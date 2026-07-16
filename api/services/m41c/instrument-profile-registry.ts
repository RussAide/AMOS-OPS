import {
  M41C_EVALUATION_AS_OF,
  M41C_EVIDENCE_CLASS,
  type M41cClinicalSource,
} from "@contracts/m41c/shared";
import {
  M41C_INSTRUMENT_VALIDATION_CHECKS,
  type M41cInstrumentExternalMapping,
  type M41cInstrumentProfile,
  type M41cInstrumentProfileRegistry,
  type M41cInstrumentProfileSeparationResult,
  type M41cInstrumentQuarantineRecord,
  type M41cInstrumentValidationCheck,
  type M41cInstrumentValidationCheckId,
  type M41cInstrumentValidationResult,
  type M41cQuarantineReasonCode,
} from "@contracts/m41c/instruments";
import type {
  M41cCompetencyGateResult,
  M41cSignedValidationRecord,
} from "@contracts/m41c/governance";
import {
  m41cDeterministicId,
  verifyM41cSignedValidationRecord,
} from "./clinical-governance";

function scope(program: string, setting: string) {
  return Object.freeze({
    population: Object.freeze(["synthetic youth evaluation records"]),
    minimumAge: 3,
    maximumAge: 20,
    settings: Object.freeze([setting]),
    programs: Object.freeze([program]),
    exclusions: Object.freeze(["real patient or client records"]),
    languages: Object.freeze(["synthetic English test content"]),
  });
}

function unavailableScoring(summary: string) {
  return Object.freeze({
    mode: "unavailable_metadata_only" as const,
    version: "UNAVAILABLE",
    totalScoreSeverityBandsPermitted: false as const,
    genericLevelOfCareMappingPermitted: false as const,
    autonomousLevelOfCarePermitted: false as const,
    humanInterpretationRequired: true as const,
    missingDataBehavior: "block" as const,
    summary,
  });
}

function metadataContent() {
  return Object.freeze({
    contentAvailable: false,
    contentHash: null,
    exactWordingValidated: false,
    responseOptionsValidated: false,
    scoringLogicValidated: false,
    proprietaryContentStored: false as const,
  });
}

function mapping(
  mappingId: string,
  targetSystem: M41cInstrumentExternalMapping["targetSystem"],
  targetProfile: string,
  validated: boolean,
): M41cInstrumentExternalMapping {
  return Object.freeze({
    mappingId,
    targetSystem,
    targetProfile,
    mappingVersion: "SYNTH-METADATA-1.0",
    readAvailableInDemo: false,
    writeAvailable: false,
    validated,
  });
}

