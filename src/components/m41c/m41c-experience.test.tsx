import {
  M41C_DEMO_BOUNDARY,
  M41C_EVIDENCE_CLASS,
  M41C_PROHIBITED_ACTIONS,
  type M41cExperienceSnapshot,
  type M41cPathwayDefinition,
  type M41cSignedValidationRecord,
  type M41cSyntheticScenarioRunResponse,
} from "@contracts/m41c";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createSyntheticM41cClinicalGovernanceCouncil } from "../../../api/services/m41c/clinical-governance";
import {
  createSyntheticM41cClinicalKnowledgeRegistry,
  exportM41cClinicalKnowledgeRegistry,
} from "../../../api/services/m41c/clinical-knowledge-registry";
import { evaluateM41cClinicalMonitoring } from "../../../api/services/m41c/clinical-monitoring";
import { createSyntheticM41cCompetencyRegistry } from "../../../api/services/m41c/competency-registry";
import { buildM41cContinuumEpisode } from "../../../api/services/m41c/continuum-episode";
import {
  createSyntheticM41cInstrumentProfileRegistry,
  verifyM41cTrRAndDfpsProfileSeparation,
} from "../../../api/services/m41c/instrument-profile-registry";
import {
  askM41cClinicalGuidance,
  buildM41cClinicalWorkplan,
} from "../../../api/services/m41c/m41b-adapter";
import { M41C_SYNTHETIC_SCENARIOS } from "../../../api/services/m41c/pathway-orchestrator";
import { M41C_YOUTH_PATHWAY_PACKS } from "../../../api/services/m41c/youth-pathway-packs";
import { M41cClinicalIntelligenceView } from "./m41c-clinical-intelligence-view";
import { M41cGovernanceProfilesPanel } from "./m41c-governance-profiles-panel";
import { M41cPathwaySafetyPanel } from "./m41c-pathway-safety-panel";
import { M41cScenarioLab } from "./m41c-scenario-lab";
import { M41cSourceRegistryPanel } from "./m41c-source-registry-panel";
import { M41cWorkplanAssistantPanel } from "./m41c-workplan-assistant-panel";

const instrumentRegistry = createSyntheticM41cInstrumentProfileRegistry();
const profileSeparation =
  verifyM41cTrRAndDfpsProfileSeparation(instrumentRegistry);
const knowledgeRegistry = exportM41cClinicalKnowledgeRegistry(
  createSyntheticM41cClinicalKnowledgeRegistry(),
);
const workplan = buildM41cClinicalWorkplan("clinical-director");
const guidance = askM41cClinicalGuidance({
  requestId: "SYNTH-M41C-UI-RENDER-GUIDANCE",
  role: "clinical-director",
  actorId: "SYNTH-HUMAN-CLINICAL-DIRECTOR",
  subjectId: "SYNTH-YOUTH-CONTINUUM-001",
  prompt: "Which governed source requires human attention?",
  intent: "which_source_governs",
  sourceIds: ["M41C-SRC-CONTROLLING-DOCTRINE"],
  workplanItemId: workplan.briefs.daily.items[0].id,
  requestedFields: ["safety_status"],
  minimumNecessaryFields: ["safety_status"],
  consentState: "active",
  part2: false,
});

const signedValidation: M41cSignedValidationRecord = {
  validationId: "SYNTH-M41C-UI-VALIDATION",
  artifactId: "SYNTH-M41C-UI-PATHWAY",
  artifactKind: "pathway",
  artifactVersion: "SYNTH-1.0",
  checks: [
    {
      checkId: "SYNTH-M41C-UI-CHECK",
      label: "Synthetic boundary verified",
      passed: true,
      evidenceIds: ["SYNTH-M41C-UI-EVIDENCE"],
      notes: ["No production activation authority."],
    },
  ],
  signatures: [
    {
      signatureId: "SYNTH-M41C-UI-SIGNATURE",
      signedBy: "SYNTH-HUMAN-CLINICAL-DIRECTOR",
      signedByRole: "clinical-director",
      signedAt: "2026-11-15T08:00:00.000Z",
      attestation: "Approved only for the governed synthetic demonstration.",
      synthetic: true,
    },
  ],
  approvedForSyntheticDemo: true,
  productionActivationAuthorized: false,
  competencyGateId: "SYNTH-M41C-UI-COMPETENCY-GATE",
  sourceIds: ["M41C-SRC-CONTROLLING-DOCTRINE"],
  recordedAt: "2026-11-15T08:00:00.000Z",
  evidenceClass: M41C_EVIDENCE_CLASS,
};

