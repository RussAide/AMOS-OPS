import { describe, expect, it } from "vitest";
import type { M41cNamedHumanDecision } from "@contracts/m41c/pathways";
import { evaluateM41cMedicationPhysicalHealthSafety } from "../services/m41c/medication-physical-health-safety";
import {
  evaluateM41cSuicideCrisisPathway,
  M41C_SUICIDE_SCREEN_METADATA_PROFILE,
} from "../services/m41c/suicide-crisis-pathway";

const NOW = "2026-11-15T08:00:00.000Z";
const decision: M41cNamedHumanDecision = {
  decidedBy: "SYNTH-HUMAN-CLINICAL-SUPERVISOR-001",
  decidedByRole: "clinical-supervisor",
  decidedAt: "2026-11-15T08:05:00.000Z",
  disposition: "approved",
  rationale: "Synthetic safety chain reviewed for demonstration.",
  overrideReason: null,
  qualificationIds: ["M41C-COMP-YOUTH-SUICIDE-SAFETY"],
};
const medicationDecision: M41cNamedHumanDecision = {
  decidedBy: "SYNTH-HUMAN-CLINICAL-SUPERVISOR-001",
  decidedByRole: "clinical-supervisor",
  decidedAt: "2026-11-15T08:05:00.000Z",
  disposition: "approved",
  rationale: "Synthetic medication safety review completed.",
  overrideReason: null,
  qualificationIds: ["M41C-COMP-MEDICATION-AND-PHYSICAL-HEALTH-SAFETY"],
};

function crisisInput() {
  return {
    pathwayRunId: "SYNTH-SAFETY-RUN-001",
    subjectId: "SYNTH-YOUTH-001",
    episodeId: "SYNTH-EPISODE-001",
    safetyState: "routine" as const,
    screeningProfileId: M41C_SUICIDE_SCREEN_METADATA_PROFILE,
    screeningCompletedAt: NOW,
    bssaCompletedBy: null,
    bssaCompletedByRole: null,
    licensedDispositionBy: null,
    licensedDispositionByRole: null,
    safetyPlanId: null,
    guardianContactStatus: "not_applicable" as const,
    crisisHandoffId: null,
    followUpDueAt: null,
    occurredAt: NOW,
  };
}

