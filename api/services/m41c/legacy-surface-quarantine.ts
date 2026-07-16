import {
  M41C_EVALUATION_AS_OF,
  M41C_EVIDENCE_CLASS,
} from "@contracts/m41c/shared";

export const M41C_LEGACY_SURFACE_QUARANTINE_MANIFEST_ID =
  "M41C-LEGACY-SURFACE-QUARANTINE-MANIFEST-V1" as const;
export const M41C_LEGACY_SURFACE_QUARANTINE_TEST_ID =
  "api/tests/m41c-legacy-surface-quarantine.test.ts" as const;

export const M41C_LEGACY_SURFACE_IDS = Object.freeze([
  "M41C-LSQ-01-BHC-DIRECT-ENDPOINTS",
  "M41C-LSQ-02-BHC-PATIENT-PROFILE",
  "M41C-LSQ-03-M14-SCORING-RISK-LOC",
  "M41C-LSQ-04-M14-NARRATIVE-PROJECTION",
  "M41C-LSQ-05-M21-SYNTHETIC-REGRESSION",
  "M41C-LSQ-06-MHTCM-CANS-LOC-INPUTS",
  "M41C-LSQ-07-MHTCM-ELIGIBILITY-DECISION",
  "M41C-LSQ-08-CCMG-SCORE-RISK-INPUTS",
  "M41C-LSQ-09-MHRS-SCORE-DOMAIN-INPUTS",
  "M41C-LSQ-10-WF002-TRANSITION",
  "M41C-LSQ-11-WF002-EVIDENCE",
  "M41C-LSQ-12-CLINICAL-UI",
  "M41C-LSQ-13-TOOLKIT-UI",
  "M41C-LSQ-14-WORKSPACE-UI",
  "M41C-LSQ-15-M2-DMS-PLACEHOLDER",
  "M41C-LSQ-16-M10-ANALYTICS",
  "M41C-LSQ-17-DEMO-MOCK-FALLBACK",
  "M41C-LSQ-18-M13-LEVEL-OF-CARE",
  "M41C-LSQ-19-M15-OBSERVATION-SCORING",
  "M41C-LSQ-20-BHC-OUTCOME-MEASURES",
  "M41C-LSQ-21-M5-OUTCOME-MEASURES",
  "M41C-LSQ-22-OUTCOME-MEASURES-PAGE",
  "M41C-LSQ-23-DASHBOARD-OUTCOME-MODAL",
] as const);

export type M41cLegacySurfaceId = (typeof M41C_LEGACY_SURFACE_IDS)[number];

export const M41C_LEGACY_SURFACE_GUARD_AND_DISPOSITION_IDS = Object.freeze({
  legacyCansHardQuarantine: "M41C_LEGACY_CANS_LOGIC_QUARANTINED",
  bhcRawRowsWithheld: "M41C_BHC_RAW_LEGACY_ASSESSMENT_ROWS_WITHHELD",
  m14NarrativeOnly: "M41C_M14_NARRATIVE_ONLY_PROJECTION",
  m21SyntheticRegressionOnly: "M41C_M21_SYNTHETIC_REGRESSION_ONLY",
  mhtcmEligibilityDecision: "M41C_UNGOVERNED_ELIGIBILITY_DECISION_QUARANTINED",
  mhrsLegacyInput: "M41C_MHRS_LEGACY_CANS_INPUT_QUARANTINED",
  wf002LegacyInput: "M41C_WORKFLOW_LEGACY_CANS_LOGIC_QUARANTINED",
  uiStaticQuarantine: "M41C_UI_LEGACY_SCORING_STATIC_QUARANTINE",
  dmsMetadataOnly: "M41C_DMS_CLINICAL_INSTRUMENT_METADATA_ONLY",
  m10NonclinicalSeedOnly: "M41C_ANALYTICS_UNGOVERNED_DERIVATIONS_REMOVED",
  demoFallbackSyntheticOnly: "M41C_EVALUATION_CLINICAL_FIXTURES_SANITIZED",
  m13LevelOfCare: "M41C_UNGOVERNED_LOC_LOGIC_QUARANTINED",
  m15ObservationScoring: "M41C_UNGOVERNED_OBSERVATION_SCORING_QUARANTINED",
  bhcOutcomeInstrument: "M41C_UNGOVERNED_INSTRUMENT_LOGIC_QUARANTINED",
  m5OutcomeInstrument: "M41C_UNGOVERNED_INSTRUMENT_LOGIC_QUARANTINED",
  outcomeMeasurePageMode: "metadata_only_quarantine",
  dashboardOutcomePreviewDisabled:
    "M41C_DASHBOARD_OUTCOME_MEASURE_PREVIEW_ENABLED=false",
} as const);

