import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";

import {
  M42_SEARCH_ACCEPTANCE_TARGET_MS,
  M42_SEARCH_CORPUS_APPROVED_AT,
  M42_SEARCH_CORPUS_ID,
  M42_SEARCH_CORPUS_VERSION,
  M42_SEARCH_EVIDENCE_CLASS,
  M42_SEARCH_PERFORMANCE_DOCUMENT_COUNT,
  M42_SEARCH_PERFORMANCE_QUERY_COUNT,
  M42_SEARCH_PROTECTED_METADATA_FIELDS,
  M42_SEARCH_PUBLIC_METADATA_FIELDS,
  type M42SearchActorContext,
  type M42SearchDocument,
  type M42SearchLatencySample,
  type M42SearchMetadata,
  type M42SearchMetadataField,
  type M42SearchMetadataValue,
  type M42SearchPerformanceQuery,
  type M42SearchPerformanceResult,
  type M42SearchProtectedMetadataField,
  type M42SearchQuery,
  type M42SearchResponse,
  type M42SearchResultItem,
} from "../../../contracts/m42/search";

export const M42_SEARCH_PROTECTED_METADATA_POLICY: Readonly<
  Record<M42SearchProtectedMetadataField, string>
> = {
  sensitivityLabel: "metadata:sensitivity:read",
  syntheticMatterCode: "metadata:matter-code:read",
  syntheticProgramCode: "metadata:program-code:read",
};

// This value is pinned to the canonical JSON emitted by
// createApprovedM42SearchPerformanceCorpus(). A corpus edit must deliberately
// establish a new version and checksum before it can be accepted.
export const M42_APPROVED_SEARCH_CORPUS_SHA256 =
  "7707d39081edab9b09a278fb80dabbf0c5c052b466e735e895059db8e8d9a20f" as const;

const PERFORMANCE_TOPICS = [
  "retention",
  "legal-hold",
  "source-authority",
  "approval-routing",
  "version-control",
  "permission-trimming",
  "disclosure-audit",
  "controlled-export",
  "report-lineage",
  "configuration-rollback",
  "metadata-taxonomy",
  "knowledge-citation",
] as const;

const PERFORMANCE_DIVISIONS = [
  "enterprise-operations",
  "clinical-operations",
  "quality-compliance",
  "finance-administration",
] as const;

const PERFORMANCE_DOCUMENT_TYPES = [
  "policy",
  "procedure",
  "work-instruction",
  "reference",
] as const;

const PERFORMANCE_LIBRARIES = [
  "policy-library",
  "operations-library",
  "quality-library",
] as const;

const PERFORMANCE_SEGMENTS = ["enterprise", "clinical", "executive"] as const;

interface ProjectedSearchDocument {
  id: string;
  title: string;
  body: string;
  metadata: M42SearchMetadata;
  citationSource: M42SearchDocument["citationSource"];
}

interface ScoredSearchDocument extends ProjectedSearchDocument {
  score: number;
}

