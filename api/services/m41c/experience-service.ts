import type {
  M41cExperienceComponentStatus,
  M41cExperienceSnapshot,
  M41cSyntheticScenarioRunInput,
  M41cSyntheticScenarioRunResponse,
} from "@contracts/m41c/experience";
import type {
  M41cCompetencyGateResult,
  M41cSignedValidationRecord,
  M41cValidationCheck,
} from "@contracts/m41c/governance";
import type {
  M41cCmbhsSnapshot,
  M41cClinicalMonitoringInput,
} from "@contracts/m41c/mappings";
import {
  M41C_CONTINUUM_STAGES,
  M41C_PATHWAY_STAGES,
  type M41cNamedHumanDecision,
  type M41cPathwayDefinition,
  type M41cSyntheticAssessmentReference,
  type M41cSyntheticScenario,
  type M41cYouthPathwayPack,
} from "@contracts/m41c/pathways";
import {
  M41C_DEMO_BOUNDARY,
  M41C_EVALUATION_AS_OF,
  M41C_EVIDENCE_CLASS,
  M41C_PROHIBITED_ACTIONS,
} from "@contracts/m41c/shared";
import { buildM41cContinuumEpisode } from "./continuum-episode";
import {
  createM41cSignedValidationRecord,
  createSyntheticM41cClinicalGovernanceCouncil,
  m41cDeterministicId as governanceId,
} from "./clinical-governance";
import {
  createSyntheticM41cClinicalKnowledgeRegistry,
  exportM41cClinicalKnowledgeRegistry,
} from "./clinical-knowledge-registry";
import { evaluateM41cClinicalMonitoring } from "./clinical-monitoring";
import {
  projectM41cFhirAlignedBundle,
  reconcileM41cCmbhsSnapshots,
  validateM41cFhirAlignedBundle,
} from "./cmbhs-fhir-mapping";
import {
  createSyntheticM41cCompetencyRegistry,
  evaluateM41cCompetencyGate,
} from "./competency-registry";
import {
  activateM41cInstrumentProfile,
  createSyntheticM41cInstrumentProfileRegistry,
  validateM41cInstrumentProfile,
  verifyM41cTrRAndDfpsProfileSeparation,
} from "./instrument-profile-registry";
import {
  M41C_SYNTHETIC_SCENARIOS,
  runM41cPathway,
} from "./pathway-orchestrator";
import {
  evaluateM41cSuicideCrisisPathway,
  M41C_SUICIDE_SCREEN_METADATA_PROFILE,
} from "./suicide-crisis-pathway";
import {
  buildM41cTrrPackage,
  M41C_TRR_SYNTHETIC_PROFILE_ID,
} from "./trr-package";
import {
  evaluateM41cYouthPathwayPack,
  M41C_YOUTH_PATHWAY_PACKS,
} from "./youth-pathway-packs";

const NOW = M41C_EVALUATION_AS_OF;
const SYNTHETIC_SUBJECT_ID = "SYNTH-YOUTH-001";
const SYNTHETIC_EPISODE_ID = "SYNTH-EPISODE-CONTINUUM-001";

function clinicalDirectorGate(
  requirementIds: readonly string[],
): M41cCompetencyGateResult {
  return evaluateM41cCompetencyGate(createSyntheticM41cCompetencyRegistry(), {
    staffId: "SYNTH-HUMAN-CLINICAL-DIRECTOR",
    staffRole: "clinical-director",
    requirementIds,
  });
}

function signatures() {
  return Object.freeze([
    Object.freeze({
      signedBy: "SYNTH-HUMAN-CLINICAL-DIRECTOR",
      signedByRole: "clinical-director" as const,
      signedAt: "2026-11-15T08:01:00.000Z",
      attestation:
        "I reviewed the synthetic validation evidence and approve bounded demonstration use.",
    }),
    Object.freeze({
      signedBy: "SYNTH-HUMAN-BHC-DIRECTOR",
      signedByRole: "bhc-director" as const,
      signedAt: "2026-11-15T08:02:00.000Z",
      attestation:
        "I independently approve this artifact for deterministic synthetic evaluation only.",
    }),
  ]);
}

function validationChecks(
  artifactId: string,
  labels: readonly string[],
): readonly M41cValidationCheck[] {
  return Object.freeze(
    labels.map((label, index) =>
      Object.freeze({
        checkId: `${artifactId}-CHECK-${String(index + 1).padStart(2, "0")}`,
        label,
        passed: true,
        evidenceIds: Object.freeze([
          `SYNTH-EVIDENCE-${artifactId}-${String(index + 1).padStart(2, "0")}`,
        ]),
        notes: Object.freeze([
          "Validated only inside the synthetic M4.1C runtime boundary.",
        ]),
      }),
    ),
  );
}

