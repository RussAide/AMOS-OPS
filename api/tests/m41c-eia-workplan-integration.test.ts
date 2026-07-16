import { describe, expect, it } from "vitest";
import { M41B_CADENCES } from "@contracts/m41b";
import { M41C_PROHIBITED_ACTIONS } from "@contracts/m41c/shared";
import { ALL_ROLES, getPermissions } from "@/constants/roles";
import {
  M41C_CLINICAL_GUIDANCE_INTENTS,
  askM41cClinicalGuidance,
  buildM41cClinicalWorkplan,
} from "../services/m41c/m41b-adapter";

describe("M4.1C Ask AMOS and five-cadence clinical workplan integration", () => {
  it("extends the authoritative M4.1B workplan for all 36 roles and all five cadences", () => {
    const plans = ALL_ROLES.map(buildM41cClinicalWorkplan);
    expect(plans).toHaveLength(36);
    for (const plan of plans) {
      expect(plan.representedCadences).toEqual(M41B_CADENCES);
      expect(plan.allFiveCadences).toBe(true);
      expect(plan.productionActionsBlocked).toBe(true);
      expect(plan.baseWorkplan.roleContext.role).toBe(plan.role);
      expect(Object.keys(plan.briefs).sort()).toEqual(
        [...M41B_CADENCES].sort(),
      );
      for (const cadence of M41B_CADENCES) {
        expect(plan.briefs[cadence].items).toHaveLength(1);
        expect(plan.briefs[cadence].items[0]).toMatchObject({
          cadence,
          ownerRole: plan.role,
          productionActionBlocked: true,
        });
      }
    }
  });

  it("reveals synthetic subject detail only to roles with canonical clinical permission", () => {
    for (const role of ALL_ROLES) {
      const plan = buildM41cClinicalWorkplan(role);
      const daily = plan.briefs.daily.items[0];
      if (getPermissions(role).canViewClinical) {
        expect(daily.accessMode, role).toBe("clinical_detail");
        expect(daily.subjectIds, role).toEqual(["SYNTH-YOUTH-CONTINUUM-001"]);
      } else {
        expect(daily.accessMode, role).not.toBe("clinical_detail");
        expect(daily.subjectIds, role).toEqual([]);
      }
    }
  });

  it("answers every clinical guidance intent with source transparency and a human gate", () => {
    for (const intent of M41C_CLINICAL_GUIDANCE_INTENTS) {
      const result = askM41cClinicalGuidance({
        requestId: `SYNTH-M41C-REQUEST-${intent.toUpperCase()}`,
        role: "clinical-director",
        subjectId: "SYNTH-YOUTH-CONTINUUM-001",
        prompt: `Explain ${intent} for this synthetic evaluation.`,
        intent,
        sourceIds: ["M41C-SRC-CONTROLLING-DOCTRINE"],
      });
      expect(result.refused, intent).toBe(false);
      expect(result.citations, intent).toHaveLength(1);
      expect(result.citations[0]).toMatchObject({
        sourceId: "M41C-SRC-CONTROLLING-DOCTRINE",
        version: "M4.1C-1.0",
        sourceState: "current",
      });
      expect(result.humanGate).toMatchObject({
        required: true,
        status: "pending",
      });
      expect(result.recommendation?.prohibitedActions).toEqual(
        M41C_PROHIBITED_ACTIONS,
      );
      expect(result.productionActionBlocked).toBe(true);
    }
  });

  it("refuses current authority metadata that is not licensed or validated for execution", () => {
    const result = askM41cClinicalGuidance({
      requestId: "SYNTH-M41C-REQUEST-TRR-PENDING",
      role: "clinical-director",
      subjectId: "SYNTH-YOUTH-CONTINUUM-001",
      prompt: "Start the TRR workflow from this profile.",
      intent: "start_approved_workflow",
      sourceIds: ["M41C-SRC-TRR-CANS-METADATA"],
    });
    expect(result).toMatchObject({
      refused: true,
      refusalCode: "M41C_SOURCE_NOT_DEMO_READY",
      recommendation: null,
    });
    expect(result.missingEvidence).toContain(
      "formal freshness validation against current program authority",
    );
    expect(result.citations[0]).toMatchObject({
      sourceState: "current",
      licenseState: "license_validation_pending",
    });
  });

  it("records permission and Part 2 refusals without producing a recommendation", () => {
    const roleDenied = askM41cClinicalGuidance({
      requestId: "SYNTH-M41C-REQUEST-ROLE-DENIED",
      role: "rcs-day",
      subjectId: "SYNTH-YOUTH-CONTINUUM-001",
      prompt: "Show clinical detail.",
      intent: "what_requires_attention",
    });
    expect(roleDenied).toMatchObject({
      refused: true,
      refusalCode: "M41C_ROLE_ACCESS_DENIED",
      recommendation: null,
    });
    const part2Denied = askM41cClinicalGuidance({
      requestId: "SYNTH-M41C-REQUEST-PART2-DENIED",
      role: "behavioral-support",
      subjectId: "SYNTH-YOUTH-CONTINUUM-001",
      prompt: "Show the Part 2 segment.",
      intent: "what_requires_attention",
      part2: true,
    });
    expect(part2Denied).toMatchObject({
      refused: true,
      refusalCode: "M41C_PART2_ACCESS_DENIED",
      recommendation: null,
    });
  });
});