type M41cLegacySurfaceControlKind =
  | "hard_error_guard"
  | "hard_error_and_row_withhold"
  | "raw_row_withhold"
  | "narrative_only_projection"
  | "synthetic_regression_only"
  | "static_quarantine_replacement"
  | "metadata_only_placeholder"
  | "nonclinical_seed_only"
  | "synthetic_mock_only";

export interface M41cLegacySurfaceQuarantineRecord {
  surfaceId: M41cLegacySurfaceId;
  activeSurfacePaths: readonly string[];
  legacyCapabilities: readonly string[];
  controlKind: M41cLegacySurfaceControlKind;
  guardOrDispositionIds: readonly string[];
  governedReplacement: string;
  disposition: string;
  productionBlocked: true;
  failClosed: true;
  rawLegacyRowsReturned: false;
  syntheticRegressionOnly: boolean;
  focusedRegressionTestIds: readonly string[];
  evidenceClass: typeof M41C_EVIDENCE_CLASS;
}

function record(input: {
  surfaceId: M41cLegacySurfaceId;
  activeSurfacePaths: readonly string[];
  legacyCapabilities: readonly string[];
  controlKind: M41cLegacySurfaceControlKind;
  guardOrDispositionIds: readonly string[];
  governedReplacement: string;
  disposition: string;
  syntheticRegressionOnly?: boolean;
  focusedRegressionTestIds: readonly string[];
}): M41cLegacySurfaceQuarantineRecord {
  return Object.freeze({
    surfaceId: input.surfaceId,
    activeSurfacePaths: Object.freeze([...input.activeSurfacePaths]),
    legacyCapabilities: Object.freeze([...input.legacyCapabilities]),
    controlKind: input.controlKind,
    guardOrDispositionIds: Object.freeze([...input.guardOrDispositionIds]),
    governedReplacement: input.governedReplacement,
    disposition: input.disposition,
    productionBlocked: true,
    failClosed: true,
    rawLegacyRowsReturned: false,
    syntheticRegressionOnly: input.syntheticRegressionOnly ?? false,
    focusedRegressionTestIds: Object.freeze([
      ...new Set([
        ...input.focusedRegressionTestIds,
        M41C_LEGACY_SURFACE_QUARANTINE_TEST_ID,
      ]),
    ]),
    evidenceClass: M41C_EVIDENCE_CLASS,
  });
}

