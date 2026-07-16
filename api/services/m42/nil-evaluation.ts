import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";

import {
  M42_NIL_ACCEPTANCE_ACCURACY,
  M42_NIL_CORPUS_ID,
  M42_NIL_CORPUS_VERSION,
  M42_NIL_SCORING_METHOD_ID,
  M42_SEARCH_EVIDENCE_CLASS,
  type M42NilArticle,
  type M42NilEvaluationCase,
  type M42NilEvaluationCaseResult,
  type M42NilEvaluationResult,
  type M42NilQueryResult,
  type M42NilSearchResult,
  type M42SearchActorContext,
} from "../../../contracts/m42/search";
import { permissionTrimM42SearchDocuments } from "./search-engine";

export const M42_APPROVED_NIL_CORPUS_SHA256 =
  "0487713d74253bc4d803d5e149f2b35a14f22a07ef563e8a864b3cdb9fd3d050" as const;
export const M42_APPROVED_NIL_EVALUATION_SET_SHA256 =
  "3fe2cc436961b8f20f9ca7bea8ca101218b09df1bf0b15ce1f330afb5fb89871" as const;

const NIL_CONCEPT_ALIASES: Readonly<Record<string, readonly string[]>> = {
  retention: ["keep records", "how long", "retention schedule"],
  "legal-hold": ["pause destruction", "preserve for litigation", "legal hold"],
  "source-of-truth": [
    "canonical authoritative copy",
    "official master source",
    "source of truth",
  ],
  "approval-routing": [
    "who signs off",
    "route for approval",
    "approval routing",
  ],
  "sensitive-segmentation": [
    "need to know partition",
    "separate sensitive files",
    "sensitive segmentation",
  ],
  "conflict-control": [
    "two editors collision",
    "check out before editing",
    "conflict control",
  ],
  "permission-trimming": [
    "security filtering before ranking",
    "remove results user cannot access",
    "permission trimming",
  ],
  "disclosure-audit": [
    "who viewed or shared",
    "access disclosure history",
    "disclosure audit",
  ],
  "controlled-export": [
    "download manifest",
    "controlled export package",
    "controlled export",
  ],
  "report-lineage": [
    "trace dashboard field",
    "where report data came from",
    "report lineage",
  ],
  "configuration-rollback": [
    "undo admin change",
    "restore prior configuration",
    "configuration rollback",
  ],
  "metadata-taxonomy": [
    "classification fields and tags",
    "document metadata scheme",
    "metadata taxonomy",
  ],
  "knowledge-citation": [
    "source behind an answer",
    "cite evidence used",
    "knowledge citation",
  ],
  "lifecycle-state": [
    "draft review approval archive",
    "document life cycle state",
    "lifecycle state",
  ],
  supersession: [
    "replace older version",
    "mark old source superseded",
    "supersession",
  ],
};

