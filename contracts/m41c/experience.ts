import type { M41bCadence, M41bWorkplan } from "../m41b";
import type { UserRole } from "../../src/constants/roles";
import type {
  M41cClinicalGovernanceCouncil,
  M41cCompetencyRegistry,
  M41cSignedValidationRecord,
} from "./governance";
import type {
  M41cInstrumentProfileRegistry,
  M41cInstrumentProfileSeparationResult,
} from "./instruments";
import type {
  M41cClinicalMonitoringResult,
  M41cFhirAlignedResourceType,
} from "./mappings";
import type {
  M41cContinuumEpisodeResult,
  M41cPathwayDefinition,
  M41cSyntheticScenario,
  M41cYouthPathwayPack,
} from "./pathways";
import type { M41cClinicalKnowledgeRegistryExport } from "./registry";
import type {
  M41cClinicalCitation,
  M41cClinicalRecommendation,
  M41cConsentState,
  M41cCriterionResult,
  M41cDemoBoundary,
  M41cEvidenceClass,
  M41cHumanGate,
  M41cIntegratedScenarioResult,
  M41cProhibitedAction,
} from "./shared";

export const M41C_CLINICAL_GUIDANCE_INTENTS = [
  "what_requires_attention",
  "why_flag_fired",
  "which_source_governs",
  "what_evidence_is_missing",
  "start_approved_workflow",
  "route_human_review",
] as const;
export type M41cClinicalGuidanceIntent =
  (typeof M41C_CLINICAL_GUIDANCE_INTENTS)[number];

export type M41cClinicalWorkplanAccessMode =
  | "clinical_detail"
  | "aggregate_governance"
  | "operational_handoff"
  | "suppressed";

export interface M41cClinicalWorkplanItem {
  id: string;
  cadence: M41bCadence;
  title: string;
  purpose: string;
  ownerRole: UserRole;
  accessMode: M41cClinicalWorkplanAccessMode;
  sourceIds: readonly string[];
  subjectIds: readonly string[];
  dueAt: string;
  status:
    | "ready_human_review"
    | "blocked_source_validation"
    | "operational_route_only"
    | "access_suppressed";
  requiredHumanApprover: readonly UserRole[];
  evidenceRequirements: readonly string[];
  missingEvidence: readonly string[];
  productionActionBlocked: true;
  evidenceClass: M41cEvidenceClass;
}

export interface M41cClinicalCadenceBrief {
  cadence: M41bCadence;
  title: string;
  purpose: string;
  items: readonly M41cClinicalWorkplanItem[];
  limitations: readonly string[];
}

export interface M41cClinicalWorkplan {
  milestone: "M4.1C";
  generatedAt: string;
  role: UserRole;
  baseWorkplan: M41bWorkplan;
  briefs: Readonly<Record<M41bCadence, M41cClinicalCadenceBrief>>;
  representedCadences: readonly M41bCadence[];
  allFiveCadences: true;
  productionActionsBlocked: true;
  evidenceClass: M41cEvidenceClass;
}

export interface M41cClinicalGuidanceInput {
  requestId: string;
  subjectId: string;
  prompt: string;
  intent: M41cClinicalGuidanceIntent;
  sourceIds?: readonly string[];
  workplanItemId?: string;
  requestedFields?: readonly string[];
  minimumNecessaryFields?: readonly string[];
  part2?: boolean;
  consentState?: M41cConsentState;
  createdAt?: string;
}

export interface M41cClinicalGuidanceResponse {
  responseId: string;
  requestId: string;
  intent: M41cClinicalGuidanceIntent;
  answer: string;
  nextSteps: readonly string[];
  citations: readonly M41cClinicalCitation[];
  missingEvidence: readonly string[];
  limitations: readonly string[];
  uncertainty: string | null;
  humanGate: M41cHumanGate;
  recommendation: M41cClinicalRecommendation | null;
  workplanItemId: string | null;
  refused: boolean;
  refusalCode: string | null;
  productionActionBlocked: true;
  evidenceClass: M41cEvidenceClass;
}