function normalize(value: string): string {
  return value
    .toLocaleLowerCase("en-US")
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(value: string): readonly string[] {
  const normalized = normalize(value);
  return normalized.length === 0
    ? []
    : [...new Set(normalized.split(/\s+/).filter((token) => token.length > 1))];
}

function metadataValueText(value: M42SearchMetadataValue | undefined): string {
  if (value === undefined) return "";
  return typeof value === "string" ? value : value.join(" ");
}

function includesAll<T>(
  available: readonly T[],
  required: readonly T[],
): boolean {
  const availableSet = new Set(available);
  return required.every((value) => availableSet.has(value));
}

function canReadProtectedMetadata(
  actor: M42SearchActorContext,
  field: M42SearchProtectedMetadataField,
): boolean {
  return actor.entitlements.includes(
    M42_SEARCH_PROTECTED_METADATA_POLICY[field],
  );
}

function canReadDocument(
  document: M42SearchDocument,
  actor: M42SearchActorContext,
): boolean {
  return (
    actor.allowedLibraryIds.includes(document.libraryId) &&
    actor.allowedClassifications.includes(document.access.classification) &&
    actor.allowedSegmentIds.includes(document.access.segmentId) &&
    includesAll(actor.entitlements, document.access.requiredEntitlements)
  );
}

/**
 * The sole authorization boundary for the search pipeline. It reads only the
 * document access envelope and returns no excluded identifiers or metadata.
 */
export function permissionTrimM42SearchDocuments(
  documents: readonly M42SearchDocument[],
  actor: M42SearchActorContext,
): readonly M42SearchDocument[] {
  return documents.filter((document) => canReadDocument(document, actor));
}

function projectAuthorizedMetadata(
  metadata: M42SearchMetadata,
  actor: M42SearchActorContext,
): M42SearchMetadata {
  const projected: Partial<
    Record<M42SearchMetadataField, M42SearchMetadataValue>
  > = {};

  for (const field of M42_SEARCH_PUBLIC_METADATA_FIELDS) {
    const value = metadata[field];
    if (value !== undefined) projected[field] = value;
  }
  for (const field of M42_SEARCH_PROTECTED_METADATA_FIELDS) {
    const value = metadata[field];
    if (value !== undefined && canReadProtectedMetadata(actor, field)) {
      projected[field] = value;
    }
  }
  return projected;
}

function assertQueryIsAuthorized(
  query: M42SearchQuery,
  actor: M42SearchActorContext,
): void {
  for (const field of M42_SEARCH_PROTECTED_METADATA_FIELDS) {
    if (
      query.metadataFilters?.[field] !== undefined &&
      !canReadProtectedMetadata(actor, field)
    ) {
      throw new Error("M42_SEARCH_FILTER_NOT_AUTHORIZED");
    }
  }
}

function metadataMatchesFilters(
  metadata: M42SearchMetadata,
  filters: M42SearchQuery["metadataFilters"],
): boolean {
  if (filters === undefined) return true;
  return Object.entries(filters).every(([field, acceptedValues]) => {
    if (acceptedValues === undefined || acceptedValues.length === 0)
      return true;
    const value = metadata[field as M42SearchMetadataField];
    const actualValues = Array.isArray(value)
      ? value
      : value === undefined
        ? []
        : [value];
    const normalizedActual = new Set(
      actualValues.map((item) => normalize(item)),
    );
    return acceptedValues.some((item) => normalizedActual.has(normalize(item)));
  });
}

function scoreDocument(
  document: ProjectedSearchDocument,
  queryText: string,
): number {
  const queryTerms = tokens(queryText);
  if (queryTerms.length === 0) return 1;

  const normalizedQuery = normalize(queryText);
  const normalizedTitle = normalize(document.title);
  const normalizedBody = normalize(document.body);
  const normalizedMetadata = normalize(
    Object.values(document.metadata).map(metadataValueText).join(" "),
  );
  let score = 0;

  if (normalizedQuery.length > 0 && normalizedTitle.includes(normalizedQuery)) {
    score += 12;
  }
  if (normalizedQuery.length > 0 && normalizedBody.includes(normalizedQuery)) {
    score += 6;
  }
  for (const term of queryTerms) {
    if (normalizedTitle.split(" ").includes(term)) score += 8;
    if (normalizedBody.split(" ").includes(term)) score += 2;
    if (normalizedMetadata.split(" ").includes(term)) score += 4;
  }
  return score;
}

export function searchM42Documents(
  documents: readonly M42SearchDocument[],
  actor: M42SearchActorContext,
  query: M42SearchQuery,
  corpusId = M42_SEARCH_CORPUS_ID,
): M42SearchResponse {
  assertQueryIsAuthorized(query, actor);
  if (
    tokens(query.text ?? "").length === 0 &&
    query.metadataFilters === undefined
  ) {
    throw new Error("M42_SEARCH_QUERY_REQUIRED");
  }

  // Security invariant: only this permission-trimmed collection can enter
  // metadata projection, matching, ranking, or citation construction.
  const permissionTrimmed = permissionTrimM42SearchDocuments(documents, actor);
  const projected: readonly ProjectedSearchDocument[] = permissionTrimmed.map(
    (document) => ({
      id: document.id,
      title: document.title,
      body: document.body,
      metadata: projectAuthorizedMetadata(document.metadata, actor),
      citationSource: document.citationSource,
    }),
  );
  const matched = projected.filter((document) =>
    metadataMatchesFilters(document.metadata, query.metadataFilters),
  );
  const scored: readonly ScoredSearchDocument[] = matched
    .map((document) => ({
      ...document,
      score: scoreDocument(document, query.text ?? ""),
    }))
    .filter((document) => document.score > 0);
  const ranked = [...scored].sort(
    (left, right) =>
      right.score - left.score || left.id.localeCompare(right.id),
  );
  const limit = Math.min(100, Math.max(1, Math.trunc(query.limit ?? 20)));
  const selected = ranked.slice(0, limit);
  const results: readonly M42SearchResultItem[] = selected.map((document) => ({
    documentId: document.id,
    title: document.title,
    score: document.score,
    metadata: document.metadata,
    citation: {
      documentId: document.id,
      title: document.title,
      ...document.citationSource,
      synthetic: true,
    },
    synthetic: true,
  }));

  return {
    corpusId,
    query,
    results,
    trace: [
      {
        stage: "permission_trim",
        sequence: 1,
        inputCount: documents.length,
        outputCount: permissionTrimmed.length,
      },
      {
        stage: "metadata_projection",
        sequence: 2,
        inputCount: permissionTrimmed.length,
        outputCount: projected.length,
      },
      {
        stage: "query_match",
        sequence: 3,
        inputCount: projected.length,
        outputCount: scored.length,
      },
      {
        stage: "ranking",
        sequence: 4,
        inputCount: scored.length,
        outputCount: ranked.length,
      },
      {
        stage: "citation_projection",
        sequence: 5,
        inputCount: selected.length,
        outputCount: results.length,
      },
    ],
    permissionTrimmedBeforeRanking: true,
    permissionTrimmedBeforeCitation: true,
    externalWriteAttempted: false,
    evidenceClass: M42_SEARCH_EVIDENCE_CLASS,
  };
}

export function createApprovedM42SearchPerformanceCorpus(): readonly M42SearchDocument[] {
  return Array.from(
    { length: M42_SEARCH_PERFORMANCE_DOCUMENT_COUNT },
    (_, zeroBasedIndex) => {
      const sequence = zeroBasedIndex + 1;
      const topic =
        PERFORMANCE_TOPICS[zeroBasedIndex % PERFORMANCE_TOPICS.length];
      const division =
        PERFORMANCE_DIVISIONS[zeroBasedIndex % PERFORMANCE_DIVISIONS.length];
      const documentType =
        PERFORMANCE_DOCUMENT_TYPES[
          zeroBasedIndex % PERFORMANCE_DOCUMENT_TYPES.length
        ];
      const libraryId =
        PERFORMANCE_LIBRARIES[zeroBasedIndex % PERFORMANCE_LIBRARIES.length];
      const segmentId =
        PERFORMANCE_SEGMENTS[zeroBasedIndex % PERFORMANCE_SEGMENTS.length];
      const classification =
        sequence % 11 === 0
          ? ("restricted" as const)
          : sequence % 5 === 0
            ? ("public" as const)
            : ("internal" as const);
      const paddedSequence = String(sequence).padStart(4, "0");

      return {
        id: `SYN-M42-DOC-${paddedSequence}`,
        libraryId,
        title: `Synthetic ${topic} ${documentType} ${paddedSequence}`,
        body:
          `Fictional demonstration guidance for ${topic}. ` +
          `This ${documentType} belongs to ${division} and exercises deterministic ` +
          `full text retrieval, metadata filtering, permission trimming, and citation projection. ` +
          `Unique evaluation token corpus-${paddedSequence}.`,
        metadata: {
          documentType,
          division,
          lifecycle: sequence % 7 === 0 ? "review" : "approved",
          ownerRole: `${division}-owner`,
          tags: [topic, "synthetic", `cohort-${sequence % 20}`],
          sensitivityLabel:
            classification === "restricted"
              ? "restricted-demo"
              : "standard-demo",
          syntheticMatterCode: `MATTER-${String(sequence % 37).padStart(2, "0")}`,
          syntheticProgramCode: `PROGRAM-${String(sequence % 13).padStart(2, "0")}`,
        },
        access: {
          classification,
          segmentId,
          requiredEntitlements:
            classification === "restricted"
              ? ["document:read", "document:restricted:read"]
              : classification === "internal"
                ? ["document:read"]
                : [],
        },
        citationSource: {
          sourceOfTruthId: `SOT-M42-${paddedSequence}`,
          sourceVersion: "1.0",
          sourceFragment: `section-${(sequence % 9) + 1}`,
        },
        synthetic: true,
      } satisfies M42SearchDocument;
    },
  );
}

export function createM42SearchPerformanceActor(): M42SearchActorContext {
  return {
    actorId: "SYN-M42-PERFORMANCE-REVIEWER",
    allowedLibraryIds: [...PERFORMANCE_LIBRARIES],
    allowedClassifications: ["public", "internal"],
    allowedSegmentIds: ["enterprise", "clinical", "executive"],
    entitlements: ["document:read"],
    synthetic: true,
  };
}

export function createApprovedM42SearchPerformanceQueries(): readonly M42SearchPerformanceQuery[] {
  return Array.from(
    { length: M42_SEARCH_PERFORMANCE_QUERY_COUNT },
    (_, index) => ({
      id: `SYN-M42-QUERY-${String(index + 1).padStart(2, "0")}`,
      query: {
        text: PERFORMANCE_TOPICS[index % PERFORMANCE_TOPICS.length],
        metadataFilters:
          index % 2 === 0
            ? {
                division: [
                  PERFORMANCE_DIVISIONS[index % PERFORMANCE_DIVISIONS.length],
                ],
              }
            : {
                documentType: [
                  PERFORMANCE_DOCUMENT_TYPES[
                    index % PERFORMANCE_DOCUMENT_TYPES.length
                  ],
                ],
              },
        limit: 25,
      },
    }),
  );
}

export function hashM42SearchCorpus(
  documents: readonly M42SearchDocument[],
): string {
  return createHash("sha256").update(JSON.stringify(documents)).digest("hex");
}

function percentile(sortedValues: readonly number[], quantile: number): number {
  if (sortedValues.length === 0) return 0;
  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.ceil(sortedValues.length * quantile) - 1),
  );
  return sortedValues[index] ?? 0;
}

