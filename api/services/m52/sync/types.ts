import {
  M52_APPROVED_WORKFLOW_IDS,
  type M52ApprovedWorkflowId,
} from "@contracts/m52/shared";

export type M52JsonPrimitive = string | number | boolean | null;

export type M52JsonValue =
  | M52JsonPrimitive
  | M52JsonObject
  | readonly M52JsonValue[];

export interface M52JsonObject {
  readonly [key: string]: M52JsonValue;
}

export type M52RecordPayload = M52JsonObject;

export type M52ApprovedOfflineWorkflow = M52ApprovedWorkflowId;

export interface M52SyncLineage {
  readonly sessionId: string;
  readonly deviceId: string;
  readonly installationId: string;
  readonly userId: string;
  readonly role: string;
  readonly divisionId: string;
  readonly youthId: string;
  readonly action: string;
  readonly boundary: "SYNTHETIC_PROTOTYPE";
}

export const M52_CANONICAL_SYNTHETIC_LINEAGE: Readonly<M52SyncLineage> =
  Object.freeze({
    sessionId: "SYNTH-M52-SESSION-AUTHORIZED-001",
    deviceId: "SYNTH-M52-DEVICE-MANAGED-001",
    installationId: "SYNTH-M52-INSTALLATION-001",
    userId: "SYNTH-M52-USER-FIELD-001",
    role: "synthetic_authorized_field_user",
    divisionId: "gro",
    youthId: "SYNTH-M52-YOUTH-001",
    action: "approved_offline_write",
    boundary: "SYNTHETIC_PROTOTYPE",
  });

export function isM52ApprovedOfflineWorkflow(
  value: unknown,
): value is M52ApprovedOfflineWorkflow {
  return (
    typeof value === "string" &&
    (M52_APPROVED_WORKFLOW_IDS as readonly string[]).includes(value)
  );
}

export interface M52SyncRecord {
  readonly recordId: string;
  readonly workflow: M52ApprovedOfflineWorkflow;
  readonly payload: M52RecordPayload;
  readonly version: number;
  readonly updatedAt: string;
  readonly synthetic: true;
}

export const M52_SYNC_STEPS = [
  "connect",
  "read_destination",
  "write_before",
  "write_after",
  "confirm_commit",
  "reconcile",
] as const;

export type M52SyncStep = (typeof M52_SYNC_STEPS)[number];

export type M52QueueStatus =
  | "queued"
  | "retry_wait"
  | "retry_exhausted"
  | "conflict"
  | "synchronized";

export type M52ConflictKind =
  | "version_conflict"
  | "clock_drift"
  | "idempotency_collision";

export type M52ConflictResolutionKind =
  | "keep_local"
  | "accept_destination"
  | "merge";

export interface M52Conflict {
  readonly conflictId: string;
  readonly kind: M52ConflictKind;
  readonly queueId: string;
  readonly recordId: string;
  readonly detectedAt: string;
  readonly expectedDestinationVersion: number;
  readonly actualDestinationVersion: number;
  readonly deviceClockOffsetMs: number;
  readonly destinationRecord: M52SyncRecord | null;
  readonly requiresUserResolution: true;
  readonly governedRecoveryRequired: true;
  readonly attemptedPayloadFingerprint: string;
  readonly retainedPayloadFingerprint: string | null;
  readonly resolved: boolean;
  readonly resolution: M52ConflictResolutionKind | null;
  readonly resolvedAt: string | null;
  readonly resolvedBy: string | null;
  readonly synthetic: true;
}

export interface M52ConflictResolution {
  readonly resolution: M52ConflictResolutionKind;
  readonly resolvedBy: string;
  readonly mergedPayload?: M52RecordPayload;
  readonly replacementIdempotencyKey?: string;
}

export interface M52QueueEntrySnapshot {
  readonly queueId: string;
  readonly operationId: string;
  readonly idempotencyKey: string;
  readonly payloadFingerprint: string;
  readonly lineage: Readonly<M52SyncLineage>;
  readonly record: M52SyncRecord;
  readonly expectedDestinationVersion: number;
  readonly deviceClockOffsetMs: number;
  readonly queuedAt: string;
  readonly status: M52QueueStatus;
  readonly lifetimeAttempts: number;
  readonly retryWindowAttempts: number;
  readonly nextRetryAt: string | null;
  readonly lastFailureStep: M52SyncStep | null;
  readonly lastFailureReason: string | null;
  readonly synchronizedAt: string | null;
  readonly conflict: M52Conflict | null;
  readonly resolutionCount: number;
  readonly duplicateDeliverySuppressed: boolean;
  readonly synthetic: true;
}

export interface M52EnqueueRequest {
  readonly operationId: string;
  readonly idempotencyKey: string;
  readonly recordId: string;
  readonly workflow: M52ApprovedOfflineWorkflow;
  readonly payload: M52RecordPayload;
  readonly expectedDestinationVersion: number;
  readonly deviceUpdatedAt: string;
  readonly deviceClockOffsetMs: number;
  readonly lineage: Readonly<M52SyncLineage>;
}