function safetyPathway(
  domain: "suicide_crisis" | "medication_physical_health",
): M41cPathwayDefinition {
  return {
    id: `SYNTH-M41C-${domain.toUpperCase()}-PATHWAY`,
    version: "SYNTH-1.0",
    title:
      domain === "suicide_crisis"
        ? "Synthetic suicide and crisis safety pathway"
        : "Synthetic medication and physical-health safety pathway",
    domain,
    activationState: "demo_approved",
    syntheticOnly: true,
    sourceIds: ["M41C-SRC-CONTROLLING-DOCTRINE"],
    instrumentProfileIds: ["SYNTH-M41C-INSTRUMENT-STANDIN"],
    population: ["synthetic youth evaluation records"],
    settings: ["synthetic continuum"],
    exclusions: ["real patient records"],
    steps: [
      {
        id: `SYNTH-M41C-${domain}-ASSESSMENT`,
        stage: "assessment",
        title: "Verify synthetic inputs",
        requiredInputs: ["synthetic signal"],
        outputKinds: ["human review route"],
        requiredHumanRoles: ["clinical-director"],
        stopOnMissingInput: true,
        prohibitedAutonomousActions: M41C_PROHIBITED_ACTIONS,
      },
      {
        id: `SYNTH-M41C-${domain}-REVIEW`,
        stage: "review",
        title: "Record qualified human review",
        requiredInputs: ["human disposition"],
        outputKinds: ["synthetic review record"],
        requiredHumanRoles: ["clinical-director"],
        stopOnMissingInput: true,
        prohibitedAutonomousActions: M41C_PROHIBITED_ACTIONS,
      },
    ],
    measurementSchedule: {
      baselineRequired: true,
      reviewCadence: "daily",
      reassessmentTriggers: ["synthetic safety change"],
      responseReviewRequired: true,
      nonresponseReviewRequired: true,
    },
    humanGateTemplate: {
      gateId: `SYNTH-M41C-${domain}-GATE`,
      domain: "clinical",
      required: true,
      accountableRoles: ["clinical-director"],
      qualifiedRoleRequired: true,
      competencyIdsRequired: ["M41C-COMP-SAFETY-ESCALATION"],
      status: "pending",
      decidedBy: null,
      decidedByRole: null,
      decidedAt: null,
      rationale: null,
      overrideReason: null,
    },
    limitations: [
      "Synthetic pathway only; licensed disposition remains human-controlled.",
    ],
  };
}

const continuum = buildM41cContinuumEpisode({
  episodeId: "SYNTH-M41C-UI-EPISODE",
  subjectId: "SYNTH-M41C-UI-YOUTH",
  openedAt: "2026-11-01T08:00:00.000Z",
  events: [
    {
      id: "SYNTH-M41C-UI-INTAKE",
      stage: "intake",
      occurredAt: "2026-11-01T08:00:00.000Z",
      serviceId: "SYNTH-M41C-UI-SERVICE-INTAKE",
      sourceRecordIds: ["SYNTH-M41C-UI-ASSESSMENT"],
      transitionReason: null,
      aftercareLinkId: null,
    },
    {
      id: "SYNTH-M41C-UI-OUTPATIENT",
      stage: "outpatient",
      occurredAt: "2026-11-02T08:00:00.000Z",
      serviceId: "SYNTH-M41C-UI-SERVICE-OUTPATIENT",
      sourceRecordIds: ["SYNTH-M41C-UI-OUTCOME"],
      transitionReason: "Synthetic qualified-human transition review.",
      aftercareLinkId: null,
    },
    {
      id: "SYNTH-M41C-UI-AFTERCARE",
      stage: "aftercare",
      occurredAt: "2026-11-10T08:00:00.000Z",
      serviceId: "SYNTH-M41C-UI-SERVICE-AFTERCARE",
      sourceRecordIds: ["SYNTH-M41C-UI-AFTERCARE-PLAN"],
      transitionReason: "Synthetic aftercare handoff.",
      aftercareLinkId: "SYNTH-M41C-UI-AFTERCARE-LINK",
    },
  ],
});

