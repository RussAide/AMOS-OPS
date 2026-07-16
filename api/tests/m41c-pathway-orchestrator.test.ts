import { describe, expect, it } from "vitest";
import {
  M41C_PATHWAY_STAGES,
  type M41cNamedHumanDecision,
  type M41cPathwayDefinition,
  type M41cSyntheticAssessmentReference,
} from "@contracts/m41c/pathways";
import { M41C_PROHIBITED_ACTIONS } from "@contracts/m41c/shared";
import { createM41cSignedValidationRecord } from "../services/m41c/clinical-governance";
import {
  createSyntheticM41cCompetencyRegistry,
  evaluateM41cCompetencyGate,
} from "../services/m41c/competency-registry";
import {
  M41C_SYNTHETIC_SCENARIOS,
  blockM41cControlledAction,
  runM41cPathway,
  verifyM41cProhibitedActionCoverage,
} from "../services/m41c/pathway-orchestrator";

const NOW = "2026-11-15T08:00:00.000Z";

const pathway: M41cPathwayDefinition = {
  id: "M41C-PATHWAY-YOUTH-CONTINUUM-SYNTHETIC",
  version: "1.0-demo",
  title: "Synthetic youth assessment-to-aftercare pathway",
  domain: "cross_cutting",
  activationState: "demo_approved",
  syntheticOnly: true,
  sourceIds: ["M41C-SRC-SYNTHETIC-PATHWAY"],
  instrumentProfileIds: ["M41C-INSTRUMENT-SYNTHETIC-METADATA"],
  population: ["synthetic youth"],
  settings: ["synthetic continuum"],
  exclusions: ["real clinical use"],
  steps: M41C_PATHWAY_STAGES.map((stage) => ({
    id: `M41C-STEP-${stage}`,
    stage,
    title: stage,
    requiredInputs: ["prior governed stage"],
    outputKinds: [`synthetic ${stage} record`],
    requiredHumanRoles: ["clinical-supervisor"],
    stopOnMissingInput: true,
    prohibitedAutonomousActions: M41C_PROHIBITED_ACTIONS,
  })),
  measurementSchedule: {
    baselineRequired: true,
    reviewCadence: "weekly",
    reassessmentTriggers: ["synthetic change"],
    responseReviewRequired: true,
    nonresponseReviewRequired: true,
  },
  humanGateTemplate: {
    gateId: "M41C-TEMPLATE-GATE",
    domain: "clinical",
    required: true,
    accountableRoles: ["clinical-supervisor", "clinical-director"],
    qualifiedRoleRequired: true,
    competencyIdsRequired: ["M41C-COMP-PATHWAY"],
    status: "pending",
    decidedBy: null,
    decidedByRole: null,
    decidedAt: null,
    rationale: null,
    overrideReason: null,
  },
  limitations: ["synthetic only"],
};

const assessment: M41cSyntheticAssessmentReference = {
  assessmentId: "SYNTH-ASSESSMENT-001",
  profileId: "M41C-INSTRUMENT-SYNTHETIC-METADATA",
  profileVersion: "1.0-demo",
  completedAt: NOW,
  signals: [
    {
      code: "SYNTH-NEED-001",
      dimension: "need",
      state: "actionable",
      assessmentId: "SYNTH-ASSESSMENT-001",
      recordedAt: NOW,
      synthetic: true,
    },
    {
      code: "SYNTH-STRENGTH-001",
      dimension: "strength",
      state: "routine",
      assessmentId: "SYNTH-ASSESSMENT-001",
      recordedAt: NOW,
      synthetic: true,
    },
  ],
  missingInputs: [],
  contentIsSyntheticStandIn: true,
};

const humanDecision: M41cNamedHumanDecision = {
  decidedBy: "SYNTH-HUMAN-CLINICAL-SUPERVISOR-001",
  decidedByRole: "clinical-supervisor",
  decidedAt: "2026-11-15T08:05:00.000Z",
  disposition: "approved",
  rationale: "Synthetic pathway proposal reviewed for demonstration.",
  overrideReason: null,
  qualificationIds: ["M41C-COMP-PATHWAY"],
};

const competencyGate = evaluateM41cCompetencyGate(
  createSyntheticM41cCompetencyRegistry(),
  {
    staffId: "SYNTH-HUMAN-CLINICAL-DIRECTOR",
    staffRole: "clinical-director",
    requirementIds: ["M41C-COMP-PATHWAY"],
  },
);

const signedValidation = createM41cSignedValidationRecord({
  artifactId: pathway.id,
  artifactKind: "pathway",
  artifactVersion: pathway.version,
  checks: [
    {
      checkId: "SYNTH-PATHWAY-PREACTIVATION",
      label: "Synthetic pathway pre-activation validation",
      passed: true,
      evidenceIds: ["SYNTH-M41C-EVIDENCE-PATHWAY-001"],
      notes: ["Bounded synthetic pathway only"],
    },
  ],
  competencyGate,
  sourceIds: pathway.sourceIds,
  signatures: [
    {
      signedBy: "SYNTH-HUMAN-CLINICAL-DIRECTOR",
      signedByRole: "clinical-director",
      signedAt: "2026-11-15T08:01:00.000Z",
      attestation: "The synthetic pathway passed its governed checks.",
    },
    {
      signedBy: "SYNTH-HUMAN-BHC-DIRECTOR",
      signedByRole: "bhc-director",
      signedAt: "2026-11-15T08:02:00.000Z",
      attestation: "The pathway is approved for bounded demo use only.",
    },
  ],
});

