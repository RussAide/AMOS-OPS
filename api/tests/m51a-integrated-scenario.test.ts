import { describe, expect, it } from "vitest";
import {
  M51A_EXACT_ACCEPTANCE_STATEMENT,
  runM51AIntegratedScenario,
} from "../services/m51a/integrated-scenario";

describe("M5.1A integrated Operations Hub experience", () => {
  it("passes the exact eight controlling criteria in canonical order", async () => {
    const result = await runM51AIntegratedScenario();
    expect(result.accepted).toBe(true);
    expect(result.acceptanceFlags.map((flag) => flag.criterionId)).toEqual([
      "M5.1A-AC-01",
      "M5.1A-AC-02",
      "M5.1A-AC-03",
      "M5.1A-AC-04",
      "M5.1A-AC-05",
      "M5.1A-AC-06",
      "M5.1A-AC-07",
      "M5.1A-AC-08",
    ]);
    expect(result.acceptanceFlags.every((flag) => flag.passed)).toBe(true);
    expect(result.acceptanceStatement).toBe(M51A_EXACT_ACCEPTANCE_STATEMENT);
  });

  it("integrates exact hub, repository, identity, pilot, and security totals", async () => {
    const result = await runM51AIntegratedScenario();
    expect(result.totals).toEqual({
      acceptanceCriteria: 8,
      passedCriteria: 8,
      sites: 14,
      libraries: 10,
      repositories: 9,
      inventoryItems: 7,
      stableObjects: 7,
      connectorOperationDecisions: 99,
      pilotItems: 12,
      securityDecisions: 1080,
      securityViolations: 0,
      liveGraphCalls: 0,
      liveMicrosoftWrites: 0,
      productionRows: 0,
      realDataRecords: 0,
    });
  });

  it("enforces all four modes for every registered connector operation", async () => {
    const result = await runM51AIntegratedScenario();
    expect(result.connectorRegistry.validationIssues).toEqual([]);
    expect(result.connectorRegistry.completeness.representedModes).toHaveLength(4);
    expect(result.connectorRegistry.modeOperations.attemptedOperations).toBe(99);
    expect(result.connectorRegistry.modeOperations.modeMismatches).toBe(0);
    expect(
      result.connectorRegistry.modeOperations.decisions.every(
        (decision) => !decision.liveExecutionAvailable,
      ),
    ).toBe(true);
  });

  it("resolves stable identity through rename, move, and cross-drive rebind", async () => {
    const result = await runM51AIntegratedScenario();
    expect(result.stableIdentity).toMatchObject({
      renameResolved: true,
      moveResolved: true,
      crossDriveResolved: true,
      priorLocatorsPreserved: true,
      sourceOfTruth: "AMOS-DMS",
      liveMicrosoftMutationAvailable: false,
    });
    expect(result.stableIdentity.validationErrors).toEqual([]);
    expect(result.stableIdentity.mapping.bindingHistory).toHaveLength(4);
    expect(result.stableIdentity.current.address.driveId).toBe(
      "SYNTH-DRIVE-GOVERNANCE-ARCHIVE",
    );
  });

  it("recovers from outage and expired delta without duplicate execution", async () => {
    const result = await runM51AIntegratedScenario();
    expect(result.reliability.retry).toMatchObject({
      status: "succeeded",
      replayed: false,
      liveGraphCalls: 0,
      liveWrites: 0,
    });
    expect(result.reliability.retry.attempts).toHaveLength(2);
    expect(result.reliability.replay.replayed).toBe(true);
    expect(result.reliability.duplicateExecutionPrevented).toBe(true);
    expect(result.reliability.expiredDelta.status).toBe("resync_required");
    expect(result.reliability.checkpointHeldAfterExpiredDelta).toBe(true);
    expect(result.reliability.recoveryResync.status).toBe("succeeded");
    expect(result.reliability.reconciliation.passed).toBe(true);
    expect(result.reliability.actualSleepCalls).toBe(0);
  });

  it("keeps pilot, security, and the hard synthetic boundary clean", async () => {
    const result = await runM51AIntegratedScenario();
    expect(result.pilot).toMatchObject({
      accepted: true,
      productionRows: 0,
      liveWrites: 0,
      realDataUsed: false,
      reconciliation: { passed: true },
      rollback: { rollbackComplete: true, sourceUnchanged: true },
    });
    expect(result.security).toMatchObject({
      accepted: true,
      decisionCount: 1080,
      metadataOnlyViolations: 0,
      excludedModeViolations: 0,
      staleSuppressionViolations: 0,
      unauthorizedAiRetrievalViolations: 0,
      liveWriteViolations: 0,
      permissionLeakViolations: 0,
      dlpDecisionViolations: 0,
    });
    expect(result.boundary).toMatchObject({
      syntheticOnly: true,
      realDataUsed: false,
      liveMicrosoftReads: 0,
      liveMicrosoftWrites: 0,
      productionRows: 0,
      githubPush: false,
    });
  });

  it("replays deterministically", async () => {
    const first = await runM51AIntegratedScenario();
    const second = await runM51AIntegratedScenario();
    expect(second).toEqual(first);
  });
});
