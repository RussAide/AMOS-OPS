import { createHash } from "node:crypto";
import type { M52DeterministicClock } from "./clock";
import {
  M52DestinationIdempotencyCollisionError,
  M52NetworkUnavailableError,
  type M52SyntheticSyncDestination,
} from "./destination";
import {
  m52FreezePayload,
  m52PayloadFingerprint,
  m52RecordFingerprint,
  m52RequestFingerprint,
} from "./fingerprint";
import {
  M52_CANONICAL_SYNTHETIC_LINEAGE,
  isM52ApprovedOfflineWorkflow,
  type M52AuditEvent,
  type M52AuditOutcome,
  type M52Conflict,
  type M52ConflictResolution,
  type M52EnqueueRequest,
  type M52EnqueueResult,
  type M52LocalSyncState,
  type M52LocalSyncStatus,
  type M52PurgeRequest,
  type M52PurgeResult,
  type M52QueueEntrySnapshot,
  type M52QueueStatus,
  type M52ReconciliationClassification,
  type M52ReconciliationReport,
  type M52RecordPayload,
  type M52RecordReconciliation,
  type M52SyncLineage,
  type M52SyncPassResult,
  type M52SyncRecord,
  type M52SyncStep,
} from "./types";

interface MutableConflict {
  conflictId: string;
  kind: "version_conflict" | "clock_drift" | "idempotency_collision";
  queueId: string;
  recordId: string;
  detectedAt: string;
  expectedDestinationVersion: number;
  actualDestinationVersion: number;
  deviceClockOffsetMs: number;
  destinationRecord: M52SyncRecord | null;
  requiresUserResolution: true;
  governedRecoveryRequired: true;
  attemptedPayloadFingerprint: string;
  retainedPayloadFingerprint: string | null;
  resolved: boolean;
  resolution: "keep_local" | "accept_destination" | "merge" | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  synthetic: true;
}

interface MutableQueueEntry {
  queueId: string;
  operationId: string;
  idempotencyKey: string;
  requestFingerprint: string;
  payloadFingerprint: string;
  lineage: Readonly<M52SyncLineage>;
  record: M52SyncRecord;
  expectedDestinationVersion: number;
  deviceClockOffsetMs: number;
  queuedAt: string;
  status: M52QueueStatus;
  lifetimeAttempts: number;
  retryWindowAttempts: number;
  nextRetryAt: string | null;
  lastFailureStep: M52SyncStep | null;
  lastFailureReason: string | null;
  synchronizedAt: string | null;
  conflict: MutableConflict | null;
  resolutionCount: number;
  duplicateDeliverySuppressed: boolean;
  synthetic: true;
}

export interface M52OfflineSyncEngineOptions {
  readonly clock: M52DeterministicClock;
  readonly destination: M52SyntheticSyncDestination;
  readonly initialLocalRecords?: readonly M52SyncRecord[];
  readonly maximumAttempts?: number;
  readonly retryDelaysMs?: readonly number[];
  readonly clockDriftToleranceMs?: number;
  readonly auditActorId?: string;
  readonly trustedLineage?: Readonly<M52SyncLineage>;
}

function freezeRecord(record: M52SyncRecord): M52SyncRecord {
  if (!isM52ApprovedOfflineWorkflow(record.workflow)) {
    throw new Error("M52_OFFLINE_WORKFLOW_NOT_APPROVED");
  }
  return Object.freeze({
    ...record,
    payload: m52FreezePayload(record.payload),
    synthetic: true,
  });
}

function freezeLineage(lineage: Readonly<M52SyncLineage>): Readonly<M52SyncLineage> {
  return Object.freeze({ ...lineage });
}

function freezeConflict(conflict: MutableConflict | null): M52Conflict | null {
  if (!conflict) {
    return null;
  }
  return Object.freeze({
    ...conflict,
    destinationRecord: conflict.destinationRecord
      ? freezeRecord(conflict.destinationRecord)
      : null,
    synthetic: true,
  });
}

function freezeEntry(entry: MutableQueueEntry): M52QueueEntrySnapshot {
  return Object.freeze({
    queueId: entry.queueId,
    operationId: entry.operationId,
    idempotencyKey: entry.idempotencyKey,
    payloadFingerprint: entry.payloadFingerprint,
    lineage: freezeLineage(entry.lineage),
    record: freezeRecord(entry.record),
    expectedDestinationVersion: entry.expectedDestinationVersion,
    deviceClockOffsetMs: entry.deviceClockOffsetMs,
    queuedAt: entry.queuedAt,
    status: entry.status,
    lifetimeAttempts: entry.lifetimeAttempts,
    retryWindowAttempts: entry.retryWindowAttempts,
    nextRetryAt: entry.nextRetryAt,
    lastFailureStep: entry.lastFailureStep,
    lastFailureReason: entry.lastFailureReason,
    synchronizedAt: entry.synchronizedAt,
    conflict: freezeConflict(entry.conflict),
    resolutionCount: entry.resolutionCount,
    duplicateDeliverySuppressed: entry.duplicateDeliverySuppressed,
    synthetic: true,
  });
}

function freezePayload(payload: M52RecordPayload): M52RecordPayload {
  return m52FreezePayload(payload);
}

