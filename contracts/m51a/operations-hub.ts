import type {
  AccessAction,
  AccessDomain,
  RoleTier,
} from "../../src/constants/access-control";
import type { DivisionId } from "../../src/constants/organization";
import type { UserRole } from "../../src/constants/roles";
import { M51A_EVALUATION_AS_OF, M51A_EVIDENCE_CLASS } from "./shared";

export const M51A_HUB_EVALUATION_AS_OF = M51A_EVALUATION_AS_OF;
export const M51A_HUB_EVIDENCE_CLASS = M51A_EVIDENCE_CLASS;

export const M51A_HUB_CRITERION_IDS = [
  "M5.1A-HUB-01",
  "M5.1A-HUB-02",
  "M5.1A-HUB-03",
  "M5.1A-HUB-04",
  "M5.1A-HUB-05",
  "M5.1A-HUB-06",
] as const;
export type M51aHubCriterionId = (typeof M51A_HUB_CRITERION_IDS)[number];

export const M51A_SITE_CODES = [
  "operations-hub",
  "corporate-office",
  "bhc-operations",
  "gro-operations",
  "learning-workforce",
  "contracts-projects",
  "future-campus",
  "restricted-clinical-records",
  "restricted-sud-part2",
  "restricted-personnel",
  "restricted-payroll",
  "restricted-finance",
  "restricted-legal",
  "system-managed",
] as const;
export type M51aSiteCode = (typeof M51A_SITE_CODES)[number];

export type M51aSiteKind =
  | "communication_hub"
  | "associated_operational_site"
  | "restricted_record_zone"
  | "system_managed_zone";

export interface M51aHubSite {
  siteId: string;
  code: M51aSiteCode;
  name: string;
  kind: M51aSiteKind;
  purpose: string;
  ownerRole: UserRole;
  divisionId: DivisionId | "enterprise";
  hubAssociation:
    | "governing_hub"
    | "associated"
    | "segregated"
    | "excluded_system_managed";
  parentHubSiteId: string | null;
  sharedNavigationEligible: boolean;
  contentRollupEligible: boolean;
  generalSearchEligible: boolean;
  lifecycleBoundary: string;
  architectureState: "approved_synthetic_architecture";
  liveMicrosoftSiteId: null;
  liveProvisioningAvailable: false;
  synthetic: true;
}

export const M51A_LIBRARY_CODES = [
  "enterprise-governance-doctrine",
  "policies-sops-standards",
  "forms-templates",
  "programs-service-operations",
  "quality-compliance-safety",
  "learning-knowledge",
  "contracts-partnerships",
  "projects-change-releases",
  "published-intranet-content",
  "legacy-intake-disposition",
] as const;
export type M51aLibraryCode = (typeof M51A_LIBRARY_CODES)[number];

export const M51A_CONTENT_TYPE_CODES = [
  "controlled-policy",
  "standard-operating-procedure",
  "form-template",
  "program-manual",
  "training-competency-module",
  "contract-grant",
  "project-release-artifact",
  "meeting-decision-record",
  "quality-compliance-evidence",
  "intranet-knowledge-article",
  "general-working-document",
] as const;
export type M51aContentTypeCode =
  (typeof M51A_CONTENT_TYPE_CODES)[number];

export const M51A_METADATA_FIELD_CODES = [
  "amos_object_id",
  "document_type",
  "division",
  "department_service_line",
  "program_campus",
  "record_class",
  "sensitivity",
  "phi_part2_indicator",
  "lifecycle_status",
  "owner",
  "approver",
  "effective_date",
  "review_date",
  "retention_class",
  "source_system",
  "authoritative_record_flag",
  "intranet_state",
  "connector_state",
] as const;
export type M51aMetadataFieldCode =
  (typeof M51A_METADATA_FIELD_CODES)[number];

export const M51A_HANDLING_CLASS_CODES = [
  "internal-general",
  "internal-controlled",
  "confidential",
  "restricted-clinical",
  "restricted-sud-part2",
  "restricted-workforce-financial",
] as const;
export type M51aHandlingClassCode =
  (typeof M51A_HANDLING_CLASS_CODES)[number];

export const M51A_DOCUMENT_LIFECYCLE = [
  "Draft",
  "Review",
  "Approved",
  "Published",
  "Superseded",
  "Withdrawn",
  "Retained",
] as const;
export type M51aDocumentLifecycle =
  (typeof M51A_DOCUMENT_LIFECYCLE)[number];