function signedPathwayValidation(
  pathway: M41cPathwayDefinition,
  competencyGate: M41cCompetencyGateResult,
): M41cSignedValidationRecord {
  return createM41cSignedValidationRecord({
    artifactId: pathway.id,
    artifactKind: "pathway",
    artifactVersion: pathway.version,
    checks: validationChecks(pathway.id, [
      "Source and population boundary",
      "Ordered assessment-to-aftercare stages",
      "Human approval and override controls",
      "Competency and supervised-use controls",
      "Zero production rows and live writes",
    ]),
    competencyGate,
    sourceIds: pathway.sourceIds,
    signatures: signatures(),
  });
}

function pathwayFromPack(pack: M41cYouthPathwayPack): M41cPathwayDefinition {
  return Object.freeze({
    id: pack.id,
    version: pack.version,
    title: `${pack.domain.replace(/_/g, " ")} governed synthetic youth pathway`,
    domain: pack.domain,
    activationState: "demo_approved",
    syntheticOnly: true,
    sourceIds: pack.sourceIds,
    instrumentProfileIds: pack.instrumentMetadataIds,
    population: Object.freeze(["synthetic youth evaluation records"]),
    settings: Object.freeze(["synthetic youth continuum"]),
    exclusions: Object.freeze(["real clinical use"]),
    steps: Object.freeze(
      M41C_PATHWAY_STAGES.map((stage) =>
        Object.freeze({
          id: `${pack.id}-STEP-${stage.toUpperCase().replace(/_/g, "-")}`,
          stage,
          title: stage.replace(/_/g, " "),
          requiredInputs: Object.freeze(["prior governed stage evidence"]),
          outputKinds: Object.freeze([`synthetic ${stage} record`]),
          requiredHumanRoles: pack.requiredHumanRoles,
          stopOnMissingInput: true,
          prohibitedAutonomousActions: M41C_PROHIBITED_ACTIONS,
        }),
      ),
    ),
    measurementSchedule: pack.schedule,
    humanGateTemplate: Object.freeze({
      gateId: `${pack.id}-TEMPLATE-HUMAN-GATE`,
      domain: "clinical",
      required: true,
      accountableRoles: pack.requiredHumanRoles,
      qualifiedRoleRequired: true,
      competencyIdsRequired: Object.freeze(["M41C-COMP-PATHWAY"]),
      status: "pending",
      decidedBy: null,
      decidedByRole: null,
      decidedAt: null,
      rationale: null,
      overrideReason: null,
    }),
    limitations: pack.boundaries,
  });
}

function specialPathway(input: {
  id: string;
  title: string;
  domain: M41cPathwayDefinition["domain"];
  sourceIds: readonly string[];
  profileIds: readonly string[];
  competencyIds: readonly string[];
}): M41cPathwayDefinition {
  return Object.freeze({
    id: input.id,
    version: "synthetic-workflow-1.0",
    title: input.title,
    domain: input.domain,
    activationState: "demo_approved",
    syntheticOnly: true,
    sourceIds: Object.freeze([...input.sourceIds]),
    instrumentProfileIds: Object.freeze([...input.profileIds]),
    population: Object.freeze(["synthetic youth evaluation records"]),
    settings: Object.freeze(["synthetic youth continuum"]),
    exclusions: Object.freeze([
      "real clinical use",
      "official instrument scoring",
      "autonomous disposition",
    ]),
    steps: Object.freeze(
      M41C_PATHWAY_STAGES.map((stage) =>
        Object.freeze({
          id: `${input.id}-STEP-${stage.toUpperCase().replace(/_/g, "-")}`,
          stage,
          title: stage.replace(/_/g, " "),
          requiredInputs: Object.freeze(["prior governed stage evidence"]),
          outputKinds: Object.freeze([`synthetic ${stage} record`]),
          requiredHumanRoles: Object.freeze([
            "clinical-director" as const,
            "clinical-supervisor" as const,
          ]),
          stopOnMissingInput: true,
          prohibitedAutonomousActions: M41C_PROHIBITED_ACTIONS,
        }),
      ),
    ),
    measurementSchedule: Object.freeze({
      baselineRequired: true,
      reviewCadence: "weekly",
      reassessmentTriggers: Object.freeze([
        "synthetic safety, transition, or nonresponse signal",
      ]),
      responseReviewRequired: true,
      nonresponseReviewRequired: true,
    }),
    humanGateTemplate: Object.freeze({
      gateId: `${input.id}-TEMPLATE-HUMAN-GATE`,
      domain: "clinical",
      required: true,
      accountableRoles: Object.freeze([
        "clinical-director" as const,
        "clinical-supervisor" as const,
      ]),
      qualifiedRoleRequired: true,
      competencyIdsRequired: Object.freeze([...input.competencyIds]),
      status: "pending",
      decidedBy: null,
      decidedByRole: null,
      decidedAt: null,
      rationale: null,
      overrideReason: null,
    }),
    limitations: Object.freeze([
      "Workflow structure only; no official scoring, diagnosis, prescribing, level-of-care assignment, or live write is available.",
    ]),
  });
}