function lineageMatches(
  left: Readonly<M52SyncLineage>,
  right: Readonly<M52SyncLineage>,
): boolean {
  return (
    left.sessionId === right.sessionId &&
    left.deviceId === right.deviceId &&
    left.installationId === right.installationId &&
    left.userId === right.userId &&
    left.role === right.role &&
    left.divisionId === right.divisionId &&
    left.youthId === right.youthId &&
    left.action === right.action &&
    left.boundary === right.boundary
  );
}

function assertSyntheticLineage(lineage: Readonly<M52SyncLineage>): void {
  const canonicalDivisionIds = new Set(["eo", "gad", "bhc", "gro"]);
  const syntheticIdentifiers = [
    lineage.sessionId,
    lineage.deviceId,
    lineage.installationId,
    lineage.userId,
    lineage.youthId,
  ];
  if (
    lineage.boundary !== "SYNTHETIC_PROTOTYPE" ||
    !syntheticIdentifiers.every((value) => value.startsWith("SYNTH-")) ||
    !canonicalDivisionIds.has(lineage.divisionId) ||
    lineage.role.length === 0 ||
    lineage.action.length === 0
  ) {
    throw new Error("M52_SYNTHETIC_AUTHORIZED_LINEAGE_REQUIRED");
  }
}

function auditHash(input: Omit<M52AuditEvent, "eventHash">): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

export class M52OfflineSyncEngine {
  private readonly clock: M52DeterministicClock;
  private readonly destination: M52SyntheticSyncDestination;
  private readonly maximumAttempts: number;
  private readonly retryDelaysMs: readonly number[];
  private readonly clockDriftToleranceMs: number;
  private readonly auditActorId: string;
  private readonly trustedLineage: Readonly<M52SyncLineage>;
  private readonly localRecords = new Map<string, M52SyncRecord>();
  private readonly queue: MutableQueueEntry[] = [];
  private readonly idempotencyIndex = new Map<string, MutableQueueEntry>();
  private readonly operationIds = new Set<string>();
  private readonly audit: M52AuditEvent[] = [];
  private queueSequence = 0;
  private conflictSequence = 0;
  private lastSuccessfulSyncAt: string | null = null;

  constructor(options: M52OfflineSyncEngineOptions) {
    this.clock = options.clock;
    this.destination = options.destination;
    this.maximumAttempts = options.maximumAttempts ?? 3;
    this.retryDelaysMs = Object.freeze([
      ...(options.retryDelaysMs ?? [1_000, 4_000]),
    ]);
    this.clockDriftToleranceMs = options.clockDriftToleranceMs ?? 300_000;
    this.auditActorId =
      options.auditActorId ?? "SYNTH-M52-ACTOR-AUTHORIZED-FIELD-USER";
    this.trustedLineage = freezeLineage(
      options.trustedLineage ?? M52_CANONICAL_SYNTHETIC_LINEAGE,
    );
    assertSyntheticLineage(this.trustedLineage);
    if (!Number.isInteger(this.maximumAttempts) || this.maximumAttempts < 1) {
      throw new Error("M52_MAXIMUM_ATTEMPTS_MUST_BE_POSITIVE");
    }
    if (
      this.maximumAttempts > 1 &&
      (this.retryDelaysMs.length === 0 ||
        this.retryDelaysMs.some(
          (delay) => !Number.isFinite(delay) || delay <= 0,
        ))
    ) {
      throw new Error("M52_RETRY_DELAYS_MUST_BE_POSITIVE");
    }
    for (const record of options.initialLocalRecords ?? []) {
      this.localRecords.set(record.recordId, freezeRecord(record));
    }
  }

