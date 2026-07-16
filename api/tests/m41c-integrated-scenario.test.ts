import { describe, expect, it } from "vitest";
import { M41B_CADENCES } from "@contracts/m41b";
import { M41C_PROHIBITED_ACTIONS } from "@contracts/m41c";
import { runM41cIntegratedScenario } from "../services/m41c/integrated-scenario";

describe("M4.1C integrated acceptance scenario", () => {
  it("passes all eighteen criteria and every exact-acceptance clause", () => {
    const result = runM41cIntegratedScenario();

    expect(result.exitGate).toBe(true);
    expect(result.criteria).toHaveLength(18);
    expect(result.criteria.every((criterion) => criterion.passed)).toBe(true);
    expect(Object.keys(result.criterionEvidence)).toHaveLength(18);
    expect(Object.values(result.exactAcceptance).every(Boolean)).toBe(true);
  });

  it("executes every required scenario with human and zero-write controls", () => {
    const result = runM41cIntegratedScenario();

    expect(result.scenarioRuns).toHaveLength(11);
    expect(new Set(result.scenarioRuns.map((run) => run.scenarioKind)).size).toBe(11);
    for (const run of result.scenarioRuns) {
      expect(run.status).toBe("passed");
      expect(run.humanGateRequired).toBe(true);
      expect(run.productionRows).toBe(0);
      expect(run.liveWrites).toBe(0);
      expect(run.prohibitedActions).toEqual(M41C_PROHIBITED_ACTIONS);
    }
  });

  it("binds every activated pathway to a signed council validation", () => {
    const result = runM41cIntegratedScenario();
    const signedPathways = new Set(
      result.snapshot.signedValidationRecords
        .filter((record) => record.artifactKind === "pathway")
        .map((record) => record.artifactId),
    );
    const activated = result.snapshot.pathwayCatalog.filter(
      (pathway) => pathway.activationState === "demo_approved",
    );

    expect(activated).toHaveLength(9);
    expect(activated.every((pathway) => signedPathways.has(pathway.id))).toBe(true);
  });

  it("covers every role and all five workplan cadences without exposing live actions", () => {
    const result = runM41cIntegratedScenario();

    expect(result.workplans).toHaveLength(36);
    for (const workplan of result.workplans) {
      expect(workplan.representedCadences).toEqual(M41B_CADENCES);
      expect(workplan.productionActionsBlocked).toBe(true);
    }
    expect(result.productionRows).toBe(0);
    expect(result.liveWrites).toBe(0);
  });

  it("is byte-for-byte deterministic across repeated executions", () => {
    expect(JSON.stringify(runM41cIntegratedScenario())).toBe(
      JSON.stringify(runM41cIntegratedScenario()),
    );
  });
});