export function createSyntheticM41cInstrumentProfileRegistry(): M41cInstrumentProfileRegistry {
  const trr: M41cInstrumentProfile = Object.freeze({
    profileId: "M41C-INSTRUMENT-TRR-CANS",
    family: "trr_cans",
    title: "TRR CANS governed metadata profile",
    version: "Internal document update 2016; freshness review required",
    purpose:
      "Maintain a distinct placeholder for future governed TRR assessment, recovery planning, review, and external reconciliation configuration.",
    programAuthority: "TRR profile authority pending validation",
    ownerRole: "clinical-director",
    populationScope: scope(
      "Texas Resilience and Recovery metadata profile",
      "behavioral health synthetic demo",
    ),
    sourceIds: Object.freeze(["M41C-SRC-TRR-CANS-METADATA"]),
    contentBinding: metadataContent(),
    licenseState: "metadata_only",
    supportedLanguages: Object.freeze([]),
    administrationCadence: Object.freeze([
      "initial assessment metadata pending",
      "reassessment cadence pending authority validation",
    ]),
    responseOptionSetId: "M41C-TRR-CANS-RESPONSE-SET-PENDING",
    itemDefinitions: Object.freeze([]),
    scoringPolicy: unavailableScoring(
      "No TRR CANS scoring or level-of-care logic is stored or executable.",
    ),
    certificationRequirements: Object.freeze([
      Object.freeze({
        requirementId: "M41C-COMP-TRR-CANS-CERTIFICATION",
        title: "Current TRR CANS certification evidence",
        requiredForAdministration: true,
        externalCertificationRequired: true,
        acceptedEvidenceTypes: Object.freeze([
          "authoritative certification record",
        ]),
        renewalDays: 365,
      }),
    ]),
    externalMappings: Object.freeze([
      mapping("M41C-MAP-TRR-CANS-CMBHS", "CMBHS", "TRR_CANS_PENDING", false),
      mapping("M41C-MAP-TRR-CANS-FHIR", "FHIR", "TRR_CANS_PENDING", false),
    ]),
    safetyTriggerBehavior: "metadata_unavailable",
    activationState: "validation_pending",
    governanceArtifactId: "M41C-GOV-INSTRUMENT-TRR-CANS",
    limitations: Object.freeze([
      "Metadata only; licensed content, anchors, scoring, and decision support are unavailable.",
    ]),
    missingEvidence: Object.freeze([
      "formal freshness validation against current program authority",
      "licensed exact wording and response options",
      "approved scoring and decision-support rules",
      "validated external mapping",
    ]),
    syntheticStandin: false,
    productionAdministrationAvailable: false,
    productionScoringAvailable: false,
    evidenceClass: M41C_EVIDENCE_CLASS,
  });

  const dfps: M41cInstrumentProfile = Object.freeze({
    profileId: "M41C-INSTRUMENT-DFPS-CANS-3",
    family: "dfps_cans_3_0",
    title: "DFPS CANS 3.0 governed metadata profile",
    version: "3.0 (2024)",
    purpose:
      "Maintain a distinct placeholder for future governed child-welfare assessment, placement, service-planning, and DFPS mapping configuration.",
    programAuthority: "DFPS profile authority pending validation",
    ownerRole: "clinical-director",
    populationScope: scope(
      "DFPS CANS 3.0 metadata profile",
      "child welfare synthetic demo",
    ),
    sourceIds: Object.freeze(["M41C-SRC-DFPS-CANS-3-METADATA"]),
    contentBinding: metadataContent(),
    licenseState: "metadata_only",
    supportedLanguages: Object.freeze([]),
    administrationCadence: Object.freeze([
      "program-specific cadence pending authority validation",
    ]),
    responseOptionSetId: "M41C-DFPS-CANS-3-RESPONSE-SET-PENDING",
    itemDefinitions: Object.freeze([]),
    scoringPolicy: unavailableScoring(
      "No DFPS CANS 3.0 scoring or disposition logic is stored or executable.",
    ),
    certificationRequirements: Object.freeze([
      Object.freeze({
        requirementId: "M41C-COMP-DFPS-CANS-3-CERTIFICATION",
        title: "Current DFPS CANS 3.0 qualification and certification evidence",
        requiredForAdministration: true,
        externalCertificationRequired: true,
        acceptedEvidenceTypes: Object.freeze([
          "authoritative certification record",
        ]),
        renewalDays: 365,
      }),
    ]),
    externalMappings: Object.freeze([
      mapping("M41C-MAP-DFPS-CANS-3", "DFPS", "DFPS_CANS_3_PENDING", false),
      mapping(
        "M41C-MAP-DFPS-CANS-3-FHIR",
        "FHIR",
        "DFPS_CANS_3_PENDING",
        false,
      ),
    ]),
    safetyTriggerBehavior: "metadata_unavailable",
    activationState: "validation_pending",
    governanceArtifactId: "M41C-GOV-INSTRUMENT-DFPS-CANS-3",
    limitations: Object.freeze([
      "Metadata only; licensed content, anchors, scoring, and decision support are unavailable.",
    ]),
    missingEvidence: Object.freeze([
      "terms and third-party rights validation",
      "licensed exact wording and response options",
      "approved scoring and decision-support rules",
      "validated external mapping",
    ]),
    syntheticStandin: false,
    productionAdministrationAvailable: false,
    productionScoringAvailable: false,
    evidenceClass: M41C_EVIDENCE_CLASS,
  });

  const standin: M41cInstrumentProfile = Object.freeze({
    profileId: "SYNTH-M41C-INSTRUMENT-STANDIN",
    family: "synthetic_test_standin",
    title: "M4.1C deterministic synthetic instrument stand-in",
    version: "SYNTH-1.0",
    purpose:
      "Exercise validation, safety routing, human approval, competency, and audit boundaries without representing a clinical instrument.",
    programAuthority: "AMOS-OPS synthetic evaluation control",
    ownerRole: "clinical-director",
    populationScope: scope("M4.1C", "synthetic demo"),
    sourceIds: Object.freeze([
      "M41C-SRC-CONTROLLING-DOCTRINE",
      "M41C-SRC-SYNTHETIC-INSTRUMENT-STANDIN",
    ]),
    contentBinding: Object.freeze({
      contentAvailable: true,
      contentHash: "sha256:SYNTHETIC-M41C-INSTRUMENT-STANDIN",
      exactWordingValidated: true,
      responseOptionsValidated: true,
      scoringLogicValidated: true,
      proprietaryContentStored: false,
    }),
    licenseState: "not_required",
    supportedLanguages: Object.freeze(["synthetic English test content"]),
    administrationCadence: Object.freeze(["on deterministic scenario launch"]),
    responseOptionSetId: "SYNTH-M41C-RESPONSE-SET-1",
    itemDefinitions: Object.freeze([
      Object.freeze({
        itemId: "SYNTH-SIGNAL-A",
        label: "Synthetic signal A",
        synthetic: true as const,
        responseOptions: Object.freeze([
          Object.freeze({
            code: "none",
            label: "No synthetic signal",
            synthetic: true as const,
          }),
          Object.freeze({
            code: "present",
            label: "Synthetic signal present",
            synthetic: true as const,
          }),
          Object.freeze({
            code: "urgent",
            label: "Synthetic urgent route",
            synthetic: true as const,
          }),
        ]),
        missingDataBehavior: "block" as const,
        safetyTriggerCodes: Object.freeze(["urgent"]),
      }),
      Object.freeze({
        itemId: "SYNTH-SIGNAL-B",
        label: "Synthetic signal B",
        synthetic: true as const,
        responseOptions: Object.freeze([
          Object.freeze({
            code: "none",
            label: "No synthetic signal",
            synthetic: true as const,
          }),
          Object.freeze({
            code: "present",
            label: "Synthetic signal present",
            synthetic: true as const,
          }),
        ]),
        missingDataBehavior: "route_human_review" as const,
        safetyTriggerCodes: Object.freeze([]),
      }),
    ]),
    scoringPolicy: Object.freeze({
      mode: "synthetic_deterministic",
      version: "SYNTH-1.0",
      totalScoreSeverityBandsPermitted: false,
      genericLevelOfCareMappingPermitted: false,
      autonomousLevelOfCarePermitted: false,
      humanInterpretationRequired: true,
      missingDataBehavior: "block",
      summary:
        "Validate and echo synthetic codes; urgent routes a human review. No clinical score, severity, diagnosis, or level of care is produced.",
    }),
    certificationRequirements: Object.freeze([
      Object.freeze({
        requirementId: "M41C-COMP-SYNTHETIC-INSTRUMENT-USER",
        title: "Synthetic instrument supervised-use competency",
        requiredForAdministration: true,
        externalCertificationRequired: false,
        acceptedEvidenceTypes: Object.freeze([
          "synthetic training completion",
          "supervisor attestation",
        ]),
        renewalDays: 180,
      }),
    ]),
    externalMappings: Object.freeze([
      Object.freeze({
        mappingId: "SYNTH-M41C-MAP-INTERNAL",
        targetSystem: "AMOS_OPS_INTERNAL",
        targetProfile: "SYNTHETIC_STANDIN_ONLY",
        mappingVersion: "SYNTH-1.0",
        readAvailableInDemo: true,
        writeAvailable: false,
        validated: true,
      }),
    ]),
    safetyTriggerBehavior: "block_and_route",
    activationState: "validation_pending",
    governanceArtifactId: "SYNTH-M41C-GOV-INSTRUMENT-STANDIN",
    limitations: Object.freeze([
      "Not a clinical instrument and cannot support real care.",
    ]),
    missingEvidence: Object.freeze([]),
    syntheticStandin: true,
    productionAdministrationAvailable: false,
    productionScoringAvailable: false,
    evidenceClass: M41C_EVIDENCE_CLASS,
  });

  const legacy: M41cInstrumentProfile = Object.freeze({
    profileId: "LEGACY-M21-CANS-TOTAL-SCORE-ROUTING",
    family: "program_cans",
    title: "Legacy M2.1 synthetic CANS routing compatibility record",
    version: "CANS-SYNTHETIC-2026.1",
    purpose:
      "Retain an immutable compatibility reference for regression while preventing it from driving M4.1C clinical use.",
    programAuthority: "Legacy synthetic prototype",
    ownerRole: "clinical-director",
    populationScope: scope("legacy M2.1", "synthetic regression only"),
    sourceIds: Object.freeze(["M41C-SRC-CONTROLLING-DOCTRINE"]),
    contentBinding: metadataContent(),
    licenseState: "restricted",
    supportedLanguages: Object.freeze([]),
    administrationCadence: Object.freeze([]),
    responseOptionSetId: null,
    itemDefinitions: Object.freeze([]),
    scoringPolicy: unavailableScoring(
      "Legacy total-score severity and generic routing behavior is not executable through M4.1C.",
    ),
    certificationRequirements: Object.freeze([]),
    externalMappings: Object.freeze([]),
    safetyTriggerBehavior: "metadata_unavailable",
    activationState: "quarantined",
    governanceArtifactId: "M41C-GOV-LEGACY-M21-CANS-ROUTING",
    limitations: Object.freeze(["Regression reference only."]),
    missingEvidence: Object.freeze([
      "approved item-level clinical governance",
      "validated program-specific mapping",
    ]),
    syntheticStandin: false,
    productionAdministrationAvailable: false,
    productionScoringAvailable: false,
    evidenceClass: M41C_EVIDENCE_CLASS,
  });

  const quarantine: M41cInstrumentQuarantineRecord = Object.freeze({
    quarantineId: "SYNTH-M41C-QUARANTINE-LEGACY-M21-CANS",
    profileId: legacy.profileId,
    reasonCodes: Object.freeze([
      "unapproved_scoring_logic" as const,
      "homegrown_total_score_band" as const,
      "generic_level_of_care_mapping" as const,
    ]),
    rationale:
      "Legacy synthetic total-score acuity bands and generic routing are preserved for regression but cannot drive M4.1C clinical use.",
    detectedLogic: Object.freeze([
      "totalScore acuity bands",
      "low/moderate/high/critical synthetic severity",
      "hard-coded MHTCM/MHRS goal routing",
      "generic level-of-care inference",
      "contracts/ccmg/cans-routing.ts regression-only routing reference",
      "api/routers/bhc.ts inherited CANS record and scoring surfaces",
      "api/routers/m14.ts inherited score, derived-risk, and generic LOC fields",
      "api/routers/m21.ts synthetic regression boundary",
      "api/routers/mhtcm.ts inherited CANS and generic LOC inputs",
      "src/pages/clinical/cans-assessment-page.tsx quarantined route",
      "src/pages/toolkits/cans-assessment-page.tsx quarantined route",
      "src/pages/clinical/clinical-workspace-page.tsx scoring removed",
      "src/pages/intake/assessment-page.tsx narrative-only replacement",
      "legacy database columns retained for read compatibility only",
    ]),
    quarantinedBy: "SYNTH-HUMAN-CLINICAL-DIRECTOR",
    quarantinedByRole: "clinical-director",
    quarantinedAt: M41C_EVALUATION_AS_OF,
    releaseRequirements: Object.freeze([
      "replace with a program-specific governed profile",
      "validate authoritative source, license, wording, responses, and scoring",
      "obtain signed Clinical Governance Council validation",
      "pass role competency and synthetic golden cases",
    ]),
    productionClinicalUseBlocked: true,
    syntheticDisplayOnly: true,
    immutable: true,
    evidenceClass: M41C_EVIDENCE_CLASS,
  });

  return Object.freeze({
    registryId: "SYNTH-M41C-INSTRUMENT-PROFILE-REGISTRY",
    registryVersion: "M4.1C-SYNTH-1.0",
    generatedAt: M41C_EVALUATION_AS_OF,
    profiles: Object.freeze([trr, dfps, standin, legacy]),
    quarantines: Object.freeze([quarantine]),
    productionActivationAvailable: false,
    evidenceClass: M41C_EVIDENCE_CLASS,
  });
}

