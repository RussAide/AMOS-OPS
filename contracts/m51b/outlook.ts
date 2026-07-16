import type { DivisionId } from "../../src/constants/organization";
import type { UserRole } from "../../src/constants/roles";
import type { M51BAuditEvent } from "./shared";
import {
  M51B_APPROVED_TENANT_BOUNDARY,
  M51B_EVIDENCE_CLASS,
} from "./shared";

export const M51B_OUTLOOK_WORKFLOW_ID =
  "SYNTH-M51B-OUTLOOK-REFERRAL-INTAKE" as const;
export const M51B_OUTLOOK_MAILBOX_ID =
  "SYNTH-M51B-MAILBOX-CCMG-REFERRALS" as const;
export const M51B_OUTLOOK_MAILBOX_ADDRESS =
  "synthetic-ccmg-referrals@adolbi.invalid" as const;
export const M51B_OUTLOOK_PURPOSE =
  "care_coordination_referral_intake" as const;
export const M51B_OUTLOOK_MAX_ATTEMPTS = 3 as const;
export const M51B_OUTLOOK_RETRY_DELAYS_MS = Object.freeze([
  1_000,
  2_000,
] as const);

export const M51B_OUTLOOK_PROCESSING_PERMISSIONS = Object.freeze([
  "m51b:outlook:referral:ingest",
  "m51b:intake:create",
] as const);

export const M51B_OUTLOOK_RECOVERY_PERMISSION =
  "m51b:outlook:dead-letter:recover" as const;

export type M51BOutlookSensitivity =
  | "internal"
  | "confidential"
  | "restricted"
  | "part2";

export type M51BOutlookSenderType =
  | "internal_staff"
  | "approved_referral_partner";

export type M51BOutlookRequestedService = "CCMG" | "MHTCM" | "MHRS";
export type M51BOutlookUrgency = "routine" | "urgent" | "emergency";
export type M51BOutlookReferralReasonCode =
  | "behavioral_health_assessment"
  | "care_coordination"
  | "skills_support"
  | "continuity_transition";

export type M51BOutlookConsentStatus =
  | "not_required"
  | "verified"
  | "missing"
  | "expired"
  | "revoked";

export type M51BOutlookConsentScope =
  | "referral_intake"
  | "care_coordination"
  | "part2_treatment_referral";

export interface M51BOutlookSender {
  senderAddress: string;
  senderDirectoryObjectId: string;
  senderType: M51BOutlookSenderType;
  synthetic: true;
}

export interface M51BOutlookProcessingActor {
  actorId: string;
  role: UserRole;
  divisionId: DivisionId;
  permissions: readonly string[];
  synthetic: true;
}

export interface M51BOutlookContext {
  tenantBoundary: typeof M51B_APPROVED_TENANT_BOUNDARY;
  mailboxId: typeof M51B_OUTLOOK_MAILBOX_ID;
  mailboxAddress: typeof M51B_OUTLOOK_MAILBOX_ADDRESS;
  workflowId: typeof M51B_OUTLOOK_WORKFLOW_ID;
  purpose: typeof M51B_OUTLOOK_PURPOSE;
  processingActor: M51BOutlookProcessingActor;
}

export interface M51BOutlookConsentEvidence {
  required: boolean;
  status: M51BOutlookConsentStatus;
  consentReference: string | null;
  scopes: readonly M51BOutlookConsentScope[];
  verifiedAt: string | null;
  expiresAt: string | null;
}

export interface M51BOutlookReferralPayload {
  referralReference: string;
  youthReference: string;
  sourceOrganizationReference: string;
  sourceDivision: "BHC" | "GRO" | "external";
  requestedService: M51BOutlookRequestedService;
  urgency: M51BOutlookUrgency;
  referralReasonCode: M51BOutlookReferralReasonCode;
  sensitivity: M51BOutlookSensitivity;
  consent: M51BOutlookConsentEvidence;
}

/**
 * A synthetic event projection, not a mailbox message. Raw body and attachment
 * access are represented only by immutable false flags so tests can prove that
 * intake logic did not read Outlook content.
 */
export interface M51BOutlookReferralEnvelope {
  messageId: string;
  internetMessageId: string;
  changeKey: string;
  subjectCode: "SYNTHETIC_REFERRAL_SUBMISSION";
  sentAt: string;
  receivedAt: string;
  sender: M51BOutlookSender;
  context: M51BOutlookContext;
  referral: M51BOutlookReferralPayload;
  evidenceClass: typeof M51B_EVIDENCE_CLASS;
  sourceAdapter: "deterministic_synthetic_outlook_event";
  synthetic: true;
  realRecord: false;
  rawBodyRead: false;
  attachmentContentRead: false;
  liveMailboxRead: false;
  liveGraphCall: false;
}

