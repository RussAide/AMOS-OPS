import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  M41C_WORKFLOW_LEGACY_CANS_LOGIC_QUARANTINED,
  assertWf002EvidenceInputAllowed,
  assertWf002TransitionInputAllowed,
  assertWf002TransitionSequence,
  workflowRouter,
} from "../routers/workflow";

function readWorkflowRouterSource(): string {
  return readFileSync(
    new URL("../routers/workflow.ts", import.meta.url),
    "utf8",
  );
}

describe("M4.1C WF-002 legacy CANS quarantine", () => {
  it("hard-quarantines the legacy completion transition", () => {
    expect(() => assertWf002TransitionInputAllowed("CANS-COMPLETE")).toThrow(
      M41C_WORKFLOW_LEGACY_CANS_LOGIC_QUARANTINED,
    );
    expect(() =>
      assertWf002TransitionInputAllowed("IN-PROGRESS"),
    ).not.toThrow();
  });

  it("hard-quarantines legacy assessment evidence", () => {
    expect(() => assertWf002EvidenceInputAllowed("cans_assessment")).toThrow(
      M41C_WORKFLOW_LEGACY_CANS_LOGIC_QUARANTINED,
    );
    expect(() =>
      assertWf002EvidenceInputAllowed("treatment_review_report"),
    ).not.toThrow();
  });

  it("requires generic assessment work before plan development", () => {
    expect(() =>
      assertWf002TransitionSequence("SCHEDULED", "PLAN-DEVELOPED"),
    ).toThrow("WF002_PLAN_DEVELOPMENT_SEQUENCE_REQUIRED");
    expect(() =>
      assertWf002TransitionSequence("CANS-COMPLETE", "PLAN-DEVELOPED"),
    ).toThrow(M41C_WORKFLOW_LEGACY_CANS_LOGIC_QUARANTINED);
    expect(() =>
      assertWf002TransitionSequence("IN-PROGRESS", "PLAN-DEVELOPED"),
    ).not.toThrow();
  });

  it("preserves generic clinical and nonclinical workflow procedures", () => {
    expect(Object.keys(workflowRouter._def.record)).toEqual(
      expect.arrayContaining([
        "createClinicalAssessmentInstance",
        "transitionClinicalAssessmentStatus",
        "submitClinicalAssessmentEvidence",
        "createReferralIntakeInstance",
        "createServiceDeliveryInstance",
        "createGROShiftInstance",
      ]),
    );
  });

  it("executes both hard-quarantine guards before database access", () => {
    const source = readWorkflowRouterSource();
    const transitionBoundary = source.slice(
      source.indexOf("transitionClinicalAssessmentStatus:"),
      source.indexOf("getClinicalAssessmentInstance:"),
    );
    const evidenceBoundary = source.slice(
      source.indexOf("submitClinicalAssessmentEvidence:"),
      source.indexOf("checkClinicalAssessmentEscalation:"),
    );

    expect(
      transitionBoundary.indexOf(
        "assertWf002TransitionInputAllowed(input.toStatus)",
      ),
    ).toBeGreaterThan(0);
    expect(
      transitionBoundary.indexOf(
        "assertWf002TransitionInputAllowed(input.toStatus)",
      ),
    ).toBeLessThan(transitionBoundary.indexOf("sqlite"));
    expect(
      evidenceBoundary.indexOf(
        "assertWf002EvidenceInputAllowed(input.gateName)",
      ),
    ).toBeGreaterThan(0);
    expect(
      evidenceBoundary.indexOf(
        "assertWf002EvidenceInputAllowed(input.gateName)",
      ),
    ).toBeLessThan(evidenceBoundary.indexOf("sqlite"));
  });

  it("keeps the WF-002 definition and seed free of operational CANS claims", () => {
    const source = readWorkflowRouterSource();
    const definitionBoundary = source.slice(
      source.indexOf("// WF-002: Clinical Assessment"),
      source.indexOf("// WF-003: Service Delivery"),
    );
    const seedBoundary = source.slice(
      source.indexOf("const wf002 = ["),
      source.indexOf(
        "// ─── WF-003: Service Delivery",
        source.indexOf("const wf002 = ["),
      ),
    );
    const evidenceSeedBoundary = source.slice(
      source.indexOf("const evidenceSeed ="),
      source.indexOf("for (const ev of evidenceSeed)"),
    );

    expect(definitionBoundary).not.toMatch(/\bcans\b/i);
    expect(definitionBoundary).not.toContain("cans_assessment");
    expect(definitionBoundary).toContain(
      'statusMap: ["SCHEDULED", "IN-PROGRESS", "PLAN-DEVELOPED"]',
    );
    expect(seedBoundary).not.toMatch(/\bcans\b/i);
    expect(seedBoundary).toContain('fromStatus: "IN-PROGRESS"');
    expect(seedBoundary).toContain('toStatus: "PLAN-DEVELOPED"');
    expect(evidenceSeedBoundary).not.toContain("cans_assessment");
  });
});