function check(
  checkId: M41cInstrumentValidationCheckId,
  passed: boolean,
  notes: readonly string[],
  evidenceIds: readonly string[],
): M41cInstrumentValidationCheck {
  return Object.freeze({
    checkId,
    passed,
    notes: Object.freeze([...notes]),
    evidenceIds: Object.freeze([...evidenceIds]),
  });
}

export function validateM41cInstrumentProfile(
  profile: M41cInstrumentProfile,
  sources: readonly M41cClinicalSource[],
  evaluatedAt = M41C_EVALUATION_AS_OF,
): M41cInstrumentValidationResult {
  const boundSources = profile.sourceIds.map((sourceId) =>
    sources.find((candidate) => candidate.id === sourceId),
  );
  const sourceCurrent =
    boundSources.length > 0 &&
    boundSources.every((sourceRecord) => sourceRecord?.state === "current");
  const versionVerified =
    profile.version.trim().length > 0 &&
    !profile.version.includes("UNVERIFIED") &&
    !profile.missingEvidence.some((value) => value.includes("version"));
  const populationValidated =
    profile.populationScope.population.length > 0 &&
    profile.populationScope.programs.length > 0;
  const ageSettingValidated =
    profile.populationScope.minimumAge !== null &&
    profile.populationScope.maximumAge !== null &&
    profile.populationScope.minimumAge <= profile.populationScope.maximumAge &&
    profile.populationScope.settings.length > 0;
  const exactWordingValidated =
    profile.contentBinding.contentAvailable &&
    profile.contentBinding.exactWordingValidated &&
    profile.contentBinding.contentHash !== null;
  const responseOptionsValidated =
    profile.contentBinding.responseOptionsValidated &&
    profile.itemDefinitions.length > 0 &&
    profile.itemDefinitions.every((item) => item.responseOptions.length > 0);
  const scoringLogicValidated =
    profile.contentBinding.scoringLogicValidated &&
    profile.scoringPolicy.mode === "synthetic_deterministic" &&
    !profile.scoringPolicy.totalScoreSeverityBandsPermitted &&
    !profile.scoringPolicy.genericLevelOfCareMappingPermitted &&
    !profile.scoringPolicy.autonomousLevelOfCarePermitted;
  const languageValidated = profile.supportedLanguages.length > 0;
  const licenseValidated =
    profile.licenseState === "not_required" ||
    profile.licenseState === "licensed_demo";
  const qualificationDefined =
    profile.certificationRequirements.length > 0 &&
    profile.certificationRequirements.every(
      (requirement) => requirement.acceptedEvidenceTypes.length > 0,
    );
  const missingDataDefined =
    Boolean(profile.scoringPolicy.missingDataBehavior) &&
    profile.itemDefinitions.every((item) => Boolean(item.missingDataBehavior));
  const safetyTriggersDefined =
    profile.safetyTriggerBehavior === "block_and_route" &&
    profile.itemDefinitions.some((item) => item.safetyTriggerCodes.length > 0);
  const externalMappingsDistinct =
    profile.externalMappings.length > 0 &&
    new Set(profile.externalMappings.map((entry) => entry.mappingId)).size ===
      profile.externalMappings.length &&
    profile.externalMappings.every(
      (entry) => entry.validated && entry.writeAvailable === false,
    );
  const values: Readonly<Record<M41cInstrumentValidationCheckId, boolean>> = {
    source_current: sourceCurrent,
    version_verified: versionVerified,
    population_validated: populationValidated,
    age_setting_validated: ageSettingValidated,
    exact_wording_validated: exactWordingValidated,
    response_options_validated: responseOptionsValidated,
    scoring_logic_validated: scoringLogicValidated,
    language_validated: languageValidated,
    license_validated: licenseValidated,
    qualification_defined: qualificationDefined,
    missing_data_defined: missingDataDefined,
    safety_triggers_defined: safetyTriggersDefined,
    external_mappings_distinct: externalMappingsDistinct,
  };
  const checks = Object.freeze(
    M41C_INSTRUMENT_VALIDATION_CHECKS.map((checkId) =>
      check(
        checkId,
        values[checkId],
        values[checkId] ? ["validated"] : ["validation evidence incomplete"],
        values[checkId] ? [`${profile.profileId}-${checkId}`] : [],
      ),
    ),
  );
  const failed = checks.filter((candidate) => !candidate.passed);
  const errors = Object.freeze(
    failed.map((candidate) => `VALIDATION_FAILED:${candidate.checkId}`),
  );
  const warnings = Object.freeze([...profile.missingEvidence]);
  const passed = failed.length === 0 && profile.missingEvidence.length === 0;
  return Object.freeze({
    validationId: m41cDeterministicId(
      "M41C-INSTRUMENT-VALIDATION",
      profile.profileId,
      profile.version,
      evaluatedAt,
    ),
    profileId: profile.profileId,
    profileVersion: profile.version,
    checks,
    passed,
    eligibleForSyntheticDemoActivation:
      passed &&
      profile.syntheticStandin &&
      profile.activationState !== "quarantined",
    productionUseAuthorized: false,
    errors,
    warnings,
    evaluatedAt,
    evidenceClass: M41C_EVIDENCE_CLASS,
  });
}