describe("M4.1C youth suicide/crisis and medication safety", () => {
  it("keeps a routine screen in human-governed monitoring without a computed disposition", () => {
    const result = evaluateM41cSuicideCrisisPathway(crisisInput());
    expect(result.disposition).toBe("routine_monitoring");
    expect(
      result.steps.find((step) => step.step === "validated_screen_metadata"),
    ).toMatchObject({
      status: "complete",
    });
    expect(
      result.steps.find((step) => step.step === "qualified_bssa"),
    ).toMatchObject({
      status: "not_applicable",
    });
    expect(result.humanGate.required).toBe(true);
    expect(result.liveWrites).toBe(0);
  });

  it("stops incomplete safety evidence", () => {
    const result = evaluateM41cSuicideCrisisPathway({
      ...crisisInput(),
      safetyState: "incomplete",
      screeningCompletedAt: null,
    });
    expect(result.disposition).toBe("stop_incomplete");
    expect(result.steps[0].status).toBe("blocked");
    expect(result.auditEvents).toHaveLength(0);
  });

  it("routes a positive signal to immediate BSSA and licensed human review", () => {
    const result = evaluateM41cSuicideCrisisPathway({
      ...crisisInput(),
      safetyState: "positive",
      guardianContactStatus: "missing",
    });
    expect(result.disposition).toBe("immediate_human_escalation");
    expect(
      result.steps.find((step) => step.step === "qualified_bssa")?.status,
    ).toBe("required");
    expect(
      result.steps.find((step) => step.step === "licensed_disposition")?.status,
    ).toBe("required");
    expect(result.auditEvents[0]).toMatchObject({
      eventType: "safety_escalated",
      immutable: true,
    });
  });

  it("completes an escalating handoff only with the entire named-human safety chain", () => {
    const result = evaluateM41cSuicideCrisisPathway({
      ...crisisInput(),
      safetyState: "escalating",
      bssaCompletedBy: "SYNTH-HUMAN-QUALIFIED-ASSESSOR-001",
      bssaCompletedByRole: "qmhp-cs",
      licensedDispositionBy: "SYNTH-HUMAN-LICENSED-CLINICIAN-001",
      licensedDispositionByRole: "therapist",
      safetyPlanId: "SYNTH-SAFETY-PLAN-001",
      guardianContactStatus: "documented",
      crisisHandoffId: "SYNTH-CRISIS-HANDOFF-001",
      followUpDueAt: "2026-11-16T08:00:00.000Z",
      humanDecision: decision,
    });
    expect(result.disposition).toBe("crisis_handoff_active");
    expect(
      result.steps
        .filter((step) => step.status !== "not_applicable")
        .every((step) => step.status === "complete"),
    ).toBe(true);
    expect(result.humanGate.decidedBy).toBe(
      "SYNTH-HUMAN-CLINICAL-SUPERVISOR-001",
    );
    expect(result.prohibitedActions).toContain("diagnosis");
    expect(result.prohibitedActions).toContain("autonomous_discharge");
  });

  it("rejects ungoverned screen metadata, invalid chronology, and non-synthetic evidence", () => {
    expect(() =>
      evaluateM41cSuicideCrisisPathway({
        ...crisisInput(),
        screeningProfileId: "UNREGISTERED-SCREEN",
      }),
    ).toThrow("M41C_VALIDATED_SCREEN_METADATA_PROFILE_REQUIRED");
    expect(() =>
      evaluateM41cSuicideCrisisPathway({
        ...crisisInput(),
        screeningCompletedAt: "2026-11-16T08:00:00.000Z",
      }),
    ).toThrow("M41C_SCREENING_TIME_INVALID");
    expect(() =>
      evaluateM41cSuicideCrisisPathway({
        ...crisisInput(),
        safetyState: "positive",
        safetyPlanId: "REAL-SAFETY-PLAN",
      }),
    ).toThrow("M41C_SYNTHETIC_IDENTIFIER_REQUIRED");
    expect(() =>
      evaluateM41cSuicideCrisisPathway({
        ...crisisInput(),
        bssaCompletedBy: null,
        bssaCompletedByRole: "qmhp-cs",
      }),
    ).toThrow("M41C_BSSA_QUALIFIED_ROLE_REQUIRED");
  });

  it("creates medication and physical-health safety tasks without prescribing", () => {
    const result = evaluateM41cMedicationPhysicalHealthSafety({
      reviewId: "SYNTH-MED-HEALTH-REVIEW-001",
      subjectId: "SYNTH-YOUTH-001",
      episodeId: "SYNTH-EPISODE-001",
      medicationReconciliationComplete: true,
      allergyReviewComplete: true,
      monitoringDue: true,
      labReviewDue: true,
      refusalRecorded: true,
      adverseEventState: "suspected",
      physicalHealthFollowUpDue: true,
      transitionMedicationListVerified: false,
      reviewerId: "SYNTH-HUMAN-NURSE-001",
      reviewerRole: "nurse",
      occurredAt: NOW,
    });
    expect(result.status).toBe("human_safety_review");
    expect(result.tasks.map((task) => task.kind)).toEqual([
      "reconciliation",
      "allergy_review",
      "monitoring",
      "lab_review",
      "refusal_review",
      "adverse_event_escalation",
      "physical_health_follow_up",
      "transition_verification",
    ]);
    expect(result.prohibitedActions).toContain("prescribing");
    expect(result.prohibitedActions).toContain("medication_authorization");
    expect(result.liveWrites).toBe(0);
  });

  it("escalates an urgent adverse-event signal without taking medication action", () => {
    const result = evaluateM41cMedicationPhysicalHealthSafety({
      reviewId: "SYNTH-MED-HEALTH-REVIEW-URGENT",
      subjectId: "SYNTH-YOUTH-001",
      episodeId: "SYNTH-EPISODE-001",
      medicationReconciliationComplete: false,
      allergyReviewComplete: false,
      monitoringDue: true,
      labReviewDue: true,
      refusalRecorded: false,
      adverseEventState: "urgent",
      physicalHealthFollowUpDue: true,
      transitionMedicationListVerified: false,
      reviewerId: "SYNTH-HUMAN-NURSE-001",
      reviewerRole: "nurse",
      occurredAt: NOW,
    });
    expect(result.status).toBe("urgent_escalation");
    expect(result.auditEvents[0].eventType).toBe("safety_escalated");
    expect(result.productionRows).toBe(0);
    expect(result.liveWrites).toBe(0);
  });

  it("keeps suspected adverse events in human safety review even with incomplete reconciliation", () => {
    const result = evaluateM41cMedicationPhysicalHealthSafety({
      reviewId: "SYNTH-MED-HEALTH-REVIEW-SUSPECTED",
      subjectId: "SYNTH-YOUTH-001",
      episodeId: "SYNTH-EPISODE-001",
      medicationReconciliationComplete: false,
      allergyReviewComplete: false,
      monitoringDue: false,
      labReviewDue: false,
      refusalRecorded: false,
      adverseEventState: "suspected",
      physicalHealthFollowUpDue: false,
      transitionMedicationListVerified: false,
      reviewerId: "SYNTH-HUMAN-NURSE-001",
      reviewerRole: "nurse",
      humanDecision: medicationDecision,
      occurredAt: NOW,
    });
    expect(result.status).toBe("human_safety_review");
    expect(result.humanGate.status).toBe("approved");
    expect(result.auditEvents).toHaveLength(1);
  });

  it("rejects non-synthetic or unauthorized medication reviewers", () => {
    const base = {
      reviewId: "SYNTH-MED-HEALTH-REVIEW-REVIEWER",
      subjectId: "SYNTH-YOUTH-001",
      episodeId: "SYNTH-EPISODE-001",
      medicationReconciliationComplete: true,
      allergyReviewComplete: true,
      monitoringDue: false,
      labReviewDue: false,
      refusalRecorded: false,
      adverseEventState: "none" as const,
      physicalHealthFollowUpDue: false,
      transitionMedicationListVerified: true,
      reviewerId: "REAL-NURSE",
      reviewerRole: "nurse" as const,
      occurredAt: NOW,
    };
    expect(() => evaluateM41cMedicationPhysicalHealthSafety(base)).toThrow(
      "M41C_MEDICATION_SYNTHETIC_REVIEWER_REQUIRED",
    );
    expect(() =>
      evaluateM41cMedicationPhysicalHealthSafety({
        ...base,
        reviewerId: "SYNTH-HUMAN-BILLER-001",
        reviewerRole: "billing-specialist",
      }),
    ).toThrow("M41C_MEDICATION_REVIEWER_ROLE_DENIED");
  });
});