export function buildM41cPathwayCatalog(): readonly M41cPathwayDefinition[] {
  return Object.freeze([
    ...M41C_YOUTH_PATHWAY_PACKS.map(pathwayFromPack),
    specialPathway({
      id: "M41C-PATHWAY-TRR-DEMO",
      title: "Texas TRR governed synthetic workflow",
      domain: "trr",
      sourceIds: Object.freeze([
        "M41C-SRC-CONTROLLING-DOCTRINE",
        "M41C-SRC-TRR-CANS-METADATA",
      ]),
      profileIds: Object.freeze([M41C_TRR_SYNTHETIC_PROFILE_ID]),
      competencyIds: Object.freeze([
        "M41C-COMP-PATHWAY",
        "M41C-COMP-TRR-REVIEW",
        "M41C-COMP-LOC-HUMAN-REVIEW",
      ]),
    }),
    specialPathway({
      id: "M41C-PATHWAY-SUICIDE-CRISIS-DEMO",
      title: "Youth suicide and crisis governed synthetic workflow",
      domain: "suicide_crisis",
      sourceIds: Object.freeze([
        "M41C-SRC-CONTROLLING-DOCTRINE",
        "M41C-SRC-NIMH-ASQ",
      ]),
      profileIds: Object.freeze(["SYNTH-M41C-INSTRUMENT-STANDIN"]),
      competencyIds: Object.freeze([
        "M41C-COMP-PATHWAY",
        "M41C-COMP-YOUTH-SUICIDE-SAFETY",
      ]),
    }),
    specialPathway({
      id: "M41C-PATHWAY-MEDICATION-PHYSICAL-HEALTH-DEMO",
      title: "Medication and physical-health safety governed synthetic workflow",
      domain: "medication_physical_health",
      sourceIds: Object.freeze(["M41C-SRC-CONTROLLING-DOCTRINE"]),
      profileIds: Object.freeze(["SYNTH-M41C-INSTRUMENT-STANDIN"]),
      competencyIds: Object.freeze([
        "M41C-COMP-PATHWAY",
        "M41C-COMP-MEDICATION-AND-PHYSICAL-HEALTH-SAFETY",
      ]),
    }),
  ]);
}

function assessment(
  profileId: string,
  missingInputs: readonly string[] = [],
): M41cSyntheticAssessmentReference {
  return Object.freeze({
    assessmentId: "SYNTH-M41C-ASSESSMENT-001",
    profileId,
    profileVersion: "synthetic-metadata-1.0",
    completedAt: NOW,
    signals: Object.freeze([
      Object.freeze({
        code: "SYNTH-NEED-A",
        dimension: "need" as const,
        state: "actionable" as const,
        assessmentId: "SYNTH-M41C-ASSESSMENT-001",
        recordedAt: NOW,
        synthetic: true as const,
      }),
      Object.freeze({
        code: "SYNTH-STRENGTH-A",
        dimension: "strength" as const,
        state: "routine" as const,
        assessmentId: "SYNTH-M41C-ASSESSMENT-001",
        recordedAt: NOW,
        synthetic: true as const,
      }),
    ]),
    missingInputs: Object.freeze([...missingInputs]),
    contentIsSyntheticStandIn: true,
  });
}

function approvedDecision(
  qualificationIds: readonly string[],
  disposition: "approved" | "modified" = "approved",
): M41cNamedHumanDecision {
  return Object.freeze({
    decidedBy: "SYNTH-HUMAN-CLINICAL-DIRECTOR",
    decidedByRole: "clinical-director",
    decidedAt: "2026-11-15T08:10:00.000Z",
    disposition,
    rationale:
      "A named synthetic clinical authority reviewed the bounded demonstration result.",
    overrideReason:
      disposition === "modified"
        ? "Synthetic conflict required a documented human modification."
        : null,
    qualificationIds: Object.freeze([...qualificationIds]),
  });
}

