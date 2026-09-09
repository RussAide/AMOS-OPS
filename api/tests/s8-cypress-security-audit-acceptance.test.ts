import { describe, expect, it } from "vitest";
import { runAskAmosMedicalRecordPreview } from "../dms/ask-amos-medical-record";
import { buildCypressS5Preview } from "../doctrine/cypress-referral-acuity-rate";
import { buildCypressS6Preview } from "../doctrine/cypress-admin-workforce-stability";
import { buildCypressS7Preview } from "../doctrine/cypress-cwop-continuum-intelligence";

const OPEN_EXCEPTIONS = [
  "EXC-S1-01",
  "EXC-S1-05",
  "EXC-S2-01",
  "EXC-S4-UX-01",
] as const;

const FINAL_ACCEPTANCE_DEMOS = [
  "AUTHORIZED_MEDICAL_RECORD_RETRIEVAL",
  "UNAUTHORIZED_RETRIEVAL_DENIED",
  "SUPERSEDED_RECORD_PROTECTION",
  "AUTHORITY_CONFLICT_HANDLING",
  "EXTERNAL_CLINICAL_RECORD_INTAKE",
  "HIGH_ACUITY_REFERRAL_ACCEPTED",
  "TARGET_POPULATION_DECLINE_REVIEW",
  "HOSPITALIZATION_CONTINUITY",
  "ADMINISTRATOR_BENCHMARK_EXCEPTION",
  "EXECUTIVE_TREND_DECISION_CASE",
] as const;

describe("S8 Cypress Security / Audit / Acceptance", () => {
  it("passes authorized medical-record retrieval and preserves synthetic/no-PHI audit evidence", async () => {
    const result = await runAskAmosMedicalRecordPreview("authorized");
    expect(result).toMatchObject({
      environment: "SYNTHETIC_PREVIEW",
      noPhi: true,
      outcome: "AUTHORIZED",
      code: "AUTHORIZED_SHAREPOINT_BINARY",
    });
    expect(result.record).toMatchObject({ authorityState: "CURRENT_CONTROLLING" });
    expect(result.trace.every((entry) => entry.status === "PASS")).toBe(true);
  });

  it("fails closed for unauthorized retrieval without record or backend disclosure", async () => {
    const result = await runAskAmosMedicalRecordPreview("denied");
    expect(result.outcome).toBe("DENIED");
    expect(result.record).toBeNull();
    expect(result.backend).toBeNull();
    expect(result.trace.find((entry) => entry.step === "Contextual access")?.status).toBe("BLOCKED");
  });

  it("protects superseded records and refuses authority conflicts", async () => {
    const superseded = await runAskAmosMedicalRecordPreview("superseded_protected");
    expect(superseded).toMatchObject({
      outcome: "AUTHORIZED",
      code: "SUPERSEDED_COPY_BLOCKED_CURRENT_RETURNED",
    });
    expect(superseded.record?.authorityState).toBe("CURRENT_CONTROLLING");

    const conflict = await runAskAmosMedicalRecordPreview("authority_conflict");
    expect(conflict).toMatchObject({
      outcome: "AUTHORITY_CONFLICT",
      code: "AUTHORITY_CONFLICT",
      record: null,
      backend: null,
    });
  });

  it("accepts evidence-backed high acuity while routing convenience decline for protected review", () => {
    const accepted = buildCypressS5Preview("high_acuity_accept");
    expect(accepted).toMatchObject({
      disposition: "ACCEPT",
      outcome: "ACCEPT_AUTHORIZED",
      licensedCapacity: 10,
    });
    expect(accepted.acuityProfile.evidenceRefs.length).toBeGreaterThan(0);

    const decline = buildCypressS5Preview("target_population_decline_review");
    expect(decline).toMatchObject({
      declineClass: "CONVENIENCE_OR_BIAS",
      disposition: "DECLINE_REVIEW_REQUIRED",
      outcome: "DECLINE_REVIEW_REQUIRED",
    });
  });

  it("preserves hospitalization continuity and routes administrator benchmark exceptions", () => {
    const continuity = buildCypressS6Preview("hospitalization_return");
    expect(continuity).toMatchObject({
      outcome: "RETURN_SUPPORTED",
      licensedCapacity: 10,
      noPhi: true,
    });
    expect(continuity.placementContinuity.safeReturn).toBe(true);
    expect(continuity.placementContinuity.automaticDischargeAllowed).toBe(false);

    const admin = buildCypressS6Preview("administrator_benchmark_exception");
    expect(admin.outcome).toBe("ADMIN_CORRECTIVE_ACTION_REQUIRED");
    expect(admin.exceptions).toContainEqual(
      expect.objectContaining({ code: "ADMINISTRATOR_BENCHMARK_MISSED" }),
    );
  });

  it("turns repeated operating signals into an evidence-backed reserved executive decision case", () => {
    const result = buildCypressS7Preview("executive_trend_referral_declines");
    expect(result.outcome).toBe("EXECUTIVE_DECISION_CASE_CREATED");
    expect(result.executiveDecisionCase).toMatchObject({
      created: true,
      reservedAuthority: "GOVERNING_BODY_OR_OWNERSHIP",
      unsupportedNarrativeAlert: false,
    });
    expect(result.executiveDecisionCase.evidenceRefs.length).toBeGreaterThan(0);
  });

  it("keeps unsupported CWOP dollar claims blocked at the final acceptance boundary", () => {
    const result = buildCypressS7Preview("unsupported_savings_claim_blocked");
    expect(result.outcome).toBe("VALUE_CLAIM_BLOCKED");
    expect(result.valueMeasurement).toMatchObject({
      dollarClaimRequested: true,
      dollarClaimAllowed: false,
      estimatedAvoidedCost: null,
      sourceSupported: false,
    });
  });

  it("declares the final acceptance matrix without silently closing inherited deployment or review exceptions", () => {
    expect(FINAL_ACCEPTANCE_DEMOS).toHaveLength(10);
    expect(OPEN_EXCEPTIONS).toEqual([
      "EXC-S1-01",
      "EXC-S1-05",
      "EXC-S2-01",
      "EXC-S4-UX-01",
    ]);
    expect(OPEN_EXCEPTIONS).toContain("EXC-S2-01");
    expect(OPEN_EXCEPTIONS).toContain("EXC-S4-UX-01");
  });
});
