import type { UserRole } from "../../src/constants/roles";
import type { M51aHandlingClassCode } from "../m51a/operations-hub";
import type { M51BIntegrationChannel } from "./shared";

export const M51B_REQUIRED_CHANNELS = Object.freeze([
  "teams",
  "outlook",
  "sharepoint",
] as const satisfies readonly M51BIntegrationChannel[]);

export const M51B_LEAST_PRIVILEGE_SCOPES = Object.freeze({
  teams: Object.freeze([
    "teams.destination.resolve.synthetic",
    "teams.notification.send.synthetic",
    "teams.acknowledgement.read.synthetic",
  ]),
  outlook: Object.freeze([
    "outlook.referral.header.read.synthetic",
    "outlook.referral.attachment.inspect.synthetic",
    "amos.intake.create.synthetic",
  ]),
  sharepoint: Object.freeze([
    "sharepoint.registry.read.synthetic",
    "sharepoint.delta.read.synthetic",
    "sharepoint.approved-item.sync.synthetic",
  ]),
} as const satisfies Readonly<Record<M51BIntegrationChannel, readonly string[]>>);

export interface M51BIdentityMappingControl {
  serverDerivedIdentity: true;
  canonicalRoleRequired: true;
  stableAmosObjectIdRequired: boolean;
  microsoftLocatorIsMutableReference: true;
  callerSuppliedAuthorityDenied: true;
}

export interface M51BConsentControl {
  policy: "minimum_necessary_internal" | "validated_referral_context" | "repository_authority_gate";
  consentOrAuthorityRequired: true;
  bypassAvailable: false;
  liveConsentGranted: false;
}

export interface M51BRetryControl {
  maximumAttempts: 4;
  retryableClasses: readonly ["throttle", "transient"];
  nonRetryableClasses: readonly ["permission", "privacy", "validation", "conflict"];
  idempotencyRequired: true;
  deadLetterRequired: true;
  operationalAlertRequired: true;
}

export interface M51BAccessReviewControl {
  cadence: "quarterly";
  lastReviewedAt: string;
  nextReviewDueAt: string;
  reviewedByRole: UserRole;
  leastPrivilegeConfirmed: true;
  exceptions: readonly [];
}

export interface M51BSupportOwnership {
  workflowOwnerRole: UserRole;
  dataOwnerRole: UserRole;
  integrationOwnerRole: UserRole;
  privacySecurityOwnerRole: UserRole;
  supportOwnerRole: UserRole;
  escalationQueue: string;
  recoveryRunbookRef: string;
}

export interface M51BIntegrationContract {
  contractId: string;
  channel: M51BIntegrationChannel;
  sourceSystem: string;
  targetSystem: string;
  purpose: string;
  tenantBoundary: "SYNTHETIC-ADOLBI-NONPRODUCTION-TENANT";
  permittedSensitivity: readonly M51aHandlingClassCode[];
  prohibitedPayloadClasses: readonly string[];
  identity: Readonly<M51BIdentityMappingControl>;
  consent: Readonly<M51BConsentControl>;
  retry: Readonly<M51BRetryControl>;
  support: Readonly<M51BSupportOwnership>;
  leastPrivilegeScopes: readonly string[];
  managedSecretReference: string;
  secretMaterialPresent: false;
  productionCredentialReadAvailable: false;
  liveConsentMutationAvailable: false;
  accessReview: Readonly<M51BAccessReviewControl>;
  approved: true;
  synthetic: true;
}

export interface M51BPrivacyThreatControl {
  threatId: string;
  channel: M51BIntegrationChannel | "integration";
  threat: string;
  controls: readonly string[];
  residualRisk: "low";
  approved: true;
  synthetic: true;
}

export interface M51BGovernanceEvaluation {
  contracts: readonly Readonly<M51BIntegrationContract>[];
  privacyThreatControls: readonly Readonly<M51BPrivacyThreatControl>[];
  validationErrors: readonly string[];
  totals: Readonly<{
    contracts: number;
    requiredChannels: number;
    leastPrivilegeScopes: number;
    accessReviews: number;
    privacyThreatControls: number;
    liveCredentials: 0;
    liveConsentMutations: 0;
    productionRows: 0;
    liveWrites: 0;
  }>;
  accepted: boolean;
  synthetic: true;
}
