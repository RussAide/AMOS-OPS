import {
  evaluateIntakeReadiness,
  type CcmgReferralIntake,
} from "../../contracts/ccmg/intake";
import type {
  CypressS5AcuityProfile,
  CypressS5AuditEvent,
  CypressS5DecisionException,
  CypressS5DeclineClass,
  CypressS5PreviewResult,
  CypressS5PreviewScenario,
  CypressS5RateControl,
  CypressS5Status,
} from "../../contracts/doctrine/cypress-referral-acuity-rate";

const EVALUATED_AT = "2026-09-09T16:30:00.000Z";
const LICENSED_CAPACITY = 10 as const;
const FUTURE_CAPACITY = 16 as const;
const RATE_FLOOR = 450 as const;
const RATE_TARGET = 550 as const;
const RATE_ENHANCED = 650 as const;

const PROTECTED_DECLINE_REASONS = new Set([
  "NO_LICENSED_CAPACITY",
  "REQUIRED_SUPPORT_NOT_AVAILABLE",
  "PAYER_AUTHORIZATION_UNRESOLVED",
  "REGULATORY_SCOPE_MISMATCH",
  "SAFETY_REQUIREMENT_UNMET",
]);

const CONVENIENCE_DECLINE_REASONS = new Set([
  "LOW_ACUITY_PREFERENCE",
  "STAFF_PREFERENCE",
  "GENERAL_COMPLEXITY_AVOIDANCE",
  "CONVENIENCE",
]);

function baseReferral(): CcmgReferralIntake {
  return {
    id: "SYNTH-S5-REF-001",
    caseId: "SYNTH-S5-CASE-001",
    evidenceClass: "synthetic_demo",
    youthId: "SYNTH-YOUTH-001",
    youthDisplayLabel: "Synthetic Youth A",
    referralSourceDivision: "external",
    referredAt: "2026-09-09T15:45:00.000Z",
    referralReason: "Synthetic Cypress GRO placement review",
    urgency: "urgent",
    status: "screening",
    holdReason: null,
    rejectionReason: null,
    intake: {
      status: "complete",
      completedAt: "2026-09-09T15:50:00.000Z",
      completedBy: "SYNTH-INTAKE-USER",
    },
    eligibility: {
      status: "eligible",
      criteria: {
        ageQualified: true,
        diagnosisQualified: true,
        functionalImpairment: true,
        coverageQualified: true,
      },
      rationale: "Synthetic target-population criteria satisfied.",
      determinedAt: "2026-09-09T15:55:00.000Z",
      determinedBy: "SYNTH-ELIGIBILITY-USER",
    },
    payerAuthorization: {
      payerLabel: "Synthetic Payer",
      verificationStatus: "verified",
      verifiedAt: "2026-09-09T16:00:00.000Z",
      authorizationRequired: true,
      authorizationStatus: "approved",
      authorizationReference: "SYNTH-AUTH-001",
      authorizationEffectiveAt: "2026-09-09T00:00:00.000Z",
      authorizationExpiresAt: "2026-10-09T00:00:00.000Z",
    },
    consent: {
      status: "active",
      consentReference: "SYNTH-CONSENT-001",
      effectiveAt: "2026-09-09T00:00:00.000Z",
      expiresAt: "2026-10-09T00:00:00.000Z",
    },
    cans: {
      status: "completed",
      dueAt: "2026-09-10T18:00:00.000Z",
      scheduledFor: "2026-09-09T16:05:00.000Z",
      currentAssessmentId: "SYNTH-CANS-001",
      currentVersion: 3,
      acuity: "high",
    },
    capacity: {
      required: true,
      facilityLabel: "Cypress GRO",
      status: "available",
      availableSlots: 2,
      reservedSlotReference: null,
      checkedAt: "2026-09-09T16:10:00.000Z",
    },
    createdAt: "2026-09-09T15:45:00.000Z",
    updatedAt: "2026-09-09T16:10:00.000Z",
    version: 1,
  };
}

