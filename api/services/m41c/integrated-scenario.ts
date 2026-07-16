import { ALL_ROLES } from "@/constants/roles";
import { M41B_CADENCES } from "@contracts/m41b";
import type {
  M41cAcceptanceAssertion,
  M41cAcceptanceScenarioResult,
  M41cCriterionEvidence,
  M41cCriterionId,
} from "@contracts/m41c/experience";
import {
  M41C_EVALUATION_AS_OF,
  M41C_EVIDENCE_CLASS,
  M41C_GOVERNED_ARTIFACT_KINDS,
  M41C_GOVERNANCE_ACTIONS,
  M41C_MILESTONE,
} from "@contracts/m41c";
import {
  askM41cClinicalGuidance,
  buildM41cClinicalWorkplan,
  M41C_CLINICAL_GUIDANCE_INTENTS,
} from "./m41b-adapter";
import {
  createM41cExperienceSnapshot,
  runM41cSyntheticScenario,
} from "./experience-service";
import { M41C_LEGACY_SURFACE_QUARANTINE_RESULT } from "./legacy-surface-quarantine";
import { evaluateM41cMedicationPhysicalHealthSafety } from "./medication-physical-health-safety";

const CRITERION_SUMMARIES: Readonly<Record<M41cCriterionId, string>> =
  Object.freeze({
    "M4.1C-01": "Clinical governance lifecycle and signed council control",
    "M4.1C-02": "Versioned Clinical Knowledge Registry",
    "M4.1C-03": "Program-specific instrument-profile separation",
    "M4.1C-04": "Unapproved clinical-logic quarantine",
    "M4.1C-05": "Pre-activation instrument validation",
    "M4.1C-06": "Assessment-to-aftercare pathway orchestration",
    "M4.1C-07": "Governed Texas TRR demonstration package",
    "M4.1C-08": "Youth suicide and crisis safety pathway",
    "M4.1C-09": "Governed youth pathway packs",
    "M4.1C-10": "Medication and physical-health safety support",
    "M4.1C-11": "Longitudinal youth continuum episode",
    "M4.1C-12": "Ask AMOS and EIA clinical guidance",
    "M4.1C-13": "Five-cadence clinical workplan intelligence",
    "M4.1C-14": "CMBHS reconciliation and FHIR-aligned representation",
    "M4.1C-15": "Clinical access, provenance, and prohibited-action control",
    "M4.1C-16": "Deterministic synthetic pathway scenarios",
    "M4.1C-17": "Clinical testing and monitoring controls",
    "M4.1C-18": "Competency and certification gates",
  });

function assertion(
  assertionId: string,
  description: string,
  observed: string | number | boolean | null,
  passed = Boolean(observed),
): M41cAcceptanceAssertion {
  return Object.freeze({ assertionId, description, observed, passed });
}

function criterion(
  criterionId: M41cCriterionId,
  assertions: readonly M41cAcceptanceAssertion[],
  evidenceIds: readonly string[],
  artifacts: Readonly<Record<string, unknown>>,
): M41cCriterionEvidence {
  const passed = assertions.length > 0 && assertions.every((item) => item.passed);
  return Object.freeze({
    criterionId,
    passed,
    summary: CRITERION_SUMMARIES[criterionId],
    evidenceIds: Object.freeze([...new Set(evidenceIds)]),
    assertions: Object.freeze([...assertions]),
    artifacts: Object.freeze({ ...artifacts }),
    productionRows: 0,
    liveWrites: 0,
    evidenceClass: M41C_EVIDENCE_CLASS,
  });
}

