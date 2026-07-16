import {
  M51B_OUTLOOK_MAILBOX_ADDRESS,
  M51B_OUTLOOK_MAILBOX_ID,
  M51B_OUTLOOK_PROCESSING_PERMISSIONS,
  M51B_OUTLOOK_PURPOSE,
  M51B_OUTLOOK_WORKFLOW_ID,
  type M51BOutlookConsentScope,
  type M51BOutlookPolicyDecision,
  type M51BOutlookReasonCode,
  type M51BOutlookReferralEnvelope,
  type M51BOutlookSenderAllowlistEntry,
  type M51BOutlookSensitivity,
} from "@contracts/m51b/outlook";
import {
  M51B_APPROVED_TENANT_BOUNDARY,
  M51B_EVALUATION_STARTED_AT,
  M51B_EVIDENCE_CLASS,
} from "@contracts/m51b/shared";
import { visibleQueueIdsForRole } from "@contracts/ccmg/workflow";
import { ROLE_DEFINITIONS } from "@/constants/roles";

const ENVELOPE_KEYS = Object.freeze([
  "messageId",
  "internetMessageId",
  "changeKey",
  "subjectCode",
  "sentAt",
  "receivedAt",
  "sender",
  "context",
  "referral",
  "evidenceClass",
  "sourceAdapter",
  "synthetic",
  "realRecord",
  "rawBodyRead",
  "attachmentContentRead",
  "liveMailboxRead",
  "liveGraphCall",
] as const);

const SENDER_KEYS = Object.freeze([
  "senderAddress",
  "senderDirectoryObjectId",
  "senderType",
  "synthetic",
] as const);

const CONTEXT_KEYS = Object.freeze([
  "tenantBoundary",
  "mailboxId",
  "mailboxAddress",
  "workflowId",
  "purpose",
  "processingActor",
] as const);

const ACTOR_KEYS = Object.freeze([
  "actorId",
  "role",
  "divisionId",
  "permissions",
  "synthetic",
] as const);

const REFERRAL_KEYS = Object.freeze([
  "referralReference",
  "youthReference",
  "sourceOrganizationReference",
  "sourceDivision",
  "requestedService",
  "urgency",
  "referralReasonCode",
  "sensitivity",
  "consent",
] as const);

const CONSENT_KEYS = Object.freeze([
  "required",
  "status",
  "consentReference",
  "scopes",
  "verifiedAt",
  "expiresAt",
] as const);

const SENSITIVITY_RANK: Readonly<Record<M51BOutlookSensitivity, number>> =
  Object.freeze({ internal: 0, confidential: 1, restricted: 2, part2: 3 });

const CONSENT_SCOPES = new Set<M51BOutlookConsentScope>([
  "referral_intake",
  "care_coordination",
  "part2_treatment_referral",
]);

