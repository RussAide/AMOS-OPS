import type { DivisionId } from "../../src/constants/organization";
import type { UserRole } from "../../src/constants/roles";
import type { M42RoleTier } from "../m42/shared";
import type { M51AActorContext } from "../m51a/shared";
import type { M51BAuditEvent } from "./shared";

export const M51B_TEAMS_DELIVERY_SLO_MS = 30_000 as const;
export const M51B_TEAMS_ACKNOWLEDGEMENT_SLO_MS = 300_000 as const;
export const M51B_TEAMS_MAX_ATTEMPTS = 4 as const;
export const M51B_TEAMS_MAX_MENTIONS = 8 as const;
export const M51B_TEAMS_MAX_BODY_LENGTH = 480 as const;

export const M51B_TEAMS_EVENT_TYPES = Object.freeze([
  "workplan_assignment_approved",
  "compliance_action_approved",
  "incident_followup_approved",
  "clinical_review_approved",
  "training_due_approved",
  "executive_decision_approved",
] as const);

export type M51BTeamsEventType = (typeof M51B_TEAMS_EVENT_TYPES)[number];
export type M51BTeamsApprovalStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "withdrawn";
export type M51BTeamsSourceSensitivity =
  | "internal"
  | "confidential"
  | "restricted"
  | "part2";
export type M51BTeamsConsentStatus =
  | "not_applicable"
  | "verified"
  | "required_not_verified";
export type M51BTeamsIdentityKind = "member" | "guest" | "service";
export type M51BTeamsIdentityStatus = "active" | "disabled";

export interface M51BTeamsIdentity {
  actorId: string;
  teamsUserId: string;
  role: UserRole;
  tier: M42RoleTier;
  divisionId: DivisionId;
  tenantId: string;
  identityKind: M51BTeamsIdentityKind;
  status: M51BTeamsIdentityStatus;
  displayLabel: string;
  synthetic: true;
}

export interface M51BTeamsDestination {
  destinationId: string;
  logicalName: string;
  tenantId: string;
  teamId: string;
  channelId: string;
  active: boolean;
  allowedEventTypes: readonly M51BTeamsEventType[];
  allowedDivisions: readonly DivisionId[];
  allowedSenderRoles: readonly UserRole[];
  allowedRecipientRoles: readonly UserRole[];
  memberTeamsUserIds: readonly string[];
  mentionPolicy: "explicit_intended_recipients_only";
  notificationSensitivity: "internal";
  physicalUrlExposed: false;
  synthetic: true;
}

/**
 * Candidate event shape. Deliberately includes non-approved states and an
 * untrusted free-text field so the server boundary can prove that those
 * inputs are rejected instead of accidentally notifying Teams.
 */
export interface M51BTeamsEventCandidate {
  eventId: string;
  eventType: M51BTeamsEventType;
  approvalStatus: M51BTeamsApprovalStatus;
  approvedByActorId: string | null;
  occurredAt: string;
  approvedAt: string | null;
  approvalExpiresAt: string | null;
  sourceSystem: "amos-ops";
  sourceReference: string;
  sourceSensitivity: M51BTeamsSourceSensitivity;
  consentStatus: M51BTeamsConsentStatus;
  divisionId: DivisionId;
  ownerRole: UserRole;
  destinationId: string;
  intendedRecipientActorIds: readonly string[];
  acknowledgementRequired: true;
  priority: "routine" | "important" | "urgent";
  dueAt: string | null;
  untrustedFreeText?: string;
  synthetic: true;
}

export interface M51BTeamsDispatchRequest {
  idempotencyKey: string;
  submittedAt: string;
  actor: M51AActorContext;
  event: M51BTeamsEventCandidate;
}

export interface M51BTeamsMention {
  mentionId: string;
  actorId: string;
  teamsUserId: string;
  role: UserRole;
  displayLabel: string;
  renderedText: string;
  validated: true;
  synthetic: true;
}

export interface M51BTeamsMinimizedPayload {
  subject: string;
  body: string;
  actionLabel: string;
  routeReference: string;
  priority: "routine" | "important" | "urgent";
  dueAt: string | null;
  mentions: readonly M51BTeamsMention[];
  notificationSensitivity: "internal";
  minimized: true;
  freeTextIncluded: false;
  protectedRecordIdentifierIncluded: false;
  physicalMicrosoftUrlIncluded: false;
  fieldCount: number;
  synthetic: true;
}