export interface M51aHubLibrary {
  libraryId: string;
  code: M51aLibraryCode;
  name: string;
  siteId: string;
  purpose: string;
  ownerRole: UserRole;
  allowedContentTypes: readonly M51aContentTypeCode[];
  requiredMetadataFields: readonly M51aMetadataFieldCode[];
  defaultHandlingClass: M51aHandlingClassCode;
  permittedLifecycleStates: readonly M51aDocumentLifecycle[];
  authoritativeGuidanceEligible: boolean;
  temporaryIntakeOnly: boolean;
  generalNavigationEligible: boolean;
  liveLibraryCreationAvailable: false;
  synthetic: true;
}

export interface M51aContentTypeDefinition {
  contentTypeId: string;
  code: M51aContentTypeCode;
  name: string;
  purpose: string;
  requiredMetadataFields: readonly M51aMetadataFieldCode[];
  allowedLibraries: readonly M51aLibraryCode[];
  controlled: boolean;
  synthetic: true;
}

export interface M51aMetadataDefinition {
  fieldId: string;
  code: M51aMetadataFieldCode;
  label: string;
  valueType:
    | "string"
    | "boolean"
    | "date"
    | "choice"
    | "identity"
    | "stable_object_id";
  requiredForPublished: boolean;
  immutableAfterPublication: boolean;
  sourceOfAuthority: "AMOS-DMS";
  synthetic: true;
}

export type M51aIndexBehavior =
  | "general_permission_trimmed"
  | "permission_trimmed"
  | "metadata_only_permission_trimmed"
  | "excluded";
export type M51aDownloadBehavior =
  | "allowed_audited"
  | "controlled_audited"
  | "blocked";

export interface M51aHandlingClass {
  classId: string;
  code: M51aHandlingClassCode;
  name: string;
  syntheticPurviewLabelRef: string;
  minimumTier: RoleTier;
  auditRequired: true;
  dlpPolicyRef: string;
  indexBehavior: M51aIndexBehavior;
  downloadBehavior: M51aDownloadBehavior;
  generalHubRollupAllowed: boolean;
  permissionTrimmed: true;
  livePurviewActivation: false;
  synthetic: true;
}

export type M51aHandlingAction =
  | "general_navigation"
  | "general_rollup"
  | "index"
  | "metadata_read"
  | "content_read"
  | "download";

export interface M51aHandlingDecision {
  decisionId: string;
  handlingClass: M51aHandlingClassCode | "unknown";
  action: M51aHandlingAction;
  allowed: boolean;
  metadataOnly: boolean;
  permissionTrimmed: true;
  reasonCodes: readonly string[];
  livePolicyMutation: false;
  synthetic: true;
}

export const M51A_INTRANET_DESTINATION_CODES = [
  "home-enterprise-operations",
  "executive-command",
  "my-work-eia",
  "clinical",
  "residential-gro",
  "quality-compliance",
  "workforce-learning",
  "finance-revenue",
  "contracts-growth",
  "enterprise-dms-search",
  "system-administration",
] as const;
export type M51aIntranetDestinationCode =
  (typeof M51A_INTRANET_DESTINATION_CODES)[number];

export type M51aRouteTargetKind =
  | "hub_home"
  | "application_capability"
  | "associated_site"
  | "permission_trimmed_search"
  | "system_administration";

export interface M51aIntranetRoute {
  routeId: string;
  code: M51aIntranetDestinationCode;
  label: string;
  logicalPath: string;
  targetKind: M51aRouteTargetKind;
  targetKey: string;
  ownerRole: UserRole;
  accessDomain: AccessDomain;
  accessAction: AccessAction;
  resourceDivision: DivisionId | null;
  sourceTransparent: true;
  physicalPathIsIdentity: false;
  generalNavigation: true;
  synthetic: true;
}

export interface M51aIntranetRouteDecision {
  decisionId: string;
  routeCode: M51aIntranetDestinationCode | "unknown";
  role: string;
  allowed: boolean;
  reasonCode:
    | "ALLOW_CANONICAL_POLICY"
    | "DENY_UNKNOWN_ROLE"
    | "DENY_UNKNOWN_ROUTE"
    | "DENY_CANONICAL_POLICY"
    | "DENY_RESTRICTED_TARGET";
  logicalPath: string | null;
  targetKey: string | null;
  physicalMicrosoftUrl: null;
  permissionTrimmed: true;
  synthetic: true;
}