export interface M51BOutlookSenderAllowlistEntry {
  allowlistEntryId: string;
  senderAddress: string;
  senderDirectoryObjectId: string;
  senderType: M51BOutlookSenderType;
  tenantBoundary: typeof M51B_APPROVED_TENANT_BOUNDARY;
  mailboxId: typeof M51B_OUTLOOK_MAILBOX_ID;
  workflowId: typeof M51B_OUTLOOK_WORKFLOW_ID;
  purpose: typeof M51B_OUTLOOK_PURPOSE;
  allowedServices: readonly M51BOutlookRequestedService[];
  sensitivityCeiling: M51BOutlookSensitivity;
  activeFrom: string;
  activeUntil: string;
  synthetic: true;
}

export type M51BOutlookReasonCode =
  | "M51B_OUTLOOK_ENVELOPE_SHAPE_INVALID"
  | "M51B_OUTLOOK_SYNTHETIC_BOUNDARY_DENIED"
  | "M51B_OUTLOOK_TIMESTAMP_INVALID"
  | "M51B_OUTLOOK_TENANT_BOUNDARY_DENIED"
  | "M51B_OUTLOOK_MAILBOX_CONTEXT_DENIED"
  | "M51B_OUTLOOK_WORKFLOW_CONTEXT_DENIED"
  | "M51B_OUTLOOK_PURPOSE_DENIED"
  | "M51B_OUTLOOK_SENDER_NOT_ALLOWLISTED"
  | "M51B_OUTLOOK_SENDER_CONTEXT_MISMATCH"
  | "M51B_OUTLOOK_PROCESSOR_ROLE_DENIED"
  | "M51B_OUTLOOK_PROCESSOR_PERMISSION_DENIED"
  | "M51B_OUTLOOK_SERVICE_SCOPE_DENIED"
  | "M51B_OUTLOOK_SENSITIVITY_SCOPE_DENIED"
  | "M51B_OUTLOOK_CONSENT_REQUIRED"
  | "M51B_OUTLOOK_CONSENT_INVALID"
  | "M51B_OUTLOOK_CONSENT_EXPIRED"
  | "M51B_OUTLOOK_PAYLOAD_NOT_MINIMIZED"
  | "M51B_OUTLOOK_SYNTHETIC_IDENTIFIER_REQUIRED"
  | "M51B_OUTLOOK_REPLAY_SUPPRESSED"
  | "M51B_OUTLOOK_DUPLICATE_REFERRAL_PREVENTED"
  | "M51B_OUTLOOK_IDEMPOTENCY_PAYLOAD_MISMATCH"
  | "M51B_OUTLOOK_ADAPTER_UNAVAILABLE"
  | "M51B_OUTLOOK_ADAPTER_THROTTLED"
  | "M51B_OUTLOOK_ADAPTER_PERMANENT_FAILURE"
  | "M51B_OUTLOOK_RETRY_EXHAUSTED"
  | "M51B_OUTLOOK_RECOVERY_ACTOR_DENIED"
  | "M51B_OUTLOOK_DEAD_LETTER_PAYLOAD_MISMATCH"
  | "M51B_OUTLOOK_DEAD_LETTER_ALREADY_RECOVERED";

export interface M51BOutlookMinimizedProjection {
  referralReference: string;
  youthReference: string;
  sourceOrganizationReference: string;
  sourceDivision: M51BOutlookReferralPayload["sourceDivision"];
  requestedService: M51BOutlookRequestedService;
  urgency: M51BOutlookUrgency;
  referralReasonCode: M51BOutlookReferralReasonCode;
  sensitivity: M51BOutlookSensitivity;
  consentReference: string | null;
}

export interface M51BOutlookPolicyDecision {
  decision: "approved" | "exception";
  reasonCodes: readonly M51BOutlookReasonCode[];
  allowlistEntryId: string | null;
  minimizedProjection: Readonly<M51BOutlookMinimizedProjection> | null;
  senderValidated: boolean;
  contextValidated: boolean;
  processorAuthorized: boolean;
  sensitivityValidated: boolean;
  consentValidated: boolean;
  minimizationValidated: boolean;
  evaluatedAt: string;
  synthetic: true;
}