const surfaces = Object.freeze([
  record({
    surfaceId: "M41C-LSQ-01-BHC-DIRECT-ENDPOINTS",
    activeSurfacePaths: [
      "api/routers/bhc.ts#listCansAssessments",
      "api/routers/bhc.ts#getCansAssessment",
      "api/routers/bhc.ts#createCansAssessment",
      "api/routers/bhc.ts#updateCansAssessment",
      "api/routers/bhc.ts#completeCansAssessment",
      "api/routers/bhc.ts#listAssessmentDomains",
      "api/routers/bhc.ts#createAssessmentDomain",
      "api/routers/bhc.ts#updateAssessmentDomain",
    ],
    legacyCapabilities: [
      "raw legacy assessment CRUD",
      "home-grown domain scoring",
      "derived risk and generic level-of-care logic",
    ],
    controlKind: "hard_error_guard",
    guardOrDispositionIds: [
      "quarantineLegacyCansLogic",
      M41C_LEGACY_SURFACE_GUARD_AND_DISPOSITION_IDS.legacyCansHardQuarantine,
    ],
    governedReplacement:
      "M4.1C program-specific profiles, signed validation, competency gates, and named human review",
    disposition: "Every direct legacy endpoint throws before database access.",
    focusedRegressionTestIds: ["api/tests/m41c-legacy-cans-quarantine.test.ts"],
  }),
  record({
    surfaceId: "M41C-LSQ-02-BHC-PATIENT-PROFILE",
    activeSurfacePaths: [
      "api/routers/bhc.ts#getPatient#governedAssessmentReference",
    ],
    legacyCapabilities: [
      "raw legacy assessment rows embedded in patient profile",
    ],
    controlKind: "raw_row_withhold",
    guardOrDispositionIds: [
      "buildBhcGovernedAssessmentReference",
      M41C_LEGACY_SURFACE_GUARD_AND_DISPOSITION_IDS.bhcRawRowsWithheld,
      "legacy_assessment_rows_quarantined",
    ],
    governedReplacement:
      "Governed M4.1C assessment reference metadata with exact TRR and DFPS profile identities",
    disposition:
      "Patient profile retains ordinary care data but withholds raw legacy assessment rows.",
    focusedRegressionTestIds: [
      "api/tests/m41c-bhc-patient-assessment-boundary.test.ts",
    ],
  }),
  record({
    surfaceId: "M41C-LSQ-03-M14-SCORING-RISK-LOC",
    activeSurfacePaths: [
      "api/routers/m14.ts#updateAssessment",
      "api/routers/m14.ts#createDomain",
      "api/routers/m14.ts#updateDomain",
    ],
    legacyCapabilities: [
      "incomplete score fields",
      "derived risk bands",
      "generic level-of-care determination",
    ],
    controlKind: "hard_error_guard",
    guardOrDispositionIds: [
      "quarantineM14UnapprovedClinicalLogic",
      M41C_LEGACY_SURFACE_GUARD_AND_DISPOSITION_IDS.legacyCansHardQuarantine,
    ],
    governedReplacement:
      "M4.1C governed pathway evaluation with sourced evidence and human disposition",
    disposition:
      "Unapproved clinical derivation fields invoke the hard quarantine.",
    focusedRegressionTestIds: ["api/tests/m41c-legacy-cans-quarantine.test.ts"],
  }),
  record({
    surfaceId: "M41C-LSQ-04-M14-NARRATIVE-PROJECTION",
    activeSurfacePaths: [
      "api/routers/m14.ts#listAssessments",
      "api/routers/m14.ts#getAssessment",
      "src/components/shell/app-shell-routes.tsx#IntakeAssessmentPage",
    ],
    legacyCapabilities: [
      "unbounded assessment-row projection with clinical derivations",
    ],
    controlKind: "narrative_only_projection",
    guardOrDispositionIds: [
      "M41C_NARRATIVE_ASSESSMENT_COLUMNS",
      M41C_LEGACY_SURFACE_GUARD_AND_DISPOSITION_IDS.m14NarrativeOnly,
      "@/pages/intake/assessment-page",
    ],
    governedReplacement:
      "Narrative history projection without score, risk-band, or level-of-care columns",
    disposition:
      "Only bounded narrative fields and non-scoring domain notes are projected.",
    focusedRegressionTestIds: [
      "api/tests/m41c-legacy-cans-quarantine.test.ts",
      "api/tests/m41c-app-route.test.ts",
    ],
  }),
  record({
    surfaceId: "M41C-LSQ-05-M21-SYNTHETIC-REGRESSION",
    activeSurfacePaths: [
      "api/routers/m21.ts#finalizeM21CansVersion",
      "api/routers/m21.ts#approveM21CansTargetRoute",
    ],
    legacyCapabilities: [
      "legacy total-score lineage",
      "legacy target-route demonstration",
    ],
    controlKind: "synthetic_regression_only",
    guardOrDispositionIds: [
      "isM21CansSyntheticRegressionContext",
      M41C_LEGACY_SURFACE_GUARD_AND_DISPOSITION_IDS.m21SyntheticRegressionOnly,
      M41C_LEGACY_SURFACE_GUARD_AND_DISPOSITION_IDS.legacyCansHardQuarantine,
    ],
    governedReplacement:
      "M4.1C governed program-specific pathway and longitudinal youth record",
    disposition:
      "Retained M2.1 lineage runs only for synthetic_demo actors and CANS-SYNTHETIC versions.",
    syntheticRegressionOnly: true,
    focusedRegressionTestIds: [
      "api/tests/m41c-legacy-cans-quarantine.test.ts",
      "api/tests/m21-care-path-e2e.test.ts",
    ],
  }),
  record({
    surfaceId: "M41C-LSQ-06-MHTCM-CANS-LOC-INPUTS",
    activeSurfacePaths: [
      "api/routers/mhtcm.ts#createServicePlan",
      "api/routers/mhtcm.ts#createEligibility",
    ],
    legacyCapabilities: [
      "CANS totals and risk",
      "generic level-of-care inputs",
    ],
    controlKind: "hard_error_guard",
    guardOrDispositionIds: [
      "assertMhtcmServicePlanLegacyCansInputsAbsent",
      "assertMhtcmEligibilityLegacyCansInputsAbsent",
      "M41C_LEGACY_CANS_LOGIC_QUARANTINED",
    ],
    governedReplacement:
      "Generic MHTCM workflow plus governed M4.1C assessment references",
    disposition: "Every declared legacy input is rejected before getDb().",
    focusedRegressionTestIds: ["api/tests/m41c-mhtcm-quarantine.test.ts"],
  }),
  record({
    surfaceId: "M41C-LSQ-07-MHTCM-ELIGIBILITY-DECISION",
    activeSurfacePaths: ["api/routers/mhtcm.ts#updateEligibility"],
    legacyCapabilities: ["direct eligible or ineligible activation"],
    controlKind: "hard_error_guard",
    guardOrDispositionIds: [
      "assertMhtcmEligibilityDecisionNotActivated",
      M41C_LEGACY_SURFACE_GUARD_AND_DISPOSITION_IDS.mhtcmEligibilityDecision,
    ],
    governedReplacement:
      "Pending or under-review workflow routed to a named accountable human",
    disposition:
      "Direct eligibility decisions are quarantined before database access.",
    focusedRegressionTestIds: [
      "api/tests/m41c-mhtcm-eligibility-quarantine.test.ts",
    ],
  }),
  record({
    surfaceId: "M41C-LSQ-08-CCMG-SCORE-RISK-INPUTS",
    activeSurfacePaths: [
      "api/routers/ccmg.ts#updateCareCoordination",
      "api/routers/ccmg.ts#bhcDashboard",
      "src/pages/bhc/bhc-dashboard-page.tsx",
    ],
    legacyCapabilities: [
      "CANS complete flag",
      "total score",
      "derived risk level",
      "legacy-assessment completion dashboard metric",
    ],
    controlKind: "hard_error_guard",
    guardOrDispositionIds: [
      "assertCcmgLegacyCansInputsAbsent",
      "quarantineCcmgLegacyCansLogic",
      M41C_LEGACY_SURFACE_GUARD_AND_DISPOSITION_IDS.legacyCansHardQuarantine,
      "M41C_CCMG_UNGOVERNED_COMPLETION_METRIC_REMOVED",
    ],
    governedReplacement:
      "Generic care coordination with governed assessment-to-plan lineage",
    disposition:
      "Legacy score and risk inputs are rejected before getDb(); the API and UI expose a governed assessment-review status instead of a completion metric.",
    focusedRegressionTestIds: ["api/tests/m41c-ccmg-quarantine.test.ts"],
  }),
  record({
    surfaceId: "M41C-LSQ-09-MHRS-SCORE-DOMAIN-INPUTS",
    activeSurfacePaths: [
      "api/routers/mhrs.ts#createServicePlan",
      "api/routers/mhrs.ts#createEncounter",
      "api/routers/mhrs.ts#createSkillsAssessment",
    ],
    legacyCapabilities: [
      "CANS domain selection",
      "baseline, target, and current scores",
    ],
    controlKind: "hard_error_guard",
    guardOrDispositionIds: [
      "assertMhrsServicePlanLegacyCansInputsAbsent",
      "assertMhrsEncounterLegacyCansInputsAbsent",
      "assertMhrsSkillsAssessmentLegacyCansInputsAbsent",
      M41C_LEGACY_SURFACE_GUARD_AND_DISPOSITION_IDS.mhrsLegacyInput,
    ],
    governedReplacement:
      "Generic MHRS goals and skill progress with governed assessment references",
    disposition: "Legacy score and domain inputs are rejected before getDb().",
    focusedRegressionTestIds: ["api/tests/m41c-mhrs-quarantine.test.ts"],
  }),
  record({
    surfaceId: "M41C-LSQ-10-WF002-TRANSITION",
    activeSurfacePaths: [
      "api/routers/workflow.ts#transitionClinicalAssessmentStatus",
    ],
    legacyCapabilities: ["CANS-COMPLETE workflow transition"],
    controlKind: "hard_error_guard",
    guardOrDispositionIds: [
      "assertWf002TransitionInputAllowed",
      "assertWf002TransitionSequence",
      M41C_LEGACY_SURFACE_GUARD_AND_DISPOSITION_IDS.wf002LegacyInput,
    ],
    governedReplacement:
      "Generic IN-PROGRESS to PLAN-DEVELOPED transition with sequence enforcement",
    disposition: "Legacy transition values are rejected before SQLite access.",
    focusedRegressionTestIds: [
      "api/tests/m41c-workflow-wf002-quarantine.test.ts",
    ],
  }),
  record({
    surfaceId: "M41C-LSQ-11-WF002-EVIDENCE",
    activeSurfacePaths: [
      "api/routers/workflow.ts#submitClinicalAssessmentEvidence",
    ],
    legacyCapabilities: ["cans_assessment evidence gate"],
    controlKind: "hard_error_guard",
    guardOrDispositionIds: [
      "assertWf002EvidenceInputAllowed",
      M41C_LEGACY_SURFACE_GUARD_AND_DISPOSITION_IDS.wf002LegacyInput,
    ],
    governedReplacement:
      "Generic named evidence gates associated with governed workflow review",
    disposition:
      "Legacy evidence gate names are rejected before SQLite access.",
    focusedRegressionTestIds: [
      "api/tests/m41c-workflow-wf002-quarantine.test.ts",
    ],
  }),
  record({
    surfaceId: "M41C-LSQ-12-CLINICAL-UI",
    activeSurfacePaths: ["src/pages/clinical/cans-assessment-page.tsx"],
    legacyCapabilities: ["interactive legacy clinical scoring form"],
    controlKind: "static_quarantine_replacement",
    guardOrDispositionIds: [
      "M41cLegacyCansQuarantine",
      M41C_LEGACY_SURFACE_GUARD_AND_DISPOSITION_IDS.uiStaticQuarantine,
    ],
    governedReplacement:
      "Static quarantine explanation linked to the Clinical Intelligence Fabric",
    disposition:
      "No score, save, route, or clinical-record action is rendered.",
    focusedRegressionTestIds: [
      "src/components/m41c/m41c-legacy-cans-quarantine.test.tsx",
    ],
  }),
  record({
    surfaceId: "M41C-LSQ-13-TOOLKIT-UI",
    activeSurfacePaths: ["src/pages/toolkits/cans-assessment-page.tsx"],
    legacyCapabilities: ["interactive legacy toolkit scoring form"],
    controlKind: "static_quarantine_replacement",
    guardOrDispositionIds: [
      "M41cLegacyCansQuarantine",
      M41C_LEGACY_SURFACE_GUARD_AND_DISPOSITION_IDS.uiStaticQuarantine,
    ],
    governedReplacement:
      "Static quarantine explanation linked to governed profiles and pathways",
    disposition: "No scoring thresholds or save action is rendered.",
    focusedRegressionTestIds: [
      "src/components/m41c/m41c-legacy-cans-quarantine.test.tsx",
    ],
  }),
  record({
    surfaceId: "M41C-LSQ-14-WORKSPACE-UI",
    activeSurfacePaths: ["src/pages/clinical/clinical-workspace-page.tsx"],
    legacyCapabilities: [
      "workspace shortcut to legacy automated scoring",
      "embedded outcome-instrument items, scoring, and severity projection",
    ],
    controlKind: "static_quarantine_replacement",
    guardOrDispositionIds: [
      "M41C_WORKSPACE_SCORING_REMOVED",
      "M41C_LEGACY_OUTCOME_MEASURE_PREVIEW_ENABLED",
      M41C_LEGACY_SURFACE_GUARD_AND_DISPOSITION_IDS.uiStaticQuarantine,
    ],
    governedReplacement:
      "Metadata-only CANS and outcome-measure governance experiences linked to the M4.1C Clinical Intelligence Fabric",
    disposition:
      "Workspace contains no executable score, severity, level-of-care derivation, instrument-item display, patient query, or clinical-record write.",
    focusedRegressionTestIds: [
      "src/components/m41c/m41c-legacy-cans-quarantine.test.tsx",
      "api/tests/m41c-app-route.test.ts",
      "api/tests/m41c-clinical-workspace-outcome-quarantine.test.ts",
    ],
  }),
  record({
    surfaceId: "M41C-LSQ-15-M2-DMS-PLACEHOLDER",
    activeSurfacePaths: ["api/routers/m2.ts#seedDocuments"],
    legacyCapabilities: ["published clinical instrument scoring guide seed"],
    controlKind: "metadata_only_placeholder",
    guardOrDispositionIds: [
      "M41C_DMS_CLINICAL_INSTRUMENT_PLACEHOLDER",
      M41C_LEGACY_SURFACE_GUARD_AND_DISPOSITION_IDS.dmsMetadataOnly,
    ],
    governedReplacement:
      "Draft metadata-only placeholder with no wording, anchors, scoring, or publication",
    disposition: "Clinical instrument seed remains draft and quarantined.",
    focusedRegressionTestIds: [
      "api/tests/m41c-dms-clinical-placeholder.test.ts",
    ],
  }),
  record({
    surfaceId: "M41C-LSQ-16-M10-ANALYTICS",
    activeSurfacePaths: [
      "api/routers/m10.ts#M41C_ANALYTICS_UNGOVERNED_DERIVATIONS_REMOVED",
      "api/routers/m10.ts#SOP_ITEMS_SEED",
      "api/routers/analytics.ts#analyticsRouter",
    ],
    legacyCapabilities: [
      "legacy clinical-assessment analytics label",
      "ungoverned score, risk, or level-of-care derivations",
    ],
    controlKind: "nonclinical_seed_only",
    guardOrDispositionIds: [
      M41C_LEGACY_SURFACE_GUARD_AND_DISPOSITION_IDS.m10NonclinicalSeedOnly,
    ],
    governedReplacement:
      "Nonclinical governance placeholder that directs clinical content to M4.1C",
    disposition:
      "The analytics seed is nonclinical metadata and cannot score, route, or activate care.",
    focusedRegressionTestIds: [
      "api/tests/m41c-analytics-fixture-quarantine.test.ts",
    ],
  }),
  record({
    surfaceId: "M41C-LSQ-17-DEMO-MOCK-FALLBACK",
    activeSurfacePaths: ["src/providers/trpc.ts#demoFallbackData"],
    legacyCapabilities: [
      "legacy assessment scores and tasks in disconnected UI fallback",
    ],
    controlKind: "synthetic_mock_only",
    guardOrDispositionIds: [
      M41C_LEGACY_SURFACE_GUARD_AND_DISPOSITION_IDS.demoFallbackSyntheticOnly,
    ],
    governedReplacement:
      "Synthetic-only quarantine metadata or neutral operational mock content",
    disposition:
      "Fallback data is labeled synthetic, cannot access raw rows, and cannot trigger production actions.",
    syntheticRegressionOnly: true,
    focusedRegressionTestIds: [
      "api/tests/m41c-analytics-fixture-quarantine.test.ts",
    ],
  }),
  record({
    surfaceId: "M41C-LSQ-18-M13-LEVEL-OF-CARE",
    activeSurfacePaths: [
      "api/routers/m13.ts#createYouth",
      "api/routers/m13.ts#updateYouth",
      "api/routers/m13.ts#listYouth",
      "api/routers/m13.ts#getYouth",
      "api/routers/m13.ts#getYouthByMRN",
    ],
    legacyCapabilities: [
      "direct level-of-care selection during intake",
      "ungoverned level-of-care update mapping",
      "raw inherited level-of-care reads",
    ],
    controlKind: "hard_error_and_row_withhold",
    guardOrDispositionIds: [
      "assertM13LevelOfCareInputAbsent",
      "quarantineM13UngovernedLevelOfCare",
      M41C_LEGACY_SURFACE_GUARD_AND_DISPOSITION_IDS.m13LevelOfCare,
      "M41C_YOUTH_PROFILE_COLUMNS",
      "M41C_M13_LEGACY_LOC_READS_WITHHELD",
      "buildM13GovernedLocReference",
    ],
    governedReplacement:
      "Neutral not-yet-determined intake state followed by the governed M4.1C pathway and named qualified human review",
    disposition:
      "Youth initialization cannot select a treatment setting; later inputs fail before database access; and reads return governed reference metadata without the inherited level-of-care column.",
    focusedRegressionTestIds: ["api/tests/m41c-m13-loc-quarantine.test.ts"],
  }),
  record({
    surfaceId: "M41C-LSQ-19-M15-OBSERVATION-SCORING",
    activeSurfacePaths: [
      "api/routers/m15.ts#listObservations",
      "api/routers/m15.ts#getObservation",
      "api/routers/m15.ts#createObservation",
      "src/pages/coordination/daily-observations-page.tsx",
    ],
    legacyCapabilities: [
      "six-domain numeric observation scoring",
      "average-score significance determination",
      "score-triggered automatic clinician routing",
    ],
    controlKind: "narrative_only_projection",
    guardOrDispositionIds: [
      "assertM15ObservationScoresAbsent",
      "M41C_NARRATIVE_OBSERVATION_COLUMNS",
      M41C_LEGACY_SURFACE_GUARD_AND_DISPOSITION_IDS.m15ObservationScoring,
    ],
    governedReplacement:
      "Narrative daily observation with an explicit clinical-concern request for named human attention",
    disposition:
      "Score inputs fail before persistence; reads and UI omit inherited scores and automated routing fields.",
    focusedRegressionTestIds: [
      "api/tests/m41c-m15-observation-quarantine.test.ts",
    ],
  }),
  record({
    surfaceId: "M41C-LSQ-20-BHC-OUTCOME-MEASURES",
    activeSurfacePaths: [
      "api/routers/bhc.ts#getPatient#governedOutcomeMeasureReference",
      "api/routers/bhc.ts#listOutcomeMeasures",
      "api/routers/bhc.ts#getOutcomeMeasure",
      "api/routers/bhc.ts#createOutcomeMeasure",
      "api/routers/bhc.ts#getOutcomeTrends",
      "src/pages/clinical/patient-profile-page.tsx#PatientProfileOutcomeGovernancePanel",
      "src/providers/trpc.ts#M41C_BHC_GET_PATIENT_FALLBACK_OUTCOME_MODE",
    ],
    legacyCapabilities: [
      "raw numeric outcome rows embedded in patient detail",
      "legacy outcome-instrument list, detail, and create procedures",
      "numeric severity interpretation and longitudinal trend output",
      "numeric patient-profile outcome tab and disconnected fallback rows",
    ],
    controlKind: "hard_error_and_row_withhold",
    guardOrDispositionIds: [
      "M41C_BHC_UNGOVERNED_INSTRUMENT_LOGIC_QUARANTINED",
      "quarantineBhcUngovernedOutcomeInstrument",
      "buildBhcGovernedOutcomeMeasureReference",
      M41C_LEGACY_SURFACE_GUARD_AND_DISPOSITION_IDS.bhcOutcomeInstrument,
      "legacy_numeric_rows_quarantined",
      "M41C_PATIENT_PROFILE_OUTCOME_TAB_MODE",
      "M41C_PATIENT_PROFILE_OUTCOME_TAB_TEST_ID",
      "M41C_BHC_GET_PATIENT_FALLBACK_OUTCOME_MODE",
    ],
    governedReplacement:
      "M4.1C program-specific instrument profiles with registered authority, licensing metadata, signed validation, competency gates, and named human review",
    disposition:
      "Outcome procedures fail before database access; BHC detail and disconnected fallback return empty legacy-row collections; and the profile tab renders metadata-only governance.",
    focusedRegressionTestIds: [
      "api/tests/m41c-outcome-measure-procedure-quarantine.test.ts",
      "src/pages/clinical/outcome-measures-page.test.tsx",
    ],
  }),
  record({
    surfaceId: "M41C-LSQ-21-M5-OUTCOME-MEASURES",
    activeSurfacePaths: [
      "api/routers/m5.ts#getPatient",
      "api/routers/m5.ts#createOutcomeMeasure",
      "api/routers/m5.ts#seedClinicalData",
    ],
    legacyCapabilities: [
      "raw numeric outcome rows embedded in patient detail",
      "legacy numeric outcome creation",
      "seeded scores, maxima, and severity labels",
    ],
    controlKind: "hard_error_and_row_withhold",
    guardOrDispositionIds: [
      "M41C_M5_UNGOVERNED_INSTRUMENT_LOGIC_QUARANTINED",
      "quarantineM5UngovernedOutcomeInstrument",
      M41C_LEGACY_SURFACE_GUARD_AND_DISPOSITION_IDS.m5OutcomeInstrument,
      "legacy_numeric_rows_quarantined",
    ],
    governedReplacement:
      "Generic patient and session workflow plus a metadata-only reference to the governed M4.1C instrument-profile experience",
    disposition:
      "Create fails before database access; patient detail withholds numeric rows; and the clinical seed contains no outcome scores, maxima, or severity values.",
    focusedRegressionTestIds: [
      "api/tests/m41c-outcome-measure-procedure-quarantine.test.ts",
    ],
  }),
  record({
    surfaceId: "M41C-LSQ-22-OUTCOME-MEASURES-PAGE",
    activeSurfacePaths: [
      "src/pages/clinical/outcome-measures-page.tsx",
      "src/components/shell/app-shell-routes.tsx#/clinical/outcome-measures",
      "src/components/shell/app-shell.tsx#/clinical/outcome-measures",
      "src/data/navData.ts#Outcome Measure Governance",
    ],
    legacyCapabilities: [
      "patient-linked outcome-instrument entry",
      "numeric score, severity, and trend presentation",
      "live list, detail, and create procedure invocation",
    ],
    controlKind: "metadata_only_placeholder",
    guardOrDispositionIds: [
      "M41C_OUTCOME_MEASURE_PAGE_MODE",
      M41C_LEGACY_SURFACE_GUARD_AND_DISPOSITION_IDS.outcomeMeasurePageMode,
    ],
    governedReplacement:
      "Mounted metadata-only governance panel linked to the M4.1C Clinical Intelligence Fabric",
    disposition:
      "The route remains discoverable but renders no patient query, mutation, entry control, instrument content, or numeric interpretation.",
    focusedRegressionTestIds: [
      "src/pages/clinical/outcome-measures-page.test.tsx",
    ],
  }),
  record({
    surfaceId: "M41C-LSQ-23-DASHBOARD-OUTCOME-MODAL",
    activeSurfacePaths: [
      "src/pages/clinical/clinical-dashboard-page.tsx#OutcomeMeasureModal",
    ],
    legacyCapabilities: [
      "dashboard patient query and outcome-instrument selection",
      "embedded item scoring and severity calculation",
      "patient-linked clinical execution from a quick action",
    ],
    controlKind: "static_quarantine_replacement",
    guardOrDispositionIds: [
      "M41C_DASHBOARD_OUTCOME_MEASURE_PREVIEW_ENABLED",
      M41C_LEGACY_SURFACE_GUARD_AND_DISPOSITION_IDS.dashboardOutcomePreviewDisabled,
    ],
    governedReplacement:
      "Fail-closed governance modal linked to the M4.1C Clinical Intelligence Fabric",
    disposition:
      "The disabled constant prevents the patient query and returns governance metadata before inherited items, scores, or severity logic can execute.",
    focusedRegressionTestIds: [
      "src/pages/clinical/outcome-measures-page.test.tsx",
    ],
  }),
]);