interface ScenarioInputs {
  readonly referral: CcmgReferralIntake;
  readonly currentCensus: number;
  readonly acuityProfile: CypressS5AcuityProfile;
  readonly proposedDailyRate: number;
  readonly requestedDecision: "ACCEPT" | "DECLINE";
  readonly declineReasonCode: string | null;
}

function scenarioInputs(scenario: CypressS5PreviewScenario): ScenarioInputs {
  const referral = baseReferral();

  if (scenario === "target_population_decline_review") {
    referral.cans.acuity = "moderate";
    return {
      referral,
      currentCensus: 7,
      acuityProfile: {
        acuity: "MODERATE",
        supervision: "STANDARD",
        behavioralRisk: "MODERATE",
        clinicalSupportIntensity: "STANDARD",
        staffingIntensity: "STANDARD",
        estimatedResourceCostPerDay: 410,
        evidenceRefs: [
          "SYNTH-CANS-001-v3",
          "SYNTH-SUPERVISION-PLAN-001",
          "SYNTH-RESOURCE-FIT-001",
        ],
      },
      proposedDailyRate: RATE_TARGET,
      requestedDecision: "DECLINE",
      declineReasonCode: "LOW_ACUITY_PREFERENCE",
    };
  }

  if (scenario === "below_floor_rate_blocked") {
    referral.cans.acuity = "moderate";
    return {
      referral,
      currentCensus: 6,
      acuityProfile: {
        acuity: "MODERATE",
        supervision: "STANDARD",
        behavioralRisk: "MODERATE",
        clinicalSupportIntensity: "STANDARD",
        staffingIntensity: "STANDARD",
        estimatedResourceCostPerDay: 430,
        evidenceRefs: [
          "SYNTH-CANS-001-v3",
          "SYNTH-SUPERVISION-PLAN-001",
          "SYNTH-RESOURCE-FIT-002",
        ],
      },
      proposedDailyRate: 425,
      requestedDecision: "ACCEPT",
      declineReasonCode: null,
    };
  }

  if (scenario === "capacity_full_hold") {
    referral.capacity.status = "unavailable";
    referral.capacity.availableSlots = 0;
    return {
      referral,
      currentCensus: LICENSED_CAPACITY,
      acuityProfile: {
        acuity: "HIGH",
        supervision: "ONE_TO_ONE",
        behavioralRisk: "HIGH",
        clinicalSupportIntensity: "ELEVATED",
        staffingIntensity: "ELEVATED",
        estimatedResourceCostPerDay: 520,
        evidenceRefs: [
          "SYNTH-CANS-001-v3",
          "SYNTH-SUPERVISION-PLAN-002",
          "SYNTH-CENSUS-SNAPSHOT-010",
        ],
      },
      proposedDailyRate: RATE_ENHANCED,
      requestedDecision: "DECLINE",
      declineReasonCode: "NO_LICENSED_CAPACITY",
    };
  }

  if (scenario === "evidence_gap_hold") {
    referral.cans.status = "scheduled";
    referral.cans.currentAssessmentId = null;
    referral.cans.currentVersion = null;
    referral.cans.acuity = "not_assessed";
    return {
      referral,
      currentCensus: 5,
      acuityProfile: {
        acuity: "HIGH",
        supervision: "TWO_TO_ONE",
        behavioralRisk: "HIGH",
        clinicalSupportIntensity: "ENHANCED",
        staffingIntensity: "ENHANCED",
        estimatedResourceCostPerDay: 610,
        evidenceRefs: [],
      },
      proposedDailyRate: RATE_ENHANCED,
      requestedDecision: "ACCEPT",
      declineReasonCode: null,
    };
  }

  return {
    referral,
    currentCensus: 8,
    acuityProfile: {
      acuity: "HIGH",
      supervision: "TWO_TO_ONE",
      behavioralRisk: "HIGH",
      clinicalSupportIntensity: "ENHANCED",
      staffingIntensity: "ENHANCED",
      estimatedResourceCostPerDay: 610,
      evidenceRefs: [
        "SYNTH-CANS-001-v3",
        "SYNTH-SUPERVISION-PLAN-003",
        "SYNTH-RESOURCE-FIT-003",
        "SYNTH-STAFFING-CAPABILITY-003",
      ],
    },
    proposedDailyRate: RATE_ENHANCED,
    requestedDecision: "ACCEPT",
    declineReasonCode: null,
  };
}