  enqueue(request: M52EnqueueRequest): M52EnqueueResult {
    this.validateEnqueueRequest(request);
    const requestFingerprint = m52RequestFingerprint(request);
    const existing = this.idempotencyIndex.get(request.idempotencyKey);
    if (existing) {
      if (existing.requestFingerprint !== requestFingerprint) {
        this.appendAudit({
          eventType: "offline_idempotency_collision_rejected",
          operationId: request.operationId,
          queueId: existing.queueId,
          recordId: request.recordId,
          outcome: "rejected",
          reasonCodes: ["M52_IDEMPOTENCY_KEY_PAYLOAD_COLLISION"],
        });
        throw new Error("M52_IDEMPOTENCY_KEY_PAYLOAD_COLLISION");
      }
      this.appendAudit({
        eventType: "offline_duplicate_enqueue_suppressed",
        operationId: request.operationId,
        queueId: existing.queueId,
        recordId: request.recordId,
        outcome: "duplicate_suppressed",
        reasonCodes: ["M52_DUPLICATE_LOCAL_INTENT_SUPPRESSED"],
      });
      return Object.freeze({
        entry: freezeEntry(existing),
        duplicateSuppressed: true,
        queueDepth: this.queue.length,
      });
    }
    if (this.operationIds.has(request.operationId)) {
      throw new Error("M52_OPERATION_ID_MUST_BE_UNIQUE");
    }

    const previousLocal = this.localRecords.get(request.recordId);
    const sourceVersion = Math.max(
      (previousLocal?.version ?? 0) + 1,
      request.expectedDestinationVersion + 1,
    );
    const record = freezeRecord({
      recordId: request.recordId,
      workflow: request.workflow,
      payload: freezePayload(request.payload),
      version: sourceVersion,
      updatedAt: request.deviceUpdatedAt,
      synthetic: true,
    });
    this.queueSequence += 1;
    const entry: MutableQueueEntry = {
      queueId: `SYNTH-M52-QUEUE-${String(this.queueSequence).padStart(4, "0")}`,
      operationId: request.operationId,
      idempotencyKey: request.idempotencyKey,
      requestFingerprint,
      payloadFingerprint: m52PayloadFingerprint({
        ...record,
        lineage: this.trustedLineage,
      }),
      lineage: this.trustedLineage,
      record,
      expectedDestinationVersion: request.expectedDestinationVersion,
      deviceClockOffsetMs: request.deviceClockOffsetMs,
      queuedAt: this.clock.now(),
      status: "queued",
      lifetimeAttempts: 0,
      retryWindowAttempts: 0,
      nextRetryAt: null,
      lastFailureStep: null,
      lastFailureReason: null,
      synchronizedAt: null,
      conflict: null,
      resolutionCount: 0,
      duplicateDeliverySuppressed: false,
      synthetic: true,
    };
    this.localRecords.set(record.recordId, record);
    this.queue.push(entry);
    this.idempotencyIndex.set(request.idempotencyKey, entry);
    this.operationIds.add(request.operationId);
    this.appendAudit({
      eventType: "offline_write_queued",
      operationId: request.operationId,
      queueId: entry.queueId,
      recordId: request.recordId,
      outcome: "queued",
      reasonCodes: ["M52_LOCAL_INTENT_DURABLY_RETAINED"],
    });
    return Object.freeze({
      entry: freezeEntry(entry),
      duplicateSuppressed: false,
      queueDepth: this.queue.length,
    });
  }

  synchronizePass(): M52SyncPassResult {
    let attempted = 0;
    let synchronized = 0;
    let deferredOffline = 0;
    let duplicateDeliveriesSuppressed = 0;
    const candidates = this.queue.filter((entry) => this.isEligible(entry));

    if (!this.destination.isConnected()) {
      for (const entry of candidates) {
        deferredOffline += 1;
        this.appendAudit({
          eventType: "offline_write_deferred",
          operationId: entry.operationId,
          queueId: entry.queueId,
          recordId: entry.record.recordId,
          outcome: "deferred",
          reasonCodes: ["M52_DEVICE_REMAINS_OFFLINE", "M52_RETRY_BUDGET_PRESERVED"],
        });
      }
      return this.passResult({
        attempted,
        synchronized,
        deferredOffline,
        duplicateDeliveriesSuppressed,
      });
    }

    for (const entry of candidates) {
      attempted += 1;
      const duplicateBefore = entry.duplicateDeliverySuppressed;
      this.attemptEntry(entry);
      if (entry.status === "synchronized") {
        synchronized += 1;
      }
      if (!duplicateBefore && entry.duplicateDeliverySuppressed) {
        duplicateDeliveriesSuppressed += 1;
      }
    }
    return this.passResult({
      attempted,
      synchronized,
      deferredOffline,
      duplicateDeliveriesSuppressed,
    });
  }

  reconnect(): M52SyncPassResult {
    this.destination.setConnected(true);
    for (const entry of this.queue) {
      if (entry.status === "retry_exhausted") {
        entry.status = "retry_wait";
        entry.retryWindowAttempts = 0;
        entry.nextRetryAt = this.clock.now();
        this.appendAudit({
          eventType: "offline_retry_window_reopened_on_reconnect",
          operationId: entry.operationId,
          queueId: entry.queueId,
          recordId: entry.record.recordId,
          outcome: "retry_scheduled",
          reasonCodes: ["M52_RECONNECT_RETAINED_INTENT_RECOVERY"],
        });
      }
    }

    let aggregate = this.passResult({
      attempted: 0,
      synchronized: 0,
      deferredOffline: 0,
      duplicateDeliveriesSuppressed: 0,
    });
    for (let pass = 0; pass < this.maximumAttempts; pass += 1) {
      const hasEligible = this.queue.some((entry) => this.isEligible(entry));
      if (!hasEligible) {
        break;
      }
      const result = this.synchronizePass();
      aggregate = this.passResult({
        attempted: aggregate.attempted + result.attempted,
        synchronized: aggregate.synchronized + result.synchronized,
        deferredOffline: aggregate.deferredOffline + result.deferredOffline,
        duplicateDeliveriesSuppressed:
          aggregate.duplicateDeliveriesSuppressed +
          result.duplicateDeliveriesSuppressed,
      });
      if (result.attempted === 0 || result.deferredOffline > 0) {
        break;
      }
    }
    return aggregate;
  }