export function verifyM41cTrRAndDfpsProfileSeparation(
  registry: M41cInstrumentProfileRegistry,
  evaluatedAt = registry.generatedAt,
): M41cInstrumentProfileSeparationResult {
  const trr = registry.profiles.find(
    (profile) => profile.family === "trr_cans",
  );
  const dfps = registry.profiles.find(
    (profile) => profile.family === "dfps_cans_3_0",
  );
  const errors: string[] = [];
  const differences: string[] = [];
  if (!trr) errors.push("TRR_CANS_PROFILE_MISSING");
  if (!dfps) errors.push("DFPS_CANS_3_PROFILE_MISSING");
  if (trr && dfps) {
    if (trr.profileId !== dfps.profileId) differences.push("profile_id");
    if (trr.family !== dfps.family) differences.push("family");
    if (trr.purpose !== dfps.purpose) differences.push("purpose");
    if (trr.programAuthority !== dfps.programAuthority)
      differences.push("program_authority");
    if (
      trr.populationScope.programs.join("|") !==
      dfps.populationScope.programs.join("|")
    )
      differences.push("program_scope");
    if (
      trr.certificationRequirements
        .map((value) => value.requirementId)
        .join("|") !==
      dfps.certificationRequirements
        .map((value) => value.requirementId)
        .join("|")
    )
      differences.push("certification");
    const trrMappings = trr.externalMappings.map(
      (value) => value.targetProfile,
    );
    const dfpsMappings = dfps.externalMappings.map(
      (value) => value.targetProfile,
    );
    if (trrMappings.join("|") !== dfpsMappings.join("|"))
      differences.push("external_mapping");
    if (trr.responseOptionSetId === dfps.responseOptionSetId)
      errors.push("PROFILE_RESPONSE_OPTIONS_NOT_SEPARATELY_BOUND");
    if (trr.governanceArtifactId === dfps.governanceArtifactId)
      errors.push("PROFILE_GOVERNANCE_ARTIFACT_SHARED");
    if (trr.sourceIds.some((sourceId) => dfps.sourceIds.includes(sourceId)))
      errors.push("PROFILE_AUTHORITATIVE_SOURCE_SHARED");
  }
  return Object.freeze({
    trrProfileId: trr?.profileId ?? "MISSING",
    dfpsProfileId: dfps?.profileId ?? "MISSING",
    distinct: errors.length === 0 && differences.length >= 6,
    differences: Object.freeze(differences),
    errors: Object.freeze(errors),
    evaluatedAt,
    evidenceClass: M41C_EVIDENCE_CLASS,
  });
}

