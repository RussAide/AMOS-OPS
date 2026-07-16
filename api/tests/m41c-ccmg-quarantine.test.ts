import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  M41C_CCMG_UNGOVERNED_COMPLETION_METRIC_REMOVED,
  assertCcmgLegacyCansInputsAbsent,
  ccmgRouter,
  quarantineCcmgLegacyCansLogic,
} from "../routers/ccmg";

const QUARANTINE_CODE = "M41C_LEGACY_CANS_LOGIC_QUARANTINED";

function readCcmgRouterSource(): string {
  return readFileSync(new URL("../routers/ccmg.ts", import.meta.url), "utf8");
}

describe("M4.1C CCMG legacy CANS quarantine", () => {
  it("exposes the deterministic fail-closed quarantine error", () => {
    expect(() => quarantineCcmgLegacyCansLogic()).toThrow(QUARANTINE_CODE);
  });

  it.each([
    ["cansCompleted", false],
    ["cansScore", 0],
    ["cansRiskLevel", "low"],
  ] as const)("rejects the care-coordination input %s", (field, value) => {
    expect(() => assertCcmgLegacyCansInputsAbsent({ [field]: value })).toThrow(
      QUARANTINE_CODE,
    );
  });

  it("retains generic care-coordination and referral workflows", () => {
    expect(() => assertCcmgLegacyCansInputsAbsent({})).not.toThrow();
    expect(Object.keys(ccmgRouter._def.record)).toEqual(
      expect.arrayContaining([
        "createCareCoordination",
        "updateCareCoordination",
        "transferDepartment",
        "createReferral",
        "completeReferral",
      ]),
    );
  });

  it("binds the guard only to updateCareCoordination before database access", () => {
    const source = readCcmgRouterSource();
    const createBoundary = source.slice(
      source.indexOf("createCareCoordination:"),
      source.indexOf("updateCareCoordination:"),
    );
    const updateBoundary = source.slice(
      source.indexOf("updateCareCoordination:"),
      source.indexOf("transferDepartment:"),
    );
    const guard = "assertCcmgLegacyCansInputsAbsent(input)";

    expect(createBoundary).not.toContain(guard);
    expect(updateBoundary.indexOf(guard)).toBeGreaterThan(0);
    expect(updateBoundary.indexOf(guard)).toBeLessThan(
      updateBoundary.indexOf("const db = getDb()"),
    );
  });

  it("keeps the synthetic seed boundary free of CANS and derived LOC claims", () => {
    const source = readCcmgRouterSource();
    const seedBoundary = source.slice(source.indexOf("seedCcmgData"));

    expect(seedBoundary).not.toMatch(/\bcans\b/i);
    expect(seedBoundary).not.toMatch(/cans(?:Completed|Score|Risk)/);
    expect(seedBoundary).not.toMatch(/\bloc(?:-|\b)/i);
  });

  it("removes the inherited completion metric from the dashboard read and UI", () => {
    const source = readCcmgRouterSource();
    const dashboardBoundary = source.slice(source.indexOf("bhcDashboard:"));
    expect(M41C_CCMG_UNGOVERNED_COMPLETION_METRIC_REMOVED).toBe(
      "M41C_CCMG_UNGOVERNED_COMPLETION_METRIC_REMOVED",
    );
    expect(dashboardBoundary).not.toContain("cansCompleted");
    expect(dashboardBoundary).not.toContain("cansCompletionRate");
    expect(dashboardBoundary).toContain("governedAssessmentMode");

    const page = readFileSync(
      new URL("../../src/pages/bhc/bhc-dashboard-page.tsx", import.meta.url),
      "utf8",
    );
    expect(page).not.toContain("cansCompletionRate");
    expect(page).not.toContain("CANS Complete");
    expect(page).toContain("Assessment Review");
  });
});
