import { describe, expect, it } from "vitest";
import type { CansAssessmentVersion } from "../../contracts/ccmg/cans-routing";
import type { CcmgReferralIntake } from "../../contracts/ccmg/intake";
import {
  CANS_TARGET_APPROVER_ROLES,
  recomputeReferralStatus,
  stableCaseCorrelationId,
  validateMedicationAlertInput,
  validateNextCansVersionContext,
  validatePlanTargetRoute,
  validateReferralGateDecision,
  type RecordReferralGateDecision,
} from "../../contracts/ccmg/care-path";

const NOW = "2026-07-14T12:00:00Z";

function referral(overrides: Partial<CcmgReferralIntake> = {}): CcmgReferralIntake {
  const base: CcmgReferralIntake = {
    id: "M21-REF-CARE-PATH-001",
    caseId: "M21-CASE-CARE-PATH-001",
    evidenceClass: "synthetic_demo",
    youthId: "M21-YOUTH-CARE-PATH-001",
    youthDisplayLabel: "Synthetic Youth Care Path",
    referralSourceDivision: "BHC",
    referredAt: "2026-07-13T12:00:00Z",
    referralReason: "Controlled M2.1 care-path scenario.",
    urgency: "urgent",
    status: "held",
    holdReason: "Former controlled hold.",
    rejectionReason: null,
    intake: { status: "complete", completedAt: NOW, completedBy: "SYNTH-INTAKE" },
    eligibility: {
      status: "eligible",
      criteria: {
        ageQualified: true,
        diagnosisQualified: true,
        functionalImpairment: true,
        coverageQualified: true,
      },
      rationale: "All synthetic criteria met.",
      determinedAt: NOW,
      determinedBy: "SYNTH-QMHP",
    },
    payerAuthorization: {
      payerLabel: "Synthetic Payer",
      verificationStatus: "verified",
      verifiedAt: NOW,
      authorizationRequired: true,
      authorizationStatus: "approved",
      authorizationReference: "SYNTH-AUTH-001",
      authorizationEffectiveAt: "2026-07-01T00:00:00Z",
      authorizationExpiresAt: "2026-10-01T00:00:00Z",
    },
    consent: {
      status: "active",
      consentReference: "SYNTH-CONSENT-001",
      effectiveAt: "2026-07-01T00:00:00Z",
      expiresAt: "2026-10-01T00:00:00Z",
    },
    cans: {
      status: "scheduled",
      dueAt: "2026-07-16T17:00:00Z",
      scheduledFor: "2026-07-15T10:00:00Z",
      currentAssessmentId: null,
      currentVersion: null,
      acuity: "not_assessed",
    },
    capacity: {
      required: true,
      facilityLabel: "Synthetic Capacity Pool",
      status: "reserved",
      availableSlots: 1,
      reservedSlotReference: "SYNTH-SLOT-001",
      checkedAt: NOW,
    },
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
  };
  return { ...base, ...overrides };
}

function cans(
  version: number,
  previousAssessmentId: string | null,
  status: CansAssessmentVersion["status"],
  overrides: Partial<CansAssessmentVersion> = {},
): CansAssessmentVersion {
  return {
    id: `M21-CANS-CARE-PATH-V${version}`,
    caseId: "M21-CASE-CARE-PATH-001",
    referralId: "M21-REF-CARE-PATH-001",
    evidenceClass: "synthetic_demo",
    version,
    instrumentVersion: "CANS-SYNTH-1",
    status,
    previousAssessmentId,
    completedAt: NOW,
    completedBy: "SYNTH-QMHP",
    totalScore: 5,
    acuity: "moderate",
    domainScores: {
      behavioral_emotional: 2,
      risk_behaviors: 1,
      life_functioning: 1,
      strengths: 1,
      caregiver_resources: 0,
      cultural_factors: 0,
    },
    actionableItems: [
      {
        itemCode: "BEH-01",
        label: "Synthetic regulation need",
        domain: "behavioral_emotional",
        rating: 2,
        disposition: "need",
      },
    ],
    createdAt: NOW,
    ...overrides,
  };
}

function issueCodes(result: { issues: readonly { code: string }[] }): string[] {
  return result.issues.map((finding) => finding.code);
}

