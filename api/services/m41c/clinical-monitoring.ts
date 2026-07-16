import type {
  M41cClinicalMonitoringInput,
  M41cClinicalMonitoringResult,
  M41cClinicalMonitoringSignal,
  M41cClinicalMonitoringSignalKind,
} from "@contracts/m41c/mappings";
import {
  buildM41cHumanGate,
  createM41cAuditEvent,
  m41cDeterministicId,
} from "./pathway-orchestrator";

function rate(numerator: number, denominator: number): number {
  return denominator === 0 ? 1 : Number((numerator / denominator).toFixed(4));
}

function signal(
  input: M41cClinicalMonitoringInput,
  kind: M41cClinicalMonitoringSignalKind,
  severity: M41cClinicalMonitoringSignal["severity"],
  summary: string,
  humanReviewRequired = true,
): M41cClinicalMonitoringSignal {
  return Object.freeze({
    id: m41cDeterministicId("SYNTH-M41C-MONITOR-SIGNAL", input.monitorId, kind),
    kind,
    severity,
    summary,
    humanReviewRequired,
  });
}

function assertCount(value: number): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error("M41C_MONITOR_COUNT_INVALID");
  }
}

/** Deterministic monitoring for source, safety, fidelity, equity, and mappings. */
export function evaluateM41cClinicalMonitoring(
  input: M41cClinicalMonitoringInput,
): M41cClinicalMonitoringResult {
  if (!input.monitorId.startsWith("SYNTH-")) {
    throw new Error("M41C_MONITOR_SYNTHETIC_ID_REQUIRED");
  }
  if (!Number.isFinite(Date.parse(input.evaluatedAt))) {
    throw new Error("M41C_MONITOR_TIME_INVALID");
  }
  [
    input.sourceExpiryCount,
    input.versionMismatchCount,
    input.permissionDenialCount,
    input.safetyEscalationCount,
    input.safetyEscalationAcknowledgedCount,
    input.alertsIssued,
    input.alertsActionable,
    input.overrideCount,
    input.overridesReviewed,
    input.pathwayStepExpected,
    input.pathwayStepCompleted,
    input.outcomeReviewExpected,
    input.outcomeReviewCompleted,
    input.unintendedEffectCount,
    input.unintendedEffectsReviewed,
    input.mappingErrorCount,
  ].forEach(assertCount);
  if (
    input.safetyEscalationAcknowledgedCount > input.safetyEscalationCount ||
    input.alertsActionable > input.alertsIssued ||
    input.overridesReviewed > input.overrideCount ||
    input.pathwayStepCompleted > input.pathwayStepExpected ||
    input.outcomeReviewCompleted > input.outcomeReviewExpected ||
    input.unintendedEffectsReviewed > input.unintendedEffectCount
  ) {
    throw new Error("M41C_MONITOR_NUMERATOR_EXCEEDS_DENOMINATOR");
  }
  const subgroupRates = Object.values(input.subgroupCompletionRates);
  if (
    Object.keys(input.subgroupCompletionRates).some(
      (groupId) => !groupId.startsWith("SYNTH-"),
    )
  ) {
    throw new Error("M41C_MONITOR_SYNTHETIC_SUBGROUP_REQUIRED");
  }
  if (subgroupRates.some((value) => value < 0 || value > 1)) {
    throw new Error("M41C_MONITOR_SUBGROUP_RATE_INVALID");
  }
  const alertPrecision = rate(input.alertsActionable, input.alertsIssued);
  const pathwayFidelity = rate(
    input.pathwayStepCompleted,
    input.pathwayStepExpected,
  );
  const safetyAcknowledgementRate = rate(
    input.safetyEscalationAcknowledgedCount,
    input.safetyEscalationCount,
  );
  const overrideReviewRate = rate(input.overridesReviewed, input.overrideCount);
  const outcomeReviewRate = rate(
    input.outcomeReviewCompleted,
    input.outcomeReviewExpected,
  );
  const unintendedEffectReviewRate = rate(
    input.unintendedEffectsReviewed,
    input.unintendedEffectCount,
  );
  const maximumSubgroupGap =
    subgroupRates.length < 2
      ? 0
      : Number(
          (Math.max(...subgroupRates) - Math.min(...subgroupRates)).toFixed(4),
        );
  const signals: M41cClinicalMonitoringSignal[] = [];
  if (input.sourceExpiryCount > 0) {
    signals.push(
      signal(
        input,
        "source_expiry",
        "urgent",
        `${input.sourceExpiryCount} active pathway source(s) require expiry review.`,
      ),
    );
  }
  if (input.versionMismatchCount > 0) {
    signals.push(
      signal(
        input,
        "version_mismatch",
        "urgent",
        `${input.versionMismatchCount} instrument or pathway version mismatch(es) detected.`,
      ),
    );
  }
  if (input.permissionDenialCount > 0) {
    signals.push(
      signal(
        input,
        "permission_control",
        "information",
        `${input.permissionDenialCount} minimum-necessary access denial(s) were enforced.`,
        false,
      ),
    );
  }
  if (safetyAcknowledgementRate < 1) {
    signals.push(
      signal(
        input,
        "safety_follow_through",
        "urgent",
        "One or more safety escalations lack documented human acknowledgement.",
      ),
    );
  }
  if (input.alertsIssued >= 5 && alertPrecision < 0.5) {
    signals.push(
      signal(
        input,
        "alert_fatigue",
        "review",
        "Less than half of issued alerts were actionable; tune only through governance review.",
      ),
    );
  }
  if (overrideReviewRate < 1) {
    signals.push(
      signal(
        input,
        "override_review",
        "urgent",
        "One or more named human overrides remain unreviewed.",
      ),
    );
  }
  if (pathwayFidelity < 0.9) {
    signals.push(
      signal(
        input,
        "pathway_fidelity",
        "review",
        "Synthetic pathway step completion is below the 90% review threshold.",
      ),
    );
  }
  if (outcomeReviewRate < 1) {
    signals.push(
      signal(
        input,
        "outcome_review",
        "review",
        "One or more governed outcome reviews remain incomplete.",
      ),
    );
  }
  if (unintendedEffectReviewRate < 1) {
    signals.push(
      signal(
        input,
        "unintended_effects",
        "urgent",
        "One or more detected unintended effects remain without documented human review.",
      ),
    );
  }
  if (input.mappingErrorCount > 0) {
    signals.push(
      signal(
        input,
        "mapping_quality",
        "review",
        `${input.mappingErrorCount} FHIR-aligned or CMBHS reconciliation error(s) require review.`,
      ),
    );
  }
  if (maximumSubgroupGap > 0.1) {
    signals.push(
      signal(
        input,
        "disparity_review",
        "review",
        `Maximum synthetic subgroup completion gap is ${maximumSubgroupGap}.`,
      ),
    );
  }
  const humanGate = buildM41cHumanGate({
    gateId: `${input.monitorId}-CLINICAL-QA-HUMAN-GATE`,
    accountableRoles: [
      "clinical-director",
      "clinical-supervisor",
      "chart-auditor",
    ],
    competencyIds: ["M41C-COMP-CLINICAL-FABRIC-MONITORING"],
  });
  const auditEvents = signals.map((candidate) =>
    createM41cAuditEvent({
      eventType: "monitoring_signal",
      actorId: "SYNTH-M41C-MONITOR",
      actorRole: "chart-auditor",
      entityType: "monitoring",
      entityId: candidate.id,
      correlationId: input.monitorId,
      after: {
        kind: candidate.kind,
        severity: candidate.severity,
        humanReviewRequired: candidate.humanReviewRequired,
      },
      rationale: candidate.summary,
      occurredAt: input.evaluatedAt,
    }),
  );
  return Object.freeze({
    monitorId: input.monitorId,
    evaluatedAt: input.evaluatedAt,
    signals: Object.freeze(signals),
    alertPrecision,
    pathwayFidelity,
    safetyAcknowledgementRate,
    overrideReviewRate,
    outcomeReviewRate,
    unintendedEffectReviewRate,
    maximumSubgroupGap,
    humanGate,
    auditEvents: Object.freeze(auditEvents),
    productionRows: 0,
    liveWrites: 0,
  });
}