const monitoring = evaluateM41cClinicalMonitoring({
  monitorId: "SYNTH-M41C-UI-MONITOR",
  evaluatedAt: "2026-11-15T08:00:00.000Z",
  sourceExpiryCount: 1,
  versionMismatchCount: 0,
  permissionDenialCount: 2,
  safetyEscalationCount: 2,
  safetyEscalationAcknowledgedCount: 2,
  alertsIssued: 6,
  alertsActionable: 4,
  overrideCount: 1,
  overridesReviewed: 1,
  pathwayStepExpected: 10,
  pathwayStepCompleted: 9,
  outcomeReviewExpected: 2,
  outcomeReviewCompleted: 2,
  unintendedEffectCount: 0,
  unintendedEffectsReviewed: 0,
  mappingErrorCount: 0,
  subgroupCompletionRates: {
    "SYNTH-GROUP-A": 0.9,
    "SYNTH-GROUP-B": 0.84,
  },
});

const mapping: M41cExperienceSnapshot["mapping"] = {
  resourceTypes: [
    "Patient",
    "EpisodeOfCare",
    "CarePlan",
    "Observation",
    "Task",
    "Consent",
    "Provenance",
  ],
  bundleValid: true,
  cmbhsMode: "read_and_reconcile_simulator",
  cmbhsStatus: "differences_pending",
  externalWritesBlocked: true,
  conformanceClaimed: false,
};

const scenarioResult: M41cSyntheticScenarioRunResponse = {
  runId: "SYNTH-M41C-UI-RUN",
  scenarioId: "SYNTH-M41C-SCENARIO-POSITIVE-SAFETY",
  scenarioKind: "positive_safety",
  status: "passed",
  summary: "The positive synthetic signal routed to qualified human review.",
  expectedControl: "Escalate to qualified BSSA review.",
  humanGateRequired: true,
  sourceIds: ["M41C-SRC-CONTROLLING-DOCTRINE"],
  evidenceIds: ["SYNTH-M41C-UI-SCENARIO-EVIDENCE"],
  auditEventIds: ["SYNTH-M41C-UI-SCENARIO-AUDIT"],
  prohibitedActions: M41C_PROHIBITED_ACTIONS,
  productionRows: 0,
  liveWrites: 0,
  evidenceClass: M41C_EVIDENCE_CLASS,
};

const pathways = [
  safetyPathway("suicide_crisis"),
  safetyPathway("medication_physical_health"),
] as const;

const snapshot: M41cExperienceSnapshot = {
  milestone: "M4.1C",
  generatedAt: "2026-11-15T08:00:00.000Z",
  environment: M41C_DEMO_BOUNDARY,
  council: createSyntheticM41cClinicalGovernanceCouncil(),
  registry: knowledgeRegistry,
  instrumentRegistry,
  profileSeparation,
  signedValidationRecords: [signedValidation],
  competencyRegistry: createSyntheticM41cCompetencyRegistry(),
  pathwayCatalog: pathways,
  youthPathwayPacks: M41C_YOUTH_PATHWAY_PACKS,
  scenarioCatalog: M41C_SYNTHETIC_SCENARIOS,
  continuum,
  mapping,
  monitoring,
  components: [
    {
      criterionId: "M4.1C-01",
      title: "Clinical governance council",
      status: "complete",
      summary: "Named synthetic human governance is operational.",
      evidenceIds: ["SYNTH-M41C-UI-EVIDENCE-01"],
    },
    {
      criterionId: "M4.1C-03",
      title: "Unapproved logic quarantine",
      status: "quarantined",
      summary: "Unapproved scoring remains isolated from clinical use.",
      evidenceIds: ["SYNTH-M41C-UI-EVIDENCE-03"],
    },
  ],
  counts: {
    sourceCount: knowledgeRegistry.sourceCount,
    knowledgeEntryCount: knowledgeRegistry.entryCount,
    instrumentProfileCount: instrumentRegistry.profiles.length,
    quarantineCount: instrumentRegistry.quarantines.length,
    pathwayCount: pathways.length,
    validationRecordCount: 1,
    scenarioCount: M41C_SYNTHETIC_SCENARIOS.length,
    cadenceCount: 5,
  },
  prohibitedActions: M41C_PROHIBITED_ACTIONS,
  productionRows: 0,
  liveWrites: 0,
  evidenceClass: M41C_EVIDENCE_CLASS,
};

