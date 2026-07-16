import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { bhcRouter, buildBhcGovernedAssessmentReference } from "../routers/bhc";

function readBhcRouterSource(): string {
  return readFileSync(new URL("../routers/bhc.ts", import.meta.url), "utf8");
}

function getPatientProcedureBoundary(): string {
  const source = readBhcRouterSource();
  const start = source.indexOf("getPatient:");
  const end = source.indexOf("createPatient:");
  expect(start).toBeGreaterThan(0);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("M4.1C BHC patient governed-assessment boundary", () => {
  it("builds deterministic quarantine metadata without raw assessment content", () => {
    const first = buildBhcGovernedAssessmentReference("SYNTH-YOUTH-001");
    const replay = buildBhcGovernedAssessmentReference("SYNTH-YOUTH-001");

    expect(first).toEqual(replay);
    expect(first).toMatchObject({
      milestone: "M4.1C",
      subjectId: "SYNTH-YOUTH-001",
      disposition: "legacy_assessment_rows_quarantined",
      rawLegacyRowsReturned: false,
      humanReviewRequired: true,
      productionRows: 0,
      liveWrites: 0,
      evidenceClass: "synthetic_clinical_demo",
    });
    expect(first.governedProfileIds).toEqual([
      "M41C-INSTRUMENT-TRR-CANS",
      "M41C-INSTRUMENT-DFPS-CANS-3",
    ]);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.governedProfileIds)).toBe(true);
    expect(JSON.stringify(first)).not.toMatch(
      /domainScores|totalScore|actionableItems|assessmentDate/i,
    );
  });

  it("does not query or return raw legacy assessment rows from getPatient", () => {
    const boundary = getPatientProcedureBoundary();

    expect(boundary).not.toContain(".from(assessments)");
    expect(boundary).not.toContain("assessments.youthId");
    expect(boundary).not.toContain("assessments.assessmentDate");
    expect(boundary).not.toContain("cansAssessments");
    expect(boundary).not.toMatch(/domainScores|totalScore|actionableItems/i);
    expect(boundary).toContain(
      "governedAssessmentReference: buildBhcGovernedAssessmentReference(",
    );
  });

  it("preserves ordinary patient-profile collections while withholding numeric outcomes", () => {
    const boundary = getPatientProcedureBoundary();

    for (const required of [
      "patient,",
      "treatmentPlans: plans",
      "recentSessions: sessions",
      "outcomeMeasures: []",
      "governedOutcomeMeasureReference:",
      "careCoordination,",
    ]) {
      expect(boundary).toContain(required);
    }
    expect(Object.keys(bhcRouter._def.record)).toContain("getPatient");
  });
});
