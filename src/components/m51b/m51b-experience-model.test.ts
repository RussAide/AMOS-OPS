import { describe, expect, it } from "vitest";
import { presentM51BIntegratedResult } from "../../../api/routers/m51b";
import { runM51BIntegratedScenario } from "../../../api/services/m51b";
import {
  m51bAcceptanceCounts,
  m51bChannelReadiness,
  m51bHasZeroLiveOperations,
  m51bSharePointGateReadiness,
  M51B_SHAREPOINT_GATE_PRESENTATION,
  type M51BAcceptancePresentation,
  type M51BSnapshot,
} from "./m51b-experience-model";

async function executiveSnapshot(): Promise<M51BSnapshot> {
  const result = await runM51BIntegratedScenario();
  return {
    ...presentM51BIntegratedResult(result),
    viewer: {
      role: "managing-director",
      tier: "T1",
      canRunIntegratedEvaluation: true,
      serverDerivedIdentity: true,
    },
  };
}

describe("M5.1B Microsoft integration experience model", () => {
  it("defaults to the exact eight-control milestone display", () => {
    expect(m51bAcceptanceCounts(null)).toEqual({
      passed: 0,
      total: 8,
      assertions: 0,
    });
  });

  it("counts passed controls and executable assertions from supplied evidence", () => {
    const result: M51BAcceptancePresentation = {
      accepted: false,
      acceptanceFlags: Array.from({ length: 8 }, (_, index) => ({
        criterionId: `M5.1B-AC-${String(index + 1).padStart(2, "0")}`,
        passed: index < 7,
        assertionCount: 10 + index,
        summary: `Synthetic criterion ${index + 1}`,
        evidenceIds: [`M51B-EVIDENCE-${index + 1}`],
      })),
    };

    expect(m51bAcceptanceCounts(result)).toEqual({
      passed: 7,
      total: 8,
      assertions: 108,
    });
  });

  it("projects all three channel thresholds and the hard zero-live boundary", async () => {
    const snapshot = await executiveSnapshot();
    expect(m51bChannelReadiness(snapshot)).toEqual([
      expect.objectContaining({ channel: "Teams", passed: true }),
      expect.objectContaining({ channel: "Outlook", passed: true }),
      expect.objectContaining({ channel: "SharePoint", passed: true }),
    ]);
    expect(m51bHasZeroLiveOperations(snapshot)).toBe(true);
    expect(snapshot.channels.teams.deliveryElapsedMilliseconds).toBeLessThanOrEqual(
      30_000,
    );
    expect(snapshot.channels.outlook.exactlyOneIntake).toBe(true);
    expect(snapshot.channels.sharepoint.governanceGatesPassed).toBe(11);
    expect(snapshot.channels.sharepoint.elapsedSeconds).toBeLessThanOrEqual(300);
  });

  it("fails each channel projection when its required evidence drifts", async () => {
    const snapshot = await executiveSnapshot();
    const teamsDrift = {
      ...snapshot,
      channels: {
        ...snapshot.channels,
        teams: { ...snapshot.channels.teams, withinThreshold: false },
      },
    } as unknown as M51BSnapshot;
    const outlookDrift = {
      ...snapshot,
      channels: {
        ...snapshot.channels,
        outlook: { ...snapshot.channels.outlook, duplicatePrevented: false },
      },
    } as unknown as M51BSnapshot;
    const sharePointDrift = {
      ...snapshot,
      channels: {
        ...snapshot.channels,
        sharepoint: {
          ...snapshot.channels.sharepoint,
          reconciliationPassed: false,
        },
      },
    } as unknown as M51BSnapshot;

    expect(m51bChannelReadiness(teamsDrift)[0]?.passed).toBe(false);
    expect(m51bChannelReadiness(outlookDrift)[1]?.passed).toBe(false);
    expect(m51bChannelReadiness(sharePointDrift)[2]?.passed).toBe(false);
  });

  it("projects the actual SharePoint gate evidence and fails a named gate closed", async () => {
    const snapshot = await executiveSnapshot();
    const governanceGates = Object.fromEntries(
      M51B_SHAREPOINT_GATE_PRESENTATION.map(({ code }) => [code, true]),
    );
    const drifted = {
      ...snapshot,
      channels: {
        ...snapshot.channels,
        sharepoint: {
          ...snapshot.channels.sharepoint,
          governanceGates: { ...governanceGates, stable_identity: false },
        },
      },
    } as unknown as M51BSnapshot;

    const gates = m51bSharePointGateReadiness(drifted);
    expect(gates).toHaveLength(11);
    expect(gates.find(({ code }) => code === "registry")?.passed).toBe(true);
    expect(gates.find(({ code }) => code === "stable_identity")?.passed).toBe(
      false,
    );
  });

  it("does not infer named SharePoint gate results from aggregate counts", async () => {
    const snapshot = await executiveSnapshot();
    const withoutGateEvidence = {
      ...snapshot,
      channels: {
        ...snapshot.channels,
        sharepoint: {
          ...snapshot.channels.sharepoint,
          governanceGates: undefined,
          governanceGatesPassed: 11,
          governanceGatesTotal: 11,
        },
      },
    } as unknown as M51BSnapshot;

    expect(
      m51bSharePointGateReadiness(withoutGateEvidence).every(
        ({ passed }) => !passed,
      ),
    ).toBe(true);
  });

  it("fails the zero-live projection for every unsafe boundary value", async () => {
    const snapshot = await executiveSnapshot();
    const unsafeValues: readonly (readonly [
      keyof M51BSnapshot["boundary"],
      boolean | number,
    ])[] = [
      ["syntheticOnly", false],
      ["realDataUsed", true],
      ["realFileContentRead", true],
      ["liveGraphCalls", 1],
      ["liveMicrosoftReads", 1],
      ["liveMicrosoftWrites", 1],
      ["realNotificationsSent", 1],
      ["realMailRead", 1],
      ["productionRows", 1],
      ["liveWrites", 1],
      ["liveConnectorMutation", true],
      ["tenantProvisioning", true],
      ["productionSecretRead", true],
      ["productionDeployment", true],
      ["githubPush", true],
    ];

    for (const [field, unsafeValue] of unsafeValues) {
      const drifted = {
        ...snapshot,
        boundary: { ...snapshot.boundary, [field]: unsafeValue },
      } as unknown as M51BSnapshot;
      expect(
        m51bHasZeroLiveOperations(drifted),
        `${String(field)} must invalidate the zero-live projection`,
      ).toBe(false);
    }
  });
});
