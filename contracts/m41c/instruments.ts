import type { UserRole } from "../../src/constants/roles";
import type {
  M41cActivationState,
  M41cContentBinding,
  M41cEvidenceClass,
  M41cLicenseState,
  M41cPopulationScope,
} from "./shared";

export const M41C_INSTRUMENT_FAMILIES = [
  "trr_cans",
  "dfps_cans_3_0",
  "program_cans",
  "other_youth_measure",
  "synthetic_test_standin",
] as const;
export type M41cInstrumentFamily = (typeof M41C_INSTRUMENT_FAMILIES)[number];

export interface M41cInstrumentResponseOption {
  code: string;
  label: string;
  synthetic: true;
}

export interface M41cInstrumentItemDefinition {
  itemId: string;
  label: string;
  synthetic: true;
  responseOptions: readonly M41cInstrumentResponseOption[];
  missingDataBehavior: "block" | "route_human_review";
  safetyTriggerCodes: readonly string[];
}

export interface M41cInstrumentScoringPolicy {
  mode: "unavailable_metadata_only" | "synthetic_deterministic";
  version: string;
  totalScoreSeverityBandsPermitted: false;
  genericLevelOfCareMappingPermitted: false;
  autonomousLevelOfCarePermitted: false;
  humanInterpretationRequired: true;
  missingDataBehavior: "block" | "route_human_review";
  summary: string;
}

export interface M41cInstrumentCertificationRequirement {
  requirementId: string;
  title: string;
  requiredForAdministration: boolean;
  externalCertificationRequired: boolean;
  acceptedEvidenceTypes: readonly string[];
  renewalDays: number;
}

export interface M41cInstrumentExternalMapping {
  mappingId: string;
  targetSystem: "CMBHS" | "DFPS" | "FHIR" | "AMOS_OPS_INTERNAL";
  targetProfile: string;
  mappingVersion: string;
  readAvailableInDemo: boolean;
  writeAvailable: false;
  validated: boolean;
}

export interface M41cInstrumentProfile {
  profileId: string;
  family: M41cInstrumentFamily;
  title: string;
  version: string;
  purpose: string;
  programAuthority: string;
  ownerRole: UserRole;
  populationScope: M41cPopulationScope;
  sourceIds: readonly string[];
  contentBinding: M41cContentBinding;
  licenseState: M41cLicenseState;
  supportedLanguages: readonly string[];
  administrationCadence: readonly string[];
  responseOptionSetId: string | null;
  itemDefinitions: readonly M41cInstrumentItemDefinition[];
  scoringPolicy: M41cInstrumentScoringPolicy;
  certificationRequirements: readonly M41cInstrumentCertificationRequirement[];
  externalMappings: readonly M41cInstrumentExternalMapping[];
  safetyTriggerBehavior: "block_and_route" | "metadata_unavailable";
  activationState: M41cActivationState;
  governanceArtifactId: string;
  limitations: readonly string[];
  missingEvidence: readonly string[];
  syntheticStandin: boolean;
  productionAdministrationAvailable: false;
  productionScoringAvailable: false;
  evidenceClass: M41cEvidenceClass;
}

export const M41C_INSTRUMENT_VALIDATION_CHECKS = [
  "source_current",
  "version_verified",
  "population_validated",
  "age_setting_validated",
  "exact_wording_validated",
  "response_options_validated",
  "scoring_logic_validated",
  "language_validated",
  "license_validated",
  "qualification_defined",
  "missing_data_defined",
  "safety_triggers_defined",
  "external_mappings_distinct",
] as const;
export type M41cInstrumentValidationCheckId =
  (typeof M41C_INSTRUMENT_VALIDATION_CHECKS)[number];

export interface M41cInstrumentValidationCheck {
  checkId: M41cInstrumentValidationCheckId;
  passed: boolean;
  notes: readonly string[];
  evidenceIds: readonly string[];
}

export interface M41cInstrumentValidationResult {
  validationId: string;
  profileId: string;
  profileVersion: string;
  checks: readonly M41cInstrumentValidationCheck[];
  passed: boolean;
  eligibleForSyntheticDemoActivation: boolean;
  productionUseAuthorized: false;
  errors: readonly string[];
  warnings: readonly string[];
  evaluatedAt: string;
  evidenceClass: M41cEvidenceClass;
}

export type M41cQuarantineReasonCode =
  | "incomplete_instrument"
  | "unapproved_scoring_logic"
  | "homegrown_total_score_band"
  | "generic_level_of_care_mapping"
  | "license_unverified"
  | "source_expired"
  | "profile_conflict"
  | "emergency_withdrawal";

export interface M41cInstrumentQuarantineRecord {
  quarantineId: string;
  profileId: string;
  reasonCodes: readonly M41cQuarantineReasonCode[];
  rationale: string;
  detectedLogic: readonly string[];
  quarantinedBy: string;
  quarantinedByRole: UserRole;
  quarantinedAt: string;
  releaseRequirements: readonly string[];
  productionClinicalUseBlocked: true;
  syntheticDisplayOnly: boolean;
  immutable: true;
  evidenceClass: M41cEvidenceClass;
}

export interface M41cInstrumentProfileRegistry {
  registryId: string;
  registryVersion: string;
  generatedAt: string;
  profiles: readonly M41cInstrumentProfile[];
  quarantines: readonly M41cInstrumentQuarantineRecord[];
  productionActivationAvailable: false;
  evidenceClass: M41cEvidenceClass;
}

export interface M41cInstrumentProfileSeparationResult {
  trrProfileId: string;
  dfpsProfileId: string;
  distinct: boolean;
  differences: readonly string[];
  errors: readonly string[];
  evaluatedAt: string;
  evidenceClass: M41cEvidenceClass;
}