function classifyDeclineReason(reasonCode: string | null): CypressS5DeclineClass {
  if (!reasonCode) return "NONE";
  if (PROTECTED_DECLINE_REASONS.has(reasonCode)) return "PROTECTED_OPERATIONAL";
  if (CONVENIENCE_DECLINE_REASONS.has(reasonCode)) return "CONVENIENCE_OR_BIAS";
  return "CONVENIENCE_OR_BIAS";
}

function rateControl(profile: CypressS5AcuityProfile, proposedDailyRate: number): CypressS5RateControl {
  const recommendedTier =
    profile.acuity === "HIGH" ||
    profile.acuity === "CRITICAL" ||
    profile.supervision === "TWO_TO_ONE" ||
    profile.supervision === "CONSTANT" ||
    profile.clinicalSupportIntensity === "ENHANCED" ||
    profile.staffingIntensity === "ENHANCED"
      ? "ENHANCED"
      : profile.acuity === "MODERATE" ||
          profile.clinicalSupportIntensity === "ELEVATED" ||
          profile.staffingIntensity === "ELEVATED"
        ? "TARGET"
        : "FLOOR";

  const recommendedDailyRate =
    recommendedTier === "ENHANCED"
      ? RATE_ENHANCED
      : recommendedTier === "TARGET"
        ? RATE_TARGET
        : RATE_FLOOR;

  return {
    floor: RATE_FLOOR,
    target: RATE_TARGET,
    enhanced: RATE_ENHANCED,
    proposedDailyRate,
    recommendedTier,
    recommendedDailyRate,
    payerGuarantee: false,
    rateEvidence: [
      `Acuity=${profile.acuity}`,
      `Supervision=${profile.supervision}`,
      `ClinicalSupport=${profile.clinicalSupportIntensity}`,
      `Staffing=${profile.staffingIntensity}`,
      `EstimatedResourceCost=${profile.estimatedResourceCostPerDay}`,
    ],
  };
}

function buildExceptions(
  scenario: CypressS5PreviewScenario,
  readinessReady: boolean,
  profile: CypressS5AcuityProfile,
  rate: CypressS5RateControl,
  declineClass: CypressS5DeclineClass,
): readonly CypressS5DecisionException[] {
  const exceptions: CypressS5DecisionException[] = [];

  if (!readinessReady) {
    exceptions.push({
      code: scenario === "capacity_full_hold" ? "CAPACITY_AT_CONTROLLING_LIMIT" : "REFERRAL_EVIDENCE_INCOMPLETE",
      severity: "EVIDENCE",
      disposition: "BLOCK",
      summary:
        scenario === "capacity_full_hold"
          ? "The 10-bed controlling capacity is full; future 16-bed expansion cannot be used to create availability."
          : "The referral cannot advance until the required controlled intake and acuity evidence is complete.",
    });
  }

  if (profile.evidenceRefs.length === 0) {
    exceptions.push({
      code: "ACUITY_EVIDENCE_MISSING",
      severity: "EVIDENCE",
      disposition: "BLOCK",
      summary: "High-acuity placement and enhanced-rate reasoning require evidence references; AMOS must not infer them.",
    });
  }

  if (rate.proposedDailyRate < RATE_FLOOR) {
    exceptions.push({
      code: "RATE_BELOW_CONTROLLED_FLOOR",
      severity: "CONTROL",
      disposition: "BLOCK",
      summary: "The proposed daily rate is below the controlling $450 operating floor and cannot be accepted without an expressly authorized doctrine change.",
    });
  }

  if (declineClass === "CONVENIENCE_OR_BIAS") {
    exceptions.push({
      code: "TARGET_POPULATION_DECLINE_REVIEW_REQUIRED",
      severity: "CONTROL",
      disposition: "REVIEW",
      summary: "A target-population decline based on convenience, staff preference, complexity avoidance, or low-acuity preference cannot be finalized without evidence review.",
    });
  }

  return exceptions;
}

