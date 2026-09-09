export const ASK_AMOS_MEDICAL_RECORD_PREVIEW_SCENARIOS = [
  "authorized",
  "denied",
  "authority_conflict",
  "backend_stale",
  "superseded_protected",
] as const;

export type AskAmosMedicalRecordPreviewScenario =
  (typeof ASK_AMOS_MEDICAL_RECORD_PREVIEW_SCENARIOS)[number];

export type AskAmosMedicalRecordPreviewOutcome =
  | "AUTHORIZED"
  | "DENIED"
  | "AUTHORITY_CONFLICT"
  | "NO_CONTROLLING_RECORD"
  | "BACKEND_STALE";

export interface AskAmosMedicalRecordPreviewTraceStep {
  step: string;
  status: "PASS" | "BLOCKED" | "NOT_REACHED";
  detail: string;
}

export interface AskAmosMedicalRecordPreviewRecord {
  recordKey: string;
  documentId: string;
  recordClass: "MEDICAL_RECORD";
  authorityState: "CURRENT_CONTROLLING";
  governingVersion: string;
  youthLabel: string;
  recordType: string;
  reviewedAt: string;
  summary: string;
  facts: readonly string[];
  nextActions: readonly string[];
}

export interface AskAmosMedicalRecordPreviewBackend {
  stableObjectId: string;
  name: string;
  tenantHost: string;
  siteId: string;
  driveId: string;
  itemId: string;
  integrityVerified: boolean;
}

export interface AskAmosMedicalRecordPreviewResult {
  environment: "SYNTHETIC_PREVIEW";
  noPhi: true;
  scenario: AskAmosMedicalRecordPreviewScenario;
  outcome: AskAmosMedicalRecordPreviewOutcome;
  code: string;
  title: string;
  answer: string;
  controlNotice: string;
  record: AskAmosMedicalRecordPreviewRecord | null;
  backend: AskAmosMedicalRecordPreviewBackend | null;
  trace: readonly AskAmosMedicalRecordPreviewTraceStep[];
  generatedAt: string;
}
