import { describe, expect, it } from "vitest";
import { M23_SYNTHETIC_VIEW } from "../../src/data/m23-synthetic-data";
import { m23Router } from "../routers/m23";

describe("M2.3 router and demo experience contract", () => {
  it("exposes every governed workflow operation through the isolated router", () => {
    expect(Object.keys(m23Router._def.procedures).sort()).toEqual([
      "addGoal",
      "addIntervention",
      "caseDetail",
      "completeReview",
      "createPlanVersion",
      "dashboard",
      "documentSession",
      "evaluateReviewAlerts",
      "evidence",
      "operationalSummary",
      "recordNeed",
      "registerCase",
      "requestClaimHandoff",
      "signSession",
      "transitionPlan",
    ]);
  });

  it("presents four selectable workflow scenarios and six explicit negative controls", () => {
    expect(M23_SYNTHETIC_VIEW.evidenceClass).toContain("Synthetic prototype");
    expect(M23_SYNTHETIC_VIEW.scenarios).toHaveLength(4);
    expect(new Set(M23_SYNTHETIC_VIEW.scenarios.map((scenario) => scenario.category)).size).toBe(4);
    expect(M23_SYNTHETIC_VIEW.scenarios.filter((scenario) => scenario.procedureCode === "H2017").map((scenario) => scenario.age))
      .toEqual([19, 18]);
    expect(M23_SYNTHETIC_VIEW.gates).toHaveLength(6);
    expect(M23_SYNTHETIC_VIEW.gates.every((gate) => gate.status === "Blocked as designed")).toBe(true);
  });

  it("makes departmental ownership and read-only bridge boundaries visible", () => {
    expect(M23_SYNTHETIC_VIEW.bridges).toEqual([
      expect.objectContaining({ owner: "CCMG", mode: "Read only" }),
      expect.objectContaining({ owner: "CCMG", mode: "Read only" }),
      expect.objectContaining({ owner: "MHTCM", mode: "Read only" }),
    ]);
  });
});