export type M51BTeamsAttemptOutcome =
  | "delivered"
  | "retry_scheduled"
  | "hard_failed"
  | "retry_exhausted";

export interface M51BTeamsDeliveryAttempt {
  attempt: number;
  startedAt: string;
  completedAt: string;
  outcome: M51BTeamsAttemptOutcome;
  statusCode: number | null;
  errorCode: string | null;
  scheduledDelayMs: number;
  retryAfterHonored: boolean;
  synthetic: true;
}

export interface M51BTeamsDeliveryTiming {
  approvedAt: string;
  submittedAt: string;
  deliveredAt: string | null;
  elapsedMilliseconds: number | null;
  thresholdMilliseconds: typeof M51B_TEAMS_DELIVERY_SLO_MS;
  withinThirtySeconds: boolean;
  measuredFromTimestamps: true;
}

export type M51BTeamsDeliveryStatus =
  | "delivered"
  | "delivered_late"
  | "denied"
  | "dead_lettered";

export interface M51BTeamsDeliveryEvidence {
  evidenceId: string;
  deliveryId: string;
  eventId: string;
  messageId: string;
  requestFingerprint: string;
  tenantId: string;
  destinationId: string;
  teamId: string;
  channelId: string;
  contentHash: string;
  recipientActorIds: readonly string[];
  mentionIds: readonly string[];
  requestedAt: string;
  deliveredAt: string;
  elapsedMilliseconds: number;
  attempts: number;
  acknowledgementRequired: true;
  contentMinimized: true;
  mentionsValidated: true;
  destinationResolved: true;
  immutable: true;
  synthetic: true;
  liveGraphCalls: 0;
  liveTeamsWrites: 0;
  realNotificationsSent: 0;
}

export interface M51BTeamsDeadLetter {
  deadLetterId: string;
  deliveryId: string;
  eventId: string;
  idempotencyKey: string;
  requestFingerprint: string;
  destinationId: string;
  failedAt: string;
  attempts: number;
  finalErrorCode: string;
  replayEligible: boolean;
  immutable: true;
  synthetic: true;
}

export interface M51BTeamsOperationalAlert {
  alertId: string;
  deliveryId: string;
  alertType: "delivery_failed" | "delivery_slo_breached";
  openedAt: string;
  reasonCode: string;
  status: "open";
  ownerRole: "administrator";
  immutable: true;
  synthetic: true;
}

export interface M51BTeamsDeadLetterResolution {
  resolutionId: string;
  deadLetterId: string;
  originalDeliveryId: string;
  recoveredDeliveryId: string;
  recoveryEvidenceId: string;
  resolvedAt: string;
  resolvedByActorId: string;
  status: "recovered";
  immutable: true;
  synthetic: true;
}

export interface M51BTeamsOperationalAlertResolution {
  resolutionId: string;
  alertId: string;
  deadLetterId: string;
  originalDeliveryId: string;
  recoveredDeliveryId: string;
  recoveryEvidenceId: string;
  acknowledgedAt: string;
  acknowledgedByActorId: string;
  resolvedAt: string;
  resolvedByActorId: string;
  status: "resolved";
  immutable: true;
  synthetic: true;
}

export interface M51BTeamsDeadLetterSnapshot
  extends M51BTeamsDeadLetter {
  operationalStatus: "open" | "recovered";
  active: boolean;
  resolution: M51BTeamsDeadLetterResolution | null;
}

export interface M51BTeamsOperationalAlertSnapshot
  extends Omit<M51BTeamsOperationalAlert, "status"> {
  originalStatus: "open";
  status: "open" | "resolved";
  active: boolean;
  acknowledgedAt: string | null;
  acknowledgedByActorId: string | null;
  resolvedAt: string | null;
  resolvedByActorId: string | null;
  resolution: M51BTeamsOperationalAlertResolution | null;
}

export interface M51BTeamsOperationalStateSnapshot {
  deadLetters: readonly M51BTeamsDeadLetterSnapshot[];
  alerts: readonly M51BTeamsOperationalAlertSnapshot[];
  totalDeadLetters: number;
  activeDeadLetters: number;
  recoveredDeadLetters: number;
  totalAlerts: number;
  openAlerts: number;
  resolvedAlerts: number;
  generatedAt: string;
  immutable: true;
  synthetic: true;
}