  resolveConflict(queueId: string, resolution: M52ConflictResolution): M52QueueEntrySnapshot {
    const entry = this.requiredEntry(queueId);
    if (entry.status !== "conflict" || !entry.conflict || entry.conflict.resolved) {
      throw new Error("M52_UNRESOLVED_CONFLICT_REQUIRED");
    }
    if (resolution.resolvedBy !== this.trustedLineage.userId) {
      throw new Error("M52_CONFLICT_RESOLVER_NOT_AUTHORIZED_FOR_SESSION");
    }
    const destinationRecord = entry.conflict.destinationRecord;
    const collisionKeyRotated =
      entry.conflict.kind === "idempotency_collision" &&
      resolution.resolution !== "accept_destination";
    if (collisionKeyRotated) {
      const replacement = resolution.replacementIdempotencyKey;
      if (
        !replacement?.startsWith("SYNTH-") ||
        replacement === entry.idempotencyKey ||
        this.idempotencyIndex.has(replacement)
      ) {
        throw new Error("M52_GOVERNED_REPLACEMENT_IDEMPOTENCY_KEY_REQUIRED");
      }
      entry.idempotencyKey = replacement;
      this.idempotencyIndex.set(replacement, entry);
    }
    if (resolution.resolution === "accept_destination") {
      if (!destinationRecord) {
        throw new Error("M52_DESTINATION_RECORD_REQUIRED_FOR_ACCEPTANCE");
      }
      this.localRecords.set(entry.record.recordId, freezeRecord(destinationRecord));
      entry.status = "synchronized";
      entry.synchronizedAt = this.clock.now();
      this.lastSuccessfulSyncAt = entry.synchronizedAt;
    } else {
      if (resolution.resolution === "merge" && !resolution.mergedPayload) {
        throw new Error("M52_MERGED_PAYLOAD_REQUIRED");
      }
      const payload =
        resolution.resolution === "merge"
          ? freezePayload(resolution.mergedPayload ?? {})
          : entry.record.payload;
      entry.expectedDestinationVersion = destinationRecord?.version ?? 0;
      entry.deviceClockOffsetMs = 0;
      entry.record = freezeRecord({
        ...entry.record,
        payload,
        version: (destinationRecord?.version ?? 0) + 1,
        updatedAt: this.clock.now(),
        synthetic: true,
      });
      entry.payloadFingerprint = m52PayloadFingerprint({
        ...entry.record,
        lineage: entry.lineage,
      });
      entry.status = "queued";
      entry.retryWindowAttempts = 0;
      entry.nextRetryAt = null;
      entry.lastFailureStep = null;
      entry.lastFailureReason = null;
      this.localRecords.set(entry.record.recordId, entry.record);
    }
    entry.resolutionCount += 1;
    entry.conflict.resolved = true;
    entry.conflict.resolution = resolution.resolution;
    entry.conflict.resolvedAt = this.clock.now();
    entry.conflict.resolvedBy = resolution.resolvedBy;
    this.appendAudit({
      eventType: "offline_conflict_user_resolved",
      operationId: entry.operationId,
      queueId: entry.queueId,
      recordId: entry.record.recordId,
      actorId: resolution.resolvedBy,
      outcome: "resolved",
      reasonCodes: [
        `M52_USER_RESOLUTION_${resolution.resolution.toUpperCase()}`,
        "M52_NO_AUTOMATIC_CONFLICT_OVERWRITE",
        ...(collisionKeyRotated
          ? ["M52_IDEMPOTENCY_COLLISION_KEY_ROTATED_BY_AUTHORIZED_USER"]
          : []),
      ],
    });
    return freezeEntry(entry);
  }