export interface M41cExperienceComponentStatus {
  criterionId: `M4.1C-${
    | "01"
    | "02"
    | "03"
    | "04"
    | "05"
    | "06"
    | "07"
    | "08"
    | "09"
    | "10"
    | "11"
    | "12"
    | "13"
    | "14"
    | "15"
    | "16"
    | "17"
    | "18"}`;
  title: string;
  status: "complete" | "blocked_authority" | "quarantined";
  summary: string;
  evidenceIds: readonly string[];
}

export interface M41cExperienceSnapshot {
  milestone: "M4.1C";
  generatedAt: string;
  environment: M41cDemoBoundary;
  council: M41cClinicalGovernanceCouncil;
  registry: M41cClinicalKnowledgeRegistryExport;
  instrumentRegistry: M41cInstrumentProfileRegistry;
  profileSeparation: M41cInstrumentProfileSeparationResult;
  signedValidationRecords: readonly M41cSignedValidationRecord[];
  competencyRegistry: M41cCompetencyRegistry;
  pathwayCatalog: readonly M41cPathwayDefinition[];
  youthPathwayPacks: readonly M41cYouthPathwayPack[];
  scenarioCatalog: readonly M41cSyntheticScenario[];
  continuum: M41cContinuumEpisodeResult;
  mapping: {
    resourceTypes: readonly M41cFhirAlignedResourceType[];
    bundleValid: boolean;
    cmbhsMode: "read_and_reconcile_simulator";
    cmbhsStatus: "reconciled" | "differences_pending" | "outage";
    externalWritesBlocked: true;
    conformanceClaimed: false;
  };
  monitoring: M41cClinicalMonitoringResult;
  components: readonly M41cExperienceComponentStatus[];
  counts: {
    sourceCount: number;
    knowledgeEntryCount: number;
    instrumentProfileCount: number;
    quarantineCount: number;
    pathwayCount: number;
    validationRecordCount: number;
    scenarioCount: number;
    cadenceCount: 5;
  };
  prohibitedActions: readonly M41cProhibitedAction[];
  productionRows: 0;
  liveWrites: 0;
  evidenceClass: M41cEvidenceClass;
}

export interface M41cSyntheticScenarioRunInput {
  scenarioId: string;
}

export interface M41cSyntheticScenarioRunResponse {
  runId: string;
  scenarioId: string;
  scenarioKind: M41cSyntheticScenario["kind"];
  status: "passed";
  summary: string;
  expectedControl: string;
  humanGateRequired: true;
  sourceIds: readonly string[];
  evidenceIds: readonly string[];
  auditEventIds: readonly string[];
  prohibitedActions: readonly M41cProhibitedAction[];
  productionRows: 0;
  liveWrites: 0;
  evidenceClass: M41cEvidenceClass;
}

export type M41cCriterionId = M41cCriterionResult["criterionId"];

export interface M41cAcceptanceAssertion {
  assertionId: string;
  description: string;
  passed: boolean;
  observed: string | number | boolean | null;
}

export interface M41cCriterionEvidence extends M41cCriterionResult {
  assertions: readonly M41cAcceptanceAssertion[];
  artifacts: Readonly<Record<string, unknown>>;
  productionRows: 0;
  liveWrites: 0;
  evidenceClass: M41cEvidenceClass;
}

export interface M41cExactAcceptanceResult {
  governedVersionedPathwayCatalog: boolean;
  longitudinalYouthRecord: boolean;
  allFiveCadences: boolean;
  trrDfpsProfilesDistinct: boolean;
  unapprovedLogicProductionBlocked: boolean;
  everyRecommendationSourcedAndHumanGated: boolean;
  allSyntheticScenariosPassed: boolean;
  everyActivatedPathwaySigned: boolean;
}

/**
 * Complete deterministic M4.1C acceptance result. Each criterion artifact is
 * derived from this single execution so evidence cannot drift between files.
 */
export interface M41cAcceptanceScenarioResult
  extends M41cIntegratedScenarioResult {
  snapshot: M41cExperienceSnapshot;
  workplans: readonly M41cClinicalWorkplan[];
  guidanceResponses: readonly M41cClinicalGuidanceResponse[];
  scenarioRuns: readonly M41cSyntheticScenarioRunResponse[];
  exactAcceptance: M41cExactAcceptanceResult;
  criterionEvidence: Readonly<
    Record<M41cCriterionId, M41cCriterionEvidence>
  >;
}