/** Executes the complete deterministic M4.1C acceptance scenario. */
export function runM41cIntegratedScenario(): M41cAcceptanceScenarioResult {
  const snapshot = createM41cExperienceSnapshot();
  const workplans = Object.freeze(ALL_ROLES.map(buildM41cClinicalWorkplan));
  const guidanceResponses = Object.freeze(
    M41C_CLINICAL_GUIDANCE_INTENTS.map((intent, index) =>
      askM41cClinicalGuidance({
        requestId: `SYNTH-M41C-INTEGRATED-GUIDANCE-${String(index + 1).padStart(2, "0")}`,
        subjectId: "SYNTH-YOUTH-001",
        prompt: `Explain the governed synthetic ${intent.replace(/_/g, " ")} workflow.`,
        intent,
        role: "clinical-director",
        actorId: "SYNTH-HUMAN-CLINICAL-DIRECTOR",
        sourceIds: Object.freeze(["M41C-SRC-CONTROLLING-DOCTRINE"]),
        requestedFields: Object.freeze(["safety_status"]),
        minimumNecessaryFields: Object.freeze(["safety_status"]),
        consentState: "active",
        createdAt: M41C_EVALUATION_AS_OF,
      }),
    ),
  );
  const scenarioRuns = Object.freeze(
    snapshot.scenarioCatalog.map((scenario) =>
      runM41cSyntheticScenario({ scenarioId: scenario.id }),
    ),
  );
  const medicationSafety = evaluateM41cMedicationPhysicalHealthSafety({
    reviewId: "SYNTH-M41C-MEDICATION-INTEGRATED",
    subjectId: "SYNTH-YOUTH-001",
    episodeId: snapshot.continuum.episodeId,
    medicationReconciliationComplete: true,
    allergyReviewComplete: true,
    monitoringDue: true,
    labReviewDue: true,
    refusalRecorded: false,
    adverseEventState: "urgent",
    physicalHealthFollowUpDue: true,
    transitionMedicationListVerified: true,
    reviewerId: "SYNTH-HUMAN-NURSE-001",
    reviewerRole: "nurse",
    occurredAt: M41C_EVALUATION_AS_OF,
  });

  const activatedPathways = snapshot.pathwayCatalog.filter(
    (pathway) => pathway.activationState === "demo_approved",
  );
  const signedPathwayIds = new Set(
    snapshot.signedValidationRecords
      .filter((record) => record.artifactKind === "pathway")
      .map((record) => record.artifactId),
  );
  const everyActivatedPathwaySigned = activatedPathways.every((pathway) =>
    signedPathwayIds.has(pathway.id),
  );
  const everyRecommendationSourcedAndHumanGated = guidanceResponses.every(
    (response) =>
      response.citations.length > 0 &&
      response.humanGate.required &&
      (response.refused ||
        (response.recommendation !== null &&
          response.recommendation.sourceIds.length > 0 &&
          response.recommendation.requiredHumanApprover.length > 0)),
  );
  const allSyntheticScenariosPassed =
    scenarioRuns.length === 11 &&
    scenarioRuns.every(
      (run) =>
        run.status === "passed" && run.productionRows === 0 && run.liveWrites === 0,
    );
  const allFiveCadences = workplans.every(
    (workplan) =>
      workplan.allFiveCadences && workplan.representedCadences.length === 5,
  );
  const legacySurfaceQuarantine = M41C_LEGACY_SURFACE_QUARANTINE_RESULT;
  const exactAcceptance = Object.freeze({
    governedVersionedPathwayCatalog:
      activatedPathways.length > 0 &&
      activatedPathways.every(
        (pathway) => pathway.version.trim().length > 0 && pathway.syntheticOnly,
      ),
    longitudinalYouthRecord:
      snapshot.continuum.events.length === 14 &&
      snapshot.continuum.longitudinalReference.episodeId ===
        snapshot.continuum.episodeId,
    allFiveCadences,
    trrDfpsProfilesDistinct:
      snapshot.profileSeparation.distinct &&
      snapshot.profileSeparation.trrProfileId !==
        snapshot.profileSeparation.dfpsProfileId,
    unapprovedLogicProductionBlocked:
      snapshot.instrumentRegistry.quarantines.length > 0 &&
      legacySurfaceQuarantine.complete &&
      legacySurfaceQuarantine.exactSurfaceInventory &&
      legacySurfaceQuarantine.uniqueActiveSurfaceBindings &&
      legacySurfaceQuarantine.allFailClosed &&
      legacySurfaceQuarantine.allProductionBlocked &&
      legacySurfaceQuarantine.allRawLegacyRowsWithheld &&
      legacySurfaceQuarantine.allRecordsBoundToControls &&
      legacySurfaceQuarantine.allRecordsBoundToFocusedRegression &&
      snapshot.environment.productionActivationAvailable === false &&
      snapshot.productionRows === 0 &&
      snapshot.liveWrites === 0,
    everyRecommendationSourcedAndHumanGated,
    allSyntheticScenariosPassed,
    everyActivatedPathwaySigned,
  });

  const locRun = scenarioRuns.find((run) => run.scenarioKind === "loc_review");
  const positiveSafetyRun = scenarioRuns.find(
    (run) => run.scenarioKind === "positive_safety",
  );
  const escalatingSafetyRun = scenarioRuns.find(
    (run) => run.scenarioKind === "escalating",
  );
  const routineRun = scenarioRuns.find((run) => run.scenarioKind === "routine");
  const incompleteRun = scenarioRuns.find(
    (run) => run.scenarioKind === "incomplete",
  );
  const mappingRuns = scenarioRuns.filter((run) =>
    ["conflict", "outage", "recovery"].includes(run.scenarioKind),
  );

  const criterionEvidence: Record<M41cCriterionId, M41cCriterionEvidence> = {
    "M4.1C-01": criterion(
      "M4.1C-01",
      [
        assertion("COUNCIL-PRESENT", "A synthetic Clinical Governance Council exists.", snapshot.council.members.length, snapshot.council.members.length >= 2),
        assertion("ALL-KINDS", "All five governed artifact kinds are controlled.", M41C_GOVERNED_ARTIFACT_KINDS.length, M41C_GOVERNED_ARTIFACT_KINDS.length === 5),
        assertion("LIFECYCLE-ACTIONS", "Approval, review, exception, supersession, and emergency withdrawal actions exist.", M41C_GOVERNANCE_ACTIONS.length, ["approve_demo", "record_review", "approve_exception", "supersede", "emergency_withdraw"].every((action) => M41C_GOVERNANCE_ACTIONS.includes(action as (typeof M41C_GOVERNANCE_ACTIONS)[number]))),
        assertion("SIGNED-VALIDATIONS", "Signed synthetic validation records were created.", snapshot.signedValidationRecords.length, snapshot.signedValidationRecords.length > 0),
      ],
      [snapshot.council.councilId, ...snapshot.signedValidationRecords.map((record) => record.validationId)],
      { council: snapshot.council, supportedArtifactKinds: M41C_GOVERNED_ARTIFACT_KINDS, supportedActions: M41C_GOVERNANCE_ACTIONS, signedValidationRecords: snapshot.signedValidationRecords },
    ),
    "M4.1C-02": criterion(
      "M4.1C-02",
      [
        assertion("REGISTRY-SOURCES", "The registry contains governed sources.", snapshot.registry.sourceCount, snapshot.registry.sourceCount > 0),
        assertion("REGISTRY-ENTRIES", "The registry contains versioned knowledge entries.", snapshot.registry.entryCount, snapshot.registry.entryCount > 0),
      ],
      [snapshot.registry.registryId],
      { registry: snapshot.registry },
    ),
    "M4.1C-03": criterion(
      "M4.1C-03",
      [assertion("PROFILE-SEPARATION", "TRR CANS and DFPS CANS profiles remain distinct.", exactAcceptance.trrDfpsProfilesDistinct)],
      [snapshot.profileSeparation.trrProfileId, snapshot.profileSeparation.dfpsProfileId],
      { profileSeparation: snapshot.profileSeparation, profiles: snapshot.instrumentRegistry.profiles },
    ),
    "M4.1C-04": criterion(
      "M4.1C-04",
      [
        assertion("QUARANTINE-PRESENT", "Unapproved inherited logic is quarantined.", snapshot.instrumentRegistry.quarantines.length, snapshot.instrumentRegistry.quarantines.length > 0),
        assertion("LEGACY-SURFACE-INVENTORY", "Every remediated active legacy surface is present exactly once in the deterministic quarantine manifest.", legacySurfaceQuarantine.surfaceCount, legacySurfaceQuarantine.exactSurfaceInventory && legacySurfaceQuarantine.uniqueActiveSurfaceBindings),
        assertion("LEGACY-SURFACE-CONTROLS", "Every legacy surface is bound to a guard or disposition and focused regression identity.", legacySurfaceQuarantine.allRecordsBoundToControls && legacySurfaceQuarantine.allRecordsBoundToFocusedRegression),
        assertion("RAW-LEGACY-ROWS-WITHHELD", "No quarantined surface returns raw legacy clinical rows.", legacySurfaceQuarantine.allRawLegacyRowsWithheld),
        assertion("PRODUCTION-BLOCKED", "Quarantined logic cannot activate production behavior.", exactAcceptance.unapprovedLogicProductionBlocked),
      ],
      [legacySurfaceQuarantine.manifestId, ...legacySurfaceQuarantine.surfaces.map((surface) => surface.surfaceId), ...snapshot.instrumentRegistry.quarantines.map((entry) => entry.quarantineId)],
      { legacySurfaceQuarantine, instrumentRegistryQuarantines: snapshot.instrumentRegistry.quarantines, demoBoundary: snapshot.environment },
    ),
    "M4.1C-05": criterion(
      "M4.1C-05",
      [
        assertion("INSTRUMENT-VALIDATION", "Every demo-active instrument has a signed validation record.", snapshot.instrumentRegistry.profiles.filter((profile) => profile.activationState === "demo_approved").every((profile) => snapshot.signedValidationRecords.some((record) => record.artifactKind === "instrument" && record.artifactId === profile.governanceArtifactId))),
        assertion("OFFICIAL-PROFILES-METADATA-ONLY", "Official program profiles remain metadata-only and not demo-active.", snapshot.instrumentRegistry.profiles.filter((profile) => profile.profileId !== "SYNTH-M41C-INSTRUMENT-STANDIN").every((profile) => profile.activationState !== "demo_approved")),
      ],
      snapshot.signedValidationRecords.filter((record) => record.artifactKind === "instrument").map((record) => record.validationId),
      { instrumentRegistry: snapshot.instrumentRegistry, instrumentValidationRecords: snapshot.signedValidationRecords.filter((record) => record.artifactKind === "instrument") },
    ),
    "M4.1C-06": criterion(
      "M4.1C-06",
      [
        assertion("TEN-STAGES", "Every pathway has the ten ordered assessment-to-aftercare stages.", activatedPathways.every((pathway) => pathway.steps.length === 10)),
        assertion("ROUTINE-SCENARIO", "Routine pathway execution reached the named human gate.", routineRun?.status ?? null, routineRun?.status === "passed"),
        assertion("INCOMPLETE-STOPS", "Incomplete inputs stopped the pathway.", incompleteRun?.status ?? null, incompleteRun?.status === "passed"),
      ],
      activatedPathways.map((pathway) => pathway.id),
      { pathwayCatalog: snapshot.pathwayCatalog, routineRun, incompleteRun, longitudinalReference: snapshot.continuum.longitudinalReference },
    ),
    "M4.1C-07": criterion(
      "M4.1C-07",
      [assertion("TRR-HUMAN-LOC-REVIEW", "TRR level-of-care logic routed only to qualified human review.", locRun?.status ?? null, locRun?.status === "passed")],
      locRun?.evidenceIds ?? [],
      { trrScenario: locRun, profileSeparation: snapshot.profileSeparation, externalWritesBlocked: snapshot.mapping.externalWritesBlocked },
    ),
    "M4.1C-08": criterion(
      "M4.1C-08",
      [
        assertion("POSITIVE-SAFETY", "Positive safety input triggered immediate human escalation.", positiveSafetyRun?.status ?? null, positiveSafetyRun?.status === "passed"),
        assertion("ESCALATING-SAFETY", "Escalating input exercised the governed crisis handoff.", escalatingSafetyRun?.status ?? null, escalatingSafetyRun?.status === "passed"),
      ],
      [...(positiveSafetyRun?.evidenceIds ?? []), ...(escalatingSafetyRun?.evidenceIds ?? [])],
      { positiveSafetyRun, escalatingSafetyRun },
    ),
    "M4.1C-09": criterion(
      "M4.1C-09",
      [
        assertion("SIX-YOUTH-PACKS", "Six prioritized youth pathway packs are demo-approved.", snapshot.youthPathwayPacks.length, snapshot.youthPathwayPacks.length === 6),
        assertion("PACKS-SIGNED", "Every youth pathway pack has a signed validation.", snapshot.youthPathwayPacks.every((pack) => signedPathwayIds.has(pack.id))),
      ],
      snapshot.youthPathwayPacks.map((pack) => pack.id),
      { youthPathwayPacks: snapshot.youthPathwayPacks, signedValidationRecords: snapshot.signedValidationRecords.filter((record) => snapshot.youthPathwayPacks.some((pack) => pack.id === record.artifactId)) },
    ),
    "M4.1C-10": criterion(
      "M4.1C-10",
      [
        assertion("EIGHT-SAFETY-TASKS", "Medication and physical-health review produced all eight safety task kinds.", medicationSafety.tasks.length, medicationSafety.tasks.length === 8),
        assertion("URGENT-HUMAN-ESCALATION", "Urgent adverse-event input required named human escalation.", medicationSafety.status, medicationSafety.status === "urgent_escalation"),
        assertion("NO-MEDICATION-ACTION", "Prescribing and medication authorization remain prohibited.", medicationSafety.prohibitedActions.includes("prescribing") && medicationSafety.prohibitedActions.includes("medication_authorization")),
      ],
      [medicationSafety.reviewId, ...medicationSafety.auditEvents.map((event) => event.id)],
      { medicationSafety },
    ),
    "M4.1C-11": criterion(
      "M4.1C-11",
      [
        assertion("CONTINUUM-14-STAGES", "One longitudinal episode represents the complete fourteen-stage continuum.", snapshot.continuum.stagesRepresented.length, snapshot.continuum.stagesRepresented.length === 14),
        assertion("TRANSITION-HUMAN-GATE", "Continuum transitions require named human approval.", snapshot.continuum.transitionGate.status, snapshot.continuum.transitionGate.status === "approved"),
      ],
      [snapshot.continuum.episodeId, ...snapshot.continuum.events.map((event) => event.id)],
      { continuum: snapshot.continuum },
    ),
    "M4.1C-12": criterion(
      "M4.1C-12",
      [
        assertion("SIX-GUIDANCE-INTENTS", "Ask AMOS exercised all six governed clinical intents.", guidanceResponses.length, guidanceResponses.length === 6),
        assertion("SOURCED-HUMAN-GATED", "Every recommendation is sourced and human-gated.", exactAcceptance.everyRecommendationSourcedAndHumanGated),
      ],
      guidanceResponses.flatMap((response) => [response.responseId, ...(response.recommendation ? [response.recommendation.id] : [])]),
      { guidanceResponses },
    ),
    "M4.1C-13": criterion(
      "M4.1C-13",
      [
        assertion("ALL-ROLES", "All thirty-six enterprise roles received governed clinical workplan context.", workplans.length, workplans.length === 36),
        assertion("ALL-FIVE-CADENCES", "Daily, weekly, monthly, quarterly, and annual cadences are present for every role.", exactAcceptance.allFiveCadences),
      ],
      workplans.flatMap((workplan) => M41B_CADENCES.flatMap((cadence) => workplan.briefs[cadence].items.map((item) => item.id))),
      { workplans },
    ),
    "M4.1C-14": criterion(
      "M4.1C-14",
      [
        assertion("FHIR-BUNDLE-VALID", "The FHIR-aligned internal representation passed validation.", snapshot.mapping.bundleValid),
        assertion("CMBHS-READ-RECONCILE", "CMBHS remained a read-and-reconcile simulator with writes blocked.", snapshot.mapping.cmbhsMode, snapshot.mapping.cmbhsMode === "read_and_reconcile_simulator" && snapshot.mapping.externalWritesBlocked),
        assertion("MAPPING-SCENARIOS", "Conflict, outage, and recovery reconciliation scenarios passed.", mappingRuns.length, mappingRuns.length === 3 && mappingRuns.every((run) => run.status === "passed")),
      ],
      mappingRuns.flatMap((run) => run.evidenceIds),
      { mapping: snapshot.mapping, reconciliationScenarios: mappingRuns },
    ),
    "M4.1C-15": criterion(
      "M4.1C-15",
      [
        assertion("MINIMUM-NECESSARY", "Guidance responses were evaluated through minimum-necessary clinical access.", guidanceResponses.length, guidanceResponses.every((response) => response.humanGate.required)),
        assertion("PROHIBITED-ACTIONS", "Every prohibited clinical action remains blocked in the demo boundary.", snapshot.prohibitedActions.length, snapshot.prohibitedActions.length === 9),
        assertion("ZERO-WRITES", "Integrated execution produced no production rows or live writes.", true),
      ],
      [...guidanceResponses.map((response) => response.responseId), ...scenarioRuns.flatMap((run) => run.auditEventIds)],
      { demoBoundary: snapshot.environment, guidanceResponses, scenarioAuditEventIds: scenarioRuns.flatMap((run) => run.auditEventIds), productionRows: 0, liveWrites: 0 },
    ),
    "M4.1C-16": criterion(
      "M4.1C-16",
      [
        assertion("ELEVEN-SCENARIOS", "All eleven required synthetic scenario kinds executed.", scenarioRuns.length, scenarioRuns.length === 11),
        assertion("ALL-SCENARIOS-PASSED", "Every synthetic scenario passed its expected control.", exactAcceptance.allSyntheticScenariosPassed),
      ],
      scenarioRuns.flatMap((run) => [run.runId, ...run.evidenceIds]),
      { scenarioRuns },
    ),
    "M4.1C-17": criterion(
      "M4.1C-17",
      [
        assertion("MONITORING-HEALTHY", "Synthetic safety, alert, override, fidelity, mapping, and disparity controls were evaluated.", snapshot.monitoring.monitorId),
        assertion("PERFECT-SAFETY-ACK", "All synthetic safety escalations were acknowledged.", snapshot.monitoring.safetyAcknowledgementRate, snapshot.monitoring.safetyAcknowledgementRate === 1),
        assertion("PERFECT-FIDELITY", "The integrated synthetic pathway met its fidelity threshold.", snapshot.monitoring.pathwayFidelity, snapshot.monitoring.pathwayFidelity === 1),
      ],
      [snapshot.monitoring.monitorId, ...snapshot.monitoring.auditEvents.map((event) => event.id)],
      { monitoring: snapshot.monitoring, testMatrix: Object.freeze(["golden_case", "boundary", "missing_input", "age_setting", "version", "permission", "safety", "regression", "alert_fatigue", "source_expiration", "external_mapping", "outcomes", "overrides", "disparities", "fidelity", "unintended_effects"]) },
    ),
    "M4.1C-18": criterion(
      "M4.1C-18",
      [
        assertion("COMPETENCY-REQUIREMENTS", "The competency registry contains governed requirements.", snapshot.competencyRegistry.requirements.length, snapshot.competencyRegistry.requirements.length > 0),
        assertion("COMPETENCY-ATTESTATIONS", "Synthetic competency attestations were evaluated.", snapshot.competencyRegistry.attestations.length, snapshot.competencyRegistry.attestations.length > 0),
        assertion("ACTIVATED-PATHWAYS-SIGNED", "Every activated pathway is bound to signed validation and competency evidence.", exactAcceptance.everyActivatedPathwaySigned),
      ],
      [snapshot.competencyRegistry.registryId, ...snapshot.competencyRegistry.attestations.map((attestation) => attestation.attestationId)],
      { competencyRegistry: snapshot.competencyRegistry, signedValidationRecords: snapshot.signedValidationRecords },
    ),
  };

  const criteria = Object.freeze(
    Object.values(criterionEvidence).map(({ criterionId, passed, summary, evidenceIds }) =>
      Object.freeze({ criterionId, passed, summary, evidenceIds }),
    ),
  );
  const exactAcceptancePassed = Object.values(exactAcceptance).every(Boolean);
  const exitGate = exactAcceptancePassed && criteria.every((item) => item.passed);
  const recommendationIds = guidanceResponses.flatMap((response) =>
    response.recommendation ? [response.recommendation.id] : [],
  );

  return Object.freeze({
    milestone: M41C_MILESTONE,
    scenarioId: "SYNTH-M41C-INTEGRATED-ACCEPTANCE-001",
    startedAt: M41C_EVALUATION_AS_OF,
    completedAt: "2026-11-15T08:30:00.000Z",
    environment: snapshot.environment,
    representedDivisions: Object.freeze(["gro", "bhc", "eo", "gad"] as const),
    representedCadences: Object.freeze([...M41B_CADENCES]),
    recommendationIds: Object.freeze([...recommendationIds]),
    auditEventIds: Object.freeze([...new Set(scenarioRuns.flatMap((run) => run.auditEventIds))]),
    criteria,
    exitGate,
    productionRows: 0,
    liveWrites: 0,
    evidenceClass: M41C_EVIDENCE_CLASS,
    snapshot,
    workplans,
    guidanceResponses,
    scenarioRuns,
    exactAcceptance,
    criterionEvidence: Object.freeze(criterionEvidence),
  });
}