export interface M51BOutlookIntakeRecord {
  intakeId: string;
  caseId: string;
  referralId: string;
  youthId: string;
  referralSourceDivision: M51BOutlookReferralPayload["sourceDivision"];
  requestedService: M51BOutlookRequestedService;
  referralReasonCode: M51BOutlookReferralReasonCode;
  urgency: M51BOutlookUrgency;
  sensitivity: M51BOutlookSensitivity;
  status: "received";
  queueId: "intake";
  sourceChannel: "outlook";
  sourceMessageId: string;
  correlationId: string;
  idempotencyKey: string;
  consentReference: string | null;
  createdAt: string;
  version: 1;
  evidenceClass: typeof M51B_EVIDENCE_CLASS;
  synthetic: true;
  realRecord: false;
  liveWritePerformed: false;
}

export type M51BOutlookExceptionQueue =
  | "sender_verification"
  | "privacy_review"
  | "intake_exception"
  | "integration_security"
  | "outlook_dead_letter";

export interface M51BOutlookExceptionRecord {
  exceptionId: string;
  messageId: string;
  correlationId: string;
  idempotencyKey: string;
  referralReference: string | null;
  queue: M51BOutlookExceptionQueue;
  reasonCodes: readonly M51BOutlookReasonCode[];
  status: "open" | "resolved";
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  synthetic: true;
  realRecord: false;
}

export type M51BOutlookSyntheticAttemptOutcome =
  | "success"
  | "transient_outage"
  | "throttled"
  | "permanent_failure";

export interface M51BOutlookAttemptEvidence {
  attempt: number;
  startedAt: string;
  completedAt: string;
  outcome: "succeeded" | "retry_scheduled" | "failed";
  reasonCode: M51BOutlookReasonCode | null;
  scheduledDelayMs: number | null;
  actualSleepPerformed: false;
  mailboxReadPerformed: false;
  liveGraphCallPerformed: false;
  liveWritePerformed: false;
  synthetic: true;
}

export interface M51BOutlookDeadLetterRecord {
  deadLetterId: string;
  operationId: string;
  messageId: string;
  correlationId: string;
  idempotencyKey: string;
  payloadFingerprint: string;
  referralReference: string | null;
  reasonCodes: readonly M51BOutlookReasonCode[];
  attempts: readonly M51BOutlookAttemptEvidence[];
  alertId: string;
  status: "open" | "recovered";
  createdAt: string;
  recoveredAt: string | null;
  recoveredBy: string | null;
  recoveryAttempts: number;
  synthetic: true;
  realRecord: false;
}

export type M51BOutlookDisposition =
  | "intake_created"
  | "duplicate_prevented"
  | "exception_routed"
  | "dead_lettered"
  | "recovered";

export interface M51BOutlookProcessingResult {
  operationId: string;
  messageId: string;
  correlationId: string;
  idempotencyKey: string;
  payloadFingerprint: string;
  disposition: M51BOutlookDisposition;
  policyDecision: M51BOutlookPolicyDecision;
  intake: Readonly<M51BOutlookIntakeRecord> | null;
  exception: Readonly<M51BOutlookExceptionRecord> | null;
  deadLetter: Readonly<M51BOutlookDeadLetterRecord> | null;
  attempts: readonly M51BOutlookAttemptEvidence[];
  reasonCodes: readonly M51BOutlookReasonCode[];
  auditEvents: readonly M51BAuditEvent[];
  createdIntakeCount: 0 | 1;
  replayed: boolean;
  duplicatePrevented: boolean;
  completedAt: string;
  synthetic: true;
  realRecordsCreated: 0;
  mailboxReads: 0;
  liveGraphCalls: 0;
  liveMicrosoftWrites: 0;
  liveWrites: 0;
}

export interface M51BOutlookRecoveryActor {
  actorId: string;
  role: UserRole;
  permissions: readonly string[];
  synthetic: true;
}

export interface M51BOutlookServiceSnapshot {
  intakes: readonly Readonly<M51BOutlookIntakeRecord>[];
  exceptions: readonly Readonly<M51BOutlookExceptionRecord>[];
  deadLetters: readonly Readonly<M51BOutlookDeadLetterRecord>[];
  auditEvents: readonly M51BAuditEvent[];
  metrics: {
    intakeCount: number;
    exceptionCount: number;
    openDeadLetterCount: number;
    recoveredDeadLetterCount: number;
    replayPreventedCount: number;
    duplicatePreventedCount: number;
    retryScheduledCount: number;
    actualSleepCalls: 0;
    mailboxReads: 0;
    liveGraphCalls: 0;
    liveMicrosoftWrites: 0;
    liveWrites: 0;
    realRecords: 0;
  };
  synthetic: true;
}
