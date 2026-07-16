import {
  M41C_EVIDENCE_CLASS,
  M41C_PROHIBITED_ACTIONS,
  type M41cSyntheticScenarioRunResponse,
} from "@contracts/m41c";
import { describe, expect, it } from "vitest";
import { buildM41cClinicalWorkplan } from "../../../api/services/m41c/m41b-adapter";
import { createSyntheticM41cInstrumentProfileRegistry } from "../../../api/services/m41c/instrument-profile-registry";
import { M41C_SYNTHETIC_SCENARIOS } from "../../../api/services/m41c/pathway-orchestrator";
import {
  M41C_CADENCES,
  M41C_REQUIRED_SCENARIO_KINDS,
  allClinicalWorkplanItems,
  findInstrumentProfile,
  scenarioCoverage,
  scenarioRunIsBounded,
  verifyProfileSeparation,
} from "./m41c-experience-model";

describe("M4.1C experience model", () => {
  it("keeps TRR CANS and DFPS CANS 3.0 as distinct metadata-only profiles", () => {
    const registry = createSyntheticM41cInstrumentProfileRegistry();
    const separation = verifyProfileSeparation(registry);
    const trr = findInstrumentProfile(registry, "trr_cans");
    const dfps = findInstrumentProfile(registry, "dfps_cans_3_0");

    expect(separation.distinct).toBe(true);
    expect(separation.reasons).toHaveLength(4);
    expect(trr?.profileId).not.toBe(dfps?.profileId);
    expect(trr?.programAuthority).not.toBe(dfps?.programAuthority);
    expect(trr?.itemDefinitions).toEqual([]);
    expect(dfps?.itemDefinitions).toEqual([]);
    expect(trr?.contentBinding.proprietaryContentStored).toBe(false);
    expect(dfps?.contentBinding.proprietaryContentStored).toBe(false);
    expect(trr?.productionScoringAvailable).toBe(false);
    expect(dfps?.productionScoringAvailable).toBe(false);
  });

  it("covers all five workplan cadences without a local workplan fallback", () => {
    const workplan = buildM41cClinicalWorkplan("clinical-director");
    const items = allClinicalWorkplanItems(workplan);

    expect(workplan.representedCadences).toEqual(M41C_CADENCES);
    expect(items).toHaveLength(5);
    expect(items.map((item) => item.cadence)).toEqual(M41C_CADENCES);
    expect(items.every((item) => item.productionActionBlocked)).toBe(true);
  });

  it("exposes every required deterministic scenario type", () => {
    const coverage = scenarioCoverage(M41C_SYNTHETIC_SCENARIOS);

    expect(coverage.missing).toEqual([]);
    expect(coverage.covered).toEqual(M41C_REQUIRED_SCENARIO_KINDS);
  });

  it("recognizes a scenario result only when human and zero-write boundaries hold", () => {
    const bounded: M41cSyntheticScenarioRunResponse = {
      runId: "SYNTH-M41C-RUN-ROUTINE",
      scenarioId: "SYNTH-M41C-SCENARIO-ROUTINE",
      scenarioKind: "routine",
      status: "passed",
      summary: "Synthetic routine controls passed.",
      expectedControl: "Continue governed measurement and human review.",
      humanGateRequired: true,
      sourceIds: ["M41C-SRC-CONTROLLING-DOCTRINE"],
      evidenceIds: ["SYNTH-M41C-EVIDENCE-ROUTINE"],
      auditEventIds: ["SYNTH-M41C-AUDIT-ROUTINE"],
      prohibitedActions: M41C_PROHIBITED_ACTIONS,
      productionRows: 0,
      liveWrites: 0,
      evidenceClass: M41C_EVIDENCE_CLASS,
    };

    expect(scenarioRunIsBounded(bounded)).toBe(true);
  });
});
