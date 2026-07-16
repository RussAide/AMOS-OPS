import { describe, expect, it } from "vitest";
import {
  M52DeterministicClock,
  M52_CANONICAL_SYNTHETIC_LINEAGE,
  M52OfflineSyncEngine,
  M52SyntheticSyncDestination,
  M52_SYNC_STEPS,
  type M52SyncRecord,
  type M52SyncStep,
} from "../services/m52/sync";

function initialRecord(recordId = "SYNTH-M52-RECORD-NETWORK"): M52SyncRecord {
  return Object.freeze({
    recordId,
    workflow: "gro_shift_safety_handoff",
    payload: Object.freeze({ state: "baseline" }),
    version: 1,
    updatedAt: "2026-07-15T13:55:00.000Z",
    synthetic: true,
  });
}

function networkRig(step: M52SyncStep) {
  const clock = new M52DeterministicClock();
  const record = initialRecord(`SYNTH-M52-RECORD-${step.toUpperCase()}`);
  const destination = new M52SyntheticSyncDestination(clock, [record]);
  const engine = new M52OfflineSyncEngine({
    clock,
    destination,
    initialLocalRecords: [record],
    maximumAttempts: 3,
    retryDelaysMs: [100, 400],
  });
  const operationId = `SYNTH-M52-OP-${step.toUpperCase()}`;
  const queued = engine.enqueue({
    operationId,
    idempotencyKey: `SYNTH-M52-IDEM-${step.toUpperCase()}`,
    recordId: record.recordId,
    workflow: record.workflow,
    payload: Object.freeze({ state: `completed-after-${step}` }),
    expectedDestinationVersion: 1,
    deviceUpdatedAt: clock.now(),
    deviceClockOffsetMs: 0,
    lineage: M52_CANONICAL_SYNTHETIC_LINEAGE,
  });
  destination.planNetworkLoss(operationId, step);
  return { clock, destination, engine, queued };
}