  purgeLocalRuntime(request: M52PurgeRequest): M52PurgeResult {
    if (!request.requestedBy.startsWith("SYNTH-")) {
      throw new Error("M52_SYNTHETIC_PURGE_ACTOR_REQUIRED");
    }
    const selected =
      request.scope === "full_runtime"
        ? [...this.queue]
        : request.queueIds.map((queueId) => this.requiredEntry(queueId));
    if (
      request.scope === "queue_ids" &&
      new Set(request.queueIds).size !== request.queueIds.length
    ) {
      throw new Error("M52_PURGE_QUEUE_IDS_MUST_BE_UNIQUE");
    }
    const selectedSet = new Set(selected);
    const selectedRecordIds = new Set(
      selected.map((entry) => entry.record.recordId),
    );
    const auditEventIds = selected.map((entry) =>
      this.appendAudit({
        eventType: "offline_local_intent_purged",
        operationId: entry.operationId,
        queueId: entry.queueId,
        recordId: entry.record.recordId,
        actorId: request.requestedBy,
        outcome: "accepted",
        reasonCodes: [
          `M52_PURGE_REASON_${request.reason.toUpperCase()}`,
          "M52_QUEUE_CANNOT_SURVIVE_LOCAL_CACHE_PURGE",
        ],
      }).eventId,
    );

    let purgedIdempotencyKeys = 0;
    for (const [key, entry] of this.idempotencyIndex) {
      if (selectedSet.has(entry)) {
        this.idempotencyIndex.delete(key);
        purgedIdempotencyKeys += 1;
      }
    }
    let purgedOperationIds = 0;
    for (const entry of selected) {
      if (this.operationIds.delete(entry.operationId)) {
        purgedOperationIds += 1;
      }
    }
    for (let index = this.queue.length - 1; index >= 0; index -= 1) {
      const entry = this.queue[index];
      if (entry && selectedSet.has(entry)) {
        this.queue.splice(index, 1);
      }
    }

    let purgedLocalRecords = 0;
    if (request.scope === "full_runtime") {
      purgedLocalRecords = this.localRecords.size;
      this.localRecords.clear();
      this.lastSuccessfulSyncAt = null;
    } else {
      for (const recordId of selectedRecordIds) {
        const stillRequired = this.queue.some(
          (entry) => entry.record.recordId === recordId,
        );
        if (!stillRequired && this.localRecords.delete(recordId)) {
          purgedLocalRecords += 1;
        }
      }
    }

    const summary = this.appendAudit({
      eventType: "offline_local_runtime_purge_completed",
      operationId: `SYNTH-M52-PURGE-${String(this.audit.length + 1).padStart(6, "0")}`,
      queueId: null,
      recordId: null,
      actorId: request.requestedBy,
      outcome: "accepted",
      reasonCodes: [
        `M52_PURGE_SCOPE_${request.scope.toUpperCase()}`,
        `M52_PURGED_QUEUE_COUNT_${selected.length}`,
        `M52_PURGED_LOCAL_RECORD_COUNT_${purgedLocalRecords}`,
        "M52_DESTINATION_UNCHANGED",
      ],
    });
    auditEventIds.push(summary.eventId);
    return Object.freeze({
      scope: request.scope,
      reason: request.reason,
      purgedQueueEntries: selected.length,
      purgedLocalRecords,
      purgedIdempotencyKeys,
      purgedOperationIds,
      remainingQueueEntries: this.queue.length,
      remainingLocalRecords: this.localRecords.size,
      auditEventIds: Object.freeze(auditEventIds),
      destinationRecordsChanged: 0,
      liveCalls: 0,
      liveWrites: 0,
      synthetic: true,
    });
  }

  localStatus(): M52LocalSyncStatus {
    const counts = this.statusCounts();
    let state: M52LocalSyncState;
    if (!this.destination.isConnected()) {
      state = "offline";
    } else if (counts.conflicts > 0 || counts.retryExhausted > 0) {
      state = "attention_required";
    } else if (counts.queued > 0 || counts.retryWaiting > 0) {
      state = "pending";
    } else {
      state = "up_to_date";
    }
    return Object.freeze({
      state,
      connected: this.destination.isConnected(),
      ...counts,
      totalRetainedIntents: this.queue.length,
      lastSuccessfulSyncAt: this.lastSuccessfulSyncAt,
      liveCalls: 0,
      liveWrites: 0,
      synthetic: true,
    });
  }

  queueSnapshot(): readonly M52QueueEntrySnapshot[] {
    return Object.freeze(this.queue.map(freezeEntry));
  }

  localRecord(recordId: string): M52SyncRecord | null {
    const record = this.localRecords.get(recordId);
    return record ? freezeRecord(record) : null;
  }

  auditHistory(): readonly M52AuditEvent[] {
    return Object.freeze(this.audit.map((event) => event));
  }

  verifyAuditChain(): boolean {
    let previousEventHash = "GENESIS";
    for (const event of this.audit) {
      if (
        !Object.isFrozen(event) ||
        !Object.isFrozen(event.reasonCodes) ||
        event.previousEventHash !== previousEventHash
      ) {
        return false;
      }
      const { eventHash, ...withoutHash } = event;
      if (auditHash(withoutHash) !== eventHash) {
        return false;
      }
      previousEventHash = event.eventHash;
    }
    return true;
  }

