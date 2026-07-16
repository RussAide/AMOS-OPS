import type { RoleTier } from "../../src/constants/access-control";
import type { DivisionId } from "../../src/constants/organization";
import type { UserRole } from "../../src/constants/roles";
import type {
  M51aContentTypeCode,
  M51aDocumentLifecycle,
  M51aHandlingClassCode,
  M51aLibraryCode,
  M51aMetadataFieldCode,
} from "./operations-hub";
import {
  M51A_CONNECTOR_MODES,
  M51A_REPOSITORY_DISPOSITIONS,
  type M51aConnectorMode,
  type M51aConnectorOperation,
  type M51aConnectorRegistryEntry,
  type M51aRepositoryDisposition,
} from "./microsoft-connectors";
import type { M51AAuditEvent, M51ADemoBoundary } from "./shared";

export const M51A_PILOT_SCENARIO_ID =
  "SYNTH-M51A-NON-SENSITIVE-PILOT" as const;
export const M51A_PILOT_EVALUATED_AT =
  "2026-07-15T13:00:00.000Z" as const;

export const M51A_PILOT_CATEGORIES = [
  "governance",
  "policy",
  "form",
  "training",
  "project-release",
  "intranet-article",
] as const;
export type M51aPilotCategory = (typeof M51A_PILOT_CATEGORIES)[number];

export const M51A_MIGRATION_DISPOSITIONS = M51A_REPOSITORY_DISPOSITIONS;
export type M51aMigrationDisposition = M51aRepositoryDisposition;

/**
 * Narrow structural connector contract used by the pilot. The connector
 * registry owns the implementation; this module consumes only these fields.
 */
export const M51A_PILOT_CONNECTOR_MODES = M51A_CONNECTOR_MODES;
export type M51aPilotConnectorMode = M51aConnectorMode;

export interface M51aPilotConnectorRecord
  extends Pick<M51aConnectorRegistryEntry, "connectorId" | "connectorMode" | "synthetic"> {
  repositoryId: string;
  allowedOperations: readonly M51aConnectorOperation[];
  readAuthority: "full" | "permission_trimmed" | "metadata_only" | "none";
  writeAuthority: "governed" | "none";
  stableObjectResolution: boolean;
  synthetic: true;
}

export interface M51aPilotVersion {
  versionId: string;
  version: string;
  contentHash: string;
  createdAt: string;
  immutable: true;
  synthetic: true;
}

export interface M51aPilotAcl {
  aclId: string;
  minimumTier: RoleTier;
  allowedDivisions: readonly (DivisionId | "enterprise")[];
  principalRefs: readonly string[];
  permissions: readonly ("metadata_read" | "content_read" | "search")[];
  aclHash: string;
  inheritedFromSource: true;
  synthetic: true;
}

export type M51aPilotMetadata = Readonly<
  Record<M51aMetadataFieldCode, string | boolean>
>;

export interface M51aPilotSourceItem {
  sourceItemId: string;
  stableObjectId: string;
  category: M51aPilotCategory;
  title: string;
  divisionId: DivisionId | "enterprise";
  sourceRepositoryId: string;
  sourceLibraryCode: M51aLibraryCode;
  targetLibraryCode: M51aLibraryCode;
  contentTypeCode: M51aContentTypeCode;
  handlingClass: "internal-general" | "internal-controlled";
  lifecycleState: "Approved" | "Published";
  disposition: "Move" | "Publish";
  versions: readonly M51aPilotVersion[];
  currentVersionId: string;
  metadata: M51aPilotMetadata;
  metadataHash: string;
  acl: M51aPilotAcl;
  sourceLink: string;
  canonicalLink: string;
  authoritative: true;
  sourceImmutable: true;
  realDataUsed: false;
  synthetic: true;
}

export interface M51aPilotTargetItem {
  targetItemId: string;
  stableObjectId: string;
  category: M51aPilotCategory;
  title: string;
  divisionId: DivisionId | "enterprise";
  targetLibraryCode: M51aLibraryCode;
  contentTypeCode: M51aContentTypeCode;
  handlingClass: "internal-general" | "internal-controlled";
  lifecycleState: "Approved" | "Published";
  disposition: "Move" | "Publish";
  versions: readonly M51aPilotVersion[];
  currentVersionId: string;
  metadata: M51aPilotMetadata;
  metadataHash: string;
  acl: M51aPilotAcl;
  sourceLink: string;
  canonicalLink: string;
  connectorId: string;
  migratedFromSourceItemId: string;
  sourcePreserved: true;
  liveMicrosoftItemId: null;
  realDataUsed: false;
  synthetic: true;
}