const REQUESTED_SERVICES = new Set(["CCMG", "MHTCM", "MHRS"]);
const URGENCIES = new Set(["routine", "urgent", "emergency"]);
const REASON_CODES = new Set([
  "behavioral_health_assessment",
  "care_coordination",
  "skills_support",
  "continuity_transition",
]);
const SOURCE_DIVISIONS = new Set(["BHC", "GRO", "external"]);
const SENSITIVITIES = new Set([
  "internal",
  "confidential",
  "restricted",
  "part2",
]);
const CONSENT_STATUSES = new Set([
  "not_required",
  "verified",
  "missing",
  "expired",
  "revoked",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function inspectKeys(
  value: unknown,
  allowed: readonly string[],
): { missing: boolean; extra: boolean } {
  if (!isRecord(value)) return { missing: true, extra: false };
  const actual = Object.keys(value);
  return {
    missing: allowed.some(
      (key) => !Object.prototype.hasOwnProperty.call(value, key),
    ),
    extra: actual.some((key) => !allowed.includes(key)),
  };
}

function syntheticId(value: unknown): boolean {
  return (
    typeof value === "string" &&
    /^SYNTH-[A-Z0-9][A-Z0-9._:-]*$/i.test(value.trim())
  );
}

function syntheticAddress(value: unknown): boolean {
  return (
    typeof value === "string" &&
    /^[^@\s]+@[^@\s]+\.invalid$/i.test(value.trim())
  );
}

function parsedTime(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function pushReason(
  reasons: M51BOutlookReasonCode[],
  reason: M51BOutlookReasonCode,
): void {
  if (!reasons.includes(reason)) reasons.push(reason);
}

function validShape(
  envelope: M51BOutlookReferralEnvelope,
  reasons: M51BOutlookReasonCode[],
): boolean {
  const inspections = [
    inspectKeys(envelope, ENVELOPE_KEYS),
    inspectKeys(envelope.sender, SENDER_KEYS),
    inspectKeys(envelope.context, CONTEXT_KEYS),
    inspectKeys(envelope.context?.processingActor, ACTOR_KEYS),
    inspectKeys(envelope.referral, REFERRAL_KEYS),
    inspectKeys(envelope.referral?.consent, CONSENT_KEYS),
  ];
  if (inspections.some((inspection) => inspection.missing)) {
    pushReason(reasons, "M51B_OUTLOOK_ENVELOPE_SHAPE_INVALID");
  }
  if (inspections.some((inspection) => inspection.extra)) {
    pushReason(reasons, "M51B_OUTLOOK_PAYLOAD_NOT_MINIMIZED");
  }
  return !inspections.some((inspection) => inspection.missing);
}

function validateSyntheticBoundary(
  envelope: M51BOutlookReferralEnvelope,
  reasons: M51BOutlookReasonCode[],
): void {
  if (
    envelope.synthetic !== true ||
    envelope.realRecord !== false ||
    envelope.rawBodyRead !== false ||
    envelope.attachmentContentRead !== false ||
    envelope.liveMailboxRead !== false ||
    envelope.liveGraphCall !== false ||
    envelope.evidenceClass !== M51B_EVIDENCE_CLASS ||
    envelope.sourceAdapter !== "deterministic_synthetic_outlook_event"
  ) {
    pushReason(reasons, "M51B_OUTLOOK_SYNTHETIC_BOUNDARY_DENIED");
  }

  const identifiers: unknown[] = [
    envelope.messageId,
    envelope.internetMessageId,
    envelope.changeKey,
    envelope.sender?.senderDirectoryObjectId,
    envelope.context?.processingActor?.actorId,
    envelope.referral?.referralReference,
    envelope.referral?.youthReference,
    envelope.referral?.sourceOrganizationReference,
  ];
  if (envelope.referral?.consent?.consentReference !== null) {
    identifiers.push(envelope.referral?.consent?.consentReference);
  }
  if (
    identifiers.some((identifier) => !syntheticId(identifier)) ||
    !syntheticAddress(envelope.sender?.senderAddress) ||
    !syntheticAddress(envelope.context?.mailboxAddress)
  ) {
    pushReason(reasons, "M51B_OUTLOOK_SYNTHETIC_IDENTIFIER_REQUIRED");
  }
}

function validateTimestamps(
  envelope: M51BOutlookReferralEnvelope,
  reasons: M51BOutlookReasonCode[],
): { receivedAt: number | null; evaluatedAt: string } {
  const sentAt = parsedTime(envelope.sentAt);
  const receivedAt = parsedTime(envelope.receivedAt);
  if (sentAt === null || receivedAt === null || receivedAt < sentAt) {
    pushReason(reasons, "M51B_OUTLOOK_TIMESTAMP_INVALID");
  }
  return {
    receivedAt,
    evaluatedAt: receivedAt === null ? M51B_EVALUATION_STARTED_AT : envelope.receivedAt,
  };
}

function validateContext(
  envelope: M51BOutlookReferralEnvelope,
  reasons: M51BOutlookReasonCode[],
): void {
  if (envelope.context?.tenantBoundary !== M51B_APPROVED_TENANT_BOUNDARY) {
    pushReason(reasons, "M51B_OUTLOOK_TENANT_BOUNDARY_DENIED");
  }
  if (
    envelope.context?.mailboxId !== M51B_OUTLOOK_MAILBOX_ID ||
    envelope.context?.mailboxAddress !== M51B_OUTLOOK_MAILBOX_ADDRESS
  ) {
    pushReason(reasons, "M51B_OUTLOOK_MAILBOX_CONTEXT_DENIED");
  }
  if (envelope.context?.workflowId !== M51B_OUTLOOK_WORKFLOW_ID) {
    pushReason(reasons, "M51B_OUTLOOK_WORKFLOW_CONTEXT_DENIED");
  }
  if (envelope.context?.purpose !== M51B_OUTLOOK_PURPOSE) {
    pushReason(reasons, "M51B_OUTLOOK_PURPOSE_DENIED");
  }
}

function validateDomainValues(
  envelope: M51BOutlookReferralEnvelope,
  reasons: M51BOutlookReasonCode[],
): void {
  const referral = envelope.referral;
  const sender = envelope.sender;
  if (
    envelope.subjectCode !== "SYNTHETIC_REFERRAL_SUBMISSION" ||
    !referral ||
    !REQUESTED_SERVICES.has(referral.requestedService) ||
    !URGENCIES.has(referral.urgency) ||
    !REASON_CODES.has(referral.referralReasonCode) ||
    !SOURCE_DIVISIONS.has(referral.sourceDivision) ||
    !SENSITIVITIES.has(referral.sensitivity) ||
    !CONSENT_STATUSES.has(referral.consent?.status) ||
    !["internal_staff", "approved_referral_partner"].includes(
      sender?.senderType,
    )
  ) {
    pushReason(reasons, "M51B_OUTLOOK_ENVELOPE_SHAPE_INVALID");
  }
}

function findAllowlistEntry(
  envelope: M51BOutlookReferralEnvelope,
  allowlist: readonly M51BOutlookSenderAllowlistEntry[],
  receivedAt: number | null,
  reasons: M51BOutlookReasonCode[],
): M51BOutlookSenderAllowlistEntry | null {
  const address = envelope.sender?.senderAddress?.trim().toLowerCase();
  const addressMatches = allowlist.filter(
    (entry) => entry.senderAddress.trim().toLowerCase() === address,
  );
  if (addressMatches.length === 0) {
    pushReason(reasons, "M51B_OUTLOOK_SENDER_NOT_ALLOWLISTED");
    return null;
  }

  const match = addressMatches.find((entry) => {
    const activeFrom = parsedTime(entry.activeFrom);
    const activeUntil = parsedTime(entry.activeUntil);
    return (
      entry.synthetic === true &&
      syntheticId(entry.allowlistEntryId) &&
      entry.senderDirectoryObjectId === envelope.sender?.senderDirectoryObjectId &&
      entry.senderType === envelope.sender?.senderType &&
      entry.tenantBoundary === envelope.context?.tenantBoundary &&
      entry.mailboxId === envelope.context?.mailboxId &&
      entry.workflowId === envelope.context?.workflowId &&
      entry.purpose === envelope.context?.purpose &&
      receivedAt !== null &&
      activeFrom !== null &&
      activeUntil !== null &&
      receivedAt >= activeFrom &&
      receivedAt <= activeUntil
    );
  });
  if (!match) {
    pushReason(reasons, "M51B_OUTLOOK_SENDER_CONTEXT_MISMATCH");
    return null;
  }
  return match;
}

function validateProcessor(
  envelope: M51BOutlookReferralEnvelope,
  reasons: M51BOutlookReasonCode[],
): void {
  const actor = envelope.context?.processingActor;
  const roleDefinition = ROLE_DEFINITIONS.find(
    (definition) => definition.id === actor?.role,
  );
  if (
    actor?.synthetic !== true ||
    !roleDefinition ||
    roleDefinition.division !== actor?.divisionId ||
    !visibleQueueIdsForRole(actor?.role ?? "").includes("intake")
  ) {
    pushReason(reasons, "M51B_OUTLOOK_PROCESSOR_ROLE_DENIED");
  }
  if (
    !Array.isArray(actor?.permissions) ||
    M51B_OUTLOOK_PROCESSING_PERMISSIONS.some(
      (permission) => !actor.permissions.includes(permission),
    )
  ) {
    pushReason(reasons, "M51B_OUTLOOK_PROCESSOR_PERMISSION_DENIED");
  }
}

function validateConsent(
  envelope: M51BOutlookReferralEnvelope,
  receivedAt: number | null,
  reasons: M51BOutlookReasonCode[],
): void {
  const sensitivity = envelope.referral?.sensitivity;
  const consent = envelope.referral?.consent;
  const sensitivityRequiresConsent =
    sensitivity === "restricted" || sensitivity === "part2";
  const consentRequired = sensitivityRequiresConsent || consent?.required === true;

  if (consentRequired && consent?.status !== "verified") {
    pushReason(reasons, "M51B_OUTLOOK_CONSENT_REQUIRED");
  }
  if (!consent || !Array.isArray(consent.scopes)) {
    pushReason(reasons, "M51B_OUTLOOK_CONSENT_INVALID");
    return;
  }
  if (
    new Set(consent.scopes).size !== consent.scopes.length ||
    consent.scopes.some((scope) => !CONSENT_SCOPES.has(scope))
  ) {
    pushReason(reasons, "M51B_OUTLOOK_CONSENT_INVALID");
  }

  if (consent.status === "verified") {
    const verifiedAt = parsedTime(consent.verifiedAt);
    const expiresAt = parsedTime(consent.expiresAt);
    if (
      !syntheticId(consent.consentReference) ||
      verifiedAt === null ||
      expiresAt === null ||
      receivedAt === null ||
      verifiedAt > receivedAt ||
      !consent.scopes.includes("referral_intake")
    ) {
      pushReason(reasons, "M51B_OUTLOOK_CONSENT_INVALID");
    }
    if (expiresAt !== null && receivedAt !== null && expiresAt < receivedAt) {
      pushReason(reasons, "M51B_OUTLOOK_CONSENT_EXPIRED");
    }
    if (
      sensitivity === "part2" &&
      !consent.scopes.includes("part2_treatment_referral")
    ) {
      pushReason(reasons, "M51B_OUTLOOK_CONSENT_INVALID");
    }
  } else if (
    consent.status === "expired" ||
    (parsedTime(consent.expiresAt) !== null &&
      receivedAt !== null &&
      (parsedTime(consent.expiresAt) ?? Number.POSITIVE_INFINITY) < receivedAt)
  ) {
    pushReason(reasons, "M51B_OUTLOOK_CONSENT_EXPIRED");
  } else if (
    consent.status === "not_required" &&
    (consent.consentReference !== null ||
      consent.verifiedAt !== null ||
      consent.expiresAt !== null ||
      consent.scopes.length > 0)
  ) {
    pushReason(reasons, "M51B_OUTLOOK_CONSENT_INVALID");
  }
}

function validateAllowlistedScope(
  envelope: M51BOutlookReferralEnvelope,
  allowlistEntry: M51BOutlookSenderAllowlistEntry | null,
  reasons: M51BOutlookReasonCode[],
): void {
  if (!allowlistEntry) return;
  const referral = envelope.referral;
  if (!referral) {
    pushReason(reasons, "M51B_OUTLOOK_ENVELOPE_SHAPE_INVALID");
    return;
  }
  if (!allowlistEntry.allowedServices.includes(referral.requestedService)) {
    pushReason(reasons, "M51B_OUTLOOK_SERVICE_SCOPE_DENIED");
  }
  const actualRank = SENSITIVITY_RANK[referral.sensitivity];
  const ceilingRank = SENSITIVITY_RANK[allowlistEntry.sensitivityCeiling];
  if (
    actualRank === undefined ||
    ceilingRank === undefined ||
    actualRank > ceilingRank
  ) {
    pushReason(reasons, "M51B_OUTLOOK_SENSITIVITY_SCOPE_DENIED");
  }
}

export function evaluateM51BOutlookReferralPolicy(
  envelope: M51BOutlookReferralEnvelope,
  allowlist: readonly M51BOutlookSenderAllowlistEntry[],
): Readonly<M51BOutlookPolicyDecision> {
  const reasons: M51BOutlookReasonCode[] = [];
  const shapeValid = validShape(envelope, reasons);
  validateDomainValues(envelope, reasons);
  validateSyntheticBoundary(envelope, reasons);
  const { receivedAt, evaluatedAt } = validateTimestamps(envelope, reasons);
  validateContext(envelope, reasons);
  const allowlistEntry = findAllowlistEntry(
    envelope,
    allowlist,
    receivedAt,
    reasons,
  );
  validateProcessor(envelope, reasons);
  validateAllowlistedScope(envelope, allowlistEntry, reasons);
  validateConsent(envelope, receivedAt, reasons);

  const senderValidated =
    allowlistEntry !== null &&
    !reasons.includes("M51B_OUTLOOK_SENDER_NOT_ALLOWLISTED") &&
    !reasons.includes("M51B_OUTLOOK_SENDER_CONTEXT_MISMATCH");
  const contextValidated = !reasons.some((reason) =>
    [
      "M51B_OUTLOOK_TENANT_BOUNDARY_DENIED",
      "M51B_OUTLOOK_MAILBOX_CONTEXT_DENIED",
      "M51B_OUTLOOK_WORKFLOW_CONTEXT_DENIED",
      "M51B_OUTLOOK_PURPOSE_DENIED",
    ].includes(reason),
  );
  const processorAuthorized = !reasons.some((reason) =>
    [
      "M51B_OUTLOOK_PROCESSOR_ROLE_DENIED",
      "M51B_OUTLOOK_PROCESSOR_PERMISSION_DENIED",
    ].includes(reason),
  );
  const sensitivityValidated = !reasons.some((reason) =>
    [
      "M51B_OUTLOOK_SERVICE_SCOPE_DENIED",
      "M51B_OUTLOOK_SENSITIVITY_SCOPE_DENIED",
    ].includes(reason),
  );
  const consentValidated = !reasons.some((reason) =>
    [
      "M51B_OUTLOOK_CONSENT_REQUIRED",
      "M51B_OUTLOOK_CONSENT_INVALID",
      "M51B_OUTLOOK_CONSENT_EXPIRED",
    ].includes(reason),
  );
  const minimizationValidated =
    shapeValid &&
    !reasons.includes("M51B_OUTLOOK_PAYLOAD_NOT_MINIMIZED") &&
    !reasons.includes("M51B_OUTLOOK_SYNTHETIC_IDENTIFIER_REQUIRED") &&
    !reasons.includes("M51B_OUTLOOK_SYNTHETIC_BOUNDARY_DENIED");

  const approved = reasons.length === 0;
  const minimizedProjection = approved
    ? Object.freeze({
        referralReference: envelope.referral.referralReference,
        youthReference: envelope.referral.youthReference,
        sourceOrganizationReference: envelope.referral.sourceOrganizationReference,
        sourceDivision: envelope.referral.sourceDivision,
        requestedService: envelope.referral.requestedService,
        urgency: envelope.referral.urgency,
        referralReasonCode: envelope.referral.referralReasonCode,
        sensitivity: envelope.referral.sensitivity,
        consentReference: envelope.referral.consent.consentReference,
      })
    : null;

  return Object.freeze({
    decision: approved ? "approved" : "exception",
    reasonCodes: Object.freeze(reasons),
    allowlistEntryId: allowlistEntry?.allowlistEntryId ?? null,
    minimizedProjection,
    senderValidated,
    contextValidated,
    processorAuthorized,
    sensitivityValidated,
    consentValidated,
    minimizationValidated,
    evaluatedAt,
    synthetic: true,
  });
}
