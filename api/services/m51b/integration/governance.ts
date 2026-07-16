import { isUserRole } from "@/constants/roles";
import {
  M51B_LEAST_PRIVILEGE_SCOPES,
  M51B_REQUIRED_CHANNELS,
  type M51BGovernanceEvaluation,
  type M51BIntegrationContract,
  type M51BPrivacyThreatControl,
} from "@contracts/m51b/integration-governance";
import {
  M51B_APPROVED_TENANT_BOUNDARY,
  M51B_EVALUATION_STARTED_AT,
} from "@contracts/m51b/shared";

function immutable<T>(value: T): Readonly<T> {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>))
      immutable(child);
    Object.freeze(value);
  }
  return value;
}

const BASE_RETRY = immutable({
  maximumAttempts: 4 as const,
  retryableClasses: ["throttle", "transient"] as const,
  nonRetryableClasses: [
    "permission",
    "privacy",
    "validation",
    "conflict",
  ] as const,
  idempotencyRequired: true as const,
  deadLetterRequired: true as const,
  operationalAlertRequired: true as const,
});

const BASE_IDENTITY = immutable({
  serverDerivedIdentity: true as const,
  canonicalRoleRequired: true as const,
  stableAmosObjectIdRequired: true,
  microsoftLocatorIsMutableReference: true as const,
  callerSuppliedAuthorityDenied: true as const,
});

const BASE_ACCESS_REVIEW = immutable({
  cadence: "quarterly" as const,
  lastReviewedAt: "2026-07-01T12:00:00.000Z",
  nextReviewDueAt: "2026-10-01T12:00:00.000Z",
  reviewedByRole: "administrator" as const,
  leastPrivilegeConfirmed: true as const,
  exceptions: [] as const,
});