function continuum() {
  return buildM41cContinuumEpisode({
    episodeId: SYNTHETIC_EPISODE_ID,
    subjectId: SYNTHETIC_SUBJECT_ID,
    openedAt: "2026-11-01T07:00:00.000Z",
    events: M41C_CONTINUUM_STAGES.map((stage, index) => {
      const code = stage.toUpperCase().replace(/_/g, "-");
      return Object.freeze({
        id: `SYNTH-CONTINUUM-EVENT-${String(index + 1).padStart(2, "0")}`,
        stage,
        occurredAt: `2026-11-${String(index + 1).padStart(2, "0")}T08:00:00.000Z`,
        serviceId: `SYNTH-SERVICE-${code}`,
        sourceRecordIds: Object.freeze([`SYNTH-RECORD-${code}`]),
        transitionReason:
          index === 0 ? null : `Synthetic transition into ${stage}`,
        aftercareLinkId:
          stage === "aftercare" ? "SYNTH-AFTERCARE-LINK-001" : null,
      });
    }),
    humanDecision: approvedDecision(["M41C-COMP-CONTINUUM-TRANSITION"]),
  });
}

function cmbhsSnapshot(id: string): M41cCmbhsSnapshot {
  return Object.freeze({
    snapshotId: id,
    subjectId: SYNTHETIC_SUBJECT_ID,
    episodeId: SYNTHETIC_EPISODE_ID,
    capturedAt: NOW,
    sourceVersion: "synthetic-1",
    fields: Object.freeze({
      assessmentStatus: "complete",
      recoveryPlanStatus: "linked",
      reviewSequence: 2,
    }),
    syntheticOnly: true,
  });
}

function healthyMonitoringInput(): M41cClinicalMonitoringInput {
  return Object.freeze({
    monitorId: "SYNTH-M41C-MONITOR-EXPERIENCE",
    evaluatedAt: NOW,
    sourceExpiryCount: 0,
    versionMismatchCount: 0,
    permissionDenialCount: 1,
    safetyEscalationCount: 2,
    safetyEscalationAcknowledgedCount: 2,
    alertsIssued: 6,
    alertsActionable: 6,
    overrideCount: 1,
    overridesReviewed: 1,
    pathwayStepExpected: 100,
    pathwayStepCompleted: 100,
    mappingErrorCount: 0,
    outcomeReviewExpected: 2,
    outcomeReviewCompleted: 2,
    unintendedEffectCount: 0,
    unintendedEffectsReviewed: 0,
    subgroupCompletionRates: Object.freeze({
      "SYNTH-GROUP-A": 0.96,
      "SYNTH-GROUP-B": 0.94,
    }),
  });
}

function component(
  index: number,
  title: string,
  evidenceIds: readonly string[],
  status: M41cExperienceComponentStatus["status"] = "complete",
): M41cExperienceComponentStatus {
  return Object.freeze({
    criterionId: `M4.1C-${String(index).padStart(2, "0")}` as M41cExperienceComponentStatus["criterionId"],
    title,
    status,
    summary:
      status === "quarantined"
        ? "Unsafe inherited logic is retained only as a labeled, non-production synthetic regression reference."
        : "Deterministic synthetic behavior is implemented with human and zero-write controls.",
    evidenceIds: Object.freeze([...evidenceIds]),
  });
}

