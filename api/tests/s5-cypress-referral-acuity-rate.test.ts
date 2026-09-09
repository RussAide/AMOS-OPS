import { describe, expect, it } from "vitest";
import {
  buildCypressS5Preview,
  getCypressS5Status,
} from "../doctrine/cypress-referral-acuity-rate";

describe("S5 Cypress Referral / Acuity / Rate", () => {
  it("accepts an evidence-backed high-acuity referral within the controlling 10-bed capacity", () => {
    const result = buildCypressS5Preview("high_acuity_accept");

    expect(result).toMatchObject({
      stage: "S5",
      environment: "SYNTHETIC_PREVIEW",
      noPhi: true,
      outcome: "ACCEPT_AUTHORIZED",
      disposition: "ACCEPT",
      licensedCapacity: 10,
      currentCensus: 8,
      availableBeds: 2,
      futureCapacity: 16,
      productionPromotion: "NOT_AUTHORIZED",
      rateControl: {
        floor: 450,
        target: 550,
        enhanced: 650,
        proposedDailyRate: 650,
        recommendedTier: "ENHANCED",
        recommendedDailyRate: 650,
        payerGuarantee: false,
      },
    });
    expect(result.referralReadiness.ready).toBe(true);
    expect(result.acuityProfile.evidenceRefs.length).toBeGreaterThan(0);
    expect(result.exceptions).toHaveLength(0);
    expect(result.audit.every((event) => event.status === "PASS")).toBe(true);
  });

  it("blocks a convenience or low-acuity target-population decline from being finalized", () => {
    const result = buildCypressS5Preview("target_population_decline_review");

    expect(result).toMatchObject({
      requestedDecision: "DECLINE",
      declineReasonCode: "LOW_ACUITY_PREFERENCE",
      declineClass: "CONVENIENCE_OR_BIAS",
      disposition: "DECLINE_REVIEW_REQUIRED",
      outcome: "DECLINE_REVIEW_REQUIRED",
    });
    expect(result.referralReadiness.ready).toBe(true);
    expect(result.exceptions).toContainEqual(
      expect.objectContaining({
        code: "TARGET_POPULATION_DECLINE_REVIEW_REQUIRED",
        disposition: "REVIEW",
      }),
    );
    expect(result.audit.at(-1)?.status).toBe("REVIEW_REQUIRED");
  });

  it("holds a placement proposal below the controlled $450 operating floor", () => {
    const result = buildCypressS5Preview("below_floor_rate_blocked");

    expect(result).toMatchObject({
      outcome: "HOLD_CONTROL",
      disposition: "HOLD",
      rateControl: {
        proposedDailyRate: 425,
        recommendedTier: "TARGET",
        recommendedDailyRate: 550,
      },
    });
    expect(result.exceptions).toContainEqual(
      expect.objectContaining({
        code: "RATE_BELOW_CONTROLLED_FLOOR",
        disposition: "BLOCK",
      }),
    );
  });

  it("holds at the current 10-bed controller and does not borrow future 16-bed capacity", () => {
    const result = buildCypressS5Preview("capacity_full_hold");

    expect(result).toMatchObject({
      outcome: "HOLD_CONTROL",
      disposition: "HOLD",
      licensedCapacity: 10,
      currentCensus: 10,
      availableBeds: 0,
      futureCapacity: 16,
      requestedDecision: "DECLINE",
      declineReasonCode: "NO_LICENSED_CAPACITY",
      declineClass: "PROTECTED_OPERATIONAL",
    });
    expect(result.referralReadiness.ready).toBe(false);
    expect(result.exceptions).toContainEqual(
      expect.objectContaining({ code: "CAPACITY_AT_CONTROLLING_LIMIT" }),
    );
  });

  it("fails closed when high-acuity evidence is incomplete instead of inferring support needs", () => {
    const result = buildCypressS5Preview("evidence_gap_hold");

    expect(result).toMatchObject({
      outcome: "HOLD_CONTROL",
      disposition: "HOLD",
      acuityProfile: {
        acuity: "HIGH",
        supervision: "TWO_TO_ONE",
        evidenceRefs: [],
      },
    });
    expect(result.exceptions).toContainEqual(
      expect.objectContaining({ code: "ACUITY_EVIDENCE_MISSING" }),
    );
  });

  it("reuses the existing CCMG intake-readiness gate model", () => {
    const result = buildCypressS5Preview("high_acuity_accept");
    expect(result.referralReadiness.gates.map((gate) => gate.id)).toEqual([
      "referral_intake",
      "eligibility",
      "payer_authorization",
      "consent",
      "cans_schedule",
      "capacity",
    ]);
  });

  it("declares the bounded synthetic S5 status without production authorization", () => {
    expect(getCypressS5Status()).toMatchObject({
      sprint: "Cypress Doctrine Sprint 01",
      stage: "S5",
      capability: "Referral / Acuity / Rate",
      previewAvailable: true,
      previewEnvironment: "SYNTHETIC_PREVIEW",
      noPhi: true,
      s4Accepted: true,
      productionPromotion: "NOT_AUTHORIZED",
    });
  });
});