export interface M52EnqueueResult {
  readonly entry: M52QueueEntrySnapshot;
  readonly duplicateSuppressed: boolean;
  readonly queueDepth: number;
}

export type M52LocalSyncState =
  | "offline"
  | "pending"
  | "attention_required"
  | "up_to_date";

export interface M52LocalSyncStatus {
  readonly state: M52LocalSyncState;
  readonly connected: boolean;
  readonly queued: number;
  readonly retryWaiting: number;
  readonly retryExhausted: number;
  readonly conflicts: number;
  readonly synchronized: number;
  readonly totalRetainedIntents: number;
  readonly lastSuccessfulSyncAt: string | null;
  readonly liveCalls: 0;
  readonly liveWrites: 0;
  readonly synthetic: true;
}

export interface M52SyncPassResult {
  readonly attempted: number;
  readonly synchronized: number;
  readonly deferredOffline: number;
  readonly retryWaiting: number;
  readonly retryExhausted: number;
  readonly conflicts: number;
  readonly duplicateDeliveriesSuppressed: number;
  readonly retainedIntentCount: number;
  readonly liveCalls: 0;
  readonly liveWrites: 0;
  readonly synthetic: true;
}

export type M52AuditOutcome =
  | "accepted"
  | "queued"
  | "deferred"
  | "retry_scheduled"
  | "retry_exhausted"
  | "conflict"
  | "resolved"
  | "synchronized"
  | "duplicate_suppressed"
  | "rejected";

export interface M52AuditEvent {
  readonly sequence: number;
  readonly eventId: string;
  readonly eventType: string;
  readonly occurredAt: string;
  readonly operationId: string;
  readonly queueId: string | null;
  readonly recordId: string | null;
  readonly actorId: string;
  readonly outcome: M52AuditOutcome;
  readonly reasonCodes: readonly string[];
  readonly previousEventHash: string;
  readonly eventHash: string;
  readonly immutable: true;
  readonly synthetic: true;
}

export type M52ReconciliationClassification =
  | "matched"
  | "pending"
  | "conflict"
  | "source_only"
  | "destination_only"
  | "mismatch";

export interface M52RecordReconciliation {
  readonly recordId: string;
  readonly sourceVersion: number | null;
  readonly destinationVersion: number | null;
  readonly sourceFingerprint: string | null;
  readonly destinationFingerprint: string | null;
  readonly retainedQueueIds: readonly string[];
  readonly queueStatuses: readonly M52QueueStatus[];
  readonly classification: M52ReconciliationClassification;
  readonly sourceAccountedFor: boolean;
  readonly matched: boolean;
  readonly synthetic: true;
}

export interface M52ReconciliationReport {
  readonly reconciledAt: string;
  readonly records: readonly M52RecordReconciliation[];
  readonly sourceCount: number;
  readonly destinationCount: number;
  readonly retainedIntentCount: number;
  readonly synchronizedIntentCount: number;
  readonly unresolvedIntentCount: number;
  readonly unaccountedRecordIds: readonly string[];
  readonly fullySynchronized: boolean;
  readonly zeroDataLoss: boolean;
  readonly destinationMutationCount: number;
  readonly duplicateSuppressionCount: number;
  readonly auditChainValid: boolean;
  readonly liveCalls: 0;
  readonly liveWrites: 0;
  readonly synthetic: true;
}

export interface M52DestinationReceipt {
  readonly idempotencyKey: string;
  readonly payloadFingerprint: string;
  readonly committedRecord: M52SyncRecord;
  readonly lineage: Readonly<M52SyncLineage>;
  readonly committedAt: string;
  readonly duplicateSuppressed: boolean;
  readonly synthetic: true;
}

export interface M52DestinationInspection {
  readonly destinationRecord: M52SyncRecord | null;
  readonly existingReceipt: M52DestinationReceipt | null;
  readonly synthetic: true;
}

export interface M52DestinationMetrics {
  readonly connected: boolean;
  readonly syntheticMutationCount: number;
  readonly duplicateSuppressionCount: number;
  readonly retainedReceiptCount: number;
  readonly liveCalls: 0;
  readonly liveWrites: 0;
  readonly synthetic: true;
}

export type M52PurgeReason =
  | "logout"
  | "device_revoked"
  | "reinstall"
  | "cache_wipe";

export type M52PurgeRequest =
  | Readonly<{
      scope: "queue_ids";
      queueIds: readonly string[];
      requestedBy: string;
      reason: M52PurgeReason;
    }>
  | Readonly<{
      scope: "full_runtime";
      requestedBy: string;
      reason: M52PurgeReason;
    }>;

export interface M52PurgeResult {
  readonly scope: M52PurgeRequest["scope"];
  readonly reason: M52PurgeReason;
  readonly purgedQueueEntries: number;
  readonly purgedLocalRecords: number;
  readonly purgedIdempotencyKeys: number;
  readonly purgedOperationIds: number;
  readonly remainingQueueEntries: number;
  readonly remainingLocalRecords: number;
  readonly auditEventIds: readonly string[];
  readonly destinationRecordsChanged: 0;
  readonly liveCalls: 0;
  readonly liveWrites: 0;
  readonly synthetic: true;
}
