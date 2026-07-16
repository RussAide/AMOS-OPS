import type { RoleTier } from "../../src/constants/access-control";
import type { DivisionId } from "../../src/constants/organization";
import type { UserRole } from "../../src/constants/roles";
import type {
  M51aContentTypeCode,
  M51aHandlingClassCode,
  M51aIntranetDestinationCode,
} from "./operations-hub";
import {
  M51A_EVALUATION_AS_OF,
  type M51AEvidenceClass,
} from "./shared";

export const M51A_CONNECTOR_EVALUATION_AS_OF =
  M51A_EVALUATION_AS_OF;

export const M51A_CONNECTOR_MODES = [
  "Governed Full Integration",
  "Permission-Trimmed Reference",
  "Metadata-Only Restricted Reference",
  "Excluded/System-Managed",
] as const;
export type M51aConnectorMode = (typeof M51A_CONNECTOR_MODES)[number];

export const M51A_CONNECTOR_OPERATIONS = [
  "discover_repository",
  "metadata_read",
  "content_read",
  "search_index",
  "download",
  "reconcile",
  "metadata_write",
  "content_write",
  "publish",
  "move",
  "delete",
] as const;
export type M51aConnectorOperation =
  (typeof M51A_CONNECTOR_OPERATIONS)[number];

function connectorOperations(
  ...values: readonly M51aConnectorOperation[]
): readonly M51aConnectorOperation[] {
  return Object.freeze(values);
}

export const M51A_CONNECTOR_MODE_OPERATION_MATRIX: Readonly<
  Record<M51aConnectorMode, readonly M51aConnectorOperation[]>
> = Object.freeze({
  "Governed Full Integration": connectorOperations(
    "discover_repository",
    "metadata_read",
    "content_read",
    "search_index",
    "download",
    "reconcile",
    "metadata_write",
    "content_write",
    "publish",
    "move",
    "delete",
  ),
  "Permission-Trimmed Reference": connectorOperations(
    "discover_repository",
    "metadata_read",
    "content_read",
    "search_index",
    "download",
    "reconcile",
  ),
  "Metadata-Only Restricted Reference": connectorOperations(
    "discover_repository",
    "metadata_read",
    "search_index",
    "reconcile",
  ),
  "Excluded/System-Managed": connectorOperations("discover_repository"),
});

export const M51A_REPOSITORY_DISPOSITIONS = [
  "Retain",
  "Move",
  "Merge",
  "Publish",
  "Archive",
  "Quarantine",
  "Exclude",
] as const;
export type M51aRepositoryDisposition =
  (typeof M51A_REPOSITORY_DISPOSITIONS)[number];

export type M51aRepositoryKind =
  | "sharepoint_document_library"
  | "sharepoint_list"
  | "onedrive_workbench"
  | "system_managed_library";

export type M51aRepositoryClassification =
  | "enterprise_governance"
  | "operational_collaboration"
  | "published_knowledge"
  | "restricted_record"
  | "personal_workbench"
  | "system_managed";

export type M51aAuthoritativeStatus =
  | "amos_dms_source_of_record"
  | "governed_reference"
  | "working_copy"
  | "system_managed_non_business_record";

export interface M51aMicrosoftRepositoryLocation {
  tenantId: string;
  siteId: string;
  driveId: string;
  rootItemId: string;
  listId: string | null;
  sitePath: string;
  libraryName: string;
}

export interface M51aConnectorOwner {
  actorId: string;
  role: UserRole;
  divisionId: DivisionId | "enterprise";
  accountableTeam: string;
}

export interface M51aConnectorIntranetRoute {
  destination: M51aIntranetDestinationCode;
  routePath: string;
  visibility:
    | "general_permission_trimmed"
    | "restricted_permission_trimmed"
    | "administrative_only"
    | "excluded";
}

export interface M51aConnectorRetentionPolicy {
  policyId: string;
  scheduleCode: string;
  dispositionAuthority: "AMOS-DMS";
  legalHoldCapable: true;
  recordLockCapable: true;
  livePolicyActivation: false;
}

export interface M51aMicrosoftPermissionGrant {
  principalType: "user" | "group";
  principalId: string;
  roles: readonly ("read" | "write" | "owner")[];
  inherited: boolean;
}

export interface M51aMicrosoftPermissionSet {
  grants: readonly M51aMicrosoftPermissionGrant[];
  externalSharingAllowed: false;
  anonymousLinksAllowed: false;
  permissionSnapshotId: string;
}

