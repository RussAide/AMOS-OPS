import type {
  M41cSafetyStep,
  M41cSafetyStepResult,
  M41cSuicideCrisisInput,
  M41cSuicideCrisisResult,
} from "@contracts/m41c/pathways";
import { M41C_DEMO_BOUNDARY } from "@contracts/m41c/shared";
import { createSyntheticM41cClinicalKnowledgeRegistry } from "./clinical-knowledge-registry";
import {
  assertM41cSyntheticIdentifier,
  buildM41cHumanGate,
  createM41cAuditEvent,
  m41cDeterministicId,
} from "./pathway-orchestrator";

export const M41C_SUICIDE_SCREEN_METADATA_PROFILE =
  "M41C-SRC-NIMH-ASQ-TOOLKIT" as const;

const QUALIFIED_BSSA_ROLES = [
  "qmhp-cs",
  "therapist",
  "clinical-supervisor",
  "clinical-director",
  "nurse",
  "crisis-intervention-specialist",
] as const;
const LICENSED_DISPOSITION_ROLES = [
  "therapist",
  "clinical-supervisor",
  "clinical-director",
  "treatment-director",
  "nurse",
] as const;

const STEPS: readonly M41cSafetyStep[] = Object.freeze([
  "validated_screen_metadata",
  "positive_result_escalation",
  "qualified_bssa",
  "licensed_disposition",
  "safety_plan",
  "guardian_contact",
  "crisis_handoff",
  "follow_up",
  "supervisory_review",
]);

function evidence(
  input: M41cSuicideCrisisInput,
  step: M41cSafetyStep,
): string | null {
  switch (step) {
    case "validated_screen_metadata":
      return input.screeningCompletedAt
        ? m41cDeterministicId("SYNTH-SCREEN", input.pathwayRunId)
        : null;
    case "positive_result_escalation":
      return input.safetyState === "positive" ||
        input.safetyState === "escalating"
        ? m41cDeterministicId("SYNTH-ESCALATION", input.pathwayRunId)
        : null;
    case "qualified_bssa":
      return input.bssaCompletedBy
        ? m41cDeterministicId("SYNTH-BSSA", input.pathwayRunId)
        : null;
    case "licensed_disposition":
      return input.licensedDispositionBy
        ? m41cDeterministicId("SYNTH-LICENSED-DISPOSITION", input.pathwayRunId)
        : null;
    case "safety_plan":
      return input.safetyPlanId;
    case "guardian_contact":
      return input.guardianContactStatus === "documented" ||
        input.guardianContactStatus === "attempted" ||
        input.guardianContactStatus === "not_applicable"
        ? m41cDeterministicId("SYNTH-GUARDIAN-CONTACT", input.pathwayRunId)
        : null;
    case "crisis_handoff":
      return input.crisisHandoffId;
    case "follow_up":
      return input.followUpDueAt
        ? m41cDeterministicId("SYNTH-FOLLOW-UP", input.pathwayRunId)
        : null;
    case "supervisory_review":
      return input.humanDecision
        ? m41cDeterministicId("SYNTH-SUPERVISORY-REVIEW", input.pathwayRunId)
        : null;
  }
}

function stepResult(
  input: M41cSuicideCrisisInput,
  step: M41cSafetyStep,
): M41cSafetyStepResult {
  const evidenceId = evidence(input, step);
  const elevated =
    input.safetyState === "positive" || input.safetyState === "escalating";
  const applicable =
    step === "validated_screen_metadata" ||
    step === "supervisory_review" ||
    elevated;
  return Object.freeze({
    step,
    status: !applicable
      ? "not_applicable"
      : evidenceId
        ? "complete"
        : input.safetyState === "incomplete"
          ? "blocked"
          : "required",
    evidenceId,
  });
}