function auditEvents(
  readinessReady: boolean,
  profile: CypressS5AcuityProfile,
  rate: CypressS5RateControl,
  disposition: CypressS5PreviewResult["disposition"],
): readonly CypressS5AuditEvent[] {
  return [
    {
      eventId: "SYNTH-S5-AUD-001",
      eventType: "REFERRAL_READINESS_EVALUATED",
      status: readinessReady ? "PASS" : "BLOCKED",
      detail: readinessReady
        ? "Existing CCMG intake readiness gates passed for the synthetic referral."
        : "At least one existing CCMG intake readiness gate blocked advancement.",
    },
    {
      eventId: "SYNTH-S5-AUD-002",
      eventType: "ACUITY_PROFILE_RESOLVED",
      status: profile.evidenceRefs.length > 0 ? "PASS" : "BLOCKED",
      detail: `Acuity ${profile.acuity}, supervision ${profile.supervision}, and resource-fit evidence were evaluated together.`,
    },
    {
      eventId: "SYNTH-S5-AUD-003",
      eventType: "RATE_CONTROL_APPLIED",
      status: rate.proposedDailyRate >= RATE_FLOOR ? "PASS" : "BLOCKED",
      detail: `Proposed $${rate.proposedDailyRate}/day was evaluated against the $450/$550/$650 controlled doctrine.`,
    },
    {
      eventId: "SYNTH-S5-AUD-004",
      eventType: "PLACEMENT_DISPOSITION_REVIEWED",
      status:
        disposition === "DECLINE_REVIEW_REQUIRED"
          ? "REVIEW_REQUIRED"
          : disposition === "HOLD"
            ? "BLOCKED"
            : "PASS",
      detail: `Final synthetic S5 disposition: ${disposition}.`,
    },
  ];
}

export function getCypressS5Status(): CypressS5Status {
  return {
    sprint: "Cypress Doctrine Sprint 01",
    stage: "S5",
    capability: "Referral / Acuity / Rate",
    previewAvailable: true,
    previewEnvironment: "SYNTHETIC_PREVIEW",
    noPhi: true,
    s4Accepted: true,
    productionPromotion: "NOT_AUTHORIZED",
    message:
      "S5 reuses the existing CCMG referral-readiness foundation and applies Cypress-specific acuity, placement, capacity, decline-review, and $450/$550/$650 rate controls using synthetic/no-PHI evidence only.",
  };
}

