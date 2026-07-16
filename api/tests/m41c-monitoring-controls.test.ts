import { describe, expect, it } from "vitest";
import type { M41cClinicalMonitoringInput } from "@contracts/m41c/mappings";
import { evaluateM41cClinicalMonitoring } from "../services/m41c/clinical-monitoring";

const healthy: M41cClinicalMonitoringInput = {
  monitorId: "SYNTH-M41C-MONITOR-HEALTHY",
  evaluatedAt: "2026-11-15T08:00:00.000Z",
  sourceExpiryCount: 0,
  versionMismatchCount: 0,
  permissionDenialCount: 0,
  safetyEscalationCount: 2,
  safetyEscalationAcknowledgedCount: 2,
  alertsIssued: 6,
  alertsActionable: 6,
  overrideCount: 2,
  overridesReviewed: 2,
  pathwayStepExpected: 100,
  pathwayStepCompleted: 100,
  outcomeReviewExpected: 4,
  outcomeReviewCompleted: 4,
  unintendedEffectCount: 0,
  unintendedEffectsReviewed: 0,
  mappingErrorCount: 0,
  subgroupCompletionRates: { "SYNTH-GROUP-A": 0.96, "SYNTH-GROUP-B": 0.94 },
};

describe("M4.1C clinical fabric monitoring", () => {
  it("passes a healthy synthetic control sample without emitting a signal", () => {
    const result = evaluateM41cClinicalMonitoring(healthy);
    expect(result.signals).toEqual([]);
    expect(result).toMatchObject({
      alertPrecision: 1,
      pathwayFidelity: 1,
      safetyAcknowledgementRate: 1,
      overrideReviewRate: 1,
      outcomeReviewRate: 1,
      unintendedEffectReviewRate: 1,
      maximumSubgroupGap: 0.02,
      productionRows: 0,
      liveWrites: 0,
    });
    expect(result.humanGate.required).toBe(true);
  });

  it("detects source, version, permission, safety, alert, override, fidelity, mapping, and disparity signals", () => {
    const result = evaluateM41cClinicalMonitoring({
      ...healthy,
      monitorId: "SYNTH-M41C-MONITOR-ISSUES",
      sourceExpiryCount: 1,
      versionMismatchCount: 2,
      permissionDenialCount: 3,
      safetyEscalationCount: 4,
      safetyEscalationAcknowledgedCount: 3,
      alertsIssued: 10,
      alertsActionable: 2,
      overrideCount: 3,
      overridesReviewed: 2,
      pathwayStepExpected: 100,
      pathwayStepCompleted: 82,
      outcomeReviewExpected: 4,
      outcomeReviewCompleted: 3,
      unintendedEffectCount: 2,
      unintendedEffectsReviewed: 1,
      mappingErrorCount: 2,
      subgroupCompletionRates: {
        "SYNTH-GROUP-A": 0.95,
        "SYNTH-GROUP-B": 0.7,
      },
    });
    expect(result.signals.map((signal) => signal.kind)).toEqual([
      "source_expiry",
      "version_mismatch",
      "permission_control",
      "safety_follow_through",
      "alert_fatigue",
      "override_review",
      "pathway_fidelity",
      "outcome_review",
      "unintended_effects",
      "mapping_quality",
      "disparity_review",
    ]);
    expect(
      result.signals.filter((signal) => signal.severity === "urgent"),
    ).toHaveLength(5);
    expect(result.auditEvents).toHaveLength(result.signals.length);
    expect(result.auditEvents.every((event) => event.immutable)).toBe(true);
    expect(result.alertPrecision).toBe(0.2);
    expect(result.pathwayFidelity).toBe(0.82);
    expect(result.maximumSubgroupGap).toBe(0.25);
  });

  it("rejects invalid monitoring arithmetic", () => {
    expect(() =>
      evaluateM41cClinicalMonitoring({
        ...healthy,
        safetyEscalationCount: 1,
        safetyEscalationAcknowledgedCount: 2,
      }),
    ).toThrow("M41C_MONITOR_NUMERATOR_EXCEEDS_DENOMINATOR");
    expect(() =>
      evaluateM41cClinicalMonitoring({
        ...healthy,
        sourceExpiryCount: -1,
      }),
    ).toThrow("M41C_MONITOR_COUNT_INVALID");
    expect(() =>
      evaluateM41cClinicalMonitoring({
        ...healthy,
        subgroupCompletionRates: { "SYNTH-GROUP-A": 1.1 },
      }),
    ).toThrow("M41C_MONITOR_SUBGROUP_RATE_INVALID");
  });
});
