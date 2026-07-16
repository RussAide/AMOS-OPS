import { describe, expect, it } from "vitest";
import { PHASE2_EXIT_CRITERIA, runPhase2IntegratedScenario } from "../services/phase2/integrated-scenario";

describe("Phase 2 integrated youth continuum", () => {
  it("moves one exact synthetic identity through all three operational milestones", () => {
    const result = runPhase2IntegratedScenario();
    expect(result.identityContinuity).toBe(true);
    expect(result.representativeIdentity).toMatchObject({
      ccmgCaseId: "M21-CASE-EXISTING-001",
      referralId: "M21-REF-EXISTING-001",
      youthId: "SYNTH-YOUTH-EXISTING-001",
      cansAssessmentId: "M21-CANS-EXISTING-V2",
      mhtcmPlanId: "SYNTH-MHTCM-PLAN-001",
    });
  });

  it("passes all 24 criteria and the Phase 2 exit gate", () => {
    const result = runPhase2IntegratedScenario();
    expect(PHASE2_EXIT_CRITERIA).toHaveLength(24);
    expect(result.failedCriteria).toEqual([]);
    expect(Object.values(result.criteria).filter(Boolean)).toHaveLength(24);
    expect(result.exitGate).toBe(true);
    expect(result.scenarioRun).toMatchObject({ status: "passed", assertionsFailed: 0 });
  });

  it("contains synthetic-only evidence and controlled aftercare and claims", () => {
    const result = runPhase2IntegratedScenario();
    expect(result.evidenceClass).toBe("synthetic_demo");
    expect(result.milestoneEvidence.m22.snapshot.aftercare?.completedAt).not.toBeNull();
    expect(result.milestoneEvidence.m22.claimHandoff.status).toBe("ready_for_revenue");
    expect(result.milestoneEvidence.m23.scenarios.every((scenario) => scenario.claimHandoffState === "ready_for_revenue")).toBe(true);
    expect(result.milestoneEvidence.m24.evidenceClass).toBe("synthetic_demo");
  });
});