export function buildCypressS5Preview(
  scenario: CypressS5PreviewScenario,
): CypressS5PreviewResult {
  const input = scenarioInputs(scenario);
  const referralReadiness = evaluateIntakeReadiness(input.referral, EVALUATED_AT);
  const rate = rateControl(input.acuityProfile, input.proposedDailyRate);
  const declineClass = classifyDeclineReason(input.declineReasonCode);
  const exceptions = buildExceptions(
    scenario,
    referralReadiness.ready,
    input.acuityProfile,
    rate,
    declineClass,
  );

  const blocking = exceptions.some((exception) => exception.disposition === "BLOCK");
  const reviewRequired = exceptions.some((exception) => exception.disposition === "REVIEW");

  const disposition: CypressS5PreviewResult["disposition"] = blocking
    ? "HOLD"
    : reviewRequired
      ? "DECLINE_REVIEW_REQUIRED"
      : input.requestedDecision === "DECLINE"
        ? "DECLINE_ALLOWED"
        : "ACCEPT";

  const outcome: CypressS5PreviewResult["outcome"] =
    disposition === "ACCEPT"
      ? "ACCEPT_AUTHORIZED"
      : disposition === "DECLINE_ALLOWED"
        ? "DECLINE_ALLOWED"
        : disposition === "DECLINE_REVIEW_REQUIRED"
          ? "DECLINE_REVIEW_REQUIRED"
          : "HOLD_CONTROL";

  const currentCensus = input.currentCensus;
  const availableBeds = Math.max(0, LICENSED_CAPACITY - currentCensus);

  const exactNextAction =
    scenario === "high_acuity_accept"
      ? "Route the evidence-backed high-acuity acceptance into the governed admission pathway at the enhanced $650 operating-control tier; do not treat the rate as a payer guarantee."
      : scenario === "target_population_decline_review"
        ? "Do not finalize the decline. Route the captured reason and supporting evidence for authorized doctrine review because convenience or low-acuity preference is not an accepted decline basis."
        : scenario === "below_floor_rate_blocked"
          ? "Hold placement economics and escalate the below-floor proposal for authorized resolution; do not silently accept a rate below $450."
          : scenario === "capacity_full_hold"
            ? "Keep the referral on a controlled hold/waitlist at the 10-bed licensed limit; do not use the future 16-bed capacity to create availability."
            : "Complete the missing acuity/CANS evidence before placement or enhanced-rate determination; AMOS must not infer high-acuity support needs.";

  const title =
    outcome === "ACCEPT_AUTHORIZED"
      ? "High-acuity referral supported for acceptance"
      : outcome === "DECLINE_REVIEW_REQUIRED"
        ? "Target-population decline requires doctrine review"
        : outcome === "DECLINE_ALLOWED"
          ? "Operational decline basis supported"
          : "Referral held by controlling S5 gate";

  const summary =
    outcome === "ACCEPT_AUTHORIZED"
      ? "The referral passed existing CCMG readiness gates, resource-fit evidence supports the high-acuity profile, capacity remains within the controlling 10-bed limit, and the enhanced rate tier is evidence-supported."
      : outcome === "DECLINE_REVIEW_REQUIRED"
        ? "The referral is otherwise supportable, but the proposed decline reason is convenience/low-acuity preference rather than an evidenced operational constraint, so AMOS prevents a final decline."
        : outcome === "DECLINE_ALLOWED"
          ? "The decline basis is an evidenced operational constraint rather than convenience or acuity cherry-picking."
          : "One or more readiness, evidence, capacity, or rate controls prevent the referral from advancing.";

  return {
    sprint: "Cypress Doctrine Sprint 01",
    stage: "S5",
    environment: "SYNTHETIC_PREVIEW",
    noPhi: true,
    scenario,
    testCaseId: `S5-${scenario.replace(/_/g, "-").toUpperCase()}`,
    capabilityLevels: ["L6", "L7", "L8"],
    licensedCapacity: LICENSED_CAPACITY,
    currentCensus,
    availableBeds,
    futureCapacity: FUTURE_CAPACITY,
    referralReadiness,
    acuityProfile: input.acuityProfile,
    rateControl: rate,
    requestedDecision: input.requestedDecision,
    declineReasonCode: input.declineReasonCode,
    declineClass,
    disposition,
    outcome,
    exceptions,
    audit: auditEvents(referralReadiness.ready, input.acuityProfile, rate, disposition),
    executiveVisibility: [
      `Referral readiness: ${referralReadiness.status}`,
      `Acuity / supervision: ${input.acuityProfile.acuity} / ${input.acuityProfile.supervision}`,
      `Census: ${currentCensus}/${LICENSED_CAPACITY}`,
      `Rate control: proposed $${rate.proposedDailyRate}; recommended ${rate.recommendedTier} ${rate.recommendedDailyRate ? `$${rate.recommendedDailyRate}` : "N/A"}`,
      `Disposition: ${disposition}`,
    ],
    title,
    summary,
    exactNextAction,
    productionPromotion: "NOT_AUTHORIZED",
  };
}