  reconcileRecords(): M52ReconciliationReport {
    const destinationRecords = this.destination.listRecords();
    const destinationById = new Map(
      destinationRecords.map((record) => [record.recordId, record]),
    );
    const recordIds = new Set([
      ...this.localRecords.keys(),
      ...destinationById.keys(),
      ...this.queue.map((entry) => entry.record.recordId),
    ]);
    const records: M52RecordReconciliation[] = [];
    const unaccountedRecordIds: string[] = [];

    for (const recordId of [...recordIds].sort()) {
      const source = this.localRecords.get(recordId) ?? null;
      const destination = destinationById.get(recordId) ?? null;
      const retainedEntries = this.queue.filter(
        (entry) => entry.record.recordId === recordId,
      );
      const statuses = retainedEntries.map((entry) => entry.status);
      const matched =
        source !== null &&
        destination !== null &&
        m52RecordFingerprint(source) === m52RecordFingerprint(destination);
      const hasConflict = statuses.includes("conflict");
      const hasPending = statuses.some((status) =>
        ["queued", "retry_wait", "retry_exhausted"].includes(status),
      );
      const sourceAccountedFor = matched || retainedEntries.length > 0;
      let classification: M52ReconciliationClassification;
      if (matched) {
        classification = "matched";
      } else if (hasConflict) {
        classification = "conflict";
      } else if (hasPending) {
        classification = "pending";
      } else if (source && !destination) {
        classification = "source_only";
      } else if (!source && destination) {
        classification = "destination_only";
      } else {
        classification = "mismatch";
      }
      if (!sourceAccountedFor) {
        unaccountedRecordIds.push(recordId);
      }
      records.push(
        Object.freeze({
          recordId,
          sourceVersion: source?.version ?? null,
          destinationVersion: destination?.version ?? null,
          sourceFingerprint: source ? m52RecordFingerprint(source) : null,
          destinationFingerprint: destination
            ? m52RecordFingerprint(destination)
            : null,
          retainedQueueIds: Object.freeze(
            retainedEntries.map((entry) => entry.queueId),
          ),
          queueStatuses: Object.freeze([...statuses]),
          classification,
          sourceAccountedFor,
          matched,
          synthetic: true,
        }),
      );
    }

    const unresolvedIntentCount = this.queue.filter(
      (entry) => entry.status !== "synchronized",
    ).length;
    const fullySynchronized =
      unresolvedIntentCount === 0 && records.every((record) => record.matched);
    const auditChainValid = this.verifyAuditChain();
    const metrics = this.destination.metrics();
    return Object.freeze({
      reconciledAt: this.clock.now(),
      records: Object.freeze(records),
      sourceCount: this.localRecords.size,
      destinationCount: destinationRecords.length,
      retainedIntentCount: this.queue.length,
      synchronizedIntentCount: this.queue.length - unresolvedIntentCount,
      unresolvedIntentCount,
      unaccountedRecordIds: Object.freeze(unaccountedRecordIds),
      fullySynchronized,
      zeroDataLoss:
        fullySynchronized && unaccountedRecordIds.length === 0 && auditChainValid,
      destinationMutationCount: metrics.syntheticMutationCount,
      duplicateSuppressionCount: metrics.duplicateSuppressionCount,
      auditChainValid,
      liveCalls: 0,
      liveWrites: 0,
      synthetic: true,
    });
  }

  private attemptEntry(entry: MutableQueueEntry): void {
    entry.lifetimeAttempts += 1;
    entry.retryWindowAttempts += 1;
    entry.nextRetryAt = null;
    this.appendAudit({
      eventType: "offline_sync_attempt_started",
      operationId: entry.operationId,
      queueId: entry.queueId,
      recordId: entry.record.recordId,
      outcome: "accepted",
      reasonCodes: [
        `M52_ATTEMPT_${entry.retryWindowAttempts}_OF_${this.maximumAttempts}`,
      ],
    });

    try {
      this.destination.checkpoint(entry.operationId, "connect");
      const inspection = this.destination.inspect({
        operationId: entry.operationId,
        recordId: entry.record.recordId,
        idempotencyKey: entry.idempotencyKey,
        payloadFingerprint: entry.payloadFingerprint,
      });

      let receipt = inspection.existingReceipt;
      if (receipt) {
        entry.duplicateDeliverySuppressed = true;
        this.appendAudit({
          eventType: "offline_destination_duplicate_suppressed",
          operationId: entry.operationId,
          queueId: entry.queueId,
          recordId: entry.record.recordId,
          outcome: "duplicate_suppressed",
          reasonCodes: ["M52_DESTINATION_IDEMPOTENCY_RECEIPT_REUSED"],
        });
      } else {
        const actualDestinationVersion = inspection.destinationRecord?.version ?? 0;
        if (Math.abs(entry.deviceClockOffsetMs) > this.clockDriftToleranceMs) {
          this.raiseConflict(
            entry,
            "clock_drift",
            inspection.destinationRecord,
            actualDestinationVersion,
          );
          return;
        }
        if (actualDestinationVersion !== entry.expectedDestinationVersion) {
          this.raiseConflict(
            entry,
            "version_conflict",
            inspection.destinationRecord,
            actualDestinationVersion,
          );
          return;
        }
        receipt = this.destination.apply({
          operationId: entry.operationId,
          idempotencyKey: entry.idempotencyKey,
          payloadFingerprint: entry.payloadFingerprint,
          expectedDestinationVersion: entry.expectedDestinationVersion,
          record: entry.record,
          lineage: entry.lineage,
        });
      }

      this.destination.confirm(entry.operationId);
      this.destination.reconcileCheckpoint(entry.operationId);
      const committed = receipt.committedRecord;
      if (
        committed.recordId !== entry.record.recordId ||
        committed.workflow !== entry.record.workflow ||
        m52PayloadFingerprint({
          ...committed,
          lineage: receipt.lineage,
        }) !== entry.payloadFingerprint ||
        !lineageMatches(receipt.lineage, entry.lineage)
      ) {
        throw new Error("M52_RECORD_LEVEL_COMMIT_RECONCILIATION_FAILED");
      }
      this.localRecords.set(committed.recordId, freezeRecord(committed));
      entry.status = "synchronized";
      entry.synchronizedAt = this.clock.now();
      entry.nextRetryAt = null;
      entry.lastFailureStep = null;
      entry.lastFailureReason = null;
      this.lastSuccessfulSyncAt = entry.synchronizedAt;
      this.appendAudit({
        eventType: "offline_write_synchronized",
        operationId: entry.operationId,
        queueId: entry.queueId,
        recordId: entry.record.recordId,
        outcome: "synchronized",
        reasonCodes: [
          "M52_SOURCE_DESTINATION_RECORD_RECONCILED",
          "M52_LOCAL_INTENT_RETAINED_IN_HISTORY",
        ],
      });
    } catch (error) {
      if (error instanceof M52NetworkUnavailableError) {
        this.handleNetworkFailure(entry, error.step);
        return;
      }
      if (error instanceof M52DestinationIdempotencyCollisionError) {
        this.raiseIdempotencyCollision(entry, error);
        return;
      }
      throw error;
    }
  }

