import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  M41C_UNGOVERNED_ELIGIBILITY_DECISION_QUARANTINED,
  assertMhtcmEligibilityDecisionNotActivated,
  mhtcmEligibilityReviewStatus,
} from "../routers/mhtcm";

describe("M4.1C MHTCM eligibility decision quarantine", () => {
  it.each(["eligible", "ineligible"] as const)(
    "blocks direct %s activation",
    (eligibilityStatus) => {
      expect(() =>
        assertMhtcmEligibilityDecisionNotActivated({ eligibilityStatus }),
      ).toThrow(M41C_UNGOVERNED_ELIGIBILITY_DECISION_QUARANTINED);
    },
  );

  it("allows only non-decisional workflow states", () => {
    expect(() =>
      assertMhtcmEligibilityDecisionNotActivated({
        eligibilityStatus: "under_review",
      }),
    ).not.toThrow();
    expect(() =>
      assertMhtcmEligibilityDecisionNotActivated({
        eligibilityStatus: "pending",
      }),
    ).not.toThrow();
  });

  it("routes complete documentation to human review without deciding eligibility", () => {
    expect(
      mhtcmEligibilityReviewStatus({
        ageQualified: true,
        diagnosisQualified: true,
        functionalImpairment: true,
        medicaidEligible: true,
      }),
    ).toBe("under_review");
    expect(mhtcmEligibilityReviewStatus({})).toBe("pending");
  });

  it("binds the activation guard before database access and seeds no decision", () => {
    const source = readFileSync(
      new URL("../routers/mhtcm.ts", import.meta.url),
      "utf8",
    );
    const updateBoundary = source.slice(
      source.indexOf("updateEligibility:"),
      source.indexOf("mhtcmDashboard:"),
    );
    expect(
      updateBoundary.indexOf(
        "assertMhtcmEligibilityDecisionNotActivated(input)",
      ),
    ).toBeGreaterThan(0);
    expect(
      updateBoundary.indexOf(
        "assertMhtcmEligibilityDecisionNotActivated(input)",
      ),
    ).toBeLessThan(updateBoundary.indexOf("const db = getDb()"));

    const seedBoundary = source.slice(source.indexOf("seedMhtcmData"));
    expect(seedBoundary).not.toContain('eligibilityStatus: "eligible"');
    expect(seedBoundary).not.toContain('eligibilityStatus: "ineligible"');
  });
});
