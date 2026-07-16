import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  M41C_M13_LEGACY_LOC_READS_WITHHELD,
  M41C_UNGOVERNED_LOC_LOGIC_QUARANTINED,
  M41C_YOUTH_PROFILE_COLUMNS,
  assertM13LevelOfCareInputAbsent,
  buildM13GovernedLocReference,
  m13Router,
  quarantineM13UngovernedLevelOfCare,
} from "../routers/m13";

function readM13RouterSource(): string {
  return readFileSync(new URL("../routers/m13.ts", import.meta.url), "utf8");
}

describe("M4.1C M13 ungoverned level-of-care quarantine", () => {
  it("exposes one deterministic fail-closed error", () => {
    expect(() => quarantineM13UngovernedLevelOfCare()).toThrow(
      M41C_UNGOVERNED_LOC_LOGIC_QUARANTINED,
    );
  });

  it.each([
    "residential",
    "day_treatment",
    "outpatient",
    "crisis_stabilization",
    "not_yet_determined",
  ] as const)("rejects every levelOfCare update value: %s", (levelOfCare) => {
    expect(() => assertM13LevelOfCareInputAbsent({ levelOfCare })).toThrow(
      M41C_UNGOVERNED_LOC_LOGIC_QUARANTINED,
    );
  });

  it("preserves generic youth and intake workflow operations", () => {
    expect(() => assertM13LevelOfCareInputAbsent({})).not.toThrow();
    expect(Object.keys(m13Router._def.record)).toEqual(
      expect.arrayContaining([
        "createYouth",
        "updateYouth",
        "createIntake",
        "updateStep",
        "createChecklist",
        "updateChecklist",
      ]),
    );
  });

  it("executes the update guard before database access and removes LOC mapping", () => {
    const source = readM13RouterSource();
    const updateBoundary = source.slice(
      source.indexOf("updateYouth:"),
      source.indexOf("// ─── Intake Pipeline"),
    );
    const guard = "assertM13LevelOfCareInputAbsent(input)";

    expect(updateBoundary.indexOf(guard)).toBeGreaterThan(0);
    expect(updateBoundary.indexOf(guard)).toBeLessThan(
      updateBoundary.indexOf("sqlite"),
    );
    expect(updateBoundary).not.toContain('levelOfCare: "level_of_care"');
  });

  it("uses only the neutral level-of-care value during youth initialization", () => {
    const source = readM13RouterSource();
    const createBoundary = source.slice(
      source.indexOf("createYouth:"),
      source.indexOf("updateYouth:"),
    );

    expect(createBoundary).toContain('"not_yet_determined"');
    expect(createBoundary).not.toMatch(
      /"(?:residential|day_treatment|outpatient|crisis_stabilization)"/,
    );
    expect(source).not.toMatch(/\bseed(?:M13|Youth|Demo)/i);
  });

  it("withholds legacy level-of-care values from every youth-profile read", () => {
    expect(M41C_YOUTH_PROFILE_COLUMNS).not.toMatch(/level_of_care/i);
    expect(buildM13GovernedLocReference("SYNTH-YOUTH-001")).toMatchObject({
      disposition: M41C_M13_LEGACY_LOC_READS_WITHHELD,
      rawLegacyLevelOfCareReturned: false,
      humanReviewRequired: true,
      liveWrites: 0,
    });

    const source = readM13RouterSource();
    const readBoundary = source.slice(
      source.indexOf("listYouth:"),
      source.indexOf("createYouth:"),
    );
    expect(readBoundary).not.toContain("SELECT * FROM youth_profiles");
    expect(readBoundary.match(/M41C_YOUTH_PROFILE_COLUMNS/g)).toHaveLength(3);
    expect(readBoundary.match(/withM13GovernedLocReference/g)).toHaveLength(3);
  });
});
