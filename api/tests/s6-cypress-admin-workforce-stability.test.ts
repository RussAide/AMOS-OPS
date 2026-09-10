import { describe, expect, it } from "vitest";
import {
  buildCypressS6Preview,
  getCypressS6Status,
} from "../doctrine/cypress-admin-workforce-stability";

describe("S6 Cypress Administrator / Workforce / Placement Stability", () => {
  it("declares the bounded synthetic S6 status after S5 acceptance without production authorization", () => {
    expect(getCypressS6Status()).toMatchObject({
      sprint: "Cypress Doctrine Sprint 01",
      stage: "S6",
      capability: "Administrator / Workforce / Placement Stability",
      previewEnvironment: "SYNTHETIC_PREVIEW",
      noPhi: true,
      s5Accepted: true,
      productionPromotion: "NOT_AUTHORIZED",
    });
  });

  it("evaluates the five role-based Administrator benchmarks without coding the control around one person", () => {
    const result = buildCypressS6Preview("administrator_ready");
    expect(result).toMatchObject({
      administratorSubject: "ROLE:GRO_ADMINISTRATOR",
      outcome: "ADMIN_WORKFORCE_READY",
      licensedCapacity: 10,
      futureCapacity: 16,
    });
    expect(result.administratorBenchmarks.map((row) => row.id)).toEqual([
      "ON_SITE_LEADERSHIP",
      "REFERRAL_RESPONSIVENESS",
      "STAFFING_READINESS",
      "HIGH_ACUITY_EXECUTION",
      "COMPLIANCE_REPORTING",
    ]);
    expect(
      result.administratorBenchmarks.every(
        (row) => row.state === "MEETS" && row.evidenceRefs.length > 0,
      ),
    ).toBe(true);
  });

  it("turns a missed Administrator benchmark into an evidence-backed corrective-action exception", () => {
    const result = buildCypressS6Preview("administrator_benchmark_exception");
    expect(result.outcome).toBe("ADMIN_CORRECTIVE_ACTION_REQUIRED");
    expect(
      result.administratorBenchmarks.find(
        (row) => row.id === "STAFFING_READINESS",
      ),
    ).toMatchObject({ state: "MISSED" });
    expect(result.correctiveAction.map((step) => [step.id, step.state])).toEqual([
      ["EVIDENCE_ASSEMBLED", "COMPLETE"],
      ["MANAGEMENT_REVIEW", "COMPLETE"],
      ["CORRECTIVE_ACTION", "COMPLETE"],
      ["FOLLOW_UP", "PENDING"],
      ["CLOSE_OR_ESCALATE", "NOT_REACHED"],
    ]);
    expect(result.exceptions).toContainEqual(
      expect.objectContaining({
        code: "ADMINISTRATOR_BENCHMARK_MISSED",
        disposition: "CORRECT",
      }),
    );
    expect(result.audit).toContainEqual(
      expect.objectContaining({
        eventType: "CORRECTIVE_ACTION_ROUTED",
        status: "REVIEW_REQUIRED",
      }),
    );
  });

  it("reuses M3.3 workforce controls and M2.4 staffing evaluation to hold an unready workforce release", () => {
    const result = buildCypressS6Preview("workforce_clearance_gap");
    expect(result.outcome).toBe("WORKFORCE_RELEASE_HELD");
    expect(result.workforce).toMatchObject({
      foundation: "M3.3_WORKFORCE",
      recruitmentToReleaseGatesPassed: true,
      credentialRequirementTypesCovered: 7,
      annualTrainingCompliant: true,
      personnelAccessControlled: true,
      clearanceReady: false,
      releaseToDutyAllowed: false,
    });
    expect(result.staffing).toMatchObject({
      foundation: "M2.4_GRO_STAFFING",
      evaluatedCensus: 6,
      qualifiedPresentStaff: 1,
      compliant: false,
    });
    expect(result.exceptions.map((row) => row.code)).toEqual(
      expect.arrayContaining([
        "WORKFORCE_CLEARANCE_INCOMPLETE",
        "STAFFING_READINESS_INSUFFICIENT",
      ]),
    );
  });

  it("preserves placement through hospitalization, modifies supports, and returns after a completed capability review", () => {
    const result = buildCypressS6Preview("hospitalization_return");
    expect(result.outcome).toBe("RETURN_SUPPORTED");
    expect(result.placementContinuity).toMatchObject({
      requestedDisposition: "RETURN",
      automaticDischargeAllowed: false,
      safeReturn: true,
      underlyingPlacementStatus: "ACTIVE",
    });
    expect(result.placementContinuity.steps.map((step) => step.id)).toEqual([
      "CRISIS_EVENT",
      "STABILIZE",
      "REASSESS",
      "MODIFY_SUPPORTS",
      "RETURN_CAPABILITY_REVIEW",
      "RETURN_OR_JUSTIFIED_DISCHARGE",
    ]);
    expect(
      result.placementContinuity.steps.every(
        (step) => step.state === "COMPLETE" && step.evidenceRefs.length > 0,
      ),
    ).toBe(true);
    expect(result.placementContinuity.supportChanges.length).toBeGreaterThan(0);
  });

  it("blocks hospitalization-to-immediate-discharge when continuity prerequisites have not been completed", () => {
    const result = buildCypressS6Preview("automatic_discharge_blocked");
    expect(result.outcome).toBe("DISCHARGE_BLOCKED");
    expect(result.placementContinuity).toMatchObject({
      requestedDisposition: "DISCHARGE",
      automaticDischargeAllowed: false,
      safeReturn: null,
      underlyingPlacementStatus: "LEAVE",
    });
    expect(
      result.placementContinuity.steps.find((step) => step.id === "REASSESS"),
    ).toMatchObject({ state: "BLOCKED" });
    expect(result.placementContinuity.executiveFlags).toContain(
      "HOSPITALIZATION_TO_DISCHARGE_PATTERN",
    );
    expect(result.exceptions.map((row) => row.code)).toEqual(
      expect.arrayContaining([
        "AUTOMATIC_CRISIS_DISCHARGE_PROHIBITED",
        "HOSPITALIZATION_TO_DISCHARGE_PATTERN",
      ]),
    );
  });

  it("allows a justified discharge only after the full continuity sequence and coordination evidence are complete", () => {
    const result = buildCypressS6Preview("justified_discharge_after_review");
    expect(result.outcome).toBe("JUSTIFIED_DISCHARGE_ALLOWED");
    expect(result.placementContinuity).toMatchObject({
      requestedDisposition: "DISCHARGE",
      automaticDischargeAllowed: false,
      safeReturn: false,
      underlyingPlacementStatus: "DISCHARGED",
    });
    expect(
      result.placementContinuity.steps.every(
        (step) => step.state === "COMPLETE" && step.evidenceRefs.length > 0,
      ),
    ).toBe(true);
    expect(result.exceptions).toContainEqual(
      expect.objectContaining({
        code: "JUSTIFIED_DISCHARGE_EVIDENCE_COMPLETE",
        disposition: "CARRY_FORWARD",
      }),
    );
  });

  it("preserves the controlling 10-bed capacity and S6 L9/L10 capability boundary in every scenario", () => {
    const scenarios = [
      "administrator_ready",
      "administrator_benchmark_exception",
      "workforce_clearance_gap",
      "hospitalization_return",
      "automatic_discharge_blocked",
      "justified_discharge_after_review",
    ] as const;
    for (const scenario of scenarios) {
      const result = buildCypressS6Preview(scenario);
      expect(result.licensedCapacity).toBe(10);
      expect(result.futureCapacity).toBe(16);
      expect(result.capabilityLevels).toEqual(["L9", "L10"]);
      expect(result.productionPromotion).toBe("NOT_AUTHORIZED");
      expect(result.noPhi).toBe(true);
    }
  });
});
