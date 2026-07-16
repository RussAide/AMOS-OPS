import { describe, expect, it } from "vitest";
import {
  M51B_ACCEPTANCE_STATEMENT,
  M51B_INTEGRATED_SCENARIO_ID,
} from "@contracts/m51b/integrated-scenario";
import { M51B_CRITERION_IDS } from "@contracts/m51b/shared";
import { runM51BIntegratedScenario } from "../services/m51b/integration/integrated-scenario";

describe("M5.1B integrated Microsoft 365 scenario", () => {
  it("passes all eight frozen acceptance criteria with executable assertions", async () => {
    const result = await runM51BIntegratedScenario();
    expect(result).toMatchObject({
      milestone: "M5.1B",
      scenarioId: M51B_INTEGRATED_SCENARIO_ID,
      acceptanceStatement: M51B_ACCEPTANCE_STATEMENT,
      accepted: true,
      synthetic: true,
      totals: {
        acceptanceCriteria: 8,
        passedCriteria: 8,
        outlookPrimaryIntakes: 1,
        openDeadLetters: 0,
        duplicateDeliveries: 0,
        liveGraphCalls: 0,
        liveMicrosoftReads: 0,
        liveMicrosoftWrites: 0,
        realNotificationsSent: 0,
        productionRows: 0,
        liveWrites: 0,
      },
    });
    expect(result.acceptanceFlags.map((flag) => flag.criterionId)).toEqual(
      M51B_CRITERION_IDS,
    );
    expect(result.acceptanceFlags.every((flag) => flag.passed)).toBe(true);
    expect(result.totals.assertionCount).toBeGreaterThanOrEqual(100);
  });

  it("meets the exact Teams, Outlook, and SharePoint operational thresholds", async () => {
    const result = await runM51BIntegratedScenario();
    expect(result.teams.primaryDelivery.timing.withinThirtySeconds).toBe(true);
    expect(result.totals.teamsDeliveryElapsedMilliseconds).toBeLessThanOrEqual(
      30_000,
    );
    expect(result.outlook.primary).toMatchObject({
      disposition: "intake_created",
      createdIntakeCount: 1,
      liveWrites: 0,
    });
    expect(result.outlook.primarySnapshot.metrics.intakeCount).toBe(1);
    expect(result.sharepoint).toMatchObject({
      accepted: true,
      withinElapsedLimit: true,
      liveMicrosoftWrites: 0,
    });
    expect(result.sharepoint.elapsedSeconds).toBeLessThanOrEqual(300);
  });

  it("recovers outages and conflicts without duplicate delivery", async () => {
    const result = await runM51BIntegratedScenario();
    expect(result.teams.assertions.retryBoundedAndRecovered).toBe(true);
    expect(result.teams).toMatchObject({
      persistentOutageDelivery: {
        status: "dead_lettered",
        attempts: expect.arrayContaining([
          expect.objectContaining({ attempt: 4, outcome: "retry_exhausted" }),
        ]),
      },
      outageRecovery: { status: "recovered" },
      operationalState: {
        activeDeadLetters: 0,
        openAlerts: 0,
        recoveredDeadLetters: 1,
        resolvedAlerts: 1,
      },
    });
    expect(result.outlook.recovery.disposition).toBe("recovered");
    expect(result.sharepoint.staleVersionConflict.status).toBe("conflict");
    expect(result.sharepoint.replay.replayed).toBe(true);
    expect(result.sharepoint.exhaustedFailureRecovery).toMatchObject({
      accepted: true,
      originalFailure: {
        channel: "sharepoint",
        status: "dead_lettered",
      },
      openedDeadLetter: { state: "open", attempts: 4 },
      operationalAlert: {
        channel: "sharepoint",
        severity: "high",
        escalationQueue: "SYNTH-QUEUE-M51B-SHAREPOINT-SUPPORT",
      },
      recovery: { channel: "sharepoint", status: "recovered" },
      recoveredDeadLetter: { state: "recovered" },
      duplicateReplay: {
        channel: "sharepoint",
        status: "duplicate_suppressed",
      },
      duplicateMutationPrevented: true,
      channelReconciliation: { accepted: true },
      contentReconciliation: { passed: true },
      reliabilitySnapshot: {
        openDeadLetters: 0,
        recoveredDeadLetters: 1,
        alertsRaised: 1,
        duplicateDeliveries: 0,
      },
    });
    expect(
      result.acceptanceFlags.find(
        (flag) => flag.criterionId === "M5.1B-AC-07",
      ),
    ).toMatchObject({ passed: true });
    expect(result.reliability.failure.channel).toBe("teams");
    expect(result.reliability).toMatchObject({
      duplicate: { status: "duplicate_suppressed" },
      failure: { status: "dead_lettered" },
      recovery: { status: "recovered" },
      reconciliation: { accepted: true },
      snapshot: {
        openDeadLetters: 0,
        recoveredDeadLetters: 1,
        duplicateDeliveries: 0,
        alertsRaised: 1,
      },
    });
  });

  it("is deterministic and performs no real Microsoft activity", async () => {
    const first = await runM51BIntegratedScenario();
    const second = await runM51BIntegratedScenario();
    expect(second).toEqual(first);
    expect(first.boundary).toMatchObject({
      syntheticOnly: true,
      realDataUsed: false,
      realFileContentRead: false,
      liveGraphCalls: 0,
      liveMicrosoftReads: 0,
      liveMicrosoftWrites: 0,
      realNotificationsSent: 0,
      realMailRead: 0,
      productionRows: 0,
      liveWrites: 0,
      productionDeployment: false,
      githubPush: false,
    });
  });
});