/** Metadata-only safety workflow. It never computes risk or a disposition. */
export function evaluateM41cSuicideCrisisPathway(
  input: M41cSuicideCrisisInput,
): M41cSuicideCrisisResult {
  assertM41cSyntheticIdentifier(input.pathwayRunId);
  assertM41cSyntheticIdentifier(input.subjectId);
  assertM41cSyntheticIdentifier(input.episodeId);
  if (input.screeningProfileId !== M41C_SUICIDE_SCREEN_METADATA_PROFILE) {
    throw new Error("M41C_VALIDATED_SCREEN_METADATA_PROFILE_REQUIRED");
  }
  if (!Number.isFinite(Date.parse(input.occurredAt))) {
    throw new Error("M41C_SAFETY_TIME_INVALID");
  }
  const screeningSource =
    createSyntheticM41cClinicalKnowledgeRegistry().sources.find(
      (source) => source.id === input.screeningProfileId,
    );
  if (
    !screeningSource ||
    screeningSource.state !== "current" ||
    Date.parse(screeningSource.reviewDueAt) <= Date.parse(input.occurredAt) ||
    screeningSource.contentBinding.proprietaryContentStored !== false
  ) {
    throw new Error("M41C_VALIDATED_SCREEN_METADATA_PROFILE_REQUIRED");
  }
  if (
    input.screeningCompletedAt !== null &&
    (!Number.isFinite(Date.parse(input.screeningCompletedAt)) ||
      Date.parse(input.screeningCompletedAt) > Date.parse(input.occurredAt))
  ) {
    throw new Error("M41C_SCREENING_TIME_INVALID");
  }
  if (input.safetyState !== "incomplete" && !input.screeningCompletedAt)
    throw new Error("M41C_SCREENING_EVIDENCE_REQUIRED");
  if (Boolean(input.bssaCompletedBy) !== Boolean(input.bssaCompletedByRole)) {
    throw new Error("M41C_BSSA_QUALIFIED_ROLE_REQUIRED");
  }
  if (
    input.bssaCompletedBy &&
    (!input.bssaCompletedBy.startsWith("SYNTH-HUMAN-") ||
      !QUALIFIED_BSSA_ROLES.some((role) => role === input.bssaCompletedByRole))
  ) {
    throw new Error("M41C_BSSA_QUALIFIED_ROLE_REQUIRED");
  }
  if (
    Boolean(input.licensedDispositionBy) !==
    Boolean(input.licensedDispositionByRole)
  ) {
    throw new Error("M41C_LICENSED_DISPOSITION_ROLE_REQUIRED");
  }
  if (
    input.licensedDispositionBy &&
    (!input.licensedDispositionBy.startsWith("SYNTH-HUMAN-") ||
      !LICENSED_DISPOSITION_ROLES.some(
        (role) => role === input.licensedDispositionByRole,
      ))
  ) {
    throw new Error("M41C_LICENSED_DISPOSITION_ROLE_REQUIRED");
  }
  if (input.safetyPlanId) assertM41cSyntheticIdentifier(input.safetyPlanId);
  if (input.crisisHandoffId)
    assertM41cSyntheticIdentifier(input.crisisHandoffId);
  if (
    input.followUpDueAt !== null &&
    (!Number.isFinite(Date.parse(input.followUpDueAt)) ||
      Date.parse(input.followUpDueAt) <= Date.parse(input.occurredAt))
  ) {
    throw new Error("M41C_SAFETY_FOLLOW_UP_TIME_INVALID");
  }
  if (
    input.humanDecision &&
    Date.parse(input.humanDecision.decidedAt) < Date.parse(input.occurredAt)
  ) {
    throw new Error("M41C_SAFETY_DECISION_BEFORE_PATHWAY");
  }

  const humanGate = buildM41cHumanGate({
    gateId: `${input.pathwayRunId}-SAFETY-HUMAN-GATE`,
    accountableRoles: [
      "clinical-director",
      "clinical-supervisor",
      "therapist",
      "nurse",
    ],
    competencyIds: ["M41C-COMP-YOUTH-SUICIDE-SAFETY"],
    decision: input.humanDecision,
  });
  const steps = STEPS.map((step) => stepResult(input, step));
  const elevated =
    input.safetyState === "positive" || input.safetyState === "escalating";
  const allElevatedStepsComplete = steps
    .filter((step) => step.status !== "not_applicable")
    .every((step) => step.status === "complete");
  const disposition =
    input.safetyState === "routine"
      ? "routine_monitoring"
      : input.safetyState === "incomplete"
        ? "stop_incomplete"
        : elevated && allElevatedStepsComplete
          ? "crisis_handoff_active"
          : "immediate_human_escalation";
  const auditEvents = elevated
    ? [
        createM41cAuditEvent({
          eventType: "safety_escalated",
          actorId: input.bssaCompletedBy ?? "SYNTH-HUMAN-SAFETY-ROUTER",
          actorRole: input.bssaCompletedByRole ?? "clinical-supervisor",
          entityType: "pathway",
          entityId: input.pathwayRunId,
          correlationId: input.pathwayRunId,
          sourceIds: [input.screeningProfileId],
          after: { safetyState: input.safetyState, disposition },
          rationale:
            "A synthetic positive safety signal requires immediate qualified human review.",
          occurredAt: input.occurredAt,
        }),
      ]
    : [];

  return Object.freeze({
    pathwayRunId: input.pathwayRunId,
    safetyState: input.safetyState,
    disposition,
    steps: Object.freeze(steps),
    humanGate,
    auditEvents: Object.freeze(auditEvents),
    prohibitedActions: M41C_DEMO_BOUNDARY.prohibitedActions,
    productionRows: 0,
    liveWrites: 0,
  });
}