function milliseconds(value: number): number {
  return Number(value.toFixed(3));
}

export function evaluateApprovedM42SearchPerformance(
  iterations = 3,
): M42SearchPerformanceResult {
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > 20) {
    throw new Error("M42_SEARCH_PERFORMANCE_ITERATIONS_INVALID");
  }

  const documents = createApprovedM42SearchPerformanceCorpus();
  const queries = createApprovedM42SearchPerformanceQueries();
  const actor = createM42SearchPerformanceActor();
  const corpusSha256 = hashM42SearchCorpus(documents);

  // Warm the deterministic pipeline once; warm-up is deliberately not scored.
  searchM42Documents(
    documents,
    actor,
    queries[0]?.query ?? { text: "retention" },
  );

  const samples: M42SearchLatencySample[] = [];
  for (let iteration = 1; iteration <= iterations; iteration += 1) {
    for (const performanceQuery of queries) {
      const startedAt = performance.now();
      const response = searchM42Documents(
        documents,
        actor,
        performanceQuery.query,
      );
      samples.push({
        queryId: performanceQuery.id,
        iteration,
        elapsedMs: milliseconds(performance.now() - startedAt),
        resultCount: response.results.length,
      });
    }
  }

  const elapsed = samples
    .map((sample) => sample.elapsedMs)
    .sort((a, b) => a - b);
  const p50Ms = milliseconds(percentile(elapsed, 0.5));
  const p95Ms = milliseconds(percentile(elapsed, 0.95));
  const maxMs = milliseconds(elapsed[elapsed.length - 1] ?? 0);
  const corpusHashVerified = corpusSha256 === M42_APPROVED_SEARCH_CORPUS_SHA256;
  const permissionTrimmedBeforeRanking = true;
  const permissionTrimmedBeforeCitation = true;

  return {
    corpusId: M42_SEARCH_CORPUS_ID,
    corpusVersion: M42_SEARCH_CORPUS_VERSION,
    approvedAt: M42_SEARCH_CORPUS_APPROVED_AT,
    frozen: true,
    documentCount: documents.length,
    queryCount: queries.length,
    sampleCount: samples.length,
    corpusSha256,
    expectedCorpusSha256: M42_APPROVED_SEARCH_CORPUS_SHA256,
    corpusHashVerified,
    targetMsExclusive: M42_SEARCH_ACCEPTANCE_TARGET_MS,
    p50Ms,
    p95Ms,
    maxMs,
    samples,
    permissionTrimmedBeforeRanking,
    permissionTrimmedBeforeCitation,
    accepted:
      corpusHashVerified &&
      maxMs < M42_SEARCH_ACCEPTANCE_TARGET_MS &&
      permissionTrimmedBeforeRanking &&
      permissionTrimmedBeforeCitation,
    externalModelCalls: 0,
    externalWrites: 0,
    evidenceClass: M42_SEARCH_EVIDENCE_CLASS,
  };
}
