import { describe, expect, it } from "vitest";
import {
  buildCypressS7Preview,
  getCypressS7Status,
} from "../doctrine/cypress-cwop-continuum-intelligence";

describe("S7 Cypress CWOP Continuum Intelligence", () => {
  it("declares the bounded synthetic S7 status after S6 acceptance without S8 or production authorization", () => {
    expect(getCypressS7Status()).toMatchObject({
      sprint: "Cypress Doctrine Sprint 01",
      stage: "S7",
      capability: "CWOP Continuum Intelligence",
      previewEnvironment: "SYNTHETIC_PREVIEW",
      noPhi: true,
      s6Accepted: true,
      s8Authorized: false,
      productionPromotion: "NOT_AUTHORIZED",
    });
  });

  it("tracks the before/during/outcome continuum while withholding dollar savings without validated cost evidence", () => {
    const result = buildCypressS7Preview("continuum_outcomes_only");
    expect(result.outcome).toBe("CONTINUUM_TRACKING_ACTIVE");
    expect(result.continuum.map((row) => row.phase)).toEqual([
      "BEFORE_ADOLBI",
      "DURING_ADOLBI",
      "OUTCOME",
    ]);
    expect(result.continuum[1]).toMatchObject({
      dailyRate: 650,
      supervisionLevel: "TWO_TO_ONE",
      placementMaintained: true,
      safeReturn: true,
    });
    expect(result.valueMeasurement).toMatchObject({
      dollarClaimRequested: false,
      dollarClaimAllowed: false,
      estimatedAvoidedCost: null,
      sourceSupported: false,
    });
  });

  it("blocks a requested avoided-cost claim when the cost source is unvalidated", () => {
    const result = buildCypressS7Preview("unsupported_savings_claim_blocked");
    expect(result.outcome).toBe("VALUE_CLAIM_BLOCKED");
    expect(result.valueMeasurement).toMatchObject({
      dollarClaimRequested: true,
      dollarClaimAllowed: false,
      estimatedAvoidedCost: null,
      sourceSupported: false,
    });
    expect(result.exceptions.map((row) => row.code)).toEqual(
      expect.arrayContaining([
        "CWOP_DOLLAR_CLAIM_UNSUPPORTED",
        "CWOP_VALUE_SOURCE_NOT_VALIDATED",
      ]),
    );
  });

  it("permits a bounded synthetic avoided-cost comparison only when validated partner cost evidence supports it", () => {
    const result = buildCypressS7Preview("validated_value_case");
    expect(result.outcome).toBe("VALUE_EVIDENCE_READY");
    expect(result.valueMeasurement).toMatchObject({
      dollarClaimRequested: true,
      dollarClaimAllowed: true,
      sourceSupported: true,
      estimatedAvoidedCost: 6500,
      payerGuarantee: false,
      unilateralBillingAllowed: false,
    });
    expect(result.negotiationCase).toMatchObject({
      ready: true,
      aggregateOnly: true,
      reservedAuthority: "GOVERNING_BODY_OR_OWNERSHIP",
    });
    expect(result.valueMeasurement.sourceRefs.length).toBeGreaterThan(0);
  });

  it("turns repeated target-population decline signals into an evidence-backed ownership decision case", () => {
    const result = buildCypressS7Preview("executive_trend_referral_declines");
    expect(result.outcome).toBe("EXECUTIVE_DECISION_CASE_CREATED");
    expect(result.executiveDecisionCase).toMatchObject({
      created: true,
      trigger: "REPEATED_TARGET_POPULATION_DECLINES",
      reservedAuthority: "GOVERNING_BODY_OR_OWNERSHIP",
      unsupportedNarrativeAlert: false,
    });
    expect(result.executiveDecisionCase.evidenceRefs.length).toBeGreaterThan(0);
  });

  it("turns sustained low census into an evidence-backed ownership decision case without changing the 10-bed control", () => {
    const result = buildCypressS7Preview("executive_trend_low_census");
    expect(result.executiveDecisionCase).toMatchObject({
      created: true,
      trigger: "LOW_CENSUS",
    });
    expect(result.licensedCapacity).toBe(10);
    expect(result.futureCapacity).toBe(16);
    expect(result.executiveDecisionCase.evidenceRefs).toHaveLength(3);
  });

  it("turns rate drift into a reserved executive decision case while preserving S5 rate doctrine", () => {
    const result = buildCypressS7Preview("executive_trend_rate_drift");
    expect(result.executiveDecisionCase).toMatchObject({
      created: true,
      trigger: "RATE_DRIFT",
    });
    expect(result).toMatchObject({
      rateFloor: 450,
      rateTarget: 550,
      rateEnhanced: 650,
    });
    expect(result.executiveDecisionCase.evidenceRefs.length).toBeGreaterThan(0);
  });

  it("keeps every S7 scenario at L11, synthetic/no-PHI, with S8 and production promotion unauthorized", () => {
    const scenarios = [
      "continuum_outcomes_only",
      "validated_value_case",
      "unsupported_savings_claim_blocked",
      "executive_trend_referral_declines",
      "executive_trend_low_census",
      "executive_trend_rate_drift",
    ] as const;
    for (const scenario of scenarios) {
      const result = buildCypressS7Preview(scenario);
      expect(result.capabilityLevels).toEqual(["L11"]);
      expect(result.noPhi).toBe(true);
      expect(result.s8Authorized).toBe(false);
      expect(result.productionPromotion).toBe("NOT_AUTHORIZED");
    }
  });
});