export interface M51aPilotReconciliation {
  sourceCount: number;
  targetCount: number;
  categoryCounts: Readonly<Record<M51aPilotCategory, number>>;
  uniqueStableObjectIds: number;
  sourceManifestHash: string;
  targetManifestHash: string;
  countMismatches: readonly string[];
  contentHashMismatches: readonly string[];
  versionMismatches: readonly string[];
  metadataMismatches: readonly string[];
  aclMismatches: readonly string[];
  stableObjectMismatches: readonly string[];
  linkMismatches: readonly string[];
  searchMismatches: readonly string[];
  dispositionMismatches: readonly string[];
  duplicateStableObjectIds: readonly string[];
  passed: boolean;
  synthetic: true;
}

export interface M51aPilotAttempt {
  attemptId: string;
  status: "failed_synthetic_checkpoint" | "completed_replay";
  processedStableObjectIds: readonly string[];
  duplicateWritesPrevented: number;
  exceptionCode: string | null;
  liveWrites: 0;
  synthetic: true;
}

export interface M51aPilotRollbackResult {
  rollbackId: string;
  targetItemsBeforeRollback: number;
  targetItemsAfterRollback: 0;
  sourceItemsBeforeRollback: number;
  sourceItemsAfterRollback: number;
  sourceManifestHashBefore: string;
  sourceManifestHashAfter: string;
  removedTargetStableObjectIds: readonly string[];
  sourceMutationCount: 0;
  sourceUnchanged: boolean;
  rollbackComplete: boolean;
  liveWrites: 0;
  synthetic: true;
}

export interface M51aPilotMigrationResult {
  scenarioId: typeof M51A_PILOT_SCENARIO_ID;
  evaluatedAt: typeof M51A_PILOT_EVALUATED_AT;
  connector: M51aPilotConnectorRecord;
  sourceItems: readonly M51aPilotSourceItem[];
  targetItems: readonly M51aPilotTargetItem[];
  attempts: readonly M51aPilotAttempt[];
  reconciliation: M51aPilotReconciliation;
  rollback: M51aPilotRollbackResult;
  auditEvents: readonly M51AAuditEvent[];
  boundary: M51ADemoBoundary;
  accepted: boolean;
  productionRows: 0;
  liveWrites: 0;
  realDataUsed: false;
  synthetic: true;
}

export const M51A_SECURITY_ACTIONS = [
  "search",
  "metadata_read",
  "content_read",
  "write",
  "ai_retrieve",
] as const;
export type M51aSecurityAction = (typeof M51A_SECURITY_ACTIONS)[number];

export interface M51aSecurityResource {
  resourceId: string;
  label: string;
  divisionId: DivisionId | "enterprise";
  handlingClass: M51aHandlingClassCode;
  connectorMode: M51aPilotConnectorMode;
  lifecycleState: M51aDocumentLifecycle;
  stale: boolean;
  synthetic: true;
}

export interface M51aSecurityActor {
  actorId: string;
  role: UserRole;
  tier: RoleTier;
  divisionId: DivisionId;
  permissions: readonly string[];
  synthetic: true;
}

export interface M51aSecurityDecision {
  decisionId: string;
  role: UserRole;
  tier: RoleTier;
  divisionId: DivisionId;
  action: M51aSecurityAction;
  requestedResourceId: string;
  disclosedResourceId: string | null;
  allowed: boolean;
  projection: "full" | "metadata_only" | "none";
  scopeAuthorized: boolean;
  modeAuthorized: boolean;
  permissionTrimmedBeforeRetrieval: true;
  staleOrWithdrawnSuppressed: boolean;
  dlpPolicyApplied: true;
  dlpDecision: "allow_controlled" | "metadata_only" | "block";
  liveWritePerformed: false;
  reasonCodes: readonly string[];
  synthetic: true;
}

export interface M51aSecuritySearchProjection {
  role: UserRole;
  tier: RoleTier;
  divisionId: DivisionId;
  visibleResourceIds: readonly string[];
  metadataOnlyResourceIds: readonly string[];
  deniedResourceIdsDisclosed: false;
  permissionTrimmedBeforeRanking: true;
  duplicateResults: number;
  staleOrWithdrawnResults: number;
  excludedResults: number;
  synthetic: true;
}

export interface M51aSecurityEvaluationResult {
  evaluationId: "SYNTH-M51A-SECURITY-EVALUATION";
  actors: readonly M51aSecurityActor[];
  resources: readonly M51aSecurityResource[];
  decisions: readonly M51aSecurityDecision[];
  searchProjections: readonly M51aSecuritySearchProjection[];
  rolesEvaluated: number;
  tiersEvaluated: readonly RoleTier[];
  divisionsEvaluated: readonly DivisionId[];
  decisionCount: number;
  metadataOnlyViolations: number;
  excludedModeViolations: number;
  staleSuppressionViolations: number;
  unauthorizedAiRetrievalViolations: number;
  liveWriteViolations: number;
  permissionLeakViolations: number;
  dlpDecisionViolations: number;
  auditEvents: readonly M51AAuditEvent[];
  boundary: M51ADemoBoundary;
  accepted: boolean;
  productionRows: 0;
  liveWrites: 0;
  realDataUsed: false;
  synthetic: true;
}