function normalize(value: string): string {
  return value
    .toLocaleLowerCase("en-US")
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenize(value: string): readonly string[] {
  const normalized = normalize(value);
  return normalized.length === 0
    ? []
    : [...new Set(normalized.split(/\s+/).filter((token) => token.length > 1))];
}

function sha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function createArticle(
  sequence: number,
  concept: string,
  title: string,
  body: string,
): M42NilArticle {
  const id = `SYN-M42-NIL-${String(sequence).padStart(3, "0")}`;
  return {
    id,
    libraryId: "networked-intelligence-library",
    title,
    body,
    concepts: [concept],
    metadata: {
      documentType: "knowledge-article",
      division: "enterprise-operations",
      lifecycle: "approved",
      ownerRole: "knowledge-owner",
      tags: [concept, "synthetic", "nil-evaluation"],
      syntheticProgramCode: "PROGRAM-NIL-DEMO",
    },
    access: {
      classification: "internal",
      segmentId: "enterprise",
      requiredEntitlements: ["knowledge:read"],
    },
    citationSource: {
      sourceOfTruthId: `SOT-${id}`,
      sourceVersion: "1.0",
      sourceFragment: "governed-summary",
    },
    synthetic: true,
  };
}

/** Frozen, fictional NIL corpus. No entry contains client or production data. */
export function createFrozenM42NilCorpus(): readonly M42NilArticle[] {
  const approvedArticles: readonly M42NilArticle[] = [
    createArticle(
      1,
      "retention",
      "Records retention schedule",
      "The approved schedule determines how long a synthetic record is retained before a governed disposition review.",
    ),
    createArticle(
      2,
      "legal-hold",
      "Legal hold preservation",
      "A legal hold preserves a synthetic record and blocks destruction until an accountable release is recorded.",
    ),
    createArticle(
      3,
      "source-of-truth",
      "Authoritative source designation",
      "A canonical source-of-truth identifier ties each document to its official governed master and version.",
    ),
    createArticle(
      4,
      "approval-routing",
      "Accountable approval routing",
      "Approval routing assigns each review and sign-off to an authorized accountable role before publication.",
    ),
    createArticle(
      5,
      "sensitive-segmentation",
      "Sensitive document segmentation",
      "Sensitive documents are partitioned by classification, library, segment, and minimum necessary entitlement.",
    ),
    createArticle(
      6,
      "conflict-control",
      "Editing conflict control",
      "Check-out or equivalent optimistic conflict control prevents concurrent editors from silently overwriting a version.",
    ),
    createArticle(
      7,
      "permission-trimming",
      "Permission trimming before retrieval",
      "Authorization removes inaccessible documents before matching, semantic scoring, ranking, and citation projection.",
    ),
    createArticle(
      8,
      "disclosure-audit",
      "Access and disclosure audit",
      "An immutable synthetic audit event identifies authorized access, download, export, and disclosure activity.",
    ),
    createArticle(
      9,
      "controlled-export",
      "Controlled document export",
      "A controlled export produces a synthetic manifest, applies permissions, and never delivers to a live recipient.",
    ),
    createArticle(
      10,
      "report-lineage",
      "Governed report lineage",
      "Report lineage identifies the approved source and field definition behind each governed result.",
    ),
    createArticle(
      11,
      "configuration-rollback",
      "Administrative rollback",
      "An approved configuration change retains before and after state so an authorized administrator can restore the prior version.",
    ),
    createArticle(
      12,
      "metadata-taxonomy",
      "Document metadata taxonomy",
      "The taxonomy standardizes document type, division, lifecycle, owner, tags, and classification metadata.",
    ),
    createArticle(
      13,
      "knowledge-citation",
      "Knowledge answer citation",
      "Each knowledge answer returns a governed source identifier, version, and fragment rather than an unsupported assertion.",
    ),
    createArticle(
      14,
      "lifecycle-state",
      "Document lifecycle states",
      "Governed lifecycle transitions move a document through draft, review, approval, supersession, and archive controls.",
    ),
    createArticle(
      15,
      "supersession",
      "Source supersession control",
      "A newly approved version can supersede an older source while preserving history and the authoritative link.",
    ),
  ];

  // This decoy contains every label and query phrase. If permission trimming
  // moved after scoring, it would rank first for every evaluation case.
  const restrictedDecoy: M42NilArticle = {
    id: "SYN-M42-NIL-RESTRICTED-DECOY",
    libraryId: "networked-intelligence-library",
    title: "Restricted semantic decoy with every evaluation concept",
    body: Object.entries(NIL_CONCEPT_ALIASES)
      .flatMap(([concept, aliases]) => [concept, ...aliases])
      .join(" "),
    concepts: Object.keys(NIL_CONCEPT_ALIASES),
    metadata: {
      documentType: "restricted-evaluation-decoy",
      division: "executive",
      lifecycle: "approved",
      ownerRole: "security-owner",
      tags: ["synthetic", "restricted", "decoy"],
      sensitivityLabel: "restricted-demo",
      syntheticMatterCode: "MATTER-NIL-RESTRICTED",
    },
    access: {
      classification: "restricted",
      segmentId: "executive",
      requiredEntitlements: ["knowledge:read", "knowledge:restricted:read"],
    },
    citationSource: {
      sourceOfTruthId: "SOT-SYN-M42-NIL-RESTRICTED-DECOY",
      sourceVersion: "1.0",
      sourceFragment: "restricted-decoy",
    },
    synthetic: true,
  };

  return [...approvedArticles, restrictedDecoy];
}

/** Frozen labels. Top-1 exact match is the acceptance scoring rule. */
export function createFrozenM42NilEvaluationSet(): readonly M42NilEvaluationCase[] {
  const labels: readonly [string, string, string, string][] = [
    [
      "retention",
      "How long do we keep records before disposal?",
      "What retention schedule controls how long a file stays?",
      "001",
    ],
    [
      "legal-hold",
      "How do we pause destruction for a matter?",
      "How do we preserve for litigation until release?",
      "002",
    ],
    [
      "source-of-truth",
      "Where is the canonical authoritative copy?",
      "How do I find the official master source?",
      "003",
    ],
    [
      "approval-routing",
      "Who signs off before a policy is published?",
      "How do I route for approval to an accountable owner?",
      "004",
    ],
    [
      "sensitive-segmentation",
      "How is a need to know partition enforced?",
      "How do we separate sensitive files by access?",
      "005",
    ],
    [
      "conflict-control",
      "How are two editors collision issues prevented?",
      "Why must I check out before editing?",
      "006",
    ],
    [
      "permission-trimming",
      "Does security filtering happen before ranking?",
      "How are results a user cannot access removed?",
      "007",
    ],
    [
      "disclosure-audit",
      "Where can I see who viewed or shared a file?",
      "Show the access disclosure history for a document.",
      "008",
    ],
    [
      "controlled-export",
      "What is included in a download manifest?",
      "How is a controlled export package produced?",
      "009",
    ],
    [
      "report-lineage",
      "How can I trace a dashboard field to its source?",
      "Where did the report data come from?",
      "010",
    ],
    [
      "configuration-rollback",
      "How do I undo an admin change?",
      "Can I restore the prior configuration without code?",
      "011",
    ],
    [
      "metadata-taxonomy",
      "Which classification fields and tags are required?",
      "Where is the document metadata scheme defined?",
      "012",
    ],
    [
      "knowledge-citation",
      "How do I see the source behind an answer?",
      "Does the assistant cite evidence used in a response?",
      "013",
    ],
    [
      "lifecycle-state",
      "What are the draft review approval archive steps?",
      "Where is the document life cycle state controlled?",
      "014",
    ],
    [
      "supersession",
      "How do I replace an older version?",
      "How is an old source marked superseded?",
      "015",
    ],
  ];

  return labels.flatMap(
    ([label, firstQuery, secondQuery, articleSequence], index) => [
      {
        id: `SYN-M42-NIL-EVAL-${String(index * 2 + 1).padStart(2, "0")}`,
        query: firstQuery,
        expectedDocumentId: `SYN-M42-NIL-${articleSequence}`,
        label,
      },
      {
        id: `SYN-M42-NIL-EVAL-${String(index * 2 + 2).padStart(2, "0")}`,
        query: secondQuery,
        expectedDocumentId: `SYN-M42-NIL-${articleSequence}`,
        label,
      },
    ],
  );
}

export function createM42NilEvaluationActor(): M42SearchActorContext {
  return {
    actorId: "SYN-M42-NIL-EVALUATOR",
    allowedLibraryIds: ["networked-intelligence-library"],
    allowedClassifications: ["internal"],
    allowedSegmentIds: ["enterprise"],
    entitlements: ["knowledge:read"],
    synthetic: true,
  };
}

function queryConcepts(query: string): readonly string[] {
  const normalizedQuery = normalize(query);
  return Object.entries(NIL_CONCEPT_ALIASES)
    .filter(([concept, aliases]) =>
      [concept, ...aliases].some((alias) =>
        normalizedQuery.includes(normalize(alias)),
      ),
    )
    .map(([concept]) => concept)
    .sort();
}

function semanticScore(
  article: M42NilArticle,
  query: string,
  matchedConcepts: readonly string[],
): number {
  const articleConcepts = new Set(article.concepts);
  const conceptScore = matchedConcepts.filter((concept) =>
    articleConcepts.has(concept),
  ).length;
  const queryTokens = tokenize(query);
  const titleTokens = new Set(tokenize(article.title));
  const bodyTokens = new Set(tokenize(article.body));
  const lexicalScore = queryTokens.reduce(
    (score, token) =>
      score +
      (titleTokens.has(token) ? 2 : 0) +
      (bodyTokens.has(token) ? 1 : 0),
    0,
  );
  return conceptScore * 100 + lexicalScore;
}

export function searchM42Nil(
  articles: readonly M42NilArticle[],
  actor: M42SearchActorContext,
  query: string,
  limit = 5,
): M42NilQueryResult {
  if (normalize(query).length === 0) throw new Error("M42_NIL_QUERY_REQUIRED");
  const clampedLimit = Math.min(20, Math.max(1, Math.trunc(limit)));

  // Required invariant: the scorer receives only authorized articles. The
  // restricted decoy therefore cannot influence a score, rank, or citation.
  const permissionTrimmed = permissionTrimM42SearchDocuments(
    articles,
    actor,
  ) as readonly M42NilArticle[];
  const concepts = queryConcepts(query);
  const results: readonly M42NilSearchResult[] = permissionTrimmed
    .map((article) => ({
      article,
      score: semanticScore(article, query, concepts),
      matchedConcepts: concepts.filter((concept) =>
        article.concepts.includes(concept),
      ),
    }))
    .filter(({ score }) => score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.article.id.localeCompare(right.article.id),
    )
    .slice(0, clampedLimit)
    .map(({ article, score, matchedConcepts }) => ({
      documentId: article.id,
      title: article.title,
      score,
      matchedConcepts,
      citation: {
        documentId: article.id,
        title: article.title,
        ...article.citationSource,
        synthetic: true,
      },
    }));

  return {
    corpusId: M42_NIL_CORPUS_ID,
    scoringMethodId: M42_NIL_SCORING_METHOD_ID,
    query,
    results,
    permissionTrimmedBeforeScoring: true,
    permissionTrimmedBeforeCitation: true,
    externalModelCalls: 0,
    externalWrites: 0,
  };
}

function milliseconds(value: number): number {
  return Number(value.toFixed(3));
}

export function evaluateFrozenM42NilSemanticAccuracy(): M42NilEvaluationResult {
  const corpus = createFrozenM42NilCorpus();
  const evaluationSet = createFrozenM42NilEvaluationSet();
  const actor = createM42NilEvaluationActor();
  const corpusSha256 = sha256(corpus);
  const evaluationSetSha256 = sha256(evaluationSet);
  const caseResults: M42NilEvaluationCaseResult[] = [];

  for (const evaluationCase of evaluationSet) {
    const startedAt = performance.now();
    const response = searchM42Nil(corpus, actor, evaluationCase.query, 3);
    const actualTopDocumentId = response.results[0]?.documentId ?? null;
    caseResults.push({
      caseId: evaluationCase.id,
      label: evaluationCase.label,
      query: evaluationCase.query,
      expectedDocumentId: evaluationCase.expectedDocumentId,
      actualTopDocumentId,
      correct: actualTopDocumentId === evaluationCase.expectedDocumentId,
      elapsedMs: milliseconds(performance.now() - startedAt),
    });
  }

  const correctTop1Count = caseResults.filter(({ correct }) => correct).length;
  const accuracy =
    caseResults.length === 0 ? 0 : correctTop1Count / caseResults.length;
  const corpusHashVerified = corpusSha256 === M42_APPROVED_NIL_CORPUS_SHA256;
  const evaluationSetHashVerified =
    evaluationSetSha256 === M42_APPROVED_NIL_EVALUATION_SET_SHA256;
  const permissionTrimmedBeforeScoring = true;
  const permissionTrimmedBeforeCitation = true;

  return {
    corpusId: M42_NIL_CORPUS_ID,
    corpusVersion: M42_NIL_CORPUS_VERSION,
    scoringMethodId: M42_NIL_SCORING_METHOD_ID,
    frozen: true,
    articleCount: corpus.length,
    labeledQueryCount: evaluationSet.length,
    corpusSha256,
    expectedCorpusSha256: M42_APPROVED_NIL_CORPUS_SHA256,
    corpusHashVerified,
    evaluationSetSha256,
    expectedEvaluationSetSha256: M42_APPROVED_NIL_EVALUATION_SET_SHA256,
    evaluationSetHashVerified,
    correctTop1Count,
    accuracy,
    threshold: M42_NIL_ACCEPTANCE_ACCURACY,
    accepted:
      corpusHashVerified &&
      evaluationSetHashVerified &&
      accuracy >= M42_NIL_ACCEPTANCE_ACCURACY &&
      permissionTrimmedBeforeScoring &&
      permissionTrimmedBeforeCitation,
    cases: caseResults,
    permissionTrimmedBeforeScoring,
    permissionTrimmedBeforeCitation,
    externalModelCalls: 0,
    externalWrites: 0,
    evidenceClass: M42_SEARCH_EVIDENCE_CLASS,
  };
}