describe("M5.2 offline synchronization under network loss", () => {
  it.each(M52_SYNC_STEPS)(
    "retains and recovers the write when connectivity fails at %s",
    (step) => {
      const { clock, destination, engine, queued } = networkRig(step);

      const firstAttempt = engine.reconnect();
      const scheduled = engine.queueSnapshot()[0];
      const earlyRetry = engine.synchronizePass();
      clock.advance(100);
      const dueRetry = engine.synchronizePass();
      const entry = engine.queueSnapshot()[0];
      const reconciliation = engine.reconcileRecords();

      expect(firstAttempt.attempted).toBe(1);
      expect(scheduled).toMatchObject({
        status: "retry_wait",
        lifetimeAttempts: 1,
        nextRetryAt: "2026-07-15T14:00:00.100Z",
      });
      expect(earlyRetry.attempted).toBe(0);
      expect(dueRetry).toMatchObject({ attempted: 1, synchronized: 1 });
      expect(entry).toMatchObject({
        queueId: queued.entry.queueId,
        status: "synchronized",
        lifetimeAttempts: 2,
        retryWindowAttempts: 2,
        lastFailureStep: null,
        lastFailureReason: null,
      });
      expect(destination.metrics().syntheticMutationCount).toBe(1);
      expect(destination.getRecord(queued.entry.record.recordId)?.payload).toEqual(
        queued.entry.record.payload,
      );
      expect(reconciliation).toMatchObject({
        fullySynchronized: true,
        zeroDataLoss: true,
        unaccountedRecordIds: [],
        liveCalls: 0,
        liveWrites: 0,
        synthetic: true,
      });
      expect(reconciliation.records).toHaveLength(1);
      expect(reconciliation.records[0]).toMatchObject({
        classification: "matched",
        sourceAccountedFor: true,
        matched: true,
      });
      expect(engine.verifyAuditChain()).toBe(true);
    },
  );

  it.each(["write_after", "confirm_commit", "reconcile"] as const)(
    "suppresses a duplicate destination mutation after acknowledgement loss at %s",
    (step) => {
      const { clock, destination, engine } = networkRig(step);

      engine.reconnect();
      clock.advance(100);
      engine.synchronizePass();
      const entry = engine.queueSnapshot()[0];

      expect(entry?.duplicateDeliverySuppressed).toBe(true);
      expect(destination.metrics()).toMatchObject({
        syntheticMutationCount: 1,
        duplicateSuppressionCount: 1,
        retainedReceiptCount: 1,
        liveCalls: 0,
        liveWrites: 0,
      });
      expect(
        engine
          .auditHistory()
          .some(
            (event) =>
              event.eventType === "offline_destination_duplicate_suppressed" &&
              event.outcome === "duplicate_suppressed",
          ),
      ).toBe(true);
    },
  );

  it("bounds retries without deleting the local intent, then recovers it on a later reconnect", () => {
    const clock = new M52DeterministicClock();
    const record = initialRecord("SYNTH-M52-RECORD-BOUNDED-RETRY");
    const destination = new M52SyntheticSyncDestination(clock, [record]);
    const engine = new M52OfflineSyncEngine({
      clock,
      destination,
      initialLocalRecords: [record],
      maximumAttempts: 3,
    });
    const queued = engine.enqueue({
      operationId: "SYNTH-M52-OP-BOUNDED-RETRY",
      idempotencyKey: "SYNTH-M52-IDEM-BOUNDED-RETRY",
      recordId: record.recordId,
      workflow: record.workflow,
      payload: Object.freeze({ state: "must-not-be-lost" }),
      expectedDestinationVersion: 1,
      deviceUpdatedAt: clock.now(),
      deviceClockOffsetMs: 0,
      lineage: M52_CANONICAL_SYNTHETIC_LINEAGE,
    });
    destination.planNetworkLoss(queued.entry.operationId, "connect", 10);

    engine.reconnect();
    clock.advance(1_000);
    engine.synchronizePass();
    clock.advance(4_000);
    engine.synchronizePass();

    expect(engine.queueSnapshot()[0]).toMatchObject({
      status: "retry_exhausted",
      lifetimeAttempts: 3,
      retryWindowAttempts: 3,
      lastFailureStep: "connect",
    });
    expect(engine.localRecord(record.recordId)?.payload).toEqual({
      state: "must-not-be-lost",
    });
    expect(destination.metrics().syntheticMutationCount).toBe(0);
    expect(engine.localStatus()).toMatchObject({
      state: "attention_required",
      retryExhausted: 1,
      totalRetainedIntents: 1,
    });

    destination.clearNetworkLoss(queued.entry.operationId);
    engine.reconnect();

    expect(engine.queueSnapshot()[0]).toMatchObject({
      status: "synchronized",
      lifetimeAttempts: 4,
      retryWindowAttempts: 1,
    });
    expect(engine.reconcileRecords()).toMatchObject({
      fullySynchronized: true,
      zeroDataLoss: true,
      destinationMutationCount: 1,
    });
  });

  it("preserves all writes through a long offline interval without consuming retry attempts", () => {
    const clock = new M52DeterministicClock();
    const records = [
      initialRecord("SYNTH-M52-RECORD-LONG-OFFLINE-01"),
      initialRecord("SYNTH-M52-RECORD-LONG-OFFLINE-02"),
    ];
    const destination = new M52SyntheticSyncDestination(clock, records);
    const engine = new M52OfflineSyncEngine({
      clock,
      destination,
      initialLocalRecords: records,
    });
    records.forEach((record, index) => {
      engine.enqueue({
        operationId: `SYNTH-M52-OP-LONG-OFFLINE-${index + 1}`,
        idempotencyKey: `SYNTH-M52-IDEM-LONG-OFFLINE-${index + 1}`,
        recordId: record.recordId,
        workflow: record.workflow,
        payload: Object.freeze({ state: `offline-update-${index + 1}` }),
        expectedDestinationVersion: 1,
        deviceUpdatedAt: clock.now(),
        deviceClockOffsetMs: 0,
        lineage: M52_CANONICAL_SYNTHETIC_LINEAGE,
      });
    });
    destination.setConnected(false);

    const firstOfflinePass = engine.synchronizePass();
    clock.advance(90 * 24 * 60 * 60 * 1_000);
    const secondOfflinePass = engine.synchronizePass();

    expect(firstOfflinePass).toMatchObject({
      attempted: 0,
      deferredOffline: 2,
      retainedIntentCount: 2,
    });
    expect(secondOfflinePass).toMatchObject({
      attempted: 0,
      deferredOffline: 2,
      retainedIntentCount: 2,
    });
    expect(engine.queueSnapshot().every((entry) => entry.lifetimeAttempts === 0)).toBe(
      true,
    );
    expect(engine.localStatus()).toMatchObject({
      state: "offline",
      queued: 2,
      totalRetainedIntents: 2,
    });

    engine.reconnect();

    expect(engine.queueSnapshot().every((entry) => entry.status === "synchronized")).toBe(
      true,
    );
    expect(engine.reconcileRecords()).toMatchObject({
      sourceCount: 2,
      destinationCount: 2,
      synchronizedIntentCount: 2,
      unresolvedIntentCount: 0,
      fullySynchronized: true,
      zeroDataLoss: true,
    });
  });
});
