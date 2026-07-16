import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  M41C_NARRATIVE_OBSERVATION_COLUMNS,
  M41C_UNGOVERNED_OBSERVATION_SCORING_QUARANTINED,
  assertM15ObservationScoresAbsent,
} from "../routers/m15";

describe("M4.1C daily-observation scoring quarantine", () => {
  it.each([
    "domain1SafetyScore",
    "domain2RegulationScore",
    "domain3FunctioningScore",
    "domain4MedicationScore",
    "domain5RelationshipsScore",
    "domain6ParticipationScore",
  ] as const)("blocks %s before persistence", (field) => {
    expect(() => assertM15ObservationScoresAbsent({ [field]: 0 })).toThrow(
      M41C_UNGOVERNED_OBSERVATION_SCORING_QUARANTINED,
    );
  });

  it("projects narrative observations without legacy score or routing fields", () => {
    expect(M41C_NARRATIVE_OBSERVATION_COLUMNS).not.toMatch(
      /score|clinically_significant|routed_to/i,
    );
  });

  it("binds the guard before actor/database work and keeps the page narrative-only", () => {
    const router = readFileSync(
      new URL("../routers/m15.ts", import.meta.url),
      "utf8",
    );
    const boundary = router.slice(
      router.indexOf("createObservation:"),
      router.indexOf("respondToObservation:"),
    );
    expect(
      boundary.indexOf("assertM15ObservationScoresAbsent(input)"),
    ).toBeGreaterThan(0);
    expect(
      boundary.indexOf("assertM15ObservationScoresAbsent(input)"),
    ).toBeLessThan(boundary.indexOf("const actor"));
    expect(boundary).not.toMatch(/avgScore|reduce\(/);

    const summaryBoundary = router.slice(
      router.indexOf("coordinationSummary:"),
      router.lastIndexOf("});"),
    );
    expect(summaryBoundary).toContain("clinical_concerns");
    expect(summaryBoundary).not.toContain("clinically_significant");

    const page = readFileSync(
      new URL(
        "../../src/pages/coordination/daily-observations-page.tsx",
        import.meta.url,
      ),
      "utf8",
    );
    expect(page).not.toMatch(/domainScores|SCORE_COLORS|avgScore/);
    expect(page).not.toMatch(/domain[1-6][A-Z][A-Za-z]*Score/);
    expect(page).toContain("Submit Narrative Observation");

    const provider = readFileSync(
      new URL("../../src/providers/trpc.ts", import.meta.url),
      "utf8",
    );
    const fixtureBoundary = provider.slice(
      provider.indexOf('procedure === "m15.listObservations"'),
      provider.indexOf('procedure === "m15.coordinationSummary"'),
    );
    expect(fixtureBoundary).not.toMatch(
      /domain[1-6]_[a-z_]+_score|clinically_significant|routed_to_clinician/,
    );
  });
});
