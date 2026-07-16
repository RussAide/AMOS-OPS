import type { UserRole } from "@/constants/roles";
import {
  M41C_PATHWAY_STAGES,
  type M41cBlockedActionResult,
  type M41cControlledClinicalAction,
  type M41cNamedHumanDecision,
  type M41cPathwayRunInput,
  type M41cPathwayRunResult,
  type M41cPathwayStage,
  type M41cSyntheticScenario,
} from "@contracts/m41c/pathways";
import {
  M41C_DEMO_BOUNDARY,
  M41C_EVALUATION_AS_OF,
  M41C_EVIDENCE_CLASS,
  M41C_PROHIBITED_ACTIONS,
  type M41cAuditEvent,
  type M41cClinicalCitation,
  type M41cHumanGate,
  type M41cProhibitedAction,
} from "@contracts/m41c/shared";
import { verifyM41cSignedValidationRecord } from "./clinical-governance";

const NON_HUMAN_ACTOR = /^(?:ai|amos|assistant|model|system)(?:$|[-_:])/i;

function hash(input: string): string {
  let value = 2166136261;
  for (const character of input) {
    value ^= character.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  return (value >>> 0).toString(16).padStart(8, "0");
}

export function m41cDeterministicId(
  prefix: string,
  ...parts: readonly string[]
): string {
  return `${prefix}-${hash(parts.join("|"))}`;
}

export function assertM41cSyntheticIdentifier(
  value: string,
  code = "M41C_SYNTHETIC_IDENTIFIER_REQUIRED",
): void {
  if (!value.startsWith("SYNTH-")) throw new Error(code);
}

function assertTime(value: string, code: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new Error(code);
}

function assertNamedHumanDecision(
  decision: M41cNamedHumanDecision,
  accountableRoles: readonly UserRole[],
  competencyIds: readonly string[],
): void {
  if (
    !decision.decidedBy.startsWith("SYNTH-HUMAN-") ||
    NON_HUMAN_ACTOR.test(decision.decidedBy.trim())
  ) {
    throw new Error("M41C_NAMED_HUMAN_DECISION_REQUIRED");
  }
  if (!accountableRoles.includes(decision.decidedByRole)) {
    throw new Error("M41C_HUMAN_ROLE_NOT_ACCOUNTABLE");
  }
  if (!decision.rationale.trim()) {
    throw new Error("M41C_HUMAN_RATIONALE_REQUIRED");
  }
  if (decision.disposition === "modified" && !decision.overrideReason?.trim()) {
    throw new Error("M41C_MODIFICATION_OVERRIDE_REASON_REQUIRED");
  }
  if (decision.qualificationIds.length === 0) {
    throw new Error("M41C_HUMAN_QUALIFICATION_REQUIRED");
  }
  if (
    competencyIds.some(
      (competencyId) => !decision.qualificationIds.includes(competencyId),
    )
  ) {
    throw new Error("M41C_HUMAN_COMPETENCY_REQUIRED");
  }
  assertTime(decision.decidedAt, "M41C_HUMAN_DECISION_TIME_INVALID");
}

export function buildM41cHumanGate(input: {
  gateId: string;
  accountableRoles: readonly UserRole[];
  competencyIds: readonly string[];
  decision?: M41cNamedHumanDecision;
}): M41cHumanGate {
  if (input.accountableRoles.length === 0) {
    throw new Error("M41C_ACCOUNTABLE_HUMAN_ROLE_REQUIRED");
  }
  if (input.decision) {
    assertNamedHumanDecision(
      input.decision,
      input.accountableRoles,
      input.competencyIds,
    );
  }
  return Object.freeze({
    gateId: input.gateId,
    domain: "clinical",
    required: true,
    accountableRoles: Object.freeze([...input.accountableRoles]),
    qualifiedRoleRequired: true,
    competencyIdsRequired: Object.freeze([...input.competencyIds]),
    status: input.decision?.disposition ?? "pending",
    decidedBy: input.decision?.decidedBy ?? null,
    decidedByRole: input.decision?.decidedByRole ?? null,
    decidedAt: input.decision?.decidedAt ?? null,
    rationale: input.decision?.rationale ?? null,
    overrideReason: input.decision?.overrideReason ?? null,
  });
}

export function createM41cAuditEvent(input: {
  eventType: M41cAuditEvent["eventType"];
  actorId: string;
  actorRole: UserRole;
  entityType: M41cAuditEvent["entityType"];
  entityId: string;
  correlationId: string;
  sourceIds?: readonly string[];
  before?: Readonly<Record<string, unknown>> | null;
  after?: Readonly<Record<string, unknown>> | null;
  rationale?: string | null;
  occurredAt: string;
}): M41cAuditEvent {
  assertM41cSyntheticIdentifier(
    input.actorId,
    "M41C_AUDIT_SYNTHETIC_ACTOR_REQUIRED",
  );
  assertM41cSyntheticIdentifier(
    input.correlationId,
    "M41C_AUDIT_SYNTHETIC_CORRELATION_REQUIRED",
  );
  assertTime(input.occurredAt, "M41C_AUDIT_TIME_INVALID");
  if (!input.actorId.startsWith("SYNTH-"))
    throw new Error("M41C_AUDIT_SYNTHETIC_ACTOR_REQUIRED");
  if (!/^(?:SYNTH-|M41C-)/.test(input.entityId))
    throw new Error("M41C_AUDIT_SYNTHETIC_ENTITY_REQUIRED");
  if (!input.correlationId.startsWith("SYNTH-"))
    throw new Error("M41C_AUDIT_SYNTHETIC_CORRELATION_REQUIRED");
  return Object.freeze({
    id: m41cDeterministicId(
      "M41C-AUDIT",
      input.correlationId,
      input.eventType,
      input.entityId,
      input.occurredAt,
    ),
    eventType: input.eventType,
    actorId: input.actorId,
    actorRole: input.actorRole,
    entityType: input.entityType,
    entityId: input.entityId,
    correlationId: input.correlationId,
    sourceIds: Object.freeze([...(input.sourceIds ?? [])]),
    before: input.before ?? null,
    after: input.after ?? null,
    rationale: input.rationale ?? null,
    occurredAt: input.occurredAt,
    immutable: true,
    evidenceClass: M41C_EVIDENCE_CLASS,
  });
}

function citation(sourceId: string): M41cClinicalCitation {
  return Object.freeze({
    sourceId,
    title: `Synthetic governed source metadata ${sourceId}`,
    publisher: "AMOS-OPS Clinical Governance Council — synthetic prototype",
    version: "demo-metadata-1.0",
    canonicalUrl: null,
    effectiveAt: null,
    reviewedAt: M41C_EVALUATION_AS_OF,
    sourceState: "current",
    licenseState: "metadata_only",
    evidenceGrade: "synthetic_test_standin",
    limitations: Object.freeze([
      "Metadata-only stand-in; no proprietary instrument content is stored.",
      "A qualified human must verify the authoritative source before clinical use.",
    ]),
    missingEvidence: Object.freeze([
      "Authoritative content and license validation are outside this synthetic prototype.",
    ]),
  });
}

function stageOutputId(runId: string, stage: M41cPathwayStage): string {
  return m41cDeterministicId("SYNTH-M41C-OUTPUT", runId, stage);
}

function longitudinalReference(
  input: M41cPathwayRunInput,
  stages: M41cPathwayRunResult["stages"],
) {
  const completedOutputs = (stage: M41cPathwayStage): readonly string[] =>
    stages.find((candidate) => candidate.stage === stage)?.outputIds ?? [];
  return Object.freeze({
    episodeId: input.episodeId,
    subjectId: input.subjectId,
    assessmentIds: Object.freeze([input.assessment.assessmentId]),
    formulationIds: Object.freeze([...completedOutputs("formulation")]),
    goalIds: Object.freeze([...completedOutputs("goals")]),
    interventionIds: Object.freeze([...completedOutputs("interventions")]),
    serviceIds: Object.freeze([...completedOutputs("staff_and_services")]),
    outcomeIds: Object.freeze([...completedOutputs("outcomes")]),
    transitionIds: Object.freeze([...completedOutputs("transition")]),
    aftercareIds: Object.freeze([...completedOutputs("aftercare")]),
  });
}

export function runM41cPathway(
  input: M41cPathwayRunInput,
): M41cPathwayRunResult {
  assertM41cSyntheticIdentifier(input.runId);
  assertM41cSyntheticIdentifier(input.subjectId);
  assertM41cSyntheticIdentifier(input.episodeId);
  assertM41cSyntheticIdentifier(input.assessment.assessmentId);
  assertM41cSyntheticIdentifier(input.actorId);
  assertM41cSyntheticIdentifier(input.correlationId);
  assertTime(input.occurredAt, "M41C_PATHWAY_TIME_INVALID");
  if (input.pathway.activationState !== "demo_approved") {
    throw new Error("M41C_PATHWAY_NOT_DEMO_APPROVED");
  }
  if (!input.pathway.syntheticOnly) {
    throw new Error("M41C_SYNTHETIC_PATHWAY_REQUIRED");
  }
  if (input.pathway.sourceIds.length === 0) {
    throw new Error("M41C_PATHWAY_SOURCE_REQUIRED");
  }
  if (
    input.signedValidation.artifactId !== input.pathway.id ||
    input.signedValidation.artifactKind !== "pathway" ||
    input.signedValidation.artifactVersion !== input.pathway.version ||
    !input.signedValidation.approvedForSyntheticDemo ||
    verifyM41cSignedValidationRecord(input.signedValidation).length > 0
  ) {
    throw new Error("M41C_PATHWAY_SIGNED_VALIDATION_REQUIRED");
  }
  if (
    !input.pathway.sourceIds.every((sourceId) =>
      input.signedValidation.sourceIds.includes(sourceId),
    )
  ) {
    throw new Error("M41C_PATHWAY_VALIDATION_SOURCE_MISMATCH");
  }
  if (
    !input.competencyGate.passedForSyntheticDemo ||
    input.competencyGate.productionUseAuthorized !== false ||
    input.pathway.humanGateTemplate.competencyIdsRequired.some(
      (requirementId) =>
        !input.competencyGate.satisfiedRequirementIds.includes(requirementId),
    )
  ) {
    throw new Error("M41C_PATHWAY_COMPETENCY_GATE_REQUIRED");
  }
  if (
    input.pathway.steps.length !== M41C_PATHWAY_STAGES.length ||
    input.pathway.steps.some(
      (step, index) => step.stage !== M41C_PATHWAY_STAGES[index],
    ) ||
    new Set(input.pathway.steps.map((step) => step.stage)).size !==
      M41C_PATHWAY_STAGES.length
  ) {
    throw new Error("M41C_PATHWAY_STAGE_SEQUENCE_INVALID");
  }
  if (
    !input.pathway.instrumentProfileIds.includes(input.assessment.profileId)
  ) {
    throw new Error("M41C_PATHWAY_INSTRUMENT_PROFILE_MISMATCH");
  }
  for (const signal of input.assessment.signals) {
    if (
      !signal.code.startsWith("SYNTH-") ||
      signal.assessmentId !== input.assessment.assessmentId ||
      !Number.isFinite(Date.parse(signal.recordedAt))
    ) {
      throw new Error("M41C_SYNTHETIC_ASSESSMENT_SIGNAL_INVALID");
    }
  }
  if (
    input.humanDecision &&
    Date.parse(input.humanDecision.decidedAt) < Date.parse(input.occurredAt)
  ) {
    throw new Error("M41C_HUMAN_DECISION_BEFORE_PATHWAY");
  }

  const gate = buildM41cHumanGate({
    gateId: `${input.runId}-HUMAN-GATE`,
    accountableRoles: input.pathway.humanGateTemplate.accountableRoles,
    competencyIds: input.pathway.humanGateTemplate.competencyIdsRequired,
    decision: input.humanDecision,
  });
  const incomplete = input.assessment.missingInputs.length > 0;
  const outputs = Object.fromEntries(
    input.pathway.steps.map((step) => [
      step.stage,
      stageOutputId(input.runId, step.stage),
    ]),
  ) as Readonly<Record<M41cPathwayStage, string>>;
  const stages = input.pathway.steps.map((step, index) => {
    const status = incomplete
      ? "blocked_missing_input"
      : gate.status === "rejected" && index >= 2
        ? "rejected"
        : index < 2 || gate.status === "approved" || gate.status === "modified"
          ? "complete"
          : "pending_human_review";
    return Object.freeze({
      id: m41cDeterministicId("SYNTH-M41C-STAGE", input.runId, step.stage),
      stage: step.stage,
      status,
      inputIds: Object.freeze(
        index === 0
          ? [input.assessment.assessmentId]
          : [outputs[input.pathway.steps[index - 1].stage]],
      ),
      outputIds: Object.freeze(
        status === "complete" ? [outputs[step.stage]] : [],
      ),
      explanation: incomplete
        ? `Stopped because required synthetic inputs are missing: ${input.assessment.missingInputs.join(", ")}.`
        : status === "rejected"
          ? "Named human reviewer rejected the proposed downstream pathway stages."
          : status === "pending_human_review"
            ? "Proposed stage is held for a named, qualified human decision."
            : "Synthetic pathway stage linked to the longitudinal record.",
      humanGateId: gate.gateId,
    });
  });

  const status = incomplete
    ? "blocked_incomplete"
    : gate.status === "approved"
      ? "approved_for_demo"
      : gate.status === "modified"
        ? "modified_for_demo"
        : gate.status === "rejected"
          ? "rejected"
          : "awaiting_human_review";
  const recommendation = incomplete
    ? null
    : Object.freeze({
        id: m41cDeterministicId("SYNTH-M41C-RECOMMENDATION", input.runId),
        subjectId: input.subjectId,
        pathwayId: input.pathway.id,
        pathwayVersion: input.pathway.version,
        summary:
          "Review the synthetic needs, strengths, goals, services, outcomes, transition, and aftercare proposal.",
        rationale: Object.freeze([
          "The pathway preserves assessment-to-aftercare lineage.",
          "No diagnostic, prescribing, level-of-care, discharge, claim, disclosure, or live-write action is permitted.",
        ]),
        sourceIds: Object.freeze([...input.pathway.sourceIds]),
        citations: Object.freeze(input.pathway.sourceIds.map(citation)),
        missingEvidence: Object.freeze([
          "Authoritative instrument content and real clinical evidence are intentionally absent.",
        ]),
        uncertainty:
          "Synthetic metadata cannot establish clinical validity or an individual care decision.",
        confidence: null,
        requiredHumanApprover: Object.freeze([...gate.accountableRoles]),
        humanGate: gate,
        workplanCadences: Object.freeze([
          "daily",
          "weekly",
          "monthly",
          "quarterly",
          "annual",
        ] as const),
        workplanItemIds: Object.freeze([]),
        prohibitedActions: M41C_DEMO_BOUNDARY.prohibitedActions,
        status:
          status === "approved_for_demo"
            ? "approved_for_demo"
            : status === "modified_for_demo"
              ? "modified_for_demo"
              : status === "rejected"
                ? "rejected"
                : "proposed",
        createdAt: input.occurredAt,
        evidenceClass: M41C_EVIDENCE_CLASS,
      } as const);
  const audits: M41cAuditEvent[] = [
    createM41cAuditEvent({
      eventType: "pathway_evaluated",
      actorId: input.actorId,
      actorRole: input.actorRole,
      entityType: "pathway",
      entityId: input.pathway.id,
      correlationId: input.correlationId,
      sourceIds: input.pathway.sourceIds,
      after: { runId: input.runId, status, humanGateId: gate.gateId },
      rationale: incomplete
        ? "Incomplete inputs stopped pathway progression."
        : "Synthetic pathway evaluated without production action.",
      occurredAt: input.occurredAt,
    }),
  ];
  if (input.humanDecision) {
    audits.push(
      createM41cAuditEvent({
        eventType:
          input.humanDecision.overrideReason === null
            ? "human_disposition"
            : "override_recorded",
        actorId: input.humanDecision.decidedBy,
        actorRole: input.humanDecision.decidedByRole,
        entityType: "human_gate",
        entityId: gate.gateId,
        correlationId: input.correlationId,
        sourceIds: input.pathway.sourceIds,
        after: {
          disposition: input.humanDecision.disposition,
          rationale: input.humanDecision.rationale,
          overrideReason: input.humanDecision.overrideReason,
        },
        rationale: input.humanDecision.rationale,
        occurredAt: input.humanDecision.decidedAt,
      }),
    );
  }

  return Object.freeze({
    runId: input.runId,
    correlationId: input.correlationId,
    status,
    stages: Object.freeze(stages),
    recommendation,
    longitudinalReference: longitudinalReference(input, stages),
    auditEvents: Object.freeze(audits),
    blockedActions: M41C_DEMO_BOUNDARY.prohibitedActions,
    productionRows: 0,
    liveWrites: 0,
  });
}

const ACTION_MAP: Readonly<
  Record<M41cControlledClinicalAction, M41cProhibitedAction>
> = Object.freeze({
  production_care_update: "production_care_update",
  diagnosis: "diagnosis",
  autonomous_level_of_care_assignment: "autonomous_level_of_care_assignment",
  prescribing: "prescribing",
  medication_authorization: "medication_authorization",
  autonomous_discharge: "autonomous_discharge",
  claims_submission: "claims_submission",
  external_disclosure: "external_disclosure",
  cmbhs_write: "cmbhs_write",
  live_write: "production_care_update",
  level_of_care_assignment: "autonomous_level_of_care_assignment",
  discharge: "autonomous_discharge",
  clinical_disclosure: "external_disclosure",
});

export function blockM41cControlledAction(input: {
  action: M41cControlledClinicalAction;
  actorId: string;
  actorRole: UserRole;
  entityId: string;
  correlationId: string;
  occurredAt: string;
}): M41cBlockedActionResult {
  const mapped = ACTION_MAP[input.action];
  return Object.freeze({
    requestedAction: input.action,
    mappedProhibitedAction: mapped,
    blocked: true,
    reason: `${mapped} is unavailable in the synthetic M4.1C evaluation boundary.`,
    auditEvent: createM41cAuditEvent({
      eventType: "external_write_blocked",
      actorId: input.actorId,
      actorRole: input.actorRole,
      entityType: "pathway",
      entityId: input.entityId,
      correlationId: input.correlationId,
      after: { requestedAction: input.action, mappedProhibitedAction: mapped },
      rationale:
        "The synthetic prototype has no production clinical action surface.",
      occurredAt: input.occurredAt,
    }),
    productionRows: 0,
    liveWrites: 0,
  });
}

export const M41C_SYNTHETIC_SCENARIOS: readonly M41cSyntheticScenario[] =
  Object.freeze(
    [
      ["ROUTINE", "routine", "Continue governed measurement and human review."],
      ["INCOMPLETE", "incomplete", "Stop and request missing evidence."],
      [
        "POSITIVE-SAFETY",
        "positive_safety",
        "Escalate to qualified BSSA review.",
      ],
      ["ESCALATING", "escalating", "Activate human crisis handoff."],
      [
        "CONFLICT",
        "conflict",
        "Surface source conflict and pause recommendation.",
      ],
      [
        "REASSESSMENT",
        "reassessment",
        "Create a governed reassessment review.",
      ],
      [
        "LOC-REVIEW",
        "loc_review",
        "Route a nonbinding LOC proposal to a qualified human.",
      ],
      [
        "TRANSITION",
        "transition",
        "Require transition and aftercare verification.",
      ],
      [
        "OUTAGE",
        "outage",
        "Queue read-only reconciliation without external writes.",
      ],
      ["OVERRIDE", "override", "Record named human rationale and review."],
      [
        "RECOVERY",
        "recovery",
        "Reconcile recovered snapshot before resuming review.",
      ],
    ].map(([suffix, kind, expectedControl]) => ({
      id: `SYNTH-M41C-SCENARIO-${suffix}`,
      kind,
      subjectId: "SYNTH-YOUTH-001",
      expectedControl,
      syntheticOnly: true,
    })) as readonly M41cSyntheticScenario[],
  );

export function verifyM41cProhibitedActionCoverage(): boolean {
  return M41C_PROHIBITED_ACTIONS.every(
    (action) => ACTION_MAP[action] === action,
  );
}
