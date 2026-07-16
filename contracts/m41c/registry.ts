import type { UserRole } from "../../src/constants/roles";
import type { M41bCadence } from "../m41b";
import type {
  M41cActivationState,
  M41cClinicalSource,
  M41cEvidenceClass,
  M41cHumanGate,
  M41cPopulationScope,
} from "./shared";

export const M41C_KNOWLEDGE_KINDS = [
  "instrument_metadata",
  "algorithm_descriptor",
  "guideline",
  "pathway",
  "knowledge_pack",
] as const;
export type M41cKnowledgeKind = (typeof M41C_KNOWLEDGE_KINDS)[number];

export interface M41cKnowledgeInputDefinition {
  inputId: string;
  label: string;
  dataType: "boolean" | "number" | "string" | "coded" | "date";
  required: boolean;
  missingDataBehavior: "block" | "route_human_review" | "mark_unknown";
  allowedValues: readonly string[];
  sourceField: string | null;
}

export interface M41cDecisionLogicDescriptor {
  logicId: string;
  logicType: "metadata_only" | "synthetic_deterministic" | "human_review_only";
  version: string;
  executableInSyntheticDemo: boolean;
  executableInProduction: false;
  humanReviewRequired: true;
  scoringOrDecisionSummary: string;
  prohibitedUses: readonly string[];
}

export interface M41cEscalationRuleDescriptor {
  ruleId: string;
  triggerSummary: string;
  routeToRoles: readonly UserRole[];
  immediate: boolean;
  automatedDispositionAvailable: false;
  sourceIds: readonly string[];
}

export interface M41cWorkplanEventBinding {
  eventId: string;
  cadence: M41bCadence;
  triggerSummary: string;
  ownerRoles: readonly UserRole[];
  humanApprovalRequired: true;
  completionEvidenceRequired: true;
}

export interface M41cClinicalKnowledgeEntry {
  entryId: string;
  kind: M41cKnowledgeKind;
  title: string;
  version: string;
  ownerRole: UserRole;
  populationScope: M41cPopulationScope;
  exclusions: readonly string[];
  sourceIds: readonly string[];
  licenseSummary: string;
  effectiveAt: string | null;
  reviewedAt: string;
  reviewDueAt: string;
  activationState: M41cActivationState;
  inputDefinitions: readonly M41cKnowledgeInputDefinition[];
  decisionLogic: M41cDecisionLogicDescriptor;
  escalationRules: readonly M41cEscalationRuleDescriptor[];
  requiredHumanApprover: readonly UserRole[];
  humanGateTemplate: M41cHumanGate;
  workplanEvents: readonly M41cWorkplanEventBinding[];
  auditEventIds: readonly string[];
  demoTestIds: readonly string[];
  limitations: readonly string[];
  missingEvidence: readonly string[];
  productionActivationAvailable: false;
  evidenceClass: M41cEvidenceClass;
}

export interface M41cClinicalKnowledgeRegistry {
  registryId: string;
  registryVersion: string;
  generatedAt: string;
  sources: readonly M41cClinicalSource[];
  entries: readonly M41cClinicalKnowledgeEntry[];
  productionActivationAvailable: false;
  evidenceClass: M41cEvidenceClass;
}

export interface M41cRegistryEntryValidation {
  entryId: string;
  valid: boolean;
  eligibleForSyntheticDemo: boolean;
  productionUseAuthorized: false;
  errors: readonly string[];
  warnings: readonly string[];
  evaluatedAt: string;
}

export interface M41cClinicalKnowledgeRegistryExport {
  registryId: string;
  registryVersion: string;
  generatedAt: string;
  sourceCount: number;
  entryCount: number;
  sources: readonly M41cClinicalSource[];
  entries: readonly M41cClinicalKnowledgeEntry[];
  validations: readonly M41cRegistryEntryValidation[];
  productionActivationAvailable: false;
  evidenceClass: M41cEvidenceClass;
}
