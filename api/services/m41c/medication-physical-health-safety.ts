import type {
  M41cMedicationHealthInput,
  M41cMedicationHealthResult,
} from "@contracts/m41c/pathways";
import { M41C_DEMO_BOUNDARY } from "@contracts/m41c/shared";
import {
  assertM41cSyntheticIdentifier,
  buildM41cHumanGate,
  createM41cAuditEvent,
  m41cDeterministicId,
} from "./pathway-orchestrator";

type MedicationTask = M41cMedicationHealthResult["tasks"][number];
const MEDICATION_REVIEWER_ROLES = Object.freeze([
  "nurse",
  "medication-aide",
  "clinical-director",
  "clinical-supervisor",
  "treatment-director",
] as const);
const MEDICATION_APPROVER_ROLES = Object.freeze([
  "nurse",
  "clinical-director",
  "clinical-supervisor",
] as const);

function task(
  input: M41cMedicationHealthInput,
  kind: MedicationTask["kind"],
  status: MedicationTask["status"],
  cadence: MedicationTask["cadence"],
): MedicationTask {
  return Object.freeze({
    id: m41cDeterministicId("SYNTH-M41C-MED-TASK", input.reviewId, kind),
    kind,
    status,
    cadence,
  });
}

/**
 * Builds safety-review tasks only. It cannot recommend a medication, dose,
 * authorization, prescription, or change to a medication order.
 */
export function evaluateM41cMedicationPhysicalHealthSafety(
  input: M41cMedicationHealthInput,
): M41cMedicationHealthResult {
  assertM41cSyntheticIdentifier(input.reviewId);
  assertM41cSyntheticIdentifier(input.subjectId);
  assertM41cSyntheticIdentifier(input.episodeId);
  if (!input.reviewerId.startsWith("SYNTH-HUMAN-"))
    throw new Error("M41C_MEDICATION_SYNTHETIC_REVIEWER_REQUIRED");
  if (!MEDICATION_REVIEWER_ROLES.some((role) => role === input.reviewerRole))
    throw new Error("M41C_MEDICATION_REVIEWER_ROLE_DENIED");
  if (!Number.isFinite(Date.parse(input.occurredAt))) {
    throw new Error("M41C_MEDICATION_REVIEW_TIME_INVALID");
  }
  const tasks: MedicationTask[] = [
    task(
      input,
      "reconciliation",
      input.medicationReconciliationComplete ? "complete" : "due",
      "daily",
    ),
    task(
      input,
      "allergy_review",
      input.allergyReviewComplete ? "complete" : "due",
      "daily",
    ),
    task(
      input,
      "monitoring",
      input.monitoringDue ? "due" : "complete",
      "weekly",
    ),
    task(
      input,
      "lab_review",
      input.labReviewDue ? "due" : "complete",
      "weekly",
    ),
    task(
      input,
      "refusal_review",
      input.refusalRecorded ? "due" : "complete",
      "daily",
    ),
    task(
      input,
      "adverse_event_escalation",
      input.adverseEventState === "urgent"
        ? "urgent"
        : input.adverseEventState === "suspected"
          ? "due"
          : "complete",
      "daily",
    ),
    task(
      input,
      "physical_health_follow_up",
      input.physicalHealthFollowUpDue ? "due" : "complete",
      "weekly",
    ),
    task(
      input,
      "transition_verification",
      input.transitionMedicationListVerified ? "complete" : "due",
      "daily",
    ),
  ];
  const incomplete =
    !input.medicationReconciliationComplete || !input.allergyReviewComplete;
  const status =
    input.adverseEventState === "urgent"
      ? "urgent_escalation"
      : input.adverseEventState === "suspected"
        ? "human_safety_review"
        : incomplete
          ? "incomplete"
          : tasks.some((candidate) => candidate.status === "due")
            ? "human_safety_review"
            : "routine";
  const gate = buildM41cHumanGate({
    gateId: `${input.reviewId}-MEDICATION-HEALTH-HUMAN-GATE`,
    accountableRoles: MEDICATION_APPROVER_ROLES,
    competencyIds: ["M41C-COMP-MEDICATION-AND-PHYSICAL-HEALTH-SAFETY"],
    decision: input.humanDecision,
  });
  if (
    input.humanDecision &&
    Date.parse(input.humanDecision.decidedAt) < Date.parse(input.occurredAt)
  ) {
    throw new Error("M41C_MEDICATION_DECISION_BEFORE_REVIEW");
  }
  const auditEvents =
    input.adverseEventState === "urgent" ||
    input.adverseEventState === "suspected"
      ? [
          createM41cAuditEvent({
            eventType: "safety_escalated",
            actorId: input.reviewerId,
            actorRole: input.reviewerRole,
            entityType: "pathway",
            entityId: input.reviewId,
            correlationId: input.reviewId,
            after: { status, humanGateId: gate.gateId },
            rationale:
              input.adverseEventState === "urgent"
                ? "Synthetic urgent adverse-event signal routed to named clinical review; no medication action was taken."
                : "Synthetic suspected adverse-event signal routed to named clinical review; no medication action was taken.",
            occurredAt: input.occurredAt,
          }),
        ]
      : [];

  return Object.freeze({
    reviewId: input.reviewId,
    status,
    tasks: Object.freeze(tasks),
    humanGate: gate,
    auditEvents: Object.freeze(auditEvents),
    prohibitedActions: M41C_DEMO_BOUNDARY.prohibitedActions,
    productionRows: 0,
    liveWrites: 0,
  });
}
