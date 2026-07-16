import { describe, expect, it } from "vitest";
import {
  CCMG_AUDIT_EVENT_TYPES,
  CCMG_QUEUE_IDS,
  INTAKE_GATE_IDS,
  evaluateIntakeReadiness,
  routeCansToApprovedPlans,
  validateAuditEvent,
  validateCansVersionHistory,
  visibleQueueIdsForRole,
  type CansAssessmentVersion,
  type CcmgAuditEvent,
  type CcmgReferralIntake,
} from "../../contracts/ccmg";

const NOW = "2026-07-14T12:00:00Z";

function readyReferral(status: CcmgReferralIntake["status"] = "ready_for_routing"): CcmgReferralIntake {
  return {
    id: "SYNTH-REF-READY",
    caseId: "SYNTH-CASE-READY",
    evidenceClass: "synthetic_demo",
    youthId: "SYNTH-YOUTH-READY",
    youthDisplayLabel: "Synthetic Youth Ready",
    referralSourceDivision: "GRO",
    referredAt: "2026-07-13T12:00:00Z",
    referralReason: "Controlled synthetic eligibility scenario.",
    urgency: "routine",
    status,
    holdReason: status === "held" ? "Controlled evidence hold." : null,
    rejectionReason: status === "rejected" ? "Controlled ineligible disposition." : null,
    intake: { status: "complete", completedAt: NOW, completedBy: "SYNTH-INTAKE" },
    eligibility: {
      status: "eligible",
      criteria: { ageQualified: true, diagnosisQualified: true, functionalImpairment: true, coverageQualified: true },
      rationale: "All controlled criteria met.",
      determinedAt: NOW,
      determinedBy: "SYNTH-QMHP",
    },
    payerAuthorization: {
      payerLabel: "Synthetic Payer",
      verificationStatus: "verified",
      verifiedAt: NOW,
      authorizationRequired: true,
      authorizationStatus: "approved",
      authorizationReference: "SYNTH-AUTH",
      authorizationEffectiveAt: "2026-07-01T00:00:00Z",
      authorizationExpiresAt: "2026-09-30T23:59:59Z",
    },
    consent: {
      status: "active",
      consentReference: "SYNTH-CONSENT",
      effectiveAt: "2026-07-01T00:00:00Z",
      expiresAt: "2026-12-31T23:59:59Z",
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
      facilityLabel: "Synthetic GRO Capacity Pool",
      status: "reserved",
      availableSlots: 1,
      reservedSlotReference: "SYNTH-SLOT",
      checkedAt: NOW,
    },
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
  };
}

function finalCans(version = 1, previousAssessmentId: string | null = null): CansAssessmentVersion {
  return {
    id: `SYNTH-CANS-V${version}`,
    caseId: "SYNTH-CASE-READY",
    referralId: "SYNTH-REF-READY",
    evidenceClass: "synthetic_demo",
    version,
    instrumentVersion: "CANS-SYNTH-1",
    status: "final",
    previousAssessmentId,
    completedAt: NOW,
    completedBy: "SYNTH-QMHP",
    totalScore: 8,
    acuity: "high",
    domainScores: {
      behavioral_emotional: 2,
      risk_behaviors: 3,
      life_functioning: 2,
      strengths: 1,
      caregiver_resources: 0,
      cultural_factors: 0,
    },
    actionableItems: [
      { itemCode: "RSK-01", label: "Safety planning", domain: "risk_behaviors", rating: 3, disposition: "need" },
      { itemCode: "LIF-01", label: "Daily routine", domain: "life_functioning", rating: 2, disposition: "need" },
      { itemCode: "STR-01", label: "Community connection", domain: "strengths", rating: 1, disposition: "strength" },
    ],
    createdAt: NOW,
  };
}

function route(status: CcmgReferralIntake["status"] = "ready_for_routing") {
  return routeCansToApprovedPlans({
    referralStatus: status,
    assessment: finalCans(),
    previousAssessment: null,
    mhtcmPlan: {
      id: "SYNTH-MHTCM-PLAN",
      version: 1,
      targetType: "mhtcm_plan",
      status: "approved",
      approvedBy: "SYNTH-LPHA",
      approvedAt: NOW,
    },
    mhrsSkillsGoals: {
      id: "SYNTH-MHRS-GOALS",
      version: 1,
      targetType: "mhrs_skills_goals",
      status: "approved",
      approvedBy: "SYNTH-LPHA",
      approvedAt: NOW,
    },
    routedBy: "SYNTH-CCMG-DIRECTOR",
    routedAt: NOW,
  });
}

