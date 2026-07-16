import { describe, expect, it } from "vitest";
import {
  M52_CANONICAL_SYNTHETIC_LINEAGE,
  M52DeterministicClock,
  M52OfflineSyncEngine,
  M52SyntheticSyncDestination,
  m52RequestFingerprint,
  type M52ApprovedOfflineWorkflow,
  type M52SyncRecord,
} from "../services/m52/sync";

function syntheticRecord(
  recordId: string,
  version = 1,
): M52SyncRecord {
  return Object.freeze({
    recordId,
    workflow: "enterprise_task_structured_form",
    payload: Object.freeze({ state: "baseline" }),
    version,
    updatedAt: "2026-07-15T13:55:00.000Z",
    synthetic: true,
  });
}

function isDeeplyFrozen(value: unknown): boolean {
  if (value === null || typeof value !== "object") {
    return true;
  }
  if (!Object.isFrozen(value)) {
    return false;
  }
  return Object.values(value).every(isDeeplyFrozen);
}

describe("M5.2 adversarial offline synchronization controls", () => {
  it("rejects any runtime workflow outside the exact canonical set", () => {
    const clock = new M52DeterministicClock();
    const initial = syntheticRecord("SYNTH-M52-RECORD-WORKFLOW-REJECTION");
    const destination = new M52SyntheticSyncDestination(clock, [initial]);
    const engine = new M52OfflineSyncEngine({
      clock,
      destination,
      initialLocalRecords: [initial],
    });

    expect(() =>
      engine.enqueue({
        operationId: "SYNTH-M52-OP-WORKFLOW-REJECTION",
        idempotencyKey: "SYNTH-M52-IDEM-WORKFLOW-REJECTION",
        recordId: initial.recordId,
        workflow: "referral_intake" as M52ApprovedOfflineWorkflow,
        payload: Object.freeze({ state: "must-not-queue" }),
        expectedDestinationVersion: 1,
        deviceUpdatedAt: clock.now(),
        deviceClockOffsetMs: 0,
        lineage: M52_CANONICAL_SYNTHETIC_LINEAGE,
      }),
    ).toThrow("M52_OFFLINE_WORKFLOW_NOT_APPROVED");

    expect(engine.queueSnapshot()).toHaveLength(0);
    expect(destination.metrics().syntheticMutationCount).toBe(0);
    expect(engine.auditHistory()).toHaveLength(1);
    expect(engine.auditHistory()[0]).toMatchObject({
      eventType: "offline_workflow_not_approved_rejected",
      outcome: "rejected",
      reasonCodes: ["M52_OFFLINE_WORKFLOW_NOT_APPROVED"],
      immutable: true,
    });
    expect(engine.verifyAuditChain()).toBe(true);
  });

  it("does not attempt retry_wait before its due time, including reconnect", () => {
    const clock = new M52DeterministicClock();
    const initial = syntheticRecord("SYNTH-M52-RECORD-RETRY-DUE");
    const destination = new M52SyntheticSyncDestination(clock, [initial]);
    const engine = new M52OfflineSyncEngine({
      clock,
      destination,
      initialLocalRecords: [initial],
      maximumAttempts: 3,
      retryDelaysMs: [1_000, 4_000],
    });
    engine.enqueue({
      operationId: "SYNTH-M52-OP-RETRY-DUE",
      idempotencyKey: "SYNTH-M52-IDEM-RETRY-DUE",
      recordId: initial.recordId,
      workflow: initial.workflow,
      payload: Object.freeze({ state: "retry-only-when-due" }),
      expectedDestinationVersion: 1,
      deviceUpdatedAt: clock.now(),
      deviceClockOffsetMs: 0,
      lineage: M52_CANONICAL_SYNTHETIC_LINEAGE,
    });
    destination.planNetworkLoss("SYNTH-M52-OP-RETRY-DUE", "connect");

    expect(engine.reconnect().attempted).toBe(1);
    expect(engine.queueSnapshot()[0]).toMatchObject({
      status: "retry_wait",
      lifetimeAttempts: 1,
      nextRetryAt: "2026-07-15T14:00:01.000Z",
    });
    expect(engine.reconnect().attempted).toBe(0);
    clock.advance(999);
    expect(engine.synchronizePass().attempted).toBe(0);
    expect(engine.queueSnapshot()[0]?.lifetimeAttempts).toBe(1);

    clock.advance(1);
    expect(engine.synchronizePass()).toMatchObject({
      attempted: 1,
      synchronized: 1,
    });
    expect(engine.queueSnapshot()[0]).toMatchObject({
      status: "synchronized",
      lifetimeAttempts: 2,
    });
    expect(engine.reconcileRecords().zeroDataLoss).toBe(true);
  });

  it("turns a destination idempotency collision into an immutable resolvable conflict", () => {
    const clock = new M52DeterministicClock();
    const initial = syntheticRecord("SYNTH-M52-RECORD-COLLISION");
    const destination = new M52SyntheticSyncDestination(clock, [initial]);
    const firstEngine = new M52OfflineSyncEngine({
      clock,
      destination,
      initialLocalRecords: [initial],
    });
    firstEngine.enqueue({
      operationId: "SYNTH-M52-OP-COLLISION-FIRST",
      idempotencyKey: "SYNTH-M52-IDEM-COLLISION-SHARED",
      recordId: initial.recordId,
      workflow: initial.workflow,
      payload: Object.freeze({ state: "first-committed-payload" }),
      expectedDestinationVersion: 1,
      deviceUpdatedAt: clock.now(),
      deviceClockOffsetMs: 0,
      lineage: M52_CANONICAL_SYNTHETIC_LINEAGE,
    });
    firstEngine.reconnect();
    const committed = destination.getRecord(initial.recordId);
    expect(committed?.version).toBe(2);

    const recoveryEngine = new M52OfflineSyncEngine({
      clock,
      destination,
      initialLocalRecords: committed ? [committed] : [],
    });
    const recoveryEntry = recoveryEngine.enqueue({
      operationId: "SYNTH-M52-OP-COLLISION-RECOVERY",
      idempotencyKey: "SYNTH-M52-IDEM-COLLISION-SHARED",
      recordId: initial.recordId,
      workflow: initial.workflow,
      payload: Object.freeze({ state: "authorized-recovery-payload" }),
      expectedDestinationVersion: 2,
      deviceUpdatedAt: clock.now(),
      deviceClockOffsetMs: 0,
      lineage: M52_CANONICAL_SYNTHETIC_LINEAGE,
    }).entry;

    recoveryEngine.reconnect();

    const conflict = recoveryEngine.queueSnapshot()[0]?.conflict;
    expect(conflict).toMatchObject({
      kind: "idempotency_collision",
      expectedDestinationVersion: 2,
      actualDestinationVersion: 2,
      destinationRecord: { version: 2 },
      requiresUserResolution: true,
      governedRecoveryRequired: true,
      resolved: false,
      resolution: null,
      synthetic: true,
    });
    expect(conflict?.attemptedPayloadFingerprint).not.toBe(
      conflict?.retainedPayloadFingerprint,
    );
    expect(Object.isFrozen(conflict)).toBe(true);
    expect(destination.metrics().syntheticMutationCount).toBe(1);
    expect(() =>
      recoveryEngine.resolveConflict(recoveryEntry.queueId, {
        resolution: "accept_destination",
        resolvedBy: "SYNTH-M52-USER-UNAUTHORIZED-999",
      }),
    ).toThrow("M52_CONFLICT_RESOLVER_NOT_AUTHORIZED_FOR_SESSION");
    expect(() =>
      recoveryEngine.resolveConflict(recoveryEntry.queueId, {
        resolution: "keep_local",
        resolvedBy: M52_CANONICAL_SYNTHETIC_LINEAGE.userId,
      }),
    ).toThrow("M52_GOVERNED_REPLACEMENT_IDEMPOTENCY_KEY_REQUIRED");

    recoveryEngine.resolveConflict(recoveryEntry.queueId, {
      resolution: "keep_local",
      resolvedBy: M52_CANONICAL_SYNTHETIC_LINEAGE.userId,
      replacementIdempotencyKey: "SYNTH-M52-IDEM-COLLISION-RECOVERY-002",
    });
    recoveryEngine.reconnect();

    expect(recoveryEngine.queueSnapshot()[0]).toMatchObject({
      idempotencyKey: "SYNTH-M52-IDEM-COLLISION-RECOVERY-002",
      status: "synchronized",
      resolutionCount: 1,
      conflict: {
        kind: "idempotency_collision",
        resolved: true,
        resolution: "keep_local",
        resolvedBy: M52_CANONICAL_SYNTHETIC_LINEAGE.userId,
      },
    });
    expect(destination.getRecord(initial.recordId)).toMatchObject({
      version: 3,
      payload: { state: "authorized-recovery-payload" },
    });
    expect(destination.metrics().syntheticMutationCount).toBe(2);
    expect(recoveryEngine.reconcileRecords()).toMatchObject({
      unresolvedIntentCount: 0,
      unaccountedRecordIds: [],
      fullySynchronized: true,
      zeroDataLoss: true,
      auditChainValid: true,
    });
    expect(
      recoveryEngine
        .auditHistory()
        .some((event) =>
          event.reasonCodes.includes(
            "M52_IDEMPOTENCY_COLLISION_KEY_ROTATED_BY_AUTHORIZED_USER",
          ),
        ),
    ).toBe(true);
  });

  it("preserves recursive JSON and trusted lineage from queue through destination", () => {
    const clock = new M52DeterministicClock();
    const initial = syntheticRecord("SYNTH-M52-RECORD-RECURSIVE-JSON");
    const destination = new M52SyntheticSyncDestination(clock, [initial]);
    const serverDerivedLineage = Object.freeze({
      ...M52_CANONICAL_SYNTHETIC_LINEAGE,
      role: "medication-aide",
      divisionId: "gro",
      action: "record-administration",
    });
    const engine = new M52OfflineSyncEngine({
      clock,
      destination,
      initialLocalRecords: [initial],
      trustedLineage: serverDerivedLineage,
    });
    const payload = {
      form: {
        sections: [
          {
            id: "safety",
            answers: [true, false, null, 3.5],
          },
          {
            id: "notes",
            answers: ["synthetic note"],
          },
        ],
        metadata: {
          completed: true,
          counters: { required: 2, answered: 2 },
        },
      },
    } as const;
    const request = {
      operationId: "SYNTH-M52-OP-RECURSIVE-JSON",
      idempotencyKey: "SYNTH-M52-IDEM-RECURSIVE-JSON",
      recordId: initial.recordId,
      workflow: initial.workflow,
      payload,
      expectedDestinationVersion: 1,
      deviceUpdatedAt: clock.now(),
      deviceClockOffsetMs: 0,
      lineage: serverDerivedLineage,
    } as const;

    const queued = engine.enqueue(request).entry;
    expect(queued.lineage).toEqual(serverDerivedLineage);
    expect(Object.isFrozen(queued.lineage)).toBe(true);
    expect(isDeeplyFrozen(queued.record.payload)).toBe(true);
    engine.reconnect();

    const destinationRecord = destination.getRecord(initial.recordId);
    expect(destinationRecord?.payload).toEqual(payload);
    expect(isDeeplyFrozen(destinationRecord?.payload)).toBe(true);
    const inspection = destination.inspect({
      operationId: "SYNTH-M52-OP-RECURSIVE-INSPECTION",
      recordId: initial.recordId,
      idempotencyKey: queued.idempotencyKey,
      payloadFingerprint: queued.payloadFingerprint,
    });
    expect(inspection.existingReceipt?.lineage).toEqual(
      serverDerivedLineage,
    );
    expect(Object.isFrozen(inspection.existingReceipt?.lineage)).toBe(true);

    const alteredLineage = Object.freeze({
      ...serverDerivedLineage,
      userId: "SYNTH-M52-USER-DIFFERENT-999",
    });
    expect(
      m52RequestFingerprint({ ...request, lineage: alteredLineage }),
    ).not.toBe(m52RequestFingerprint(request));
    expect(() =>
      engine.enqueue({
        ...request,
        operationId: "SYNTH-M52-OP-UNTRUSTED-LINEAGE",
        idempotencyKey: "SYNTH-M52-IDEM-UNTRUSTED-LINEAGE",
        lineage: alteredLineage,
      }),
    ).toThrow("M52_LINEAGE_DOES_NOT_MATCH_TRUSTED_SESSION_CONTEXT");
    expect(engine.queueSnapshot()).toHaveLength(1);
    expect(engine.reconcileRecords().zeroDataLoss).toBe(true);
  });

  it("purges selected or full local runtime state without touching destination records", () => {
    const clock = new M52DeterministicClock();
    const records = [
      syntheticRecord("SYNTH-M52-RECORD-PURGE-01"),
      syntheticRecord("SYNTH-M52-RECORD-PURGE-02"),
    ];
    const destination = new M52SyntheticSyncDestination(clock, records);
    const engine = new M52OfflineSyncEngine({
      clock,
      destination,
      initialLocalRecords: records,
    });
    const entries = records.map((record, index) =>
      engine.enqueue({
        operationId: `SYNTH-M52-OP-PURGE-${index + 1}`,
        idempotencyKey: `SYNTH-M52-IDEM-PURGE-${index + 1}`,
        recordId: record.recordId,
        workflow: record.workflow,
        payload: Object.freeze({ state: `pending-${index + 1}` }),
        expectedDestinationVersion: 1,
        deviceUpdatedAt: clock.now(),
        deviceClockOffsetMs: 0,
        lineage: M52_CANONICAL_SYNTHETIC_LINEAGE,
      }).entry,
    );

    expect(() =>
      engine.purgeLocalRuntime({
        scope: "queue_ids",
        queueIds: ["SYNTH-M52-QUEUE-UNKNOWN"],
        requestedBy: "SYNTH-M52-ACTOR-SECURITY",
        reason: "device_revoked",
      }),
    ).toThrow("M52_QUEUE_ENTRY_NOT_FOUND");
    expect(engine.queueSnapshot()).toHaveLength(2);

    const selected = engine.purgeLocalRuntime({
      scope: "queue_ids",
      queueIds: [entries[0]!.queueId],
      requestedBy: "SYNTH-M52-ACTOR-SECURITY",
      reason: "logout",
    });
    expect(selected).toMatchObject({
      scope: "queue_ids",
      purgedQueueEntries: 1,
      purgedLocalRecords: 1,
      purgedIdempotencyKeys: 1,
      purgedOperationIds: 1,
      remainingQueueEntries: 1,
      remainingLocalRecords: 1,
      destinationRecordsChanged: 0,
      liveCalls: 0,
      liveWrites: 0,
    });
    expect(selected.auditEventIds).toHaveLength(2);
    expect(engine.localRecord(records[0]!.recordId)).toBeNull();
    expect(destination.listRecords()).toHaveLength(2);

    engine.enqueue({
      operationId: "SYNTH-M52-OP-PURGE-1",
      idempotencyKey: "SYNTH-M52-IDEM-PURGE-1",
      recordId: records[0]!.recordId,
      workflow: records[0]!.workflow,
      payload: Object.freeze({ state: "recreated-after-scoped-purge" }),
      expectedDestinationVersion: 1,
      deviceUpdatedAt: clock.now(),
      deviceClockOffsetMs: 0,
      lineage: M52_CANONICAL_SYNTHETIC_LINEAGE,
    });
    const full = engine.purgeLocalRuntime({
      scope: "full_runtime",
      requestedBy: "SYNTH-M52-ACTOR-SECURITY",
      reason: "reinstall",
    });

    expect(full).toMatchObject({
      scope: "full_runtime",
      purgedQueueEntries: 2,
      purgedLocalRecords: 2,
      purgedIdempotencyKeys: 2,
      purgedOperationIds: 2,
      remainingQueueEntries: 0,
      remainingLocalRecords: 0,
      destinationRecordsChanged: 0,
    });
    expect(engine.queueSnapshot()).toHaveLength(0);
    expect(engine.localStatus()).toMatchObject({
      totalRetainedIntents: 0,
      queued: 0,
    });
    expect(destination.listRecords()).toHaveLength(2);
    expect(engine.verifyAuditChain()).toBe(true);
  });
});