export function createSyntheticM51BIntegrationContracts(): readonly Readonly<M51BIntegrationContract>[] {
  return immutable([
    {
      contractId: "SYNTH-M51B-CONTRACT-TEAMS-NOTIFICATIONS",
      channel: "teams",
      sourceSystem: "AMOS-OPS governed event bus",
      targetSystem: "Microsoft Teams synthetic adapter",
      purpose: "Deliver approved minimum-necessary operational notifications and capture acknowledgement evidence.",
      tenantBoundary: M51B_APPROVED_TENANT_BOUNDARY,
      permittedSensitivity: ["internal-general", "internal-controlled"],
      prohibitedPayloadClasses: [
        "direct_youth_identifier",
        "clinical_narrative",
        "sud_part2_content",
        "workforce_financial_detail",
      ],
      identity: { ...BASE_IDENTITY, stableAmosObjectIdRequired: false },
      consent: {
        policy: "minimum_necessary_internal",
        consentOrAuthorityRequired: true,
        bypassAvailable: false,
        liveConsentGranted: false,
      },
      retry: BASE_RETRY,
      support: {
        workflowOwnerRole: "administrator",
        dataOwnerRole: "managing-director",
        integrationOwnerRole: "administrator",
        privacySecurityOwnerRole: "hr-compliance-officer",
        supportOwnerRole: "administrator",
        escalationQueue: "SYNTH-QUEUE-M51B-TEAMS-SUPPORT",
        recoveryRunbookRef: "amos-runbook://synthetic/m51b/teams-recovery",
      },
      leastPrivilegeScopes: M51B_LEAST_PRIVILEGE_SCOPES.teams,
      managedSecretReference: "vault-ref://synthetic/m51b/teams-adapter",
      secretMaterialPresent: false,
      productionCredentialReadAvailable: false,
      liveConsentMutationAvailable: false,
      accessReview: BASE_ACCESS_REVIEW,
      approved: true,
      synthetic: true,
    },
    {
      contractId: "SYNTH-M51B-CONTRACT-OUTLOOK-REFERRAL",
      channel: "outlook",
      sourceSystem: "Microsoft Outlook synthetic referral mailbox adapter",
      targetSystem: "AMOS-OPS BHC intake registry",
      purpose: "Validate an approved fictional referral envelope and create one governed synthetic intake record.",
      tenantBoundary: M51B_APPROVED_TENANT_BOUNDARY,
      permittedSensitivity: ["internal-controlled", "confidential"],
      prohibitedPayloadClasses: [
        "unvalidated_sender_body",
        "malware_attachment",
        "sud_part2_without_authority",
        "duplicate_referral_record",
      ],
      identity: BASE_IDENTITY,
      consent: {
        policy: "validated_referral_context",
        consentOrAuthorityRequired: true,
        bypassAvailable: false,
        liveConsentGranted: false,
      },
      retry: BASE_RETRY,
      support: {
        workflowOwnerRole: "intake-coordinator",
        dataOwnerRole: "bhc-director",
        integrationOwnerRole: "administrator",
        privacySecurityOwnerRole: "hr-compliance-officer",
        supportOwnerRole: "intake-coordinator",
        escalationQueue: "SYNTH-QUEUE-M51B-OUTLOOK-INTAKE-SUPPORT",
        recoveryRunbookRef: "amos-runbook://synthetic/m51b/outlook-recovery",
      },
      leastPrivilegeScopes: M51B_LEAST_PRIVILEGE_SCOPES.outlook,
      managedSecretReference: "vault-ref://synthetic/m51b/outlook-adapter",
      secretMaterialPresent: false,
      productionCredentialReadAvailable: false,
      liveConsentMutationAvailable: false,
      accessReview: BASE_ACCESS_REVIEW,
      approved: true,
      synthetic: true,
    },
    {
      contractId: "SYNTH-M51B-CONTRACT-SHAREPOINT-SYNC",
      channel: "sharepoint",
      sourceSystem: "AMOS-DMS",
      targetSystem: "Microsoft SharePoint synthetic connector adapter",
      purpose: "Synchronize approved fictional items through the accepted connector registry without changing AMOS authority.",
      tenantBoundary: M51B_APPROVED_TENANT_BOUNDARY,
      permittedSensitivity: [
        "internal-general",
        "internal-controlled",
        "confidential",
        "restricted-clinical",
        "restricted-sud-part2",
        "restricted-workforce-financial",
      ],
      prohibitedPayloadClasses: [
        "excluded_system_managed_repository",
        "unapproved_restricted_body",
        "retention_locked_item",
        "caller_supplied_source_of_truth",
      ],
      identity: BASE_IDENTITY,
      consent: {
        policy: "repository_authority_gate",
        consentOrAuthorityRequired: true,
        bypassAvailable: false,
        liveConsentGranted: false,
      },
      retry: BASE_RETRY,
      support: {
        workflowOwnerRole: "administrator",
        dataOwnerRole: "managing-director",
        integrationOwnerRole: "administrator",
        privacySecurityOwnerRole: "hr-compliance-officer",
        supportOwnerRole: "administrator",
        escalationQueue: "SYNTH-QUEUE-M51B-SHAREPOINT-SUPPORT",
        recoveryRunbookRef: "amos-runbook://synthetic/m51b/sharepoint-recovery",
      },
      leastPrivilegeScopes: M51B_LEAST_PRIVILEGE_SCOPES.sharepoint,
      managedSecretReference: "vault-ref://synthetic/m51b/sharepoint-adapter",
      secretMaterialPresent: false,
      productionCredentialReadAvailable: false,
      liveConsentMutationAvailable: false,
      accessReview: BASE_ACCESS_REVIEW,
      approved: true,
      synthetic: true,
    },
  ] satisfies M51BIntegrationContract[]);
}