describe("M4.1C Clinical Intelligence Fabric experience", () => {
  it("renders the complete synthetic clinical workspace without fallback clinical content", () => {
    const markup = renderToStaticMarkup(
      <M41cClinicalIntelligenceView
        guidance={guidance}
        isRefreshing={false}
        isRunningScenario={false}
        isSubmittingGuidance={false}
        onAsk={() => undefined}
        onRefresh={() => undefined}
        onRunScenario={() => undefined}
        scenarioResult={scenarioResult}
        snapshot={snapshot}
        state="ready"
        workplan={workplan}
      />,
    );

    expect(markup).toContain(M41C_DEMO_BOUNDARY.label);
    expect(markup).toContain("Clinical Intelligence Fabric");
    expect(markup).toContain("0 live writes · 0 production rows");
    expect(markup).toContain("M4.1C experience control map");
    expect(markup).toContain("Clinical governance &amp; instrument boundaries");
    expect(markup).toContain("Source-transparent clinical knowledge registry");
    expect(markup).toContain(
      "Pathway orchestration &amp; continuum intelligence",
    );
    expect(markup).toContain("Clinical workplan &amp; Ask AMOS");
    expect(markup).toContain("Deterministic clinical scenario lab");
    expect(markup).not.toContain("itemDefinitions");
    expect(markup).not.toContain("responseOptions");
  });

  it("renders source transparency and never renders instrument item definitions", () => {
    const markup = renderToStaticMarkup(
      <M41cSourceRegistryPanel registry={knowledgeRegistry} />,
    );

    expect(markup).toContain("Source-transparent clinical knowledge registry");
    expect(markup).toContain("Proprietary content stored: no");
    expect(markup).toContain("License state");
    expect(markup).toContain("Missing evidence");
    expect(markup).toContain("Production execution: unavailable");
    expect(markup).not.toContain("responseOptions");
    expect(markup).not.toContain("itemDefinitions");
  });

  it("renders named governance, signed validation, separated profiles, and quarantine", () => {
    const markup = renderToStaticMarkup(
      <M41cGovernanceProfilesPanel
        council={createSyntheticM41cClinicalGovernanceCouncil()}
        instrumentRegistry={instrumentRegistry}
        profileSeparation={profileSeparation}
        signedValidationRecords={[signedValidation]}
      />,
    );

    expect(markup).toContain("Named human authority");
    expect(markup).toContain("Signed validation state");
    expect(markup).toContain("Profiles distinct");
    expect(markup).toContain("TRR CANS governed metadata profile");
    expect(markup).toContain("DFPS CANS 3.0 governed metadata profile");
    expect(markup).toContain("Quarantine register");
    expect(markup).toContain("Production authority: none");
  });

  it("renders pathway orchestration, continuum lineage, safety boundaries, and write-blocked mappings", () => {
    const markup = renderToStaticMarkup(
      <M41cPathwaySafetyPanel
        continuum={continuum}
        mapping={mapping}
        monitoring={monitoring}
        pathways={pathways}
        youthPathwayPacks={M41C_YOUTH_PATHWAY_PACKS}
      />,
    );

    expect(markup).toContain("Youth continuum lineage");
    expect(markup).toContain("Suicide &amp; crisis safety boundary");
    expect(markup).toContain(
      "Medication &amp; physical-health safety boundary",
    );
    expect(markup).toContain("CMBHS / FHIR mapping boundary");
    expect(markup).toContain("Writes blocked");
    expect(markup).toContain("Conformance claim");
    expect(markup).toContain("Clinical safety monitoring");
  });

  it("renders all five cadence items, Ask AMOS citations, and competency gates", () => {
    const markup = renderToStaticMarkup(
      <M41cWorkplanAssistantPanel
        competencyRegistry={createSyntheticM41cCompetencyRegistry()}
        guidance={guidance}
        isSubmittingGuidance={false}
        onAsk={() => undefined}
        workplan={workplan}
      />,
    );

    for (const cadence of [
      "Daily",
      "Weekly",
      "Monthly",
      "Quarterly",
      "Annual",
    ]) {
      expect(markup).toContain(`${cadence} workplan`);
    }
    expect(markup).toContain("Ask AMOS clinical guidance");
    expect(markup).toContain("Complete citation set");
    expect(markup).toContain("Named human gate");
    expect(markup).toContain("Competency &amp; certification monitor");
    expect(markup).toContain("Production credentialing unavailable");
  });

  it("renders complete scenario coverage and zero-write proof", () => {
    const markup = renderToStaticMarkup(
      <M41cScenarioLab
        isRunning={false}
        onRun={() => undefined}
        result={scenarioResult}
        scenarios={M41C_SYNTHETIC_SCENARIOS}
      />,
    );

    expect(markup).toContain("11/11 required types");
    expect(markup).toContain("Positive Safety control result");
    expect(markup).toContain("Human gate");
    expect(markup).toContain("Live writes / rows");
    expect(markup).toContain("0 / 0");
    expect(markup).toContain("Blocked actions");
  });
});