export interface M51aConnectorPermissionModel {
  microsoftAclRequired: true;
  amosAuthorizationRequired: true;
  connectorModeEnforced: true;
  sensitivityPolicyEnforced: true;
  externalSharingAllowed: false;
  anonymousLinksAllowed: false;
  repositoryPermissions: M51aMicrosoftPermissionSet;
}

export interface M51aConnectorSyncConfiguration {
  method:
    | "synthetic_delta"
    | "synthetic_inventory"
    | "synthetic_metadata_inventory"
    | "excluded";
  cadence: "event_plus_daily_reconciliation" | "daily" | "manual" | "none";
  state: "ready" | "metadata_only" | "excluded" | "exception";
  checkpoint: string | null;
  lastSuccessfulReconciliationAt: string | null;
  maximumAttempts: 4;
}

export interface M51aConnectorExceptionState {
  status: "none" | "quarantined" | "owner_review_required";
  code: string | null;
  rationale: string | null;
}

export interface M51aConnectorRegistryEntry {
  connectorId: string;
  displayName: string;
  repositoryKind: M51aRepositoryKind;
  location: M51aMicrosoftRepositoryLocation;
  owner: M51aConnectorOwner;
  businessPurpose: string;
  classification: M51aRepositoryClassification;
  recordClasses: readonly string[];
  handlingClass: M51aHandlingClassCode;
  sensitivityLabelRef: string;
  dlpPolicyRef: string;
  contentTypes: readonly M51aContentTypeCode[];
  connectorMode: M51aConnectorMode;
  allowedOperations: readonly M51aConnectorOperation[];
  authoritativeStatus: M51aAuthoritativeStatus;
  disposition: M51aRepositoryDisposition;
  intranetRoute: M51aConnectorIntranetRoute;
  lifecycle: "governed" | "working" | "restricted" | "system_managed";
  retentionPolicy: M51aConnectorRetentionPolicy;
  permissionModel: M51aConnectorPermissionModel;
  sync: M51aConnectorSyncConfiguration;
  exceptionState: M51aConnectorExceptionState;
  status: "active" | "quarantined" | "excluded";
  credentialReference: null;
  liveTenantConnected: false;
  liveReadsAvailable: false;
  liveWritesAvailable: false;
  evidenceClass: M51AEvidenceClass;
  synthetic: true;
}

export const M51A_REQUIRED_CONNECTOR_REGISTRY_FIELDS = [
  "connectorId",
  "displayName",
  "repositoryKind",
  "location",
  "owner",
  "businessPurpose",
  "classification",
  "recordClasses",
  "handlingClass",
  "sensitivityLabelRef",
  "dlpPolicyRef",
  "contentTypes",
  "connectorMode",
  "allowedOperations",
  "authoritativeStatus",
  "disposition",
  "intranetRoute",
  "lifecycle",
  "retentionPolicy",
  "permissionModel",
  "sync",
  "exceptionState",
  "status",
  "credentialReference",
  "liveTenantConnected",
  "liveReadsAvailable",
  "liveWritesAvailable",
  "evidenceClass",
  "synthetic",
] as const satisfies readonly (keyof M51aConnectorRegistryEntry)[];

export type M51aPurposeOfUse =
  | "operations"
  | "treatment"
  | "payment"
  | "compliance"
  | "workforce_operations"
  | "financial_operations";

export interface M51aConnectorActorContext {
  actorId: string;
  role: UserRole;
  roleTier: RoleTier;
  divisions: readonly (DivisionId | "enterprise")[];
  amosPermissions: readonly string[];
  purposeOfUse: M51aPurposeOfUse;
  tenantId: string;
  microsoftPrincipalId: string;
  microsoftGroupIds: readonly string[];
  graphScopes: readonly string[];
  part2ConsentId: string | null;
  enterpriseEntitlements: readonly string[];
  externalGuest: boolean;
  synthetic: true;
}

export interface M51aConnectorAccessDecision {
  connectorId: string;
  stableObjectId: string | null;
  actorId: string;
  operation: M51aConnectorOperation;
  effectiveHandlingClass: M51aHandlingClassCode;
  allowed: boolean;
  metadataVisible: boolean;
  contentVisible: boolean;
  downloadable: boolean;
  concealAsNotFound: boolean;
  reasonCodes: readonly string[];
  architectureOperationAllowed: boolean;
  liveExecutionAvailable: false;
  evaluatedAt: string;
  synthetic: true;
}

export interface M51aConnectorRegistryValidationIssue {
  connectorId: string;
  code: string;
  field: string;
  message: string;
}