const activeSurfaceBindings = Object.freeze(
  surfaces.flatMap((surface) => Array.from(surface.activeSurfacePaths)),
);

export const M41C_LEGACY_SURFACE_QUARANTINE_RESULT = Object.freeze({
  manifestId: M41C_LEGACY_SURFACE_QUARANTINE_MANIFEST_ID,
  manifestVersion: "1.0" as const,
  milestone: "M4.1C" as const,
  evaluatedAt: M41C_EVALUATION_AS_OF,
  expectedSurfaceIds: M41C_LEGACY_SURFACE_IDS,
  surfaces,
  surfaceCount: surfaces.length,
  activeSurfaceBindingCount: activeSurfaceBindings.length,
  exactSurfaceInventory:
    surfaces.length === M41C_LEGACY_SURFACE_IDS.length &&
    surfaces.every(
      (surface, index) => surface.surfaceId === M41C_LEGACY_SURFACE_IDS[index],
    ),
  uniqueActiveSurfaceBindings:
    new Set(activeSurfaceBindings).size === activeSurfaceBindings.length,
  allFailClosed: surfaces.every((surface) => surface.failClosed),
  allProductionBlocked: surfaces.every((surface) => surface.productionBlocked),
  allRawLegacyRowsWithheld: surfaces.every(
    (surface) => surface.rawLegacyRowsReturned === false,
  ),
  allRecordsBoundToControls: surfaces.every(
    (surface) =>
      surface.guardOrDispositionIds.length > 0 &&
      surface.guardOrDispositionIds.every((id) => id.trim().length > 0),
  ),
  allRecordsBoundToFocusedRegression: surfaces.every(
    (surface) =>
      surface.focusedRegressionTestIds.includes(
        M41C_LEGACY_SURFACE_QUARANTINE_TEST_ID,
      ) &&
      surface.focusedRegressionTestIds.some(
        (testId) => testId !== M41C_LEGACY_SURFACE_QUARANTINE_TEST_ID,
      ),
  ),
  productionRows: 0 as const,
  liveWrites: 0 as const,
  evidenceClass: M41C_EVIDENCE_CLASS,
  complete:
    surfaces.length === M41C_LEGACY_SURFACE_IDS.length &&
    new Set(activeSurfaceBindings).size === activeSurfaceBindings.length &&
    surfaces.every(
      (surface, index) =>
        surface.surfaceId === M41C_LEGACY_SURFACE_IDS[index] &&
        surface.failClosed &&
        surface.productionBlocked &&
        surface.rawLegacyRowsReturned === false &&
        surface.guardOrDispositionIds.length > 0 &&
        surface.governedReplacement.trim().length > 0 &&
        surface.disposition.trim().length > 0 &&
        surface.focusedRegressionTestIds.includes(
          M41C_LEGACY_SURFACE_QUARANTINE_TEST_ID,
        ) &&
        surface.focusedRegressionTestIds.some(
          (testId) => testId !== M41C_LEGACY_SURFACE_QUARANTINE_TEST_ID,
        ),
    ),
});
