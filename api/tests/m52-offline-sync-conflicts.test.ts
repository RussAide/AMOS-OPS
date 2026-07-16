import { describe, expect, it } from "vitest";
import {
  M52DeterministicClock,
  M52_CANONICAL_SYNTHETIC_LINEAGE,
  M52OfflineSyncEngine,
  M52SyntheticSyncDestination,
  type M52SyncRecord,
} from "../services/m52/sync";

function record(input: {
  recordId: string;
  version?: number;
  state?: string;
}): M52SyncRecord {
  return Object.freeze({
    recordId: input.recordId,
    workflow: "bhc_field_case_management_contact",
    payload: Object.freeze({ state: input.state ?? "baseline" }),
    version: input.version ?? 1,
    updatedAt: "2026-07-15T13:55:00.000Z",
    synthetic: true,
  });
}

describe("M5.2 conflict and duplicate controls", () => {
  it("detects a destination version conflict and requires an explicit merge", () => {
    const clock = new M52DeterministicClock();
    const local = record({ recordId: "SYNTH-M52-RECORD-VERSION" });
    const destinationRecord = record({
      recordId: local.recordId,
      version: 2,
      state: "concurrent-destination-change",
    });
    const destination = new M52SyntheticSyncDestination(clock, [destinationRecord]);
    const engine = new M52OfflineSyncEngine({
      clock,
      destination,
      initialLocalRecords: [local],
    });
    const queued = engine.enqueue({
      operationId: "SYNTH-M52-OP-VERSION",
      idempotencyKey: "SYNTH-M52-IDEM-VERSION",
      recordId: local.recordId,
      workflow: local.workflow,
      payload: Object.freeze({ state: "local-authorized-change" }),
      expectedDestinationVersion: 1,
      deviceUpdatedAt: clock.now(),
      deviceClockOffsetMs: 0,
      lineage: M52_CANONICAL_SYNTHETIC_LINEAGE,
    });

    engine.reconnect();

    expect(engine.queueSnapshot()[0]).toMatchObject({
      status: "conflict",
      conflict: {
        kind: "version_conflict",
        expectedDestinationVersion: 1,
        actualDestinationVersion: 2,
        requiresUserResolution: true,
        resolved: false,
      },
    });
    expect(destination.metrics().syntheticMutationCount).toBe(0);
    expect(engine.synchronizePass().attempted).toBe(0);

    engine.resolveConflict(queued.entry.queueId, {
      resolution: "merge",
      resolvedBy: M52_CANONICAL_SYNTHETIC_LINEAGE.userId,
      mergedPayload: Object.freeze({
        state: "explicitly-merged",
        supervisorApproved: true,
      }),
    });
    engine.reconnect();

    expect(destination.getRecord(local.recordId)).toMatchObject({
      version: 3,
      payload: {
        state: "explicitly-merged",
        supervisorApproved: true,
      },
    });
    expect(engine.queueSnapshot()[0]).toMatchObject({
      status: "synchronized",
      resolutionCount: 1,
      conflict: {
        resolved: true,
        resolution: "merge",
        resolvedBy: M52_CANONICAL_SYNTHETIC_LINEAGE.userId,
      },
    });
    expect(engine.reconcileRecords().zeroDataLoss).toBe(true);
  });

  it("detects forward and backward device clock drift without treating an old offline write as drift", () => {
    for (const offset of [300_001, -300_001]) {
      const clock = new M52DeterministicClock();
      const initial = record({
        recordId: `SYNTH-M52-RECORD-CLOCK-${offset > 0 ? "FORWARD" : "BACKWARD"}`,
      });
      const destination = new M52SyntheticSyncDestination(clock, [initial]);
      const engine = new M52OfflineSyncEngine({
        clock,
        destination,
        initialLocalRecords: [initial],
        clockDriftToleranceMs: 300_000,
      });
      const queued = engine.enqueue({
        operationId: `SYNTH-M52-OP-CLOCK-${offset}`,
        idempotencyKey: `SYNTH-M52-IDEM-CLOCK-${offset}`,
        recordId: initial.recordId,
        workflow: initial.workflow,
        payload: Object.freeze({ state: "clock-reviewed-change" }),
        expectedDestinationVersion: 1,
        deviceUpdatedAt: "2026-01-01T00:00:00.000Z",
        deviceClockOffsetMs: offset,
        lineage: M52_CANONICAL_SYNTHETIC_LINEAGE,
      });

      engine.reconnect();

      expect(engine.queueSnapshot()[0]).toMatchObject({
        status: "conflict",
        conflict: {
          kind: "clock_drift",
          deviceClockOffsetMs: offset,
          requiresUserResolution: true,
        },
      });
      expect(destination.metrics().syntheticMutationCount).toBe(0);

      engine.resolveConflict(queued.entry.queueId, {
        resolution: "keep_local",
        resolvedBy: M52_CANONICAL_SYNTHETIC_LINEAGE.userId,
      });
      engine.reconnect();

      expect(engine.queueSnapshot()[0]).toMatchObject({
        status: "synchronized",
        deviceClockOffsetMs: 0,
        conflict: {
          resolved: true,
          resolution: "keep_local",
        },
      });
      expect(destination.metrics().syntheticMutationCount).toBe(1);
      expect(engine.reconcileRecords().zeroDataLoss).toBe(true);
    }
  });

  it("allows an authorized user to accept the destination while retaining the original intent in history", () => {
    const clock = new M52DeterministicClock();
    const local = record({ recordId: "SYNTH-M52-RECORD-ACCEPT-DESTINATION" });
    const remote = record({
      recordId: local.recordId,
      version: 2,
      state: "destination-wins-by-user-choice",
    });
    const destination = new M52SyntheticSyncDestination(clock, [remote]);
    const engine = new M52OfflineSyncEngine({
      clock,
      destination,
      initialLocalRecords: [local],
    });
    const queued = engine.enqueue({
      operationId: "SYNTH-M52-OP-ACCEPT-DESTINATION",
      idempotencyKey: "SYNTH-M52-IDEM-ACCEPT-DESTINATION",
      recordId: local.recordId,
      workflow: local.workflow,
      payload: Object.freeze({ state: "retained-original-intent" }),
      expectedDestinationVersion: 1,
      deviceUpdatedAt: clock.now(),
      deviceClockOffsetMs: 0,
      lineage: M52_CANONICAL_SYNTHETIC_LINEAGE,
    });
    engine.reconnect();

    engine.resolveConflict(queued.entry.queueId, {
      resolution: "accept_destination",
      resolvedBy: M52_CANONICAL_SYNTHETIC_LINEAGE.userId,
    });

    expect(engine.localRecord(local.recordId)).toEqual(remote);
    expect(engine.queueSnapshot()[0]).toMatchObject({
      status: "synchronized",
      record: { payload: { state: "retained-original-intent" } },
      conflict: {
        resolved: true,
        resolution: "accept_destination",
      },
    });
    expect(destination.metrics().syntheticMutationCount).toBe(0);
    expect(engine.reconcileRecords()).toMatchObject({
      fullySynchronized: true,
      zeroDataLoss: true,
      synchronizedIntentCount: 1,
    });
    expect(engine.verifyAuditChain()).toBe(true);
  });

  it("suppresses a repeated local submission and rejects idempotency payload drift", () => {
    const clock = new M52DeterministicClock();
    const initial = record({ recordId: "SYNTH-M52-RECORD-DUPLICATE" });
    const destination = new M52SyntheticSyncDestination(clock, [initial]);
    const engine = new M52OfflineSyncEngine({
      clock,
      destination,
      initialLocalRecords: [initial],
    });
    const request = {
      operationId: "SYNTH-M52-OP-DUPLICATE-01",
      idempotencyKey: "SYNTH-M52-IDEM-DUPLICATE",
      recordId: initial.recordId,
      workflow: initial.workflow,
      payload: Object.freeze({ state: "one-logical-write" }),
      expectedDestinationVersion: 1,
      deviceUpdatedAt: clock.now(),
      deviceClockOffsetMs: 0,
      lineage: M52_CANONICAL_SYNTHETIC_LINEAGE,
    } as const;

    const first = engine.enqueue(request);
    const duplicate = engine.enqueue({
      ...request,
      operationId: "SYNTH-M52-OP-DUPLICATE-02",
    });

    expect(first.duplicateSuppressed).toBe(false);
    expect(duplicate).toMatchObject({
      duplicateSuppressed: true,
      queueDepth: 1,
      entry: { queueId: first.entry.queueId },
    });
    expect(engine.queueSnapshot()).toHaveLength(1);
    expect(() =>
      engine.enqueue({
        ...request,
        operationId: "SYNTH-M52-OP-DUPLICATE-03",
        payload: Object.freeze({ state: "different-payload" }),
      }),
    ).toThrow("M52_IDEMPOTENCY_KEY_PAYLOAD_COLLISION");

    engine.reconnect();

    expect(destination.metrics()).toMatchObject({
      syntheticMutationCount: 1,
      retainedReceiptCount: 1,
      liveCalls: 0,
      liveWrites: 0,
    });
    expect(engine.reconcileRecords().zeroDataLoss).toBe(true);
  });

  it("continues independent records during a partial synchronization, then reconciles all of them", () => {
    const clock = new M52DeterministicClock();
    const successful = record({ recordId: "SYNTH-M52-RECORD-PARTIAL-SUCCESS" });
    const conflictedLocal = record({ recordId: "SYNTH-M52-RECORD-PARTIAL-CONFLICT" });
    const conflictedRemote = record({
      recordId: conflictedLocal.recordId,
      version: 2,
      state: "concurrent-change",
    });
    const exhausted = record({ recordId: "SYNTH-M52-RECORD-PARTIAL-RETRY" });
    const destination = new M52SyntheticSyncDestination(clock, [
      successful,
      conflictedRemote,
      exhausted,
    ]);
    const engine = new M52OfflineSyncEngine({
      clock,
      destination,
      initialLocalRecords: [successful, conflictedLocal, exhausted],
      maximumAttempts: 2,
    });
    const entries = [successful, conflictedLocal, exhausted].map((item, index) =>
      engine.enqueue({
        operationId: `SYNTH-M52-OP-PARTIAL-${index + 1}`,
        idempotencyKey: `SYNTH-M52-IDEM-PARTIAL-${index + 1}`,
        recordId: item.recordId,
        workflow: item.workflow,
        payload: Object.freeze({ state: `partial-update-${index + 1}` }),
        expectedDestinationVersion: 1,
        deviceUpdatedAt: clock.now(),
        deviceClockOffsetMs: 0,
        lineage: M52_CANONICAL_SYNTHETIC_LINEAGE,
      }).entry,
    );
    destination.planNetworkLoss(entries[2]!.operationId, "connect", 10);

    engine.reconnect();
    clock.advance(1_000);
    engine.synchronizePass();

    expect(engine.queueSnapshot().map((entry) => entry.status)).toEqual([
      "synchronized",
      "conflict",
      "retry_exhausted",
    ]);
    expect(engine.reconcileRecords()).toMatchObject({
      synchronizedIntentCount: 1,
      unresolvedIntentCount: 2,
      fullySynchronized: false,
      zeroDataLoss: false,
      unaccountedRecordIds: [],
    });
    expect(engine.reconcileRecords().records.map((item) => item.classification)).toEqual([
      "conflict",
      "pending",
      "matched",
    ]);

    engine.resolveConflict(entries[1]!.queueId, {
      resolution: "keep_local",
      resolvedBy: M52_CANONICAL_SYNTHETIC_LINEAGE.userId,
    });
    destination.clearNetworkLoss(entries[2]!.operationId);
    engine.reconnect();

    const finalReport = engine.reconcileRecords();
    expect(engine.queueSnapshot().every((entry) => entry.status === "synchronized")).toBe(
      true,
    );
    expect(finalReport).toMatchObject({
      sourceCount: 3,
      destinationCount: 3,
      retainedIntentCount: 3,
      synchronizedIntentCount: 3,
      unresolvedIntentCount: 0,
      fullySynchronized: true,
      zeroDataLoss: true,
      unaccountedRecordIds: [],
      destinationMutationCount: 3,
      liveCalls: 0,
      liveWrites: 0,
    });
    expect(finalReport.records.every((item) => item.classification === "matched")).toBe(
      true,
    );
  });
});