export interface M51aRoleRouteProjection {
  role: UserRole;
  tier: RoleTier;
  division: DivisionId;
  routes: readonly M51aIntranetRoute[];
  deniedRouteCodes: readonly M51aIntranetDestinationCode[];
  unknownRouteDisclosure: false;
  permissionTrimmed: true;
  synthetic: true;
}

export interface M51aIntranetPublishingCandidate {
  objectId: string;
  title: string;
  siteId: string;
  libraryCode: M51aLibraryCode;
  contentTypeCode: M51aContentTypeCode;
  handlingClass: M51aHandlingClassCode;
  lifecycleState: M51aDocumentLifecycle;
  approvalState: "pending" | "approved" | "rejected";
  ownerId: string;
  ownerRole: UserRole;
  approverId: string | null;
  approverRole: UserRole | null;
  effectiveAt: string | null;
  reviewDueAt: string | null;
  authoritativeRecord: boolean;
  intranetState: "not_submitted" | "review" | "published" | "withdrawn";
  sourceSystem: "AMOS-DMS";
  sourceOfTruthUri: string;
  contentHash: string;
  metadata: Readonly<Partial<Record<M51aMetadataFieldCode, unknown>>>;
  realDataUsed: false;
  synthetic: true;
}

export interface M51aPublishedCitation {
  objectId: string;
  title: string;
  sourceSystem: "AMOS-DMS";
  sourceOfTruthUri: string;
  contentHash: string;
  ownerRole: UserRole;
  approverRole: UserRole;
  effectiveAt: string;
  reviewDueAt: string;
  synthetic: true;
}

export interface M51aPublishingDecision {
  decisionId: string;
  objectId: string;
  authoritativeGuidanceEligible: boolean;
  reasonCodes: readonly string[];
  citation: M51aPublishedCitation | null;
  liveMicrosoftPublishPerformed: false;
  liveExternalWrites: 0;
  synthetic: true;
}

export interface M51aOperationsHubArchitecture {
  architectureId: string;
  name: "Adolbi Care Operations Hub";
  governingSystem: "AMOS-DMS";
  collaborationLayer: "Microsoft 365 constrained synthetic architecture";
  sharePointIsGoverningSystem: false;
  sites: readonly M51aHubSite[];
  libraries: readonly M51aHubLibrary[];
  contentTypes: readonly M51aContentTypeDefinition[];
  metadataDefinitions: readonly M51aMetadataDefinition[];
  handlingClasses: readonly M51aHandlingClass[];
  intranetRoutes: readonly M51aIntranetRoute[];
  approvedAt: string;
  approvedByRole: "managing-director";
  liveSiteProvisioning: false;
  liveExternalWrites: 0;
  realDataUsed: false;
  synthetic: true;
}

export interface M51aHubCriterionResult {
  criterionId: M51aHubCriterionId;
  passed: boolean;
  assertionCount: number;
  summary: string;
  evidenceIds: readonly string[];
}

export interface M51aHubArchitectureScenarioResult {
  scenarioId: "SYNTH-M51A-HUB-ARCHITECTURE-SCENARIO";
  executedAt: typeof M51A_HUB_EVALUATION_AS_OF;
  architecture: M51aOperationsHubArchitecture;
  topologyValidationErrors: readonly string[];
  contentModelValidationErrors: readonly string[];
  handlingValidationErrors: readonly string[];
  routeValidationErrors: readonly string[];
  roleProjections: readonly M51aRoleRouteProjection[];
  publishingDecisions: readonly M51aPublishingDecision[];
  criteria: readonly M51aHubCriterionResult[];
  accepted: boolean;
  totals: {
    sites: number;
    associatedOperationalSites: number;
    restrictedOrSystemZones: number;
    libraries: number;
    contentTypes: number;
    metadataFields: number;
    handlingClasses: number;
    intranetDestinations: number;
    canonicalRolesEvaluated: number;
    authoritativeGuidanceItems: number;
    productionRows: 0;
    liveExternalWrites: 0;
  };
  synthetic: true;
}