  private raiseConflict(
    entry: MutableQueueEntry,
    kind: "version_conflict" | "clock_drift",
    destinationRecord: M52SyncRecord | null,
    actualDestinationVersion: number,
  ): void {
    this.conflictSequence += 1;
    entry.status = "conflict";
    entry.nextRetryAt = null;
    entry.conflict = {
      conflictId: `SYNTH-M52-CONFLICT-${String(this.conflictSequence).padStart(4, "0")}`,
      kind,
      queueId: entry.queueId,
      recordId: entry.record.recordId,
      detectedAt: this.clock.now(),
      expectedDestinationVersion: entry.expectedDestinationVersion,
      actualDestinationVersion,
      deviceClockOffsetMs: entry.deviceClockOffsetMs,
      destinationRecord: destinationRecord ? freezeRecord(destinationRecord) : null,
      requiresUserResolution: true,
      governedRecoveryRequired: true,
      attemptedPayloadFingerprint: entry.payloadFingerprint,
      retainedPayloadFingerprint: null,
      resolved: false,
      resolution: null,
      resolvedAt: null,
      resolvedBy: null,
      synthetic: true,
    };
    this.appendAudit({
      eventType: "offline_sync_conflict_detected",
      operationId: entry.operationId,
      queueId: entry.queueId,
      recordId: entry.record.recordId,
      outcome: "conflict",
      reasonCodes: [
        kind === "clock_drift"
          ? "M52_DEVICE_CLOCK_DRIFT_REQUIRES_USER_RESOLUTION"
          : "M52_DESTINATION_VERSION_CONFLICT_REQUIRES_USER_RESOLUTION",
        "M52_AUTOMATIC_OVERWRITE_PROHIBITED",
      ],
    });
  }

  private raiseIdempotencyCollision(
    entry: MutableQueueEntry,
    error: M52DestinationIdempotencyCollisionError,
  ): void {
    this.conflictSequence += 1;
    entry.status = "conflict";
    entry.nextRetryAt = null;
    entry.lastFailureReason = error.message;
    entry.conflict = {
      conflictId: `SYNTH-M52-CONFLICT-${String(this.conflictSequence).padStart(4, "0")}`,
      kind: "idempotency_collision",
      queueId: entry.queueId,
      recordId: entry.record.recordId,
      detectedAt: this.clock.now(),
      expectedDestinationVersion: entry.expectedDestinationVersion,
      actualDestinationVersion: error.retainedRecord.version,
      deviceClockOffsetMs: entry.deviceClockOffsetMs,
      destinationRecord: freezeRecord(error.retainedRecord),
      requiresUserResolution: true,
      governedRecoveryRequired: true,
      attemptedPayloadFingerprint: error.attemptedPayloadFingerprint,
      retainedPayloadFingerprint: error.retainedPayloadFingerprint,
      resolved: false,
      resolution: null,
      resolvedAt: null,
      resolvedBy: null,
      synthetic: true,
    };
    this.appendAudit({
      eventType: "offline_destination_idempotency_collision",
      operationId: entry.operationId,
      queueId: entry.queueId,
      recordId: entry.record.recordId,
      outcome: "conflict",
      reasonCodes: [
        error.message,
        "M52_COLLISION_REQUIRES_AUTHORIZED_USER_RESOLUTION",
        "M52_AUTOMATIC_OVERWRITE_PROHIBITED",
      ],
    });
  }

  private handleNetworkFailure(
    entry: MutableQueueEntry,
    step: M52SyncStep,
  ): void {
    entry.lastFailureStep = step;
    entry.lastFailureReason = "M52_SYNTHETIC_NETWORK_UNAVAILABLE";
    if (entry.retryWindowAttempts >= this.maximumAttempts) {
      entry.status = "retry_exhausted";
      entry.nextRetryAt = null;
      this.appendAudit({
        eventType: "offline_sync_retry_exhausted",
        operationId: entry.operationId,
        queueId: entry.queueId,
        recordId: entry.record.recordId,
        outcome: "retry_exhausted",
        reasonCodes: [
          `M52_NETWORK_LOSS_AT_${step.toUpperCase()}`,
          "M52_BOUNDED_RETRY_EXHAUSTED_INTENT_RETAINED",
        ],
      });
      return;
    }
    entry.status = "retry_wait";
    const delayIndex = Math.min(
      entry.retryWindowAttempts - 1,
      Math.max(this.retryDelaysMs.length - 1, 0),
    );
    const delay = this.retryDelaysMs[delayIndex] ?? 0;
    entry.nextRetryAt = this.clock.atOffset(delay);
    this.appendAudit({
      eventType: "offline_sync_retry_scheduled",
      operationId: entry.operationId,
      queueId: entry.queueId,
      recordId: entry.record.recordId,
      outcome: "retry_scheduled",
      reasonCodes: [
        `M52_NETWORK_LOSS_AT_${step.toUpperCase()}`,
        `M52_RETRY_DELAY_MS_${delay}`,
        "M52_LOCAL_INTENT_RETAINED",
      ],
    });
  }