export function createM41cExperienceSnapshot(): M41cExperienceSnapshot {
  const council = createSyntheticM41cClinicalGovernanceCouncil();
  const knowledge = createSyntheticM41cClinicalKnowledgeRegistry();
  const registry = exportM41cClinicalKnowledgeRegistry(knowledge);
  const competencyRegistry = createSyntheticM41cCompetencyRegistry();
  const instrumentUserGate = clinicalDirectorGate([
    "M41C-COMP-SYNTHETIC-INSTRUMENT-USER",
  ]);
  const baseInstrumentRegistry = createSyntheticM41cInstrumentProfileRegistry();
  const standin = baseInstrumentRegistry.profiles.find(
    (profile) => profile.profileId === "SYNTH-M41C-INSTRUMENT-STANDIN",
  );
  if (!standin) throw new Error("M41C_STANDIN_PROFILE_NOT_FOUND");
  const instrumentValidation = validateM41cInstrumentProfile(
    standin,
    knowledge.sources,
  );
  const signedInstrumentValidation = createM41cSignedValidationRecord({
    artifactId: standin.governanceArtifactId,
    artifactKind: "instrument",
    artifactVersion: standin.version,
    checks: instrumentValidation.checks.map((check) =>
      Object.freeze({
        checkId: check.checkId,
        label: check.checkId.replace(/_/g, " "),
        passed: check.passed,
        evidenceIds: check.evidenceIds,
        notes: check.notes,
      }),
    ),
    competencyGate: instrumentUserGate,
    sourceIds: standin.sourceIds,
    signatures: signatures(),
  });
  const instrumentRegistry = activateM41cInstrumentProfile(
    baseInstrumentRegistry,
    standin.profileId,
    {
      target: "synthetic_demo",
      validation: instrumentValidation,
      signedValidation: signedInstrumentValidation,
      competencyGate: instrumentUserGate,
    },
  );
  const profileSeparation = verifyM41cTrRAndDfpsProfileSeparation(
    instrumentRegistry,
  );
  const pathwayCatalog = buildM41cPathwayCatalog();
  const signedPathwayValidations = pathwayCatalog.map((pathway) => {
    const gate = clinicalDirectorGate(
      pathway.humanGateTemplate.competencyIdsRequired,
    );
    return signedPathwayValidation(pathway, gate);
  });
  const signedValidationRecords = Object.freeze([
    signedInstrumentValidation,
    ...signedPathwayValidations,
  ]);
  const episode = continuum();
  const bundle = projectM41cFhirAlignedBundle({
    bundleId: "SYNTH-FHIR-BUNDLE-M41C-EXPERIENCE",
    subjectId: SYNTHETIC_SUBJECT_ID,
    episodeId: SYNTHETIC_EPISODE_ID,
    generatedAt: NOW,
    versionId: "synthetic-1",
    consentState: "active",
    sourceRecordIds: Object.freeze(["SYNTH-SOURCE-001"]),
    questionnaireIds: Object.freeze(["SYNTH-QUESTIONNAIRE-001"]),
    assessmentIds: Object.freeze(["SYNTH-ASSESSMENT-001"]),
    carePlanIds: Object.freeze(["SYNTH-CAREPLAN-001"]),
    measureIds: Object.freeze(["SYNTH-MEASURE-001"]),
    planDefinitionIds: Object.freeze(["SYNTH-PLAN-DEFINITION-001"]),
    serviceRequestIds: Object.freeze(["SYNTH-SERVICE-REQUEST-001"]),
    taskIds: Object.freeze(["SYNTH-TASK-001"]),
    detectedIssueIds: Object.freeze(["SYNTH-DETECTED-ISSUE-001"]),
  });
  const bundleValidation = validateM41cFhirAlignedBundle(bundle);
  const localSnapshot = cmbhsSnapshot("SYNTH-CMBHS-LOCAL-EXPERIENCE");
  const externalSnapshot = cmbhsSnapshot("SYNTH-CMBHS-EXTERNAL-EXPERIENCE");
  const reconciliation = reconcileM41cCmbhsSnapshots({
    reconciliationId: "SYNTH-CMBHS-RECONCILIATION-EXPERIENCE",
    localSnapshot,
    externalSnapshot,
    expectedFieldNames: Object.freeze([
      "assessmentStatus",
      "recoveryPlanStatus",
      "reviewSequence",
    ]),
    actorId: "SYNTH-HUMAN-CHART-AUDITOR-001",
    actorRole: "chart-auditor",
    occurredAt: NOW,
    externalServiceAvailable: true,
  });
  const monitoring = evaluateM41cClinicalMonitoring(healthyMonitoringInput());
  const components = Object.freeze([
    component(1, "Clinical Governance Council", [council.councilId]),
    component(2, "Clinical Knowledge Registry", [registry.registryId]),
    component(3, "Program-specific instrument profiles", [profileSeparation.trrProfileId, profileSeparation.dfpsProfileId]),
    component(4, "Unapproved logic quarantine", instrumentRegistry.quarantines.map((entry) => entry.quarantineId), "quarantined"),
    component(5, "Pre-activation instrument validation", [instrumentValidation.validationId]),
    component(6, "Assessment-to-aftercare pathway orchestration", pathwayCatalog.map((entry) => entry.id)),
    component(7, "Texas TRR package", ["SYNTH-TRR-PACKAGE-EXPERIENCE"]),
    component(8, "Youth suicide and crisis pathway", ["SYNTH-SAFETY-RUN-EXPERIENCE"]),
    component(9, "Youth pathway packs", M41C_YOUTH_PATHWAY_PACKS.map((entry) => entry.id)),
    component(10, "Medication and physical-health safety", ["SYNTH-MED-HEALTH-EXPERIENCE"]),
    component(11, "Youth continuum episode", [episode.episodeId]),
    component(12, "Ask AMOS clinical guidance", ["SYNTH-M41C-GUIDANCE-EXPERIENCE"]),
    component(13, "Five-cadence clinical workplan", ["SYNTH-M41C-WORKPLAN-EXPERIENCE"]),
    component(14, "CMBHS and FHIR-aligned mapping", [bundle.bundleId, reconciliation.reconciliationId]),
    component(15, "Clinical access and provenance", [bundle.provenanceResourceId]),
    component(16, "Synthetic pathway scenarios", M41C_SYNTHETIC_SCENARIOS.map((entry) => entry.id)),
    component(17, "Clinical tests and monitoring", [monitoring.monitorId]),
    component(18, "Competency and certification", [competencyRegistry.registryId]),
  ]);

  return Object.freeze({
    milestone: "M4.1C",
    generatedAt: NOW,
    environment: M41C_DEMO_BOUNDARY,
    council,
    registry,
    instrumentRegistry,
    profileSeparation,
    signedValidationRecords,
    competencyRegistry,
    pathwayCatalog,
    youthPathwayPacks: M41C_YOUTH_PATHWAY_PACKS,
    scenarioCatalog: M41C_SYNTHETIC_SCENARIOS,
    continuum: episode,
    mapping: Object.freeze({
      resourceTypes: Object.freeze(bundle.resources.map((entry) => entry.resourceType)),
      bundleValid: bundleValidation.valid,
      cmbhsMode: reconciliation.mode,
      cmbhsStatus: reconciliation.status,
      externalWritesBlocked: true,
      conformanceClaimed: false,
    }),
    monitoring,
    components,
    counts: Object.freeze({
      sourceCount: registry.sourceCount,
      knowledgeEntryCount: registry.entryCount,
      instrumentProfileCount: instrumentRegistry.profiles.length,
      quarantineCount: instrumentRegistry.quarantines.length,
      pathwayCount: pathwayCatalog.length,
      validationRecordCount: signedValidationRecords.length,
      scenarioCount: M41C_SYNTHETIC_SCENARIOS.length,
      cadenceCount: 5,
    }),
    prohibitedActions: M41C_PROHIBITED_ACTIONS,
    productionRows: 0,
    liveWrites: 0,
    evidenceClass: M41C_EVIDENCE_CLASS,
  });
}

