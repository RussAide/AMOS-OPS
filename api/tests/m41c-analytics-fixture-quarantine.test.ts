import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { M41C_ANALYTICS_UNGOVERNED_DERIVATIONS_REMOVED } from "../routers/m10";

describe("M4.1C analytics and evaluation-fixture quarantine", () => {
  it("publishes a deterministic analytics disposition", () => {
    expect(M41C_ANALYTICS_UNGOVERNED_DERIVATIONS_REMOVED).toBe(
      "M41C_ANALYTICS_UNGOVERNED_DERIVATIONS_REMOVED",
    );
  });

  it("contains no operational CANS score, risk-band, or generic LOC analytics", () => {
    const analytics = readFileSync(
      new URL("../routers/m10.ts", import.meta.url),
      "utf8",
    );
    const provider = readFileSync(
      new URL("../../src/providers/trpc.ts", import.meta.url),
      "utf8",
    );

    expect(analytics).not.toMatch(/avgCansScore|byRiskLevel|byLevelOfCare/);
    expect(analytics).not.toContain("Assessment (CANS/ANSA)");
    expect(provider).not.toContain('measureType: "CANS"');
    expect(provider).not.toMatch(/Reduced CANS score|Complete CANS assessment/);
    expect(provider).not.toContain('serviceName: "CANS Assessment"');
    expect(provider).toContain("rawLegacyScoresReturned: false");
  });
});