export interface M51BTeamsDeliveryResult {
  deliveryId: string;
  status: M51BTeamsDeliveryStatus;
  idempotencyKey: string;
  requestFingerprint: string;
  replayed: boolean;
  replayOfDeliveryId: string | null;
  destination: M51BTeamsDestination | null;
  payload: M51BTeamsMinimizedPayload | null;
  attempts: readonly M51BTeamsDeliveryAttempt[];
  timing: M51BTeamsDeliveryTiming;
  denialCodes: readonly string[];
  evidence: M51BTeamsDeliveryEvidence | null;
  deadLetter: M51BTeamsDeadLetter | null;
  operationalAlert: M51BTeamsOperationalAlert | null;
  auditEvents: readonly M51BAuditEvent[];
  synthetic: true;
  liveGraphCalls: 0;
  liveTeamsWrites: 0;
  realNotificationsSent: 0;
}

export interface M51BTeamsAcknowledgementRequest {
  idempotencyKey: string;
  deliveryId: string;
  messageId: string;
  acknowledgedAt: string;
  actor: M51AActorContext;
}

export interface M51BTeamsAcknowledgementEvidence {
  acknowledgementId: string;
  deliveryId: string;
  messageId: string;
  actorId: string;
  acknowledgedAt: string;
  elapsedFromDeliveryMilliseconds: number;
  withinAcknowledgementWindow: boolean;
  immutable: true;
  synthetic: true;
  liveGraphCalls: 0;
  liveTeamsWrites: 0;
  realNotificationsSent: 0;
}

export interface M51BTeamsAcknowledgementResult {
  status: "acknowledged" | "denied";
  replayed: boolean;
  denialCodes: readonly string[];
  evidence: M51BTeamsAcknowledgementEvidence | null;
  auditEvents: readonly M51BAuditEvent[];
  synthetic: true;
}

export interface M51BTeamsRecoveryRequest {
  deadLetterId: string;
  recoveryIdempotencyKey: string;
  replayedAt: string;
  actor: M51AActorContext;
}

export interface M51BTeamsRecoveryEvidence {
  recoveryEvidenceId: string;
  deadLetterId: string;
  originalDeliveryId: string;
  recoveredDeliveryId: string;
  recoveredAt: string;
  recoveredByActorId: string;
  deadLetterResolutionId: string;
  operationalAlertResolutionId: string;
  resolvedOperationalAlertId: string;
  duplicateNotificationCreated: false;
  immutable: true;
  synthetic: true;
}

export interface M51BTeamsRecoveryResult {
  status: "recovered" | "denied";
  replayed: boolean;
  denialCodes: readonly string[];
  delivery: M51BTeamsDeliveryResult | null;
  evidence: M51BTeamsRecoveryEvidence | null;
  synthetic: true;
}

export interface M51BTeamsAdapterMetrics {
  syntheticSendAttempts: number;
  syntheticDeliveries: number;
  blockedLiveOperations: number;
  liveGraphCalls: 0;
  liveTeamsWrites: 0;
  realNotificationsSent: 0;
  credentialReads: 0;
}

export interface M51BTeamsScenarioResult {
  primaryDelivery: M51BTeamsDeliveryResult;
  primaryAcknowledgement: M51BTeamsAcknowledgementResult;
  retryDelivery: M51BTeamsDeliveryResult;
  persistentOutageDelivery: M51BTeamsDeliveryResult;
  outageRecovery: M51BTeamsRecoveryResult;
  operationalState: M51BTeamsOperationalStateSnapshot;
  privacyDenial: M51BTeamsDeliveryResult;
  replayDelivery: M51BTeamsDeliveryResult;
  assertions: Readonly<{
    approvedEventDelivered: boolean;
    destinationResolved: boolean;
    mentionsValidated: boolean;
    contentMinimized: boolean;
    deliveredWithinThirtySeconds: boolean;
    acknowledgementRecorded: boolean;
    immutableEvidenceRecorded: boolean;
    retryBoundedAndRecovered: boolean;
    privacyDenied: boolean;
    idempotentReplay: boolean;
    zeroLiveOperations: boolean;
  }>;
  passed: boolean;
  adapterMetrics: M51BTeamsAdapterMetrics;
  auditEvents: readonly M51BAuditEvent[];
  synthetic: true;
}