function scenarioById(id: string): M41cSyntheticScenario {
  const scenario = M41C_SYNTHETIC_SCENARIOS.find((entry) => entry.id === id);
  if (!scenario) throw new Error("M41C_SYNTHETIC_SCENARIO_NOT_FOUND");
  return scenario;
}

export function runM41cSyntheticScenario(
  input: M41cSyntheticScenarioRunInput,
): M41cSyntheticScenarioRunResponse {
  const scenario = scenarioById(input.scenarioId);
  const snapshot = createM41cExperienceSnapshot();
  const pathway = snapshot.pathwayCatalog[0];
  const validation = snapshot.signedValidationRecords.find(
    (entry) => entry.artifactId === pathway.id,
  );
  if (!validation) throw new Error("M41C_SCENARIO_PATHWAY_VALIDATION_MISSING");
  const gate = clinicalDirectorGate(
    pathway.humanGateTemplate.competencyIdsRequired,
  );
  const auditIds: string[] = [];
  const evidenceIds: string[] = [validation.validationId];
  const summary = scenario.expectedControl;

  const pathwayRun = (options?: {
    missing?: readonly string[];
    disposition?: "approved" | "modified";
  }) =>
    runM41cPathway({
      runId: `SYNTH-M41C-RUN-${scenario.kind.toUpperCase().replace(/_/g, "-")}`,
      correlationId: `SYNTH-M41C-CORRELATION-${scenario.kind.toUpperCase().replace(/_/g, "-")}`,
      subjectId: SYNTHETIC_SUBJECT_ID,
      episodeId: SYNTHETIC_EPISODE_ID,
      pathway,
      assessment: assessment(
        pathway.instrumentProfileIds[0],
        options?.missing ?? [],
      ),
      actorId: "SYNTH-HUMAN-QMHP-001",
      actorRole: "qmhp-cs",
      occurredAt: NOW,
      signedValidation: validation,
      competencyGate: gate,
      humanDecision: options?.disposition
        ? approvedDecision(
            pathway.humanGateTemplate.competencyIdsRequired,
            options.disposition,
          )
        : undefined,
    });

  switch (scenario.kind) {
    case "routine": {
      const result = pathwayRun();
      if (result.status !== "awaiting_human_review")
        throw new Error("M41C_SCENARIO_ROUTINE_CONTROL_FAILED");
      auditIds.push(...result.auditEvents.map((entry) => entry.id));
      evidenceIds.push(result.runId);
      break;
    }
    case "incomplete": {
      const result = pathwayRun({ missing: ["synthetic guardian context"] });
      if (result.status !== "blocked_incomplete" || result.recommendation)
        throw new Error("M41C_SCENARIO_INCOMPLETE_CONTROL_FAILED");
      auditIds.push(...result.auditEvents.map((entry) => entry.id));
      evidenceIds.push(result.runId);
      break;
    }
    case "positive_safety": {
      const result = evaluateM41cSuicideCrisisPathway({
        pathwayRunId: "SYNTH-SAFETY-RUN-POSITIVE",
        subjectId: SYNTHETIC_SUBJECT_ID,
        episodeId: SYNTHETIC_EPISODE_ID,
        safetyState: "positive",
        screeningProfileId: M41C_SUICIDE_SCREEN_METADATA_PROFILE,
        screeningCompletedAt: NOW,
        bssaCompletedBy: null,
        bssaCompletedByRole: null,
        licensedDispositionBy: null,
        licensedDispositionByRole: null,
        safetyPlanId: null,
        guardianContactStatus: "missing",
        crisisHandoffId: null,
        followUpDueAt: null,
        occurredAt: NOW,
      });
      if (result.disposition !== "immediate_human_escalation")
        throw new Error("M41C_SCENARIO_POSITIVE_SAFETY_CONTROL_FAILED");
      auditIds.push(...result.auditEvents.map((entry) => entry.id));
      evidenceIds.push(result.pathwayRunId);
      break;
    }
    case "escalating": {
      const result = evaluateM41cSuicideCrisisPathway({
        pathwayRunId: "SYNTH-SAFETY-RUN-ESCALATING",
        subjectId: SYNTHETIC_SUBJECT_ID,
        episodeId: SYNTHETIC_EPISODE_ID,
        safetyState: "escalating",
        screeningProfileId: M41C_SUICIDE_SCREEN_METADATA_PROFILE,
        screeningCompletedAt: NOW,
        bssaCompletedBy: "SYNTH-HUMAN-QMHP-001",
        bssaCompletedByRole: "qmhp-cs",
        licensedDispositionBy: "SYNTH-HUMAN-THERAPIST-001",
        licensedDispositionByRole: "therapist",
        safetyPlanId: "SYNTH-SAFETY-PLAN-001",
        guardianContactStatus: "documented",
        crisisHandoffId: "SYNTH-CRISIS-HANDOFF-001",
        followUpDueAt: "2026-11-16T08:00:00.000Z",
        humanDecision: approvedDecision([
          "M41C-COMP-YOUTH-SUICIDE-SAFETY",
        ]),
        occurredAt: NOW,
      });
      if (result.disposition !== "crisis_handoff_active")
        throw new Error("M41C_SCENARIO_ESCALATING_CONTROL_FAILED");
      auditIds.push(...result.auditEvents.map((entry) => entry.id));
      evidenceIds.push(result.pathwayRunId);
      break;
    }
    case "conflict": {
      const local = cmbhsSnapshot("SYNTH-CMBHS-LOCAL-CONFLICT");
      const result = reconcileM41cCmbhsSnapshots({
        reconciliationId: "SYNTH-CMBHS-RECONCILIATION-CONFLICT",
        localSnapshot: local,
        externalSnapshot: Object.freeze({
          ...cmbhsSnapshot("SYNTH-CMBHS-EXTERNAL-CONFLICT"),
          fields: Object.freeze({ ...local.fields, reviewSequence: 3 }),
        }),
        expectedFieldNames: Object.freeze(["reviewSequence"]),
        actorId: "SYNTH-HUMAN-CHART-AUDITOR-001",
        actorRole: "chart-auditor",
        occurredAt: NOW,
        externalServiceAvailable: true,
      });
      if (result.status !== "differences_pending")
        throw new Error("M41C_SCENARIO_CONFLICT_CONTROL_FAILED");
      auditIds.push(...result.auditEvents.map((entry) => entry.id));
      evidenceIds.push(result.reconciliationId);
      break;
    }
    case "reassessment": {
      const pack = M41C_YOUTH_PATHWAY_PACKS[0];
      const packValidation = snapshot.signedValidationRecords.find(
        (entry) => entry.artifactId === pack.id,
      );
      if (!packValidation)
        throw new Error("M41C_SCENARIO_PACK_VALIDATION_MISSING");
      const result = evaluateM41cYouthPathwayPack({
        domain: pack.domain,
        evidenceComplete: true,
        observedSignals: Object.freeze(["SYNTH-MEASURE-NOT-IMPROVING"]),
        activeComorbidityDomains: Object.freeze([]),
        signedValidation: packValidation,
        competencyGate: clinicalDirectorGate(["M41C-COMP-PATHWAY"]),
      });
      if (result.status !== "nonresponse_review")
        throw new Error("M41C_SCENARIO_REASSESSMENT_CONTROL_FAILED");
      evidenceIds.push(result.packId);
      break;
    }
    case "loc_review": {
      const trrValidation = snapshot.signedValidationRecords.find(
        (entry) => entry.artifactId === "M41C-PATHWAY-TRR-DEMO",
      );
      if (!trrValidation)
        throw new Error("M41C_SCENARIO_TRR_VALIDATION_MISSING");
      const result = buildM41cTrrPackage({
        packageId: "SYNTH-TRR-PACKAGE-LOC-REVIEW",
        subjectId: SYNTHETIC_SUBJECT_ID,
        episodeId: SYNTHETIC_EPISODE_ID,
        assessment: assessment(M41C_TRR_SYNTHETIC_PROFILE_ID),
        uniformAssessmentComplete: true,
        recoveryPlanId: "SYNTH-RECOVERY-PLAN-001",
        authorizationReviewDueAt: "2026-11-22T08:00:00.000Z",
        serviceHistoryIds: Object.freeze(["SYNTH-SERVICE-001"]),
        outcomeRecordIds: Object.freeze(["SYNTH-OUTCOME-001"]),
        signedValidation: trrValidation,
        competencyGate: clinicalDirectorGate([
          "M41C-COMP-TRR-REVIEW",
          "M41C-COMP-LOC-HUMAN-REVIEW",
        ]),
        occurredAt: NOW,
      });
      if (result.levelOfCareReview !== "qualified_human_review_required")
        throw new Error("M41C_SCENARIO_LOC_REVIEW_CONTROL_FAILED");
      evidenceIds.push(result.packageId);
      break;
    }
    case "transition": {
      const result = continuum();
      if (
        result.stagesRepresented.length !== M41C_CONTINUUM_STAGES.length ||
        result.transitionGate.status !== "approved"
      )
        throw new Error("M41C_SCENARIO_TRANSITION_CONTROL_FAILED");
      evidenceIds.push(result.episodeId);
      break;
    }
    case "outage": {
      const result = reconcileM41cCmbhsSnapshots({
        reconciliationId: "SYNTH-CMBHS-RECONCILIATION-OUTAGE",
        localSnapshot: cmbhsSnapshot("SYNTH-CMBHS-LOCAL-OUTAGE"),
        externalSnapshot: null,
        expectedFieldNames: Object.freeze(["assessmentStatus"]),
        actorId: "SYNTH-HUMAN-CHART-AUDITOR-001",
        actorRole: "chart-auditor",
        occurredAt: NOW,
        externalServiceAvailable: false,
      });
      if (result.status !== "outage" || result.liveWrites !== 0)
        throw new Error("M41C_SCENARIO_OUTAGE_CONTROL_FAILED");
      auditIds.push(...result.auditEvents.map((entry) => entry.id));
      evidenceIds.push(result.reconciliationId);
      break;
    }
    case "override": {
      const result = pathwayRun({ disposition: "modified" });
      if (
        result.status !== "modified_for_demo" ||
        !result.auditEvents.some((entry) => entry.eventType === "override_recorded")
      )
        throw new Error("M41C_SCENARIO_OVERRIDE_CONTROL_FAILED");
      auditIds.push(...result.auditEvents.map((entry) => entry.id));
      evidenceIds.push(result.runId);
      break;
    }
    case "recovery": {
      const result = reconcileM41cCmbhsSnapshots({
        reconciliationId: "SYNTH-CMBHS-RECONCILIATION-RECOVERY",
        localSnapshot: cmbhsSnapshot("SYNTH-CMBHS-LOCAL-RECOVERY"),
        externalSnapshot: cmbhsSnapshot("SYNTH-CMBHS-EXTERNAL-RECOVERY"),
        expectedFieldNames: Object.freeze(["assessmentStatus"]),
        actorId: "SYNTH-HUMAN-CHART-AUDITOR-001",
        actorRole: "chart-auditor",
        occurredAt: NOW,
        externalServiceAvailable: true,
      });
      if (result.status !== "reconciled" || result.liveWrites !== 0)
        throw new Error("M41C_SCENARIO_RECOVERY_CONTROL_FAILED");
      auditIds.push(...result.auditEvents.map((entry) => entry.id));
      evidenceIds.push(result.reconciliationId);
      break;
    }
  }

  const runId = governanceId(
    "SYNTH-M41C-SCENARIO-RUN",
    scenario.id,
    scenario.kind,
  );
  return Object.freeze({
    runId,
    scenarioId: scenario.id,
    scenarioKind: scenario.kind,
    status: "passed",
    summary,
    expectedControl: scenario.expectedControl,
    humanGateRequired: true,
    sourceIds: Object.freeze(["M41C-SRC-CONTROLLING-DOCTRINE"]),
    evidenceIds: Object.freeze([...new Set(evidenceIds)]),
    auditEventIds: Object.freeze([...new Set(auditIds)]),
    prohibitedActions: M41C_PROHIBITED_ACTIONS,
    productionRows: 0,
    liveWrites: 0,
    evidenceClass: M41C_EVIDENCE_CLASS,
  });
}