export interface QuarantineM41cInstrumentInput {
  reasonCodes: readonly M41cQuarantineReasonCode[];
  rationale: string;
  detectedLogic: readonly string[];
  quarantinedBy: string;
  quarantinedByRole: M41cInstrumentQuarantineRecord["quarantinedByRole"];
  quarantinedAt: string;
  releaseRequirements: readonly string[];
  syntheticDisplayOnly?: boolean;
}

export function quarantineM41cInstrumentProfile(
  registry: M41cInstrumentProfileRegistry,
  profileId: string,
  input: QuarantineM41cInstrumentInput,
): M41cInstrumentProfileRegistry {
  const profile = registry.profiles.find(
    (candidate) => candidate.profileId === profileId,
  );
  if (!profile) throw new Error("M41C_INSTRUMENT_PROFILE_NOT_FOUND");
  if (input.reasonCodes.length === 0)
    throw new Error("M41C_QUARANTINE_REASON_REQUIRED");
  if (!input.rationale.trim())
    throw new Error("M41C_QUARANTINE_RATIONALE_REQUIRED");
  if (!input.quarantinedBy.startsWith("SYNTH-HUMAN-"))
    throw new Error("M41C_QUARANTINE_HUMAN_ACTOR_REQUIRED");
  const updatedProfile = Object.freeze({
    ...profile,
    activationState: "quarantined" as const,
  });
  const quarantine: M41cInstrumentQuarantineRecord = Object.freeze({
    quarantineId: m41cDeterministicId(
      "M41C-QUARANTINE",
      profileId,
      input.reasonCodes.join(","),
      input.quarantinedAt,
    ),
    profileId,
    reasonCodes: Object.freeze([...new Set(input.reasonCodes)]),
    rationale: input.rationale,
    detectedLogic: Object.freeze([...input.detectedLogic]),
    quarantinedBy: input.quarantinedBy,
    quarantinedByRole: input.quarantinedByRole,
    quarantinedAt: input.quarantinedAt,
    releaseRequirements: Object.freeze([...input.releaseRequirements]),
    productionClinicalUseBlocked: true,
    syntheticDisplayOnly: input.syntheticDisplayOnly ?? true,
    immutable: true,
    evidenceClass: M41C_EVIDENCE_CLASS,
  });
  return Object.freeze({
    ...registry,
    profiles: Object.freeze(
      registry.profiles.map((candidate) =>
        candidate.profileId === profileId ? updatedProfile : candidate,
      ),
    ),
    quarantines: Object.freeze([...registry.quarantines, quarantine]),
  });
}

