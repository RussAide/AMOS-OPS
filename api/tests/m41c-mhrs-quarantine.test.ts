import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  M41C_MHRS_LEGACY_CANS_INPUT_QUARANTINED,
  assertMhrsEncounterLegacyCansInputsAbsent,
  assertMhrsServicePlanLegacyCansInputsAbsent,
  assertMhrsSkillsAssessmentLegacyCansInputsAbsent,
  mhrsRouter,
  quarantineMhrsLegacyCansInput,
} from "../routers/mhrs";

function readMhrsRouterSource(): string {
  return readFileSync(new URL("../routers/mhrs.ts", import.meta.url), "utf8");
}

describe("M4.1C MHRS legacy CANS input quarantine", () => {
  it("exposes one deterministic fail-closed quarantine error", () => {
    expect(() => quarantineMhrsLegacyCansInput()).toThrow(
      M41C_MHRS_LEGACY_CANS_INPUT_QUARANTINED,
    );
  });

  it.each([
    ["cansDomainPrimary", "behavioral_emotional"],
    ["cansDomainSecondary", "functioning"],
    ["cansBaselineScore", 0],
    ["cansTargetScore", 0],
  ] as const)("rejects the service-plan input %s", (field, value) => {
    expect(() =>
      assertMhrsServicePlanLegacyCansInputsAbsent({ [field]: value }),
    ).toThrow(M41C_MHRS_LEGACY_CANS_INPUT_QUARANTINED);
  });

  it.each([
    ["cansDomainTargeted", "risk_behaviors"],
    ["cansScoreCurrent", 0],
  ] as const)("rejects the encounter input %s", (field, value) => {
    expect(() =>
      assertMhrsEncounterLegacyCansInputsAbsent({ [field]: value }),
    ).toThrow(M41C_MHRS_LEGACY_CANS_INPUT_QUARANTINED);
  });

  it("rejects the skills-assessment CANS domain", () => {
    expect(() =>
      assertMhrsSkillsAssessmentLegacyCansInputsAbsent({
        cansDomain: "strengths",
      }),
    ).toThrow(M41C_MHRS_LEGACY_CANS_INPUT_QUARANTINED);
  });

  it("retains generic MHRS service-plan, encounter, and skills workflows", () => {
    expect(() => assertMhrsServicePlanLegacyCansInputsAbsent({})).not.toThrow();
    expect(() => assertMhrsEncounterLegacyCansInputsAbsent({})).not.toThrow();
    expect(() =>
      assertMhrsSkillsAssessmentLegacyCansInputsAbsent({}),
    ).not.toThrow();
    expect(Object.keys(mhrsRouter._def.record)).toEqual(
      expect.arrayContaining([
        "createServicePlan",
        "updateServicePlan",
        "createEncounter",
        "signEncounter",
        "createSkillsAssessment",
      ]),
    );
  });

  it("binds every guard before database access", () => {
    const source = readMhrsRouterSource();
    const boundaries = [
      {
        source: source.slice(
          source.indexOf("createServicePlan:"),
          source.indexOf("updateServicePlan:"),
        ),
        guard: "assertMhrsServicePlanLegacyCansInputsAbsent(input)",
      },
      {
        source: source.slice(
          source.indexOf("createEncounter:"),
          source.indexOf("signEncounter:"),
        ),
        guard: "assertMhrsEncounterLegacyCansInputsAbsent(input)",
      },
      {
        source: source.slice(
          source.indexOf("createSkillsAssessment:"),
          source.indexOf("mhrsDashboard:"),
        ),
        guard: "assertMhrsSkillsAssessmentLegacyCansInputsAbsent(input)",
      },
    ];

    for (const boundary of boundaries) {
      expect(boundary.source.indexOf(boundary.guard)).toBeGreaterThan(0);
      expect(boundary.source.indexOf(boundary.guard)).toBeLessThan(
        boundary.source.indexOf("const db = getDb()"),
      );
    }
  });

  it("keeps seeds free of inherited CANS domains and scores", () => {
    const source = readMhrsRouterSource();
    const seedBoundary = source.slice(source.indexOf("seedMhrsData"));

    expect(seedBoundary).not.toMatch(/\bcans\b/i);
    expect(seedBoundary).not.toMatch(
      /cans(?:Domain|Baseline|Target|Score|Current)/,
    );
    expect(seedBoundary).toContain("Governed-assessment records");
    expect(seedBoundary).toContain(
      "governed-assessment records remain unseeded",
    );
  });
});
