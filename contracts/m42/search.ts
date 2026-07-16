export const M42_SEARCH_MILESTONE = "M4.2" as const;
export const M42_SEARCH_EVIDENCE_CLASS =
  "synthetic_document_knowledge_demo" as const;
export const M42_SEARCH_CORPUS_ID =
  "AMOS-OPS-M4.2-SEARCH-PERFORMANCE-v1" as const;
export const M42_SEARCH_CORPUS_VERSION = "1.0.0" as const;
export const M42_SEARCH_CORPUS_APPROVED_AT =
  "2026-07-15T00:00:00.000Z" as const;
export const M42_SEARCH_ACCEPTANCE_TARGET_MS = 3_000 as const;
export const M42_SEARCH_PERFORMANCE_DOCUMENT_COUNT = 2_400 as const;
export const M42_SEARCH_PERFORMANCE_QUERY_COUNT = 24 as const;

export const M42_SEARCH_CLASSIFICATIONS = [
  "public",
  "internal",
  "restricted",
] as const;
export type M42SearchClassification =
  (typeof M42_SEARCH_CLASSIFICATIONS)[number];

export const M42_SEARCH_PUBLIC_METADATA_FIELDS = [
  "documentType",
  "division",
  "lifecycle",
  "ownerRole",
  "tags",
] as const;
export type M42SearchPublicMetadataField =
  (typeof M42_SEARCH_PUBLIC_METADATA_FIELDS)[number];

export const M42_SEARCH_PROTECTED_METADATA_FIELDS = [
  "sensitivityLabel",
  "syntheticMatterCode",
  "syntheticProgramCode",
] as const;
export type M42SearchProtectedMetadataField =
  (typeof M42_SEARCH_PROTECTED_METADATA_FIELDS)[number];
export type M42SearchMetadataField =
  M42SearchPublicMetadataField | M42SearchProtectedMetadataField;

export type M42SearchMetadataValue = string | readonly string[];
export type M42SearchMetadata = Readonly<
  Partial<Record<M42SearchMetadataField, M42SearchMetadataValue>>
>;

export interface M42SearchDocumentAccess {
  classification: M42SearchClassification;
  segmentId: string;
  requiredEntitlements: readonly string[];
}

export interface M42SearchCitationSource {
  sourceOfTruthId: string;
  sourceVersion: string;
  sourceFragment: string;
}

export interface M42SearchDocument {
  id: string;
  libraryId: string;
  title: string;
  body: string;
  metadata: M42SearchMetadata;
  access: M42SearchDocumentAccess;
  citationSource: M42SearchCitationSource;
  synthetic: true;
}

export interface M42SearchActorContext {
  actorId: string;
  allowedLibraryIds: readonly string[];
  allowedClassifications: readonly M42SearchClassification[];
  allowedSegmentIds: readonly string[];
  entitlements: readonly string[];
  synthetic: true;
}

export interface M42SearchQuery {
  text?: string;
  metadataFilters?: Readonly<
    Partial<Record<M42SearchMetadataField, readonly string[]>>
  >;
  limit?: number;
}

export interface M42SearchCitation {
  documentId: string;
  title: string;
  sourceOfTruthId: string;
  sourceVersion: string;
  sourceFragment: string;
  synthetic: true;
}

export interface M42SearchResultItem {
  documentId: string;
  title: string;
  score: number;
  metadata: M42SearchMetadata;
  citation: M42SearchCitation;
  synthetic: true;
}

export type M42SearchPipelineStage =
  | "permission_trim"
  | "metadata_projection"
  | "query_match"
  | "ranking"
  | "citation_projection";

export interface M42SearchPipelineTrace {
  stage: M42SearchPipelineStage;
  sequence: number;
  inputCount: number;
  outputCount: number;
}

