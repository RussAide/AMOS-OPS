import { describe, expect, it } from "vitest";
import { M24_CRITERIA, M24_SCENARIO_IDS } from "../../contracts/gro/m24-model";
import { runM24AcceptanceSuite } from "../lib/m24-gro/scenarios";

describe("M2.4 deterministic acceptance suite", () => {
  it("passes the exact six controlling scenarios with synthetic-only evidence", () => {
    const suite = runM24AcceptanceSuite();
    expect(suite).toMatchObject({
      milestone: "M2.4",
      evidenceClass: "synthetic_demo",
      passed: true,
    });
    expect(suite.results.map((item) => item.id)).toEqual(M24_SCENARIO_IDS);
    expect(suite.results.every((item) => item.passed)).toBe(true);
    expect(suite.scenarioRuns).toHaveLength(6);
    expect(
      suite.scenarioRuns.every(
        (item) => item.id.startsWith("SYNTH-") && item.status === "passed",
      ),
    ).toBe(true);
  });

  it("is byte-for-byte deterministic for results, runs, state, and dashboard", () => {
    expect(runM24AcceptanceSuite()).toEqual(runM24AcceptanceSuite());
  });

  it("produces evidence across all eight acceptance criteria", () => {
    const suite = runM24AcceptanceSuite();
    expect(M24_CRITERIA).toHaveLength(8);
    expect(suite.dashboard.census.stages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stageNumber: 1,
          currentCensus: 14,
          percentFull: 88,
        }),
        expect.objectContaining({ stageNumber: 2 }),
        expect.objectContaining({ stageNumber: 3 }),
      ]),
    );
    expect(suite.snapshot.censusAlerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stageId: "M24-STAGE-1",
          percentFull: 94,
          resolvedAt: "2026-07-14T17:00:00.000Z",
        }),
      ]),
    );
    expect(
      suite.snapshot.placements.find(
        (item) => item.caseId === "M21-CASE-EXISTING-001",
      ),
    ).toMatchObject({
      youthId: "SYNTH-YOUTH-EXISTING-001",
      youthLabel: "Synthetic Youth Existing-01",
      status: "discharged",
    });
    expect(suite.snapshot.staffingEvaluations).not.toHaveLength(0);
    expect(suite.snapshot.safetyRounds).not.toHaveLength(0);
    expect(suite.snapshot.careLogs).not.toHaveLength(0);
    expect(suite.snapshot.shiftHandoffs).not.toHaveLength(0);
    expect(suite.snapshot.medications).not.toHaveLength(0);
    expect(suite.snapshot.incidents).not.toHaveLength(0);
    expect(suite.snapshot.rightsAcknowledgments).not.toHaveLength(0);
    expect(suite.snapshot.practiceDecisions).toEqual([
      expect.objectContaining({
        practiceCode: "verbal-deescalation",
        allowed: true,
        classification: "supportive",
      }),
      expect.objectContaining({
        practiceCode: "corporal-punishment",
        allowed: false,
        classification: "prohibited",
      }),
      expect.objectContaining({
        practiceCode: "synthetic-unknown-practice",
        allowed: false,
        classification: "unknown",
      }),
    ]);
    expect(
      new Set(suite.snapshot.engagementEvents.map((item) => item.eventType)),
    ).toEqual(
      new Set([
        "family_contact",
        "activity",
        "transport",
        "crisis",
        "discharge_coordination",
      ]),
    );
  });

  it("keeps the scenario engine independent from the singleton runtime engine", async () => {
    const { m24GroEngine } = await import("../lib/m24-gro/engine");
    m24GroEngine.reset();
    runM24AcceptanceSuite();
    expect(m24GroEngine.getState().placements).toHaveLength(0);
  });
});
