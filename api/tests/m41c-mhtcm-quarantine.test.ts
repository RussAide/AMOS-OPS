import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  M41C_LEGACY_CANS_LOGIC_QUARANTINED,
  assertMhtcmEligibilityLegacyCansInputsAbsent,
  assertMhtcmServicePlanLegacyCansInputsAbsent,
  mhtcmRouter,
  quarantineMhtcmLegacyCansLogic,
} from "../routers/mhtcm";

function readMhtcmRouterSource(): string {
  return readFileSync(new URL("../routers/mhtcm.ts", import.meta.url), "utf8");
}

describe("M4.1C MHTCM legacy CANS quarantine", () => {
  it("exposes one deterministic fail-closed quarantine error", () => {
    expect(() => quarantineMhtcmLegacyCansLogic()).toThrow(
      M41C_LEGACY_CANS_LOGIC_QUARANTINED,
    );
  });

  it.each([
    ["cansScoreAtIntake", 0],
    ["cansRiskLevel", "low"],
    ["locLevel", "not_determined"],
  ] as const)("rejects the service-plan input %s", (field, value) => {
    expect(() =>
      assertMhtcmServicePlanLegacyCansInputsAbsent({ [field]: value }),
    ).toThrow(M41C_LEGACY_CANS_LOGIC_QUARANTINED);
  });

  it.each([
    ["cansAssessmentId", "SYNTH-LEGACY-CANS-001"],
    ["cansTotalScore", 0],
  ] as const)("rejects the eligibility input %s", (field, value) => {
    expect(() =>
      assertMhtcmEligibilityLegacyCansInputsAbsent({ [field]: value }),
    ).toThrow(M41C_LEGACY_CANS_LOGIC_QUARANTINED);
  });

  it("retains generic service-plan, eligibility, and encounter workflows", () => {
    expect(() =>
      assertMhtcmServicePlanLegacyCansInputsAbsent({}),
    ).not.toThrow();
    expect(() =>
      assertMhtcmEligibilityLegacyCansInputsAbsent({}),
    ).not.toThrow();
    expect(Object.keys(mhtcmRouter._def.record)).toEqual(
      expect.arrayContaining([
        "createServicePlan",
        "updateServicePlan",
        "createEligibility",
        "updateEligibility",
        "createEncounter",
      ]),
    );
  });

  it("binds each guard to its create procedure before database access", () => {
    const source = readMhtcmRouterSource();
    const servicePlanBoundary = source.slice(
      source.indexOf("createServicePlan:"),
      source.indexOf("updateServicePlan:"),
    );
    const eligibilityBoundary = source.slice(
      source.indexOf("createEligibility:"),
      source.indexOf("updateEligibility:"),
    );

    expect(
      servicePlanBoundary.indexOf(
        "assertMhtcmServicePlanLegacyCansInputsAbsent(input)",
      ),
    ).toBeGreaterThan(0);
    expect(
      servicePlanBoundary.indexOf(
        "assertMhtcmServicePlanLegacyCansInputsAbsent(input)",
      ),
    ).toBeLessThan(servicePlanBoundary.indexOf("const db = getDb()"));
    expect(
      eligibilityBoundary.indexOf(
        "assertMhtcmEligibilityLegacyCansInputsAbsent(input)",
      ),
    ).toBeGreaterThan(0);
    expect(
      eligibilityBoundary.indexOf(
        "assertMhtcmEligibilityLegacyCansInputsAbsent(input)",
      ),
    ).toBeLessThan(eligibilityBoundary.indexOf("const db = getDb()"));
  });

  it("keeps the synthetic seed boundary free of CANS and derived LOC content", () => {
    const source = readMhtcmRouterSource();
    const seedBoundary = source.slice(source.indexOf("seedMhtcmData"));

    expect(seedBoundary).not.toMatch(/\bcans\b/i);
    expect(seedBoundary).not.toMatch(/cans(?:Score|Risk|Assessment|Total)/);
    expect(seedBoundary).not.toMatch(/loc(?:Determined|Level)/);
  });
});