export interface M42SearchResponse {
  corpusId: string;
  query: M42SearchQuery;
  results: readonly M42SearchResultItem[];
  trace: readonly M42SearchPipelineTrace[];
  permissionTrimmedBeforeRanking: true;
  permissionTrimmedBeforeCitation: true;
  externalWriteAttempted: false;
  evidenceClass: typeof M42_SEARCH_EVIDENCE_CLASS;
}

export interface M42SearchPerformanceQuery {
  id: string;
  query: M42SearchQuery;
}

export interface M42SearchLatencySample {
  queryId: string;
  iteration: number;
  elapsedMs: number;
  resultCount: number;
}

export interface M42SearchPerformanceResult {
  corpusId: typeof M42_SEARCH_CORPUS_ID;
  corpusVersion: typeof M42_SEARCH_CORPUS_VERSION;
  approvedAt: typeof M42_SEARCH_CORPUS_APPROVED_AT;
  frozen: true;
  documentCount: number;
  queryCount: number;
  sampleCount: number;
  corpusSha256: string;
  expectedCorpusSha256: string;
  corpusHashVerified: boolean;
  targetMsExclusive: typeof M42_SEARCH_ACCEPTANCE_TARGET_MS;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
  samples: readonly M42SearchLatencySample[];
  permissionTrimmedBeforeRanking: boolean;
  permissionTrimmedBeforeCitation: boolean;
  accepted: boolean;
  externalModelCalls: 0;
  externalWrites: 0;
  evidenceClass: typeof M42_SEARCH_EVIDENCE_CLASS;
}

export const M42_NIL_CORPUS_ID = "AMOS-OPS-M4.2-NIL-v1" as const;
export const M42_NIL_CORPUS_VERSION = "1.0.0" as const;
export const M42_NIL_SCORING_METHOD_ID =
  "M42-NIL-DETERMINISTIC-CONCEPT-TOP1-v1" as const;
export const M42_NIL_ACCEPTANCE_ACCURACY = 0.9 as const;

export interface M42NilArticle extends M42SearchDocument {
  concepts: readonly string[];
}

export interface M42NilEvaluationCase {
  id: string;
  query: string;
  expectedDocumentId: string;
  label: string;
}

export interface M42NilSearchResult {
  documentId: string;
  title: string;
  score: number;
  matchedConcepts: readonly string[];
  citation: M42SearchCitation;
}

export interface M42NilQueryResult {
  corpusId: typeof M42_NIL_CORPUS_ID;
  scoringMethodId: typeof M42_NIL_SCORING_METHOD_ID;
  query: string;
  results: readonly M42NilSearchResult[];
  permissionTrimmedBeforeScoring: true;
  permissionTrimmedBeforeCitation: true;
  externalModelCalls: 0;
  externalWrites: 0;
}

export interface M42NilEvaluationCaseResult {
  caseId: string;
  label: string;
  query: string;
  expectedDocumentId: string;
  actualTopDocumentId: string | null;
  correct: boolean;
  elapsedMs: number;
}

export interface M42NilEvaluationResult {
  corpusId: typeof M42_NIL_CORPUS_ID;
  corpusVersion: typeof M42_NIL_CORPUS_VERSION;
  scoringMethodId: typeof M42_NIL_SCORING_METHOD_ID;
  frozen: true;
  articleCount: number;
  labeledQueryCount: number;
  corpusSha256: string;
  expectedCorpusSha256: string;
  corpusHashVerified: boolean;
  evaluationSetSha256: string;
  expectedEvaluationSetSha256: string;
  evaluationSetHashVerified: boolean;
  correctTop1Count: number;
  accuracy: number;
  threshold: typeof M42_NIL_ACCEPTANCE_ACCURACY;
  accepted: boolean;
  cases: readonly M42NilEvaluationCaseResult[];
  permissionTrimmedBeforeScoring: boolean;
  permissionTrimmedBeforeCitation: boolean;
  externalModelCalls: 0;
  externalWrites: 0;
  evidenceClass: typeof M42_SEARCH_EVIDENCE_CLASS;
}
