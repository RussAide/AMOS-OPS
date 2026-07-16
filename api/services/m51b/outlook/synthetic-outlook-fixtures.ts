import type {
  M51BOutlookRecoveryActor,
  M51BOutlookReferralEnvelope,
  M51BOutlookSenderAllowlistEntry,
} from "@contracts/m51b/outlook";
import {
  M51B_OUTLOOK_MAILBOX_ADDRESS,
  M51B_OUTLOOK_MAILBOX_ID,
  M51B_OUTLOOK_PROCESSING_PERMISSIONS,
  M51B_OUTLOOK_PURPOSE,
  M51B_OUTLOOK_RECOVERY_PERMISSION,
  M51B_OUTLOOK_WORKFLOW_ID,
} from "@contracts/m51b/outlook";
import {
  M51B_APPROVED_TENANT_BOUNDARY,
  M51B_EVIDENCE_CLASS,
} from "@contracts/m51b/shared";

export const M51B_SYNTHETIC_REFERRAL_SENDER_ADDRESS =
  "referrals@synthetic-community-partner.invalid" as const;

export function createSyntheticM51BOutlookSenderAllowlist(): readonly M51BOutlookSenderAllowlistEntry[] {
  return Object.freeze([
    Object.freeze({
      allowlistEntryId: "SYNTH-M51B-OUTLOOK-ALLOWLIST-001",
      senderAddress: M51B_SYNTHETIC_REFERRAL_SENDER_ADDRESS,
      senderDirectoryObjectId: "SYNTH-M51B-SENDER-PARTNER-001",
      senderType: "approved_referral_partner",
      tenantBoundary: M51B_APPROVED_TENANT_BOUNDARY,
      mailboxId: M51B_OUTLOOK_MAILBOX_ID,
      workflowId: M51B_OUTLOOK_WORKFLOW_ID,
      purpose: M51B_OUTLOOK_PURPOSE,
      allowedServices: Object.freeze(["CCMG", "MHTCM", "MHRS"] as const),
      sensitivityCeiling: "part2",
      activeFrom: "2026-01-01T00:00:00.000Z",
      activeUntil: "2027-01-01T00:00:00.000Z",
      synthetic: true,
    }),
    Object.freeze({
      allowlistEntryId: "SYNTH-M51B-OUTLOOK-ALLOWLIST-002",
      senderAddress: "intake-coordinator@adolbi.invalid",
      senderDirectoryObjectId: "SYNTH-M51B-SENDER-INTERNAL-001",
      senderType: "internal_staff",
      tenantBoundary: M51B_APPROVED_TENANT_BOUNDARY,
      mailboxId: M51B_OUTLOOK_MAILBOX_ID,
      workflowId: M51B_OUTLOOK_WORKFLOW_ID,
      purpose: M51B_OUTLOOK_PURPOSE,
      allowedServices: Object.freeze(["CCMG", "MHTCM", "MHRS"] as const),
      sensitivityCeiling: "part2",
      activeFrom: "2026-01-01T00:00:00.000Z",
      activeUntil: "2027-01-01T00:00:00.000Z",
      synthetic: true,
    }),
  ] satisfies readonly M51BOutlookSenderAllowlistEntry[]);
}

export function createSyntheticM51BOutlookReferral(): Readonly<M51BOutlookReferralEnvelope> {
  return Object.freeze({
    messageId: "SYNTH-M51B-OUTLOOK-MESSAGE-001",
    internetMessageId: "SYNTH-M51B-OUTLOOK-INTERNET-MESSAGE-001",
    changeKey: "SYNTH-M51B-OUTLOOK-CHANGEKEY-001",
    subjectCode: "SYNTHETIC_REFERRAL_SUBMISSION",
    sentAt: "2026-07-15T12:00:00.000Z",
    receivedAt: "2026-07-15T12:00:05.000Z",
    sender: Object.freeze({
      senderAddress: M51B_SYNTHETIC_REFERRAL_SENDER_ADDRESS,
      senderDirectoryObjectId: "SYNTH-M51B-SENDER-PARTNER-001",
      senderType: "approved_referral_partner",
      synthetic: true,
    }),
    context: Object.freeze({
      tenantBoundary: M51B_APPROVED_TENANT_BOUNDARY,
      mailboxId: M51B_OUTLOOK_MAILBOX_ID,
      mailboxAddress: M51B_OUTLOOK_MAILBOX_ADDRESS,
      workflowId: M51B_OUTLOOK_WORKFLOW_ID,
      purpose: M51B_OUTLOOK_PURPOSE,
      processingActor: Object.freeze({
        actorId: "SYNTH-M51B-ACTOR-INTAKE-COORDINATOR",
        role: "intake-coordinator",
        divisionId: "bhc",
        permissions: M51B_OUTLOOK_PROCESSING_PERMISSIONS,
        synthetic: true,
      }),
    }),
    referral: Object.freeze({
      referralReference: "SYNTH-M51B-REFERRAL-001",
      youthReference: "SYNTH-M51B-YOUTH-001",
      sourceOrganizationReference: "SYNTH-M51B-ORGANIZATION-PARTNER-001",
      sourceDivision: "external",
      requestedService: "CCMG",
      urgency: "routine",
      referralReasonCode: "behavioral_health_assessment",
      sensitivity: "restricted",
      consent: Object.freeze({
        required: true,
        status: "verified",
        consentReference: "SYNTH-M51B-CONSENT-001",
        scopes: Object.freeze([
          "referral_intake",
          "care_coordination",
        ] as const),
        verifiedAt: "2026-07-15T11:50:00.000Z",
        expiresAt: "2026-10-15T00:00:00.000Z",
      }),
    }),
    evidenceClass: M51B_EVIDENCE_CLASS,
    sourceAdapter: "deterministic_synthetic_outlook_event",
    synthetic: true,
    realRecord: false,
    rawBodyRead: false,
    attachmentContentRead: false,
    liveMailboxRead: false,
    liveGraphCall: false,
  });
}

export function createSyntheticM51BOutlookRecoveryActor(): Readonly<M51BOutlookRecoveryActor> {
  return Object.freeze({
    actorId: "SYNTH-M51B-ACTOR-INTEGRATION-RECOVERY",
    role: "administrator",
    permissions: Object.freeze([M51B_OUTLOOK_RECOVERY_PERMISSION]),
    synthetic: true,
  });
}