export function createSyntheticM51BPrivacyThreatControls(): readonly Readonly<M51BPrivacyThreatControl>[] {
  return immutable([
    {
      threatId: "SYNTH-M51B-THREAT-TEAMS-OVERDISCLOSURE",
      channel: "teams",
      threat: "A notification exposes youth, clinical, Part 2, or workforce/financial detail beyond minimum necessity.",
      controls: ["destination_allowlist", "mention_allowlist", "payload_minimization", "restricted_class_denial"],
      residualRisk: "low",
      approved: true,
      synthetic: true,
    },
    {
      threatId: "SYNTH-M51B-THREAT-OUTLOOK-UNTRUSTED-REFERRAL",
      channel: "outlook",
      threat: "An untrusted or duplicated referral creates an intake record.",
      controls: ["sender_allowlist", "context_validation", "attachment_manifest_validation", "idempotency_key", "exception_queue"],
      residualRisk: "low",
      approved: true,
      synthetic: true,
    },
    {
      threatId: "SYNTH-M51B-THREAT-SHAREPOINT-AUTHORITY-BYPASS",
      channel: "sharepoint",
      threat: "Synchronization bypasses connector mode, stable identity, permissions, lifecycle, retention, or source of truth.",
      controls: ["connector_registry_gate", "stable_object_resolver", "permission_intersection", "retention_lock", "reconciliation"],
      residualRisk: "low",
      approved: true,
      synthetic: true,
    },
    {
      threatId: "SYNTH-M51B-THREAT-CREDENTIAL-OR-TENANT-DRIFT",
      channel: "integration",
      threat: "A workflow uses raw credentials, excessive permissions, or an unapproved tenant.",
      controls: ["managed_secret_reference_only", "least_privilege_scope_matrix", "tenant_boundary", "quarterly_access_review", "zero_live_consent"],
      residualRisk: "low",
      approved: true,
      synthetic: true,
    },
  ] satisfies M51BPrivacyThreatControl[]);
}

function blank(value: string): boolean {
  return value.trim().length === 0;
}