export interface ActivateM41cInstrumentInput {
  target: "synthetic_demo" | "production";
  validation: M41cInstrumentValidationResult;
  signedValidation: M41cSignedValidationRecord;
  competencyGate: M41cCompetencyGateResult;
}

export function activateM41cInstrumentProfile(
  registry: M41cInstrumentProfileRegistry,
  profileId: string,
  input: ActivateM41cInstrumentInput,
): M41cInstrumentProfileRegistry {
  if (input.target === "production")
    throw new Error("M41C_PRODUCTION_INSTRUMENT_ACTIVATION_UNAVAILABLE");
  const profile = registry.profiles.find(
    (candidate) => candidate.profileId === profileId,
  );
  if (!profile) throw new Error("M41C_INSTRUMENT_PROFILE_NOT_FOUND");
  if (registry.quarantines.some((record) => record.profileId === profileId))
    throw new Error("M41C_QUARANTINED_INSTRUMENT_ACTIVATION_DENIED");
  if (
    !input.validation.passed ||
    !input.validation.eligibleForSyntheticDemoActivation ||
    input.validation.profileId !== profile.profileId ||
    input.validation.profileVersion !== profile.version
  )
    throw new Error("M41C_INSTRUMENT_PREACTIVATION_VALIDATION_REQUIRED");
  const requiredCompetencyIds = profile.certificationRequirements
    .filter((requirement) => requirement.requiredForAdministration)
    .map((requirement) => requirement.requirementId);
  if (
    !input.competencyGate.passedForSyntheticDemo ||
    input.competencyGate.productionUseAuthorized !== false ||
    input.competencyGate.evidenceClass !== M41C_EVIDENCE_CLASS ||
    !input.competencyGate.staffId.startsWith("SYNTH-HUMAN-") ||
    requiredCompetencyIds.length === 0 ||
    requiredCompetencyIds.some(
      (requirementId) =>
        !input.competencyGate.requirementIds.includes(requirementId) ||
        !input.competencyGate.satisfiedRequirementIds.includes(requirementId),
    ) ||
    input.competencyGate.missingRequirementIds.length > 0 ||
    input.competencyGate.expiredRequirementIds.length > 0 ||
    input.competencyGate.roleMismatchRequirementIds.length > 0
  )
    throw new Error("M41C_INSTRUMENT_COMPETENCY_GATE_REQUIRED");
  const validationErrors = verifyM41cSignedValidationRecord(
    input.signedValidation,
  );
  if (validationErrors.length > 0)
    throw new Error("M41C_INSTRUMENT_SIGNED_VALIDATION_INVALID");
  if (
    input.signedValidation.artifactId !== profile.governanceArtifactId ||
    input.signedValidation.artifactKind !== "instrument" ||
    input.signedValidation.artifactVersion !== profile.version
  )
    throw new Error("M41C_INSTRUMENT_GOVERNANCE_VALIDATION_MISMATCH");
  if (!profile.syntheticStandin)
    throw new Error("M41C_METADATA_ONLY_INSTRUMENT_ACTIVATION_DENIED");

  return Object.freeze({
    ...registry,
    profiles: Object.freeze(
      registry.profiles.map((candidate) =>
        candidate.profileId === profileId
          ? Object.freeze({
              ...candidate,
              activationState: "demo_approved" as const,
            })
          : candidate,
      ),
    ),
  });
}