describe("M2.1 CCMG controlled contracts", () => {
  it("evaluates all six intake gates and the ready/new path", () => {
    const evaluation = evaluateIntakeReadiness(readyReferral(), NOW);
    expect(INTAKE_GATE_IDS).toEqual([
      "referral_intake",
      "eligibility",
      "payer_authorization",
      "consent",
      "cans_schedule",
      "capacity",
    ]);
    expect(evaluation.ready).toBe(true);
    expect(evaluation.gates.map((gate) => gate.id)).toEqual(INTAKE_GATE_IDS);
    expect(evaluation.gates.every((gate) => gate.passed)).toBe(true);
  });

  it("keeps held and rejected dispositions distinct", () => {
    expect(evaluateIntakeReadiness(readyReferral("held"), NOW)).toMatchObject({
      ready: false,
      status: "held",
      reasonCodes: expect.arrayContaining(["REFERRAL_HELD"]),
    });
    expect(evaluateIntakeReadiness(readyReferral("rejected"), NOW)).toMatchObject({
      ready: false,
      status: "rejected",
      reasonCodes: expect.arrayContaining(["REFERRAL_REJECTED"]),
    });
  });

  it("routes a final existing CANS only to approved MHTCM and MHRS targets", () => {
    const result = route("active");
    expect(result.valid).toBe(true);
    expect(result.lineage.map((entry) => entry.targetType)).toEqual(["mhtcm_plan", "mhrs_skills_goals"]);
    expect(result.lineage.every((entry) => entry.mappedGoals.length > 0)).toBe(true);
    const first = finalCans();
    const second = finalCans(2, first.id);
    expect(validateCansVersionHistory([second, first])).toEqual([]);
  });

  it("denies post-rejection CANS routing", () => {
    expect(route("rejected")).toEqual({
      valid: false,
      reasonCodes: ["REFERRAL_NOT_ROUTABLE"],
      lineage: [],
    });
  });

  it("rejects swapped named plan targets and cross-scope version histories", () => {
    const assessment = finalCans();
    const swapped = routeCansToApprovedPlans({
      referralStatus: "active",
      assessment,
      previousAssessment: null,
      mhtcmPlan: {
        id: "SYNTH-WRONG-MHRS",
        version: 1,
        targetType: "mhrs_skills_goals",
        status: "approved",
        approvedBy: "SYNTH-LPHA",
        approvedAt: NOW,
      },
      mhrsSkillsGoals: {
        id: "SYNTH-WRONG-MHTCM",
        version: 1,
        targetType: "mhtcm_plan",
        status: "approved",
        approvedBy: "SYNTH-LPHA",
        approvedAt: NOW,
      },
      routedBy: "SYNTH-CCMG-DIRECTOR",
      routedAt: NOW,
    });
    expect(swapped).toMatchObject({ valid: false, reasonCodes: expect.arrayContaining(["TARGET_TYPE_MISMATCH"]), lineage: [] });

    const second = finalCans(2, assessment.id);
    const crossScope = {
      ...second,
      referralId: "SYNTH-OTHER-REFERRAL",
      evidenceClass: "production" as const,
    };
    expect(validateCansVersionHistory([assessment, crossScope])).toEqual(["CANS_HISTORY_SCOPE_MISMATCH"]);
  });

  it("reconciles exact queue visibility by role", () => {
    expect(visibleQueueIdsForRole("bhc-director")).toEqual(CCMG_QUEUE_IDS);
    expect(visibleQueueIdsForRole("ccmg-program-director")).toEqual(CCMG_QUEUE_IDS);
    expect(visibleQueueIdsForRole("treatment-director")).toEqual(["qa", "cans", "mhtcm"]);
    expect(visibleQueueIdsForRole("qmhp-cs")).toEqual(["intake", "cans"]);
    expect(visibleQueueIdsForRole("therapist")).toEqual(["mhrs"]);
    expect(visibleQueueIdsForRole("revenue-cycle-manager")).toEqual(["intake"]);
    expect(visibleQueueIdsForRole("hr-director")).toEqual([]);
  });

  it("validates all five immutable audit event shapes", () => {
    expect(CCMG_AUDIT_EVENT_TYPES).toEqual(["access", "assignment", "approval", "plan_handoff", "material_change"]);
    CCMG_AUDIT_EVENT_TYPES.forEach((eventType, index) => {
      const access = eventType === "access";
      const event: CcmgAuditEvent = {
        id: `SYNTH-AUDIT-${index}`,
        caseId: "SYNTH-CASE",
        referralId: "SYNTH-REF",
        workItemId: access ? null : "SYNTH-WORK",
        eventType,
        action: `synthetic_${eventType}`,
        entityType: "synthetic_entity",
        entityId: "SYNTH-ENTITY",
        actorId: "SYNTH-ACTOR",
        actorRole: "ccmg-program-director",
        reason: "Controlled synthetic audit evidence.",
        before: access ? null : { status: "before" },
        after: access ? null : { status: "after" },
        changedFields: access ? [] : ["status"],
        correlationId: `SYNTH-CORR-${index}`,
        evidenceClass: "synthetic_demo",
        occurredAt: NOW,
      };
      expect(validateAuditEvent(event)).toEqual([]);
    });
  });
});
