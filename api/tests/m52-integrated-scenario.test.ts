import { describe, expect, it } from "vitest";
import { M52_APPROVED_WORKFLOW_IDS, M52_CRITERION_IDS } from "@contracts/m52/shared";
import { runM52IntegratedScenario } from "../services/m52";

describe("M5.2 integrated mobile and offline scenario", () => {
  it("accepts all eight frozen criteria with a zero-live boundary", async () => {
    const result = await runM52IntegratedScenario();
    expect(result.accepted).toBe(true);
    expect(result.acceptanceFlags.map((flag) => flag.criterionId)).toEqual(
      M52_CRITERION_IDS,
    );
    expect(result.acceptanceFlags.every((flag) => flag.passed)).toBe(true);
    expect(result.totals).toMatchObject({
      acceptanceCriteria: 8,
      passedCriteria: 8,
      assertionCount: 57,
      inheritedAssertionCount: 117,
      approvedWorkflows: 4,
      reconciledWorkflowRecords: 4,
      lostRecords: 0,
      productionRows: 0,
      liveExternalCalls: 0,
      liveMicrosoftReads: 0,
      liveMicrosoftWrites: 0,
      realNotificationsSent: 0,
      deployments: 0,
      githubPushes: 0,
    });
  });

  it("executes the exact four-workflow set through authorization, ciphertext, queue, destination, and reconciliation", async () => {
    const result = await runM52IntegratedScenario();
    expect(result.workflows.map((workflow) => workflow.workflowId)).toEqual(
      M52_APPROVED_WORKFLOW_IDS,
    );
    for (const workflow of result.workflows) {
      expect(workflow).toMatchObject({
        allowedActionExecuted: true,
        prohibitedActionDenied: true,
        ciphertextEnvelopeCount: 1,
        persistedPlaintextBytes: 0,
        queueLineageBound: true,
        payloadPreservedExactly: true,
        synchronized: true,
        zeroDataLoss: true,
        unresolvedIntentCount: 0,
        liveCalls: 0,
        liveWrites: 0,
        synthetic: true,
      });
      expect(workflow.restrictions.length).toBeGreaterThanOrEqual(5);
    }
  });

  it("binds the 4:13 medication-pass claim to ordered timing and reconciliation evidence", async () => {
    const result = await runM52IntegratedScenario();
    expect(result.medicationTiming.ordered).toBe(true);
    expect(result.medicationTiming.events).toHaveLength(6);
    expect(result.medicationTiming.evidence).toMatchObject({
      measuredElapsedSeconds: 253,
      source: "integrated-scenario",
    });
    expect(result.experience.medicationPass).toMatchObject({
      measuredElapsedSeconds: 253,
      completedUnderFiveMinutes: true,
      noVerificationControlBypassed: true,
      outcome: "administered",
      administrationNoteCaptured: true,
      attestationCaptured: true,
    });
    expect(result.experience.reconnect).toMatchObject({
      syncState: "synced",
      dataLossCount: 0,
      zeroDataLoss: true,
      passed: true,
    });
  });

  it("proves network-loss recovery, long-offline retention, partial sync, duplicates, and governed conflicts", async () => {
    const result = await runM52IntegratedScenario();
    expect(result.sync.networkLoss).toMatchObject({
      allRecovered: true,
    });
    expect(result.sync.networkLoss.stepsExercised).toHaveLength(6);
    expect(result.sync.longOffline).toMatchObject({
      attemptsConsumedWhileOffline: 0,
      recovered: true,
    });
    expect(result.sync.partialSync).toMatchObject({
      conflictsStillHeld: 2,
      observed: true,
    });
    expect(result.sync.partialSync.synchronizedBeforeConflictResolution).toBeGreaterThan(0);
    expect(result.sync.counts).toMatchObject({
      conflictsDetected: 2,
      conflictsResolved: 2,
      duplicateSubmissionsSuppressed: 1,
    });
    expect(result.sync.counts.duplicateDeliveriesSuppressed).toBeGreaterThan(0);
  });

  it("purges encrypted cache and transport queue together on logout, reinstall, and device loss", async () => {
    const result = await runM52IntegratedScenario();
    expect(result.purgeLifecycle).toEqual({
      logoutPurged: true,
      deviceLossPurged: true,
      reinstallPurged: true,
      destinationMutations: 0,
      liveCalls: 0,
      liveWrites: 0,
      synthetic: true,
    });
  });

  it("is deterministic across repeated evaluations", async () => {
    expect(await runM52IntegratedScenario()).toEqual(
      await runM52IntegratedScenario(),
    );
  });
});