export interface M41cSyntheticInstrumentEvaluation {
  evaluationId: string;
  profileId: string;
  responseCodes: Readonly<Record<string, string>>;
  safetyTriggered: boolean;
  routeToHumanReview: true;
  clinicalScore: null;
  diagnosis: null;
  levelOfCare: null;
  productionEffect: false;
  evaluatedAt: string;
  evidenceClass: typeof M41C_EVIDENCE_CLASS;
}

export function evaluateM41cSyntheticInstrumentStandin(
  registry: M41cInstrumentProfileRegistry,
  profileId: string,
  responseCodes: Readonly<Record<string, string>>,
  evaluatedAt = M41C_EVALUATION_AS_OF,
): M41cSyntheticInstrumentEvaluation {
  const profile = registry.profiles.find(
    (candidate) => candidate.profileId === profileId,
  );
  if (!profile) throw new Error("M41C_INSTRUMENT_PROFILE_NOT_FOUND");
  if (profile.activationState !== "demo_approved" || !profile.syntheticStandin)
    throw new Error("M41C_INSTRUMENT_NOT_APPROVED_FOR_SYNTHETIC_DEMO");
  const allowedItemIds = new Set(
    profile.itemDefinitions.map((item) => item.itemId),
  );
  const unknownItemIds = Object.keys(responseCodes).filter(
    (itemId) => !allowedItemIds.has(itemId),
  );
  if (unknownItemIds.length > 0) {
    throw new Error(
      `M41C_INSTRUMENT_RESPONSE_ITEM_UNKNOWN:${unknownItemIds.sort().join(",")}`,
    );
  }
  for (const item of profile.itemDefinitions) {
    const response = responseCodes[item.itemId];
    if (!response)
      throw new Error(`M41C_INSTRUMENT_RESPONSE_REQUIRED:${item.itemId}`);
    if (!item.responseOptions.some((option) => option.code === response))
      throw new Error(`M41C_INSTRUMENT_RESPONSE_INVALID:${item.itemId}`);
  }
  const safetyTriggered = profile.itemDefinitions.some((item) =>
    item.safetyTriggerCodes.includes(responseCodes[item.itemId] ?? ""),
  );
  return Object.freeze({
    evaluationId: m41cDeterministicId(
      "M41C-STANDIN-EVALUATION",
      profileId,
      JSON.stringify(responseCodes),
      evaluatedAt,
    ),
    profileId,
    responseCodes: Object.freeze({ ...responseCodes }),
    safetyTriggered,
    routeToHumanReview: true,
    clinicalScore: null,
    diagnosis: null,
    levelOfCare: null,
    productionEffect: false,
    evaluatedAt,
    evidenceClass: M41C_EVIDENCE_CLASS,
  });
}