describe("M2.1 end-to-end care-path pure contracts", () => {
  it("accepts the exact eligible decision and rejects internally inconsistent gate payloads", () => {
    const eligible = {
      gate: "eligibility",
      decision: {
        status: "eligible",
        criteria: {
          ageQualified: true,
          diagnosisQualified: true,
          functionalImpairment: true,
          coverageQualified: true,
        },
        rationale: "Controlled criteria satisfied.",
      },
    } satisfies RecordReferralGateDecision;
    expect(validateReferralGateDecision(eligible)).toEqual({ valid: true, value: eligible, issues: [] });

    const invalidEligible = validateReferralGateDecision({
      gate: "eligibility",
      decision: {
        status: "eligible",
        criteria: {
          ageQualified: true,
          diagnosisQualified: true,
          functionalImpairment: false,
          coverageQualified: true,
        },
        rationale: "Contradictory payload.",
      },
    });
    expect(invalidEligible.valid).toBe(false);
    expect(issueCodes(invalidEligible)).toContain("STATE_INCONSISTENT");
  });

  it.each([
    ["payer authorization", {
      gate: "payer_authorization",
      decision: {
        payerLabel: "Synthetic Payer",
        verificationStatus: "verified",
        authorizationRequired: true,
        authorizationStatus: "approved",
        authorizationReference: "SYNTH-AUTH-002",
        effectiveAt: "2026-07-01T00:00:00Z",
        expiresAt: "2026-10-01T00:00:00Z",
      },
    }],
    ["consent", {
      gate: "consent",
      decision: {
        status: "active",
        consentReference: "SYNTH-CONSENT-002",
        effectiveAt: "2026-07-01T00:00:00Z",
        expiresAt: "2026-10-01T00:00:00Z",
      },
    }],
    ["CANS schedule", {
      gate: "cans_schedule",
      decision: {
        status: "scheduled",
        dueAt: "2026-07-16T17:00:00Z",
        scheduledFor: "2026-07-15T10:00:00Z",
      },
    }],
    ["capacity", {
      gate: "capacity",
      decision: {
        required: true,
        facilityLabel: "Synthetic Capacity Pool",
        status: "reserved",
        availableSlots: 1,
        reservedSlotReference: "SYNTH-SLOT-002",
        checkedAt: NOW,
      },
    }],
  ] as const)("accepts a valid %s gate decision", (_label, decision) => {
    expect(validateReferralGateDecision(decision)).toMatchObject({ valid: true, issues: [] });
  });

  it("denies malformed payer, consent, CANS schedule, capacity, and unsupported decisions", () => {
    const payloads = [
      {
        gate: "payer_authorization",
        decision: {
          payerLabel: "Synthetic Payer",
          verificationStatus: "failed",
          authorizationRequired: false,
          authorizationStatus: "approved",
        },
      },
      { gate: "consent", decision: { status: "active" } },
      { gate: "cans_schedule", decision: { status: "scheduled", dueAt: "not-a-date" } },
      { gate: "capacity", decision: { required: true, status: "reserved", availableSlots: -1 } },
      { gate: "unknown", decision: { status: "complete" } },
    ];
    for (const payload of payloads) expect(validateReferralGateDecision(payload).valid).toBe(false);
  });

  it("recomputes corrected eligibility to ready_for_routing instead of preserving a former hold", () => {
    expect(recomputeReferralStatus(referral(), NOW)).toBe("ready_for_routing");
  });

  it("keeps screening, held, and rejected gate outcomes distinct", () => {
    expect(recomputeReferralStatus(referral({
      intake: { status: "in_progress", completedAt: null, completedBy: null },
    }), NOW)).toBe("screening");
    expect(recomputeReferralStatus(referral({
      eligibility: { ...referral().eligibility, status: "needs_review" },
    }), NOW)).toBe("held");
    expect(recomputeReferralStatus(referral({
      eligibility: { ...referral().eligibility, status: "ineligible" },
    }), NOW)).toBe("rejected");
    expect(recomputeReferralStatus(referral({
      capacity: { ...referral().capacity, status: "waitlisted", reservedSlotReference: null },
    }), NOW)).toBe("held");
  });

  it("derives first and next CANS versions only from strict current continuity", () => {
    expect(validateNextCansVersionContext({
      referral: {
        id: "M21-REF-CARE-PATH-001",
        caseId: "M21-CASE-CARE-PATH-001",
        evidenceClass: "synthetic_demo",
        currentAssessmentId: null,
        currentVersion: null,
      },
      priorAssessments: [],
    })).toEqual({ valid: true, nextVersion: 1, previousAssessmentId: null, issues: [] });

    const first = cans(1, null, "superseded");
    const second = cans(2, first.id, "final");
    expect(validateNextCansVersionContext({
      referral: {
        id: second.referralId,
        caseId: second.caseId,
        evidenceClass: second.evidenceClass,
        currentAssessmentId: second.id,
        currentVersion: second.version,
      },
      priorAssessments: [second, first],
    })).toEqual({ valid: true, nextVersion: 3, previousAssessmentId: second.id, issues: [] });
  });

  it("rejects cross-case, cross-referral, cross-evidence, and stale-pointer CANS continuity", () => {
    const first = cans(1, null, "final", {
      caseId: "M21-OTHER-CASE",
      referralId: "M21-OTHER-REFERRAL",
      evidenceClass: "production",
    });
    const result = validateNextCansVersionContext({
      referral: {
        id: "M21-REF-CARE-PATH-001",
        caseId: "M21-CASE-CARE-PATH-001",
        evidenceClass: "synthetic_demo",
        currentAssessmentId: "M21-STALE-CANS",
        currentVersion: 1,
      },
      priorAssessments: [first],
    });
    expect(result.valid).toBe(false);
    expect(issueCodes(result)).toEqual(expect.arrayContaining([
      "CANS_CONTEXT_SCOPE_MISMATCH",
      "CANS_CURRENT_POINTER_MISMATCH",
    ]));
  });

  it("enforces separate MHTCM and MHRS target approval role boundaries", () => {
    expect(CANS_TARGET_APPROVER_ROLES).toEqual({
      mhtcm_plan: ["treatment-director", "mhtcm-supervisor"],
      mhrs_skills_goals: ["mhrs-supervisor"],
    });
    expect(validatePlanTargetRoute({
      targetType: "mhtcm_plan",
      targetRecordId: "SYNTH-MHTCM-PLAN-001",
      targetVersion: 1,
      actorRole: "mhtcm-supervisor",
    }).valid).toBe(true);
    expect(validatePlanTargetRoute({
      targetType: "mhrs_skills_goals",
      targetRecordId: "SYNTH-MHRS-GOALS-001",
      targetVersion: 1,
      actorRole: "mhrs-supervisor",
    }).valid).toBe(true);

    const crossed = validatePlanTargetRoute({
      targetType: "mhrs_skills_goals",
      targetRecordId: "SYNTH-MHRS-GOALS-001",
      targetVersion: 1,
      actorRole: "mhtcm-supervisor",
    });
    expect(issueCodes(crossed)).toContain("TARGET_APPROVER_ROLE_INVALID");
  });

  it("validates a bounded urgent/critical medication oversight alert", () => {
    expect(validateMedicationAlertInput({
      referralId: "M21-REF-CARE-PATH-001",
      title: "Synthetic medication coordination alert",
      priority: "urgent",
      dueAt: "2026-07-14T14:00:00Z",
      reason: "Controlled medication oversight scenario.",
      expectedReferralVersion: 2,
    }, NOW).valid).toBe(true);

    const invalid = validateMedicationAlertInput({
      referralId: " ",
      title: " ",
      priority: "routine",
      dueAt: "2026-07-14T11:00:00Z",
      reason: " ",
      expectedReferralVersion: 0,
    }, NOW);
    expect(issueCodes(invalid)).toEqual(expect.arrayContaining([
      "REQUIRED_FIELD_MISSING",
      "MEDICATION_ALERT_PRIORITY_INVALID",
      "MEDICATION_ALERT_DUE_NOT_FUTURE",
      "FIELD_TYPE_INVALID",
    ]));
  });

  it("produces a deterministic case-level correlation key", () => {
    expect(stableCaseCorrelationId("M21-CASE-CARE-PATH-001")).toBe("M21-CORR-M21-CASE-CARE-PATH-001");
    expect(stableCaseCorrelationId("M21-CASE-CARE-PATH-001")).toBe(stableCaseCorrelationId("M21-CASE-CARE-PATH-001"));
    expect(stableCaseCorrelationId("M21-CASE-CARE-PATH-002")).not.toBe(stableCaseCorrelationId("M21-CASE-CARE-PATH-001"));
    expect(() => stableCaseCorrelationId("   ")).toThrow(/non-empty caseId/);
  });
});