export function validateM51BIntegrationContracts(
  contracts: readonly M51BIntegrationContract[],
  privacyThreatControls: readonly M51BPrivacyThreatControl[] =
    createSyntheticM51BPrivacyThreatControls(),
): readonly string[] {
  const errors: string[] = [];
  const channels = contracts.map((contract) => contract.channel);
  if (
    contracts.length !== M51B_REQUIRED_CHANNELS.length ||
    new Set(channels).size !== M51B_REQUIRED_CHANNELS.length ||
    M51B_REQUIRED_CHANNELS.some((channel) => !channels.includes(channel))
  )
    errors.push("M51B_REQUIRED_CHANNEL_CONTRACTS_INCOMPLETE");

  for (const contract of contracts) {
    const prefix = `M51B_CONTRACT_${contract.channel.toUpperCase()}`;
    if (
      blank(contract.contractId) ||
      blank(contract.sourceSystem) ||
      blank(contract.targetSystem) ||
      blank(contract.purpose) ||
      blank(contract.support.escalationQueue) ||
      blank(contract.support.recoveryRunbookRef)
    )
      errors.push(`${prefix}_OWNERSHIP_OR_PURPOSE_INCOMPLETE`);
    if (
      ![
        contract.support.workflowOwnerRole,
        contract.support.dataOwnerRole,
        contract.support.integrationOwnerRole,
        contract.support.privacySecurityOwnerRole,
        contract.support.supportOwnerRole,
        contract.accessReview.reviewedByRole,
      ].every(isUserRole)
    )
      errors.push(`${prefix}_CANONICAL_OWNER_REQUIRED`);
    if (contract.tenantBoundary !== M51B_APPROVED_TENANT_BOUNDARY)
      errors.push(`${prefix}_TENANT_BOUNDARY_DENIED`);
    if (
      contract.permittedSensitivity.length === 0 ||
      contract.prohibitedPayloadClasses.length === 0 ||
      !contract.consent.consentOrAuthorityRequired ||
      contract.consent.bypassAvailable ||
      contract.consent.liveConsentGranted ||
      contract.liveConsentMutationAvailable
    )
      errors.push(`${prefix}_PRIVACY_OR_CONSENT_CONTROL_INVALID`);
    if (
      !contract.identity.serverDerivedIdentity ||
      !contract.identity.canonicalRoleRequired ||
      !contract.identity.microsoftLocatorIsMutableReference ||
      !contract.identity.callerSuppliedAuthorityDenied
    )
      errors.push(`${prefix}_IDENTITY_MAPPING_INVALID`);
    const stableAmosObjectIdExpected = contract.channel !== "teams";
    if (
      contract.identity.stableAmosObjectIdRequired !==
      stableAmosObjectIdExpected
    )
      errors.push(
        contract.channel === "teams"
          ? `${prefix}_STABLE_AMOS_OBJECT_ID_MUST_BE_FALSE`
          : `${prefix}_STABLE_AMOS_OBJECT_ID_REQUIRED`,
      );
    if (
      JSON.stringify(contract.leastPrivilegeScopes) !==
        JSON.stringify(M51B_LEAST_PRIVILEGE_SCOPES[contract.channel])
    )
      errors.push(`${prefix}_LEAST_PRIVILEGE_SCOPE_DRIFT`);
    if (
      !contract.managedSecretReference.startsWith("vault-ref://synthetic/") ||
      contract.secretMaterialPresent ||
      contract.productionCredentialReadAvailable ||
      /(?:bearer|client[_-]?secret|password|token=)/i.test(
        contract.managedSecretReference,
      )
    )
      errors.push(`${prefix}_MANAGED_SECRET_BOUNDARY_INVALID`);
    const reviewStart = Date.parse(contract.accessReview.lastReviewedAt);
    const reviewDue = Date.parse(contract.accessReview.nextReviewDueAt);
    const evaluation = Date.parse(M51B_EVALUATION_STARTED_AT);
    if (
      contract.accessReview.cadence !== "quarterly" ||
      !contract.accessReview.leastPrivilegeConfirmed ||
      contract.accessReview.exceptions.length !== 0 ||
      !Number.isFinite(reviewStart) ||
      !Number.isFinite(reviewDue) ||
      reviewStart > evaluation ||
      reviewDue <= evaluation
    )
      errors.push(`${prefix}_ACCESS_REVIEW_INVALID`);
    if (
      contract.retry.maximumAttempts !== 4 ||
      !contract.retry.idempotencyRequired ||
      !contract.retry.deadLetterRequired ||
      !contract.retry.operationalAlertRequired ||
      contract.retry.retryableClasses.join(",") !== "throttle,transient" ||
      contract.retry.nonRetryableClasses.join(",") !==
        "permission,privacy,validation,conflict"
    )
      errors.push(`${prefix}_RETRY_IDEMPOTENCY_SUPPORT_INVALID`);
    if (!contract.approved || !contract.synthetic)
      errors.push(`${prefix}_APPROVAL_OR_SYNTHETIC_BOUNDARY_INVALID`);
  }

  if (
    privacyThreatControls.length !== 4 ||
    privacyThreatControls.some(
      (control) =>
        blank(control.threatId) ||
        blank(control.threat) ||
        control.controls.length < 4 ||
        control.residualRisk !== "low" ||
        !control.approved ||
        !control.synthetic,
    )
  )
    errors.push("M51B_PRIVACY_THREAT_REVIEW_INCOMPLETE");
  return immutable([...new Set(errors)].sort());
}

export function evaluateM51BIntegrationGovernance(
  contracts: readonly M51BIntegrationContract[] =
    createSyntheticM51BIntegrationContracts(),
  privacyThreatControls: readonly M51BPrivacyThreatControl[] =
    createSyntheticM51BPrivacyThreatControls(),
): Readonly<M51BGovernanceEvaluation> {
  const validationErrors = validateM51BIntegrationContracts(
    contracts,
    privacyThreatControls,
  );
  return immutable({
    contracts: [...contracts],
    privacyThreatControls: [...privacyThreatControls],
    validationErrors,
    totals: {
      contracts: contracts.length,
      requiredChannels: M51B_REQUIRED_CHANNELS.length,
      leastPrivilegeScopes: contracts.reduce(
        (total, contract) => total + contract.leastPrivilegeScopes.length,
        0,
      ),
      accessReviews: contracts.length,
      privacyThreatControls: privacyThreatControls.length,
      liveCredentials: 0 as const,
      liveConsentMutations: 0 as const,
      productionRows: 0 as const,
      liveWrites: 0 as const,
    },
    accepted: validationErrors.length === 0,
    synthetic: true as const,
  });
}
