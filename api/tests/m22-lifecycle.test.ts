import { describe, expect, it } from "vitest";
import { M22_MHTCM_FUNCTIONS, M22DomainError } from "@contracts/mhtcm";
import {
  M22_SCENARIO_ACTORS,
  M22_SCENARIO_IDS,
  runM22RepresentativeScenario,
  seedM22CaseThroughApprovedPlan,
} from "../services/mhtcm";

describe("M2.2 representative lifecycle", () => {
  it("passes all eight acceptance criteria through one complete synthetic episode", () => {
    const result = runM22RepresentativeScenario();
    expect(result.acceptanceGate).toBe(true);
    expect(Object.keys(result.criteria)).toEqual([
      "M2.2-01",
      "M2.2-02",
      "M2.2-03",
      "M2.2-04",
      "M2.2-05",
      "M2.2-06",
      "M2.2-07",
      "M2.2-08",
    ]);
    expect(Object.values(result.criteria).every(Boolean)).toBe(true);
    expect(result.snapshot.case.lifecycle.map((item) => item.function)).toEqual(
      M22_MHTCM_FUNCTIONS,
    );
  });

  it("preserves immutable plan versions and exact M2.1 lineage", () => {
    const { snapshot } = runM22RepresentativeScenario();
    expect(snapshot.planVersions).toHaveLength(2);
    expect(
      snapshot.planVersions.map((plan) => [
        plan.version,
        plan.previousVersion,
        plan.status,
      ]),
    ).toEqual([
      [1, null, "draft"],
      [2, 1, "approved"],
    ]);
    expect(snapshot.planVersions[0].sourceCansAssessmentId).toBe(
      "M21-CANS-EXISTING-V2",
    );
    expect(snapshot.planVersions[1].sourceLineageId).toBe(
      "M21-LINEAGE-EXISTING-V2-MHTCM",
    );
    expect(snapshot.case.referralId).toBe("M21-REF-EXISTING-001");
    expect(snapshot.case.youthId).toBe("SYNTH-YOUTH-EXISTING-001");
    expect(snapshot.case.targetPlanId).toBe("SYNTH-MHTCM-PLAN-001");
    expect(snapshot.planVersions[1].components.goals).toHaveLength(1);
    expect(snapshot.planVersions[1].components.providers).toHaveLength(1);
    expect(snapshot.planVersions[1].components.referrals).toHaveLength(1);
    expect(snapshot.planVersions[1].components.contacts).toHaveLength(1);
    expect(snapshot.planVersions[1].components.barriers).toHaveLength(1);
    expect(snapshot.planVersions[1].components.outcomes).toHaveLength(1);
  });

  it("enforces exact lifecycle sequence", () => {
    const engine = seedM22CaseThroughApprovedPlan();
    expect(() =>
      engine.completeLifecycleFunction(
        M22_SCENARIO_ACTORS.caseManager,
        M22_SCENARIO_IDS.caseId,
        "care_coordination",
        "2026-06-04T09:00:00.000Z",
        "Attempt out of order.",
      ),
    ).toThrowError(M22DomainError);
    expect(
      engine.repository.getCase(M22_SCENARIO_IDS.caseId)?.lifecycle,
    ).toHaveLength(0);
  });

  it("enforces the discharge, aftercare, authorization, and escalation clocks", () => {
    const { snapshot } = runM22RepresentativeScenario();
    expect(snapshot.dischargePlan).toMatchObject({
      leadDays: 15,
      completedOn: "2026-06-30",
      projectedDischargeOn: "2026-07-15",
    });
    expect(snapshot.aftercare).toMatchObject({
      dueOn: "2026-08-14",
      scheduledFor: "2026-07-25",
    });
    expect(snapshot.authorization).toMatchObject({
      renewalDueOn: "2026-07-14",
      procedureCode: "T1017",
    });
    expect(snapshot.authorizationAlerts).toEqual([
      expect.objectContaining({
        daysUntilRenewal: 13,
        priority: "urgent",
        escalationLevel: "supervisor",
      }),
    ]);
  });
});
