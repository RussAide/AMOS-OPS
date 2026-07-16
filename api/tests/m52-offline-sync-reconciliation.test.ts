import { describe, expect, it } from "vitest";
import { M52_APPROVED_WORKFLOW_IDS } from "@contracts/m52/shared";
import {
  M52_SYNC_STEPS,
  runM52OfflineSyncScenario,
} from "../services/m52/sync";

describe("M5.2 canonical offline synchronization scenario", () => {
  it("proves zero data loss after network loss, long offline operation, conflicts, and reconnect", () => {
    const result = runM52OfflineSyncScenario();

    expect(result).toMatchObject({
      accepted: true,
      counts: {
        queued: 8,
        delivered: 8,
        conflictsDetected: 2,
        conflictsResolved: 2,
        duplicateSubmissionsSuppressed: 1,
      },
      networkLoss: {
        allRecovered: true,
      },
      longOffline: {
        durationMs: 1_814_400_000,
        retainedIntentCount: 8,
        attemptsConsumedWhileOffline: 0,
        recovered: true,
      },
      reconciliation: {
        sourceCount: 8,
        destinationCount: 8,
        retainedIntentCount: 8,
        synchronizedIntentCount: 8,
        unresolvedIntentCount: 0,
        unaccountedRecordIds: [],
        fullySynchronized: true,
        zeroDataLoss: true,
        auditChainValid: true,
        liveCalls: 0,
        liveWrites: 0,
        synthetic: true,
      },
      lostRecords: 0,
      audit: {
        immutable: true,
        chainValid: true,
      },
      boundary: {
        liveCalls: 0,
        liveWrites: 0,
        liveDeployments: 0,
        realRecords: 0,
        synthetic: true,
      },
    });
    expect(result.counts.duplicateDeliveriesSuppressed).toBeGreaterThanOrEqual(3);
    expect(result.approvedWorkflowsExercised).toEqual(
      M52_APPROVED_WORKFLOW_IDS,
    );
    expect(result.networkLoss.stepsExercised).toEqual(M52_SYNC_STEPS);
    expect(result.networkLoss.recoveredOperationIds).toHaveLength(
      M52_SYNC_STEPS.length,
    );
    expect(result.reconciliation.records).toHaveLength(8);
    expect(
      result.reconciliation.records.every(
        (record) =>
          record.matched &&
          record.sourceAccountedFor &&
          record.classification === "matched" &&
          record.sourceFingerprint === record.destinationFingerprint,
      ),
    ).toBe(true);
    expect(result.audit.eventCount).toBeGreaterThan(40);
  });

  it("is deterministic across repeated runs", () => {
    const first = runM52OfflineSyncScenario();
    const second = runM52OfflineSyncScenario();

    expect(second).toEqual(first);
  });

  it("returns deeply frozen acceptance evidence", () => {
    const result = runM52OfflineSyncScenario();

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.counts)).toBe(true);
    expect(Object.isFrozen(result.networkLoss)).toBe(true);
    expect(Object.isFrozen(result.networkLoss.stepsExercised)).toBe(true);
    expect(Object.isFrozen(result.longOffline)).toBe(true);
    expect(Object.isFrozen(result.reconciliation)).toBe(true);
    expect(Object.isFrozen(result.reconciliation.records)).toBe(true);
    expect(Object.isFrozen(result.audit)).toBe(true);
    expect(Object.isFrozen(result.boundary)).toBe(true);
  });
});
