import { describe, expect, it } from "vitest";
import { quarantineLegacyCansLogic } from "../routers/bhc";
import {
  M41C_NARRATIVE_ASSESSMENT_COLUMNS,
  quarantineM14UnapprovedClinicalLogic,
} from "../routers/m14";
import { isM21CansSyntheticRegressionContext } from "../routers/m21";

describe("M4.1C legacy CANS quarantine", () => {
  it("blocks the inherited BHC scoring and record surfaces before any write", () => {
    expect(() => quarantineLegacyCansLogic()).toThrow(
      "M41C_LEGACY_CANS_LOGIC_QUARANTINED",
    );
  });

  it("blocks inherited M1.4 scoring, derived risk, and generic level-of-care logic", () => {
    expect(() => quarantineM14UnapprovedClinicalLogic()).toThrow(
      "M41C_LEGACY_CANS_LOGIC_QUARANTINED",
    );
  });

  it("projects narrative assessment data without exposing inherited clinical derivations", () => {
    expect(M41C_NARRATIVE_ASSESSMENT_COLUMNS).not.toMatch(
      /cans|loc_|risk_|score/i,
    );
  });

  it("retains M2.1 CANS lineage only inside the labeled synthetic regression boundary", () => {
    expect(
      isM21CansSyntheticRegressionContext({
        evidenceClass: "synthetic_demo",
        actorId: "SYNTH-QMHP-001",
        instrumentVersion: "CANS-SYNTHETIC-2026.1",
      }),
    ).toBe(true);
    expect(
      isM21CansSyntheticRegressionContext({
        evidenceClass: "production",
        actorId: "SYNTH-QMHP-001",
        instrumentVersion: "CANS-SYNTHETIC-2026.1",
      }),
    ).toBe(false);
    expect(
      isM21CansSyntheticRegressionContext({
        evidenceClass: "synthetic_demo",
        actorId: "REAL-QMHP-001",
        instrumentVersion: "CANS-SYNTHETIC-2026.1",
      }),
    ).toBe(false);
    expect(
      isM21CansSyntheticRegressionContext({
        evidenceClass: "synthetic_demo",
        actorId: "SYNTH-QMHP-001",
        instrumentVersion: "CANS-UNVALIDATED-REAL",
      }),
    ).toBe(false);
  });
});