function runInput() {
  return {
    runId: "SYNTH-M41C-PATHWAY-RUN-001",
    correlationId: "SYNTH-M41C-CORRELATION-001",
    subjectId: "SYNTH-YOUTH-001",
    episodeId: "SYNTH-EPISODE-001",
    pathway,
    assessment,
    actorId: "SYNTH-HUMAN-CLINICIAN-001",
    actorRole: "qmhp-cs" as const,
    occurredAt: NOW,
    signedValidation,
    competencyGate,
  };
}

describe("M4.1C deterministic assessment-to-aftercare pathway", () => {
  it("holds every proposed clinical action behind a named human gate", () => {
    const result = runM41cPathway(runInput());
    expect(result.status).toBe("awaiting_human_review");
    expect(result.stages.map((stage) => stage.stage)).toEqual(
      M41C_PATHWAY_STAGES,
    );
    expect(
      result.stages.slice(0, 2).every((stage) => stage.status === "complete"),
    ).toBe(true);
    expect(
      result.stages
        .slice(2)
        .every((stage) => stage.status === "pending_human_review"),
    ).toBe(true);
    expect(result.recommendation?.humanGate).toMatchObject({
      required: true,
      status: "pending",
      decidedBy: null,
    });
    expect(result.blockedActions).toEqual(M41C_PROHIBITED_ACTIONS);
    expect(result.longitudinalReference).toMatchObject({
      episodeId: "SYNTH-EPISODE-001",
      subjectId: "SYNTH-YOUTH-001",
      assessmentIds: ["SYNTH-ASSESSMENT-001"],
    });
    expect(result.productionRows).toBe(0);
    expect(result.liveWrites).toBe(0);
  });

  it("advances the full longitudinal chain only after a qualified named human decision", () => {
    const result = runM41cPathway({ ...runInput(), humanDecision });
    expect(result.status).toBe("approved_for_demo");
    expect(result.stages.every((stage) => stage.status === "complete")).toBe(
      true,
    );
    expect(result.recommendation).toMatchObject({
      status: "approved_for_demo",
      humanGate: {
        decidedBy: "SYNTH-HUMAN-CLINICAL-SUPERVISOR-001",
        status: "approved",
      },
    });
    expect(result.auditEvents.map((event) => event.eventType)).toContain(
      "human_disposition",
    );
    expect(result.longitudinalReference.aftercareIds).toHaveLength(1);
  });

  it("stops incomplete evidence without emitting a recommendation", () => {
    const result = runM41cPathway({
      ...runInput(),
      assessment: {
        ...assessment,
        missingInputs: ["synthetic guardian context"],
      },
    });
    expect(result.status).toBe("blocked_incomplete");
    expect(result.recommendation).toBeNull();
    expect(
      result.stages.every((stage) => stage.status === "blocked_missing_input"),
    ).toBe(true);
  });

  it("rejects non-human approval identities", () => {
    expect(() =>
      runM41cPathway({
        ...runInput(),
        humanDecision: { ...humanDecision, decidedBy: "AMOS-ASSISTANT" },
      }),
    ).toThrow("M41C_NAMED_HUMAN_DECISION_REQUIRED");
  });

  it("blocks every prohibited or aliased clinical action deterministically", () => {
    expect(verifyM41cProhibitedActionCoverage()).toBe(true);
    for (const action of [
      ...M41C_PROHIBITED_ACTIONS,
      "live_write",
      "level_of_care_assignment",
      "discharge",
      "clinical_disclosure",
    ] as const) {
      const result = blockM41cControlledAction({
        action,
        actorId: "SYNTH-HUMAN-CLINICIAN-001",
        actorRole: "clinical-supervisor",
        entityId: "SYNTH-EPISODE-001",
        correlationId: "SYNTH-BLOCK-CONTROL-001",
        occurredAt: NOW,
      });
      expect(result.blocked, action).toBe(true);
      expect(result.liveWrites, action).toBe(0);
      expect(result.productionRows, action).toBe(0);
    }
  });

  it("defines every required deterministic synthetic scenario without real data", () => {
    expect(M41C_SYNTHETIC_SCENARIOS.map((scenario) => scenario.kind)).toEqual([
      "routine",
      "incomplete",
      "positive_safety",
      "escalating",
      "conflict",
      "reassessment",
      "loc_review",
      "transition",
      "outage",
      "override",
      "recovery",
    ]);
    expect(
      M41C_SYNTHETIC_SCENARIOS.every(
        (scenario) =>
          scenario.syntheticOnly && scenario.subjectId.startsWith("SYNTH-"),
      ),
    ).toBe(true);
  });
});
