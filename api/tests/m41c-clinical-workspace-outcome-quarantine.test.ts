import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("M4.1C clinical-workspace outcome-measure quarantine", () => {
  it("fails closed before any inherited item or scoring path can execute", () => {
    const source = readFileSync(
      new URL(
        "../../src/pages/clinical/clinical-workspace-page.tsx",
        import.meta.url,
      ),
      "utf8",
    );
    expect(source).toContain(
      "M41C_LEGACY_OUTCOME_MEASURE_PREVIEW_ENABLED = false",
    );
    const boundary = source.slice(
      source.indexOf("function OutcomeMeasureModal"),
      source.indexOf("D007-01: ADMIT PATIENT MODAL"),
    );
    const quarantineIndex = boundary.indexOf(
      "if (!M41C_LEGACY_OUTCOME_MEASURE_PREVIEW_ENABLED)",
    );
    expect(quarantineIndex).toBeGreaterThan(0);
    expect(quarantineIndex).toBeLessThan(
      boundary.indexOf("const measureDef"),
    );
    expect(boundary).toContain(
      "enabled: M41C_LEGACY_OUTCOME_MEASURE_PREVIEW_ENABLED",
    );
    expect(boundary).toContain("cannot display those items");
    expect(boundary).toContain("update a patient");
  });
});
