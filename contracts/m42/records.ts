import type { DivisionId } from "../../src/constants/organization";
import type { UserRole } from "../../src/constants/roles";
import type {
  M42ActorContext,
  M42AuditEvent,
  M42RecordState,
  M42SensitivityLevel,
} from "./shared";

export const M42_DOCUMENT_TYPES = [
  "policy",
  "procedure",
  "form",
  "clinical_reference",
  "training_material",
  "operations_record",
  "governance_record",
] as const;
export type M42DocumentType = (typeof M42_DOCUMENT_TYPES)[number];

export const M42_DOCUMENT_ACTIONS = [
  "metadata_read",
  "content_read",
  "download",
  "export",
  "disclose",
  "checkout",
  "approve",
  "legal_hold",
] as const;
export type M42DocumentAction = (typeof M42_DOCUMENT_ACTIONS)[number];

export interface M42TaxonomyNode {
  taxonomyId: string;
  parentTaxonomyId: string | null;
  code: string;
  label: string;
  divisionId: DivisionId | "enterprise";
  allowedDocumentTypes: readonly M42DocumentType[];
  defaultClassification: M42SensitivityLevel;
  defaultRetentionScheduleId: string;
  ownerRole: UserRole;
  active: true;
  synthetic: true;
}

export interface M42RetentionSchedule {
  scheduleId: string;
  code: string;
  title: string;
  trigger: "superseded" | "withdrawn" | "published" | "fiscal_year_close";
  retentionYears: number;
  dispositionMethod: "synthetic_review";
  approvalRoles: readonly UserRole[];
  legalHoldOverride: true;
  productionDispositionAvailable: false;
  synthetic: true;
}

export interface M42LegalHold {
  holdId: string;
  reason: string;
  matterReference: string;
  appliedBy: string;
  appliedByRole: UserRole;
  appliedAt: string;
  releasedAt: string | null;
  active: boolean;
  productionEffect: false;
  synthetic: true;
}

export interface M42ApprovalStep {
  step: number;
  requiredRole: UserRole;
  decision: "pending" | "approved" | "rejected";
  decidedBy: string | null;
  decidedAt: string | null;
  rationale: string | null;
}

export interface M42ApprovalRoute {
  routeId: string;
  requestedBy: string;
  requestedAt: string;
  steps: readonly M42ApprovalStep[];
  status: "pending" | "approved" | "rejected";
  completedAt: string | null;
  synthetic: true;
}

export interface M42SourceOfTruthLink {
  stableObjectId: string;
  canonicalUri: string;
  canonicalRepository: "amos_ops_synthetic_dms";
  currentVersionId: string;
  contentHash: string;
  supersedesStableObjectId: string | null;
  supersededByStableObjectId: string | null;
  externalWriteAvailable: false;
  synthetic: true;
}

export interface M42DocumentRecord {
  documentId: string;
  stableObjectId: string;
  title: string;
  description: string;
  documentType: M42DocumentType;
  taxonomyId: string;
  divisionId: DivisionId | "enterprise";
  ownerId: string;
  ownerRole: UserRole;
  classification: M42SensitivityLevel;
  lifecycleState: M42RecordState;
  currentVersion: string;
  currentVersionId: string;
  retentionScheduleId: string;
  effectiveAt: string;
  reviewDueAt: string;
  tags: readonly string[];
  approvalRoute: M42ApprovalRoute | null;
  legalHolds: readonly M42LegalHold[];
  sourceOfTruth: M42SourceOfTruthLink;
  downloadEnabled: boolean;
  exportEnabled: boolean;
  productionDispositionAvailable: false;
  evidenceClass: "synthetic_document_knowledge_demo";
  synthetic: true;
}

export interface M42DocumentRegistry {
  taxonomy: readonly M42TaxonomyNode[];
  retentionSchedules: readonly M42RetentionSchedule[];
  documents: readonly M42DocumentRecord[];
  auditEvents: readonly M42AuditEvent[];
  frozenAt: string;
  productionRepositoryConnected: false;
  synthetic: true;
}

export interface M42DispositionPreview {
  documentId: string;
  scheduleId: string;
  evaluatedAt: string;
  retentionComplete: boolean;
  legalHoldActive: boolean;
  eligibleForSyntheticReview: boolean;
  dispositionExecuted: false;
  reasons: readonly string[];
  approvalRoles: readonly UserRole[];
  productionDispositionAvailable: false;
}

export interface M42DocumentAccessDecision {
  decisionId: string;
  documentId: string;
  actorId: string;
  action: M42DocumentAction;
  allowed: boolean;
  reasonCodes: readonly string[];
  permissionTrimmed: boolean;
  metadataVisible: boolean;
  contentVisible: boolean;
  downloadable: boolean;
  exportManifestOnly: boolean;
  liveDisclosureAvailable: false;
  evaluatedAt: string;
  auditEvent: M42AuditEvent;
}

export interface M42DisclosureLedger {
  events: readonly M42AuditEvent[];
  appendOnly: true;
  synthetic: true;
}

export interface M42ExportManifest {
  manifestId: string;
  requestedBy: string;
  requestedAt: string;
  documentIds: readonly string[];
  versionIds: readonly string[];
  contentHashes: readonly string[];
  deniedDocumentIds: readonly string[];
  recipientDelivery: false;
  binaryContentIncluded: false;
  liveRepositoryWrite: false;
  synthetic: true;
  auditEvents: readonly M42AuditEvent[];
}

export interface M42VersionEntry {
  versionId: string;
  documentId: string;
  version: string;
  baseVersionId: string | null;
  contentHash: string;
  changeSummary: string;
  createdBy: string;
  createdByRole: UserRole;
  createdAt: string;
  status: "draft" | "in_review" | "approved" | "published" | "superseded";
  approvalRoute: M42ApprovalRoute | null;
  immutableAfterPublish: boolean;
  synthetic: true;
}

export interface M42CheckoutLock {
  lockId: string;
  documentId: string;
  versionId: string;
  checkedOutBy: string;
  checkedOutAt: string;
  expiresAt: string;
  releasedAt: string | null;
  active: boolean;
  synthetic: true;
}

export interface M42VersionLedger {
  document: M42DocumentRecord;
  versions: readonly M42VersionEntry[];
  locks: readonly M42CheckoutLock[];
  auditEvents: readonly M42AuditEvent[];
  appendOnlyHistory: true;
  synthetic: true;
}

export interface M42CheckoutResult {
  ledger: M42VersionLedger;
  lock: M42CheckoutLock;
}

export interface M42CheckinInput {
  actor: M42ActorContext;
  lockId: string;
  expectedBaseVersionId: string;
  contentHash: string;
  changeSummary: string;
  checkedInAt?: string;
}