  private passResult(input: {
    attempted: number;
    synchronized: number;
    deferredOffline: number;
    duplicateDeliveriesSuppressed: number;
  }): M52SyncPassResult {
    const counts = this.statusCounts();
    return Object.freeze({
      ...input,
      retryWaiting: counts.retryWaiting,
      retryExhausted: counts.retryExhausted,
      conflicts: counts.conflicts,
      retainedIntentCount: this.queue.length,
      liveCalls: 0,
      liveWrites: 0,
      synthetic: true,
    });
  }

  private statusCounts(): {
    queued: number;
    retryWaiting: number;
    retryExhausted: number;
    conflicts: number;
    synchronized: number;
  } {
    return {
      queued: this.queue.filter((entry) => entry.status === "queued").length,
      retryWaiting: this.queue.filter((entry) => entry.status === "retry_wait")
        .length,
      retryExhausted: this.queue.filter(
        (entry) => entry.status === "retry_exhausted",
      ).length,
      conflicts: this.queue.filter((entry) => entry.status === "conflict").length,
      synchronized: this.queue.filter((entry) => entry.status === "synchronized")
        .length,
    };
  }

  private appendAudit(input: {
    eventType: string;
    operationId: string;
    queueId: string | null;
    recordId: string | null;
    actorId?: string;
    outcome: M52AuditOutcome;
    reasonCodes: readonly string[];
  }): M52AuditEvent {
    const sequence = this.audit.length + 1;
    const previousEventHash =
      this.audit[this.audit.length - 1]?.eventHash ?? "GENESIS";
    const withoutHash: Omit<M52AuditEvent, "eventHash"> = {
      sequence,
      eventId: `SYNTH-M52-AUDIT-${String(sequence).padStart(6, "0")}`,
      eventType: input.eventType,
      occurredAt: this.clock.now(),
      operationId: input.operationId,
      queueId: input.queueId,
      recordId: input.recordId,
      actorId: input.actorId ?? this.auditActorId,
      outcome: input.outcome,
      reasonCodes: Object.freeze([...input.reasonCodes]),
      previousEventHash,
      immutable: true,
      synthetic: true,
    };
    const event = Object.freeze({
      ...withoutHash,
      eventHash: auditHash(withoutHash),
    });
    this.audit.push(event);
    return event;
  }

  private requiredEntry(queueId: string): MutableQueueEntry {
    const entry = this.queue.find((candidate) => candidate.queueId === queueId);
    if (!entry) {
      throw new Error("M52_QUEUE_ENTRY_NOT_FOUND");
    }
    return entry;
  }

  private isEligible(entry: MutableQueueEntry): boolean {
    if (entry.status === "queued") {
      return true;
    }
    if (entry.status !== "retry_wait" || !entry.nextRetryAt) {
      return false;
    }
    return Date.parse(entry.nextRetryAt) <= Date.parse(this.clock.now());
  }

  private validateEnqueueRequest(request: M52EnqueueRequest): void {
    if (!isM52ApprovedOfflineWorkflow(request.workflow)) {
      this.appendAudit({
        eventType: "offline_workflow_not_approved_rejected",
        operationId: request.operationId,
        queueId: null,
        recordId: request.recordId,
        outcome: "rejected",
        reasonCodes: ["M52_OFFLINE_WORKFLOW_NOT_APPROVED"],
      });
      throw new Error("M52_OFFLINE_WORKFLOW_NOT_APPROVED");
    }
    assertSyntheticLineage(request.lineage);
    if (!lineageMatches(request.lineage, this.trustedLineage)) {
      this.appendAudit({
        eventType: "offline_untrusted_lineage_rejected",
        operationId: request.operationId,
        queueId: null,
        recordId: request.recordId,
        outcome: "rejected",
        reasonCodes: ["M52_CLIENT_AUTHORITATIVE_LINEAGE_PROHIBITED"],
      });
      throw new Error("M52_LINEAGE_DOES_NOT_MATCH_TRUSTED_SESSION_CONTEXT");
    }
    if (
      !request.operationId.startsWith("SYNTH-") ||
      !request.idempotencyKey.startsWith("SYNTH-") ||
      !request.recordId.startsWith("SYNTH-")
    ) {
      throw new Error("M52_SYNTHETIC_IDENTIFIERS_REQUIRED");
    }
    if (
      !Number.isInteger(request.expectedDestinationVersion) ||
      request.expectedDestinationVersion < 0
    ) {
      throw new Error("M52_EXPECTED_DESTINATION_VERSION_INVALID");
    }
    if (!Number.isFinite(request.deviceClockOffsetMs)) {
      throw new Error("M52_DEVICE_CLOCK_OFFSET_INVALID");
    }
    if (!Number.isFinite(Date.parse(request.deviceUpdatedAt))) {
      throw new Error("M52_DEVICE_UPDATED_AT_INVALID");
    }
  }
}
