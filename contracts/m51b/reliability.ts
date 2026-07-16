import type { UserRole } from "../../src/constants/roles";
import type {
  M51BAuditEvent,
  M51BIntegrationChannel,
} from "./shared";

export type M51BFailureClass =
  | "throttle"
  | "transient"
  | "permission"
  | "privacy"
  | "validation"
  | "conflict";

export type M51BReliabilityStatus =
  | "delivered"
  | "duplicate_suppressed"
  | "dead_lettered"
  | "recovered";

export interface M51BReliabilityRequest {
  operationId: string;
  channel: M51BIntegrationChannel;
  correlationId: string;
  idempotencyKey: string;
  actorId: string;
  payloadFingerprint: string;
  requestedAt: string;
  synthetic: true;
}

export interface M51BAdapterAttempt<T> {
  ok: boolean;
  value?: T;
  failureClass?: M51BFailureClass;
  reasonCode?: string;
}

export interface M51BAttemptEvidence {
  attempt: number;
  failureClass: M51BFailureClass | null;
  reasonCode: string;
  retryScheduled: boolean;
  synthetic: true;
}

export interface M51BReliabilityResult<T> {
  operationId: string;
  channel: M51BIntegrationChannel;
  correlationId: string;
  idempotencyKey: string;
  status: M51BReliabilityStatus;
  value: T | null;
  attempts: readonly M51BAttemptEvidence[];
  duplicateSuppressed: boolean;
  replayed: boolean;
  deadLetterId: string | null;
  alertId: string | null;
  auditEvents: readonly M51BAuditEvent[];
  liveCalls: 0;
  liveWrites: 0;
  synthetic: true;
}

export interface M51BDeadLetterRecord {
  deadLetterId: string;
  request: Readonly<M51BReliabilityRequest>;
  failedAt: string;
  failureClass: M51BFailureClass;
  reasonCode: string;
  attempts: number;
  replayEligible: boolean;
  state: "open" | "recovered";
  recoveredAt: string | null;
  recoveryOperationId: string | null;
  immutableOriginalFailure: true;
  synthetic: true;
}

export interface M51BOperationalAlert {
  alertId: string;
  channel: M51BIntegrationChannel;
  correlationId: string;
  deadLetterId: string;
  severity: "high";
  escalationQueue: string;
  reasonCode: string;
  acknowledged: false;
  synthetic: true;
}

export interface M51BReplayAuthorization {
  authorizedBy: string;
  authorizedRole: UserRole;
  authorizedAt: string;
  failureCorrected: boolean;
  privacyAndPermissionRevalidated: boolean;
  synthetic: true;
}

export interface M51BReconciliationResult {
  expectedOperationIds: readonly string[];
  deliveredOperationIds: readonly string[];
  openDeadLetterOperationIds: readonly string[];
  missingOperationIds: readonly string[];
  duplicateDeliveries: readonly string[];
  alertsRaised: number;
  accepted: boolean;
  liveCalls: 0;
  liveWrites: 0;
  synthetic: true;
}

export interface M51BReliabilitySnapshot {
  delivered: number;
  openDeadLetters: number;
  recoveredDeadLetters: number;
  alertsRaised: number;
  duplicateDeliveries: 0;
  maximumAttempts: 4;
  liveCalls: 0;
  liveWrites: 0;
  synthetic: true;
}
