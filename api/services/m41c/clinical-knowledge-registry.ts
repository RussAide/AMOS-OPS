import {
  M41C_DEMO_BOUNDARY,
  M41C_EVALUATION_AS_OF,
  M41C_EVIDENCE_CLASS,
  type M41cClinicalSource,
  type M41cPopulationScope,
} from "@contracts/m41c/shared";
import type {
  M41cClinicalKnowledgeEntry,
  M41cClinicalKnowledgeRegistry,
  M41cClinicalKnowledgeRegistryExport,
  M41cRegistryEntryValidation,
} from "@contracts/m41c/registry";

function youthPopulation(
  programs: readonly string[],
  settings: readonly string[],
): M41cPopulationScope {
  return Object.freeze({
    population: Object.freeze(["synthetic youth evaluation records"]),
    minimumAge: 3,
    maximumAge: 20,
    settings: Object.freeze([...settings]),
    programs: Object.freeze([...programs]),
    exclusions: Object.freeze(["real patient or client records"]),
    languages: Object.freeze(["synthetic English test content"]),
  });
}

function source(
  input: Omit<
    M41cClinicalSource,
    "populationScope" | "evidenceClass" | "contentBinding"
  > & {
    populationScope?: M41cPopulationScope;
    contentBinding: M41cClinicalSource["contentBinding"];
  },
): M41cClinicalSource {
  return Object.freeze({
    ...input,
    populationScope:
      input.populationScope ?? youthPopulation(["M4.1C"], ["synthetic demo"]),
    limitations: Object.freeze([...input.limitations]),
    missingEvidence: Object.freeze([...input.missingEvidence]),
    contentBinding: Object.freeze({ ...input.contentBinding }),
    evidenceClass: M41C_EVIDENCE_CLASS,
  });
}

interface OfficialReferenceSourceInput {
  id: string;
  title: string;
  publisher: string;
  sourceType: M41cClinicalSource["sourceType"];
  canonicalUrl: string;
  version: string;
  effectiveAt: string | null;
  reviewDueAt: string;
  evidenceGrade: M41cClinicalSource["evidenceGrade"];
  licenseState: M41cClinicalSource["licenseState"];
  populationScope?: M41cPopulationScope;
  limitations: readonly string[];
  missingEvidence: readonly string[];
}

function officialReferenceSource(
  input: OfficialReferenceSourceInput,
): M41cClinicalSource {
  return source({
    ...input,
    reviewedAt: "2026-07-14T12:00:00.000Z",
    state: "current",
    ownerRole: "clinical-director",
    limitations: Object.freeze([
      ...input.limitations,
      "Authority-source status is independent from algorithm, scoring, pathway, or live-write activation.",
    ]),
    contentBinding: Object.freeze({
      contentAvailable: false,
      contentHash: null,
      exactWordingValidated: false,
      responseOptionsValidated: false,
      scoringLogicValidated: false,
      proprietaryContentStored: false,
    }),
  });
}

function cadenceEvents() {
  return Object.freeze(
    ["daily", "weekly", "monthly", "quarterly", "annual"].map((cadence) =>
      Object.freeze({
        eventId: `M41C-KNOWLEDGE-REVIEW-${cadence.toUpperCase()}`,
        cadence: cadence as
          "daily" | "weekly" | "monthly" | "quarterly" | "annual",
        triggerSummary: `Review governed synthetic clinical knowledge on the ${cadence} workplan.`,
        ownerRoles: Object.freeze(["clinical-director" as const]),
        humanApprovalRequired: true as const,
        completionEvidenceRequired: true as const,
      }),
    ),
  );
}

function metadataEntry(
  input: Pick<
    M41cClinicalKnowledgeEntry,
    | "entryId"
    | "title"
    | "version"
    | "sourceIds"
    | "populationScope"
    | "limitations"
    | "missingEvidence"
  >,
): M41cClinicalKnowledgeEntry {
  return Object.freeze({
    ...input,
    kind: "instrument_metadata",
    ownerRole: "clinical-director",
    exclusions: Object.freeze([...input.populationScope.exclusions]),
    licenseSummary:
      "Metadata is retained for synthetic planning; licensed instrument content and executable scoring are not stored.",
    effectiveAt: null,
    reviewedAt: M41C_EVALUATION_AS_OF,
    reviewDueAt: "2027-05-15T08:00:00.000Z",
    activationState: "validation_pending",
    inputDefinitions: Object.freeze([]),
    decisionLogic: Object.freeze({
      logicId: `${input.entryId}-LOGIC`,
      logicType: "metadata_only",
      version: input.version,
      executableInSyntheticDemo: false,
      executableInProduction: false,
      humanReviewRequired: true,
      scoringOrDecisionSummary:
        "No scoring or decision logic is available from this metadata-only record.",
      prohibitedUses: Object.freeze([
        "clinical scoring",
        "diagnosis",
        "level-of-care assignment",
        "production care updates",
      ]),
    }),
    escalationRules: Object.freeze([
      Object.freeze({
        ruleId: `${input.entryId}-MISSING-EVIDENCE`,
        triggerSummary:
          "Route missing authoritative content, license, version, or qualification evidence to clinical governance.",
        routeToRoles: Object.freeze([
          "clinical-director" as const,
          "bhc-director" as const,
        ]),
        immediate: false,
        automatedDispositionAvailable: false,
        sourceIds: Object.freeze([...input.sourceIds]),
      }),
    ]),
    requiredHumanApprover: Object.freeze([
      "clinical-director" as const,
      "bhc-director" as const,
    ]),
    humanGateTemplate: Object.freeze({
      gateId: `${input.entryId}-HUMAN-GATE`,
      domain: "clinical",
      required: true,
      accountableRoles: Object.freeze([
        "clinical-director" as const,
        "bhc-director" as const,
      ]),
      qualifiedRoleRequired: true,
      competencyIdsRequired: Object.freeze(["M41C-COMP-GOVERNANCE-APPROVER"]),
      status: "pending",
      decidedBy: null,
      decidedByRole: null,
      decidedAt: null,
      rationale: null,
      overrideReason: null,
    }),
    workplanEvents: cadenceEvents(),
    auditEventIds: Object.freeze([`${input.entryId}-REGISTERED`]),
    demoTestIds: Object.freeze([`${input.entryId}-METADATA-BOUNDARY-TEST`]),
    productionActivationAvailable: false,
    evidenceClass: M41C_EVIDENCE_CLASS,
  });
}

export function createSyntheticM41cClinicalKnowledgeRegistry(): M41cClinicalKnowledgeRegistry {
  const doctrineScope = youthPopulation(["AMOS-OPS"], ["enterprise"]);
  const trrScope = youthPopulation(
    ["Texas Resilience and Recovery metadata profile"],
    ["behavioral health synthetic demo"],
  );
  const dfpsScope = youthPopulation(
    ["DFPS CANS 3.0 metadata profile"],
    ["child welfare synthetic demo"],
  );
  const sources = Object.freeze([
    source({
      id: "M41C-SRC-CONTROLLING-DOCTRINE",
      title: "AMOS-OPS M4.1C controlling clinical doctrine",
      publisher: "Adolbi Care synthetic evaluation",
      sourceType: "organizational_control",
      canonicalUrl: null,
      version: "M4.1C-1.0",
      effectiveAt: "2026-11-01T00:00:00.000Z",
      reviewedAt: M41C_EVALUATION_AS_OF,
      reviewDueAt: "2027-11-15T08:00:00.000Z",
      state: "current",
      evidenceGrade: "organizational_governance",
      ownerRole: "clinical-director",
      licenseState: "not_required",
      populationScope: doctrineScope,
      limitations: Object.freeze([M41C_DEMO_BOUNDARY.label]),
      missingEvidence: Object.freeze([]),
      contentBinding: Object.freeze({
        contentAvailable: true,
        contentHash:
          "sha256:SYNTHETIC-M41C-CONTROLLING-DOCTRINE-CONTENT-BINDING",
        exactWordingValidated: true,
        responseOptionsValidated: true,
        scoringLogicValidated: true,
        proprietaryContentStored: false,
      }),
    }),
    source({
      id: "M41C-SRC-SYNTHETIC-INSTRUMENT-STANDIN",
      title: "M4.1C deterministic synthetic instrument stand-in",
      publisher: "Adolbi Care synthetic evaluation",
      sourceType: "synthetic_test_definition",
      canonicalUrl: null,
      version: "SYNTH-1.0",
      effectiveAt: "2026-11-01T00:00:00.000Z",
      reviewedAt: M41C_EVALUATION_AS_OF,
      reviewDueAt: "2027-05-15T08:00:00.000Z",
      state: "current",
      evidenceGrade: "synthetic_test_standin",
      ownerRole: "clinical-director",
      licenseState: "not_required",
      limitations: Object.freeze([
        "Synthetic stand-in only; it is not a clinical instrument.",
      ]),
      missingEvidence: Object.freeze([]),
      contentBinding: Object.freeze({
        contentAvailable: true,
        contentHash: "sha256:SYNTHETIC-M41C-INSTRUMENT-STANDIN",
        exactWordingValidated: true,
        responseOptionsValidated: true,
        scoringLogicValidated: true,
        proprietaryContentStored: false,
      }),
    }),
    officialReferenceSource({
      id: "M41C-SRC-TRR-CANS-METADATA",
      title: "HHSC Child and Adolescent TRR Utilization Management Guidelines",
      publisher: "Texas Health and Human Services Commission",
      sourceType: "instrument_metadata",
      canonicalUrl:
        "https://www.hhs.texas.gov/sites/default/files/documents/trr-um-guidelines-child.pdf",
      version: "Internal document update 2016; current HHSC-linked reference",
      effectiveAt: null,
      reviewDueAt: "2026-10-14T12:00:00.000Z",
      evidenceGrade: "official_authority",
      licenseState: "license_validation_pending",
      populationScope: trrScope,
      limitations: Object.freeze([
        "Official metadata/reference only; no item text, anchors, scoring logic, or level-of-care logic is stored.",
        "The internally updated 2016 document requires a formal freshness review before any governed content activation.",
      ]),
      missingEvidence: Object.freeze([
        "formal freshness validation against current program authority",
        "license and terms validation",
        "licensed exact wording and response options",
        "approved scoring and decision-support rules",
        "current qualification and certification requirements",
      ]),
    }),
    officialReferenceSource({
      id: "M41C-SRC-DFPS-CANS-3-METADATA",
      title: "DFPS CANS 3.0 Manual and Reference Guide",
      publisher: "Texas Department of Family and Protective Services",
      sourceType: "instrument_metadata",
      canonicalUrl:
        "https://www.dfps.texas.gov/Child_Protection/Medical_Services/documents/CANS_3.0_Manual_Reference_Guide.pdf",
      version: "3.0 (2024)",
      effectiveAt: null,
      reviewDueAt: "2027-01-14T12:00:00.000Z",
      evidenceGrade: "official_authority",
      licenseState: "license_validation_pending",
      populationScope: dfpsScope,
      limitations: Object.freeze([
        "Official metadata/reference only; no item text, anchors, scoring logic, or disposition logic is stored.",
      ]),
      missingEvidence: Object.freeze([
        "certification requirements validation",
        "terms and third-party rights validation",
        "licensed exact wording and response options",
        "approved scoring and decision-support rules",
      ]),
    }),
    officialReferenceSource({
      id: "M41C-SRC-HHSC-TRR-HUB",
      title:
        "HHSC Texas Resilience and Recovery Utilization Management Guidelines and Manual hub",
      publisher: "Texas Health and Human Services Commission",
      sourceType: "official_toolkit",
      canonicalUrl:
        "https://www.hhs.texas.gov/providers/behavioral-health-services-providers-programs/behavioral-health-provider-resources/texas-resilience-recovery-utilization-management-guidelines-manual",
      version: "Current web resource reviewed 2026-07-14",
      effectiveAt: null,
      reviewDueAt: "2027-01-14T12:00:00.000Z",
      evidenceGrade: "official_authority",
      licenseState: "metadata_only",
      populationScope: trrScope,
      limitations: Object.freeze([
        "Catalog and provenance reference only; linked materials require independent version, license, and clinical validation.",
      ]),
      missingEvidence: Object.freeze(["linked-resource freshness review"]),
    }),
    officialReferenceSource({
      id: "M41C-SRC-HHSC-UM-MANUAL-2025",
      title: "HHSC Utilization Management Program Manual",
      publisher: "Texas Health and Human Services Commission",
      sourceType: "state_program_authority",
      canonicalUrl:
        "https://www.hhs.texas.gov/sites/default/files/documents/um-program-manual.pdf",
      version: "February 2025; revised September 2024",
      effectiveAt: "2025-02-01T00:00:00.000Z",
      reviewDueAt: "2027-01-14T12:00:00.000Z",
      evidenceGrade: "official_authority",
      licenseState: "metadata_only",
      populationScope: trrScope,
      limitations: Object.freeze([
        "Program-authority metadata only; operational mappings remain validation pending.",
      ]),
      missingEvidence: Object.freeze([
        "section-level controlled mapping validation",
        "clinical governance approval",
      ]),
    }),
    officialReferenceSource({
      id: "M41C-SRC-HHSC-TCOM",
      title: "HHSC Transformational Collaborative Outcomes Management",
      publisher: "Texas Health and Human Services Commission",
      sourceType: "official_toolkit",
      canonicalUrl:
        "https://www.hhs.texas.gov/providers/behavioral-health-services-providers-programs/behavioral-health-provider-resources/texas-resilience-recovery-utilization-management-guidelines-manual/transformational-collaborative-outcomes-management",
      version: "Current web resource reviewed 2026-07-14",
      effectiveAt: null,
      reviewDueAt: "2027-01-14T12:00:00.000Z",
      evidenceGrade: "official_authority",
      licenseState: "metadata_only",
      populationScope: trrScope,
      limitations: Object.freeze([
        "Framework reference only; no instrument items or decision logic are stored.",
      ]),
      missingEvidence: Object.freeze([
        "implementation and training terms validation",
      ]),
    }),
    officialReferenceSource({
      id: "M41C-SRC-HHSC-CMBHS",
      title: "HHSC Clinical Management for Behavioral Health Services",
      publisher: "Texas Health and Human Services Commission",
      sourceType: "state_program_authority",
      canonicalUrl:
        "https://www.hhs.texas.gov/providers/behavioral-health-services-providers-programs/behavioral-health-provider-resources/clinical-management-behavioral-health-services",
      version: "Current web resource reviewed 2026-07-14",
      effectiveAt: null,
      reviewDueAt: "2027-01-14T12:00:00.000Z",
      evidenceGrade: "official_authority",
      licenseState: "metadata_only",
      populationScope: trrScope,
      limitations: Object.freeze([
        "Connector and reconciliation reference only; all CMBHS writes remain blocked in M4.1C.",
      ]),
      missingEvidence: Object.freeze([
        "approved interface specification",
        "controlled field-level mapping validation",
      ]),
    }),
    officialReferenceSource({
      id: "M41C-SRC-NIMH-ASQ-TOOLKIT",
      title: "NIMH Ask Suicide-Screening Questions Toolkit",
      publisher: "National Institute of Mental Health",
      sourceType: "official_toolkit",
      canonicalUrl:
        "https://www.nimh.nih.gov/research/research-conducted-at-nimh/asq-toolkit-materials",
      version: "Current web toolkit reviewed 2026-07-14",
      effectiveAt: null,
      reviewDueAt: "2027-01-14T12:00:00.000Z",
      evidenceGrade: "official_authority",
      licenseState: "license_validation_pending",
      limitations: Object.freeze([
        "Toolkit metadata only; no screening items, scripts, or clinical disposition logic are stored.",
      ]),
      missingEvidence: Object.freeze([
        "terms and use conditions validation",
        "setting and age-specific implementation validation",
        "qualified safety pathway approval",
      ]),
    }),
    officialReferenceSource({
      id: "M41C-SRC-HL7-FHIR-R4",
      title: "HL7 FHIR Release 4",
      publisher: "Health Level Seven International",
      sourceType: "interoperability_standard",
      canonicalUrl: "https://hl7.org/fhir/R4/",
      version: "4.0.1",
      effectiveAt: null,
      reviewDueAt: "2027-01-14T12:00:00.000Z",
      evidenceGrade: "official_authority",
      licenseState: "license_validation_pending",
      limitations: Object.freeze([
        "Interoperability metadata only; no external exchange or production write is enabled.",
      ]),
      missingEvidence: Object.freeze([
        "implementation-guide selection",
        "profile and terminology validation",
        "license and conformance review",
      ]),
    }),
    officialReferenceSource({
      id: "M41C-SRC-42-CFR-PART-2",
      title:
        "42 CFR Part 2 — Confidentiality of Substance Use Disorder Patient Records",
      publisher: "Electronic Code of Federal Regulations",
      sourceType: "law_or_regulation",
      canonicalUrl:
        "https://www.ecfr.gov/current/title-42/chapter-I/subchapter-A/part-2?toc=1",
      version: "Current eCFR reference reviewed 2026-07-14",
      effectiveAt: null,
      reviewDueAt: "2026-10-14T12:00:00.000Z",
      evidenceGrade: "official_authority",
      licenseState: "not_required",
      limitations: Object.freeze([
        "Regulatory reference only; implementation requires privacy, legal, consent, and minimum-necessary controls.",
      ]),
      missingEvidence: Object.freeze([
        "legal implementation review",
        "controlled consent and disclosure mapping validation",
      ]),
    }),
  ]);

  const syntheticEntry: M41cClinicalKnowledgeEntry = Object.freeze({
    entryId: "SYNTH-M41C-KNOWLEDGE-INSTRUMENT-STANDIN",
    kind: "instrument_metadata",
    title: "Deterministic synthetic clinical instrument stand-in",
    version: "SYNTH-1.0",
    ownerRole: "clinical-director",
    populationScope: youthPopulation(["M4.1C"], ["synthetic demo"]),
    exclusions: Object.freeze(["real clinical use"]),
    sourceIds: Object.freeze([
      "M41C-SRC-CONTROLLING-DOCTRINE",
      "M41C-SRC-SYNTHETIC-INSTRUMENT-STANDIN",
    ]),
    licenseSummary: "Synthetic test definition; no proprietary content.",
    effectiveAt: "2026-11-01T00:00:00.000Z",
    reviewedAt: M41C_EVALUATION_AS_OF,
    reviewDueAt: "2027-05-15T08:00:00.000Z",
    activationState: "demo_approved",
    inputDefinitions: Object.freeze([
      Object.freeze({
        inputId: "SYNTH-SIGNAL-A",
        label: "Synthetic signal A",
        dataType: "coded",
        required: true,
        missingDataBehavior: "block",
        allowedValues: Object.freeze(["none", "present", "urgent"]),
        sourceField: null,
      }),
      Object.freeze({
        inputId: "SYNTH-SIGNAL-B",
        label: "Synthetic signal B",
        dataType: "coded",
        required: true,
        missingDataBehavior: "route_human_review",
        allowedValues: Object.freeze(["none", "present"]),
        sourceField: null,
      }),
    ]),
    decisionLogic: Object.freeze({
      logicId: "SYNTH-M41C-STANDIN-LOGIC",
      logicType: "synthetic_deterministic",
      version: "SYNTH-1.0",
      executableInSyntheticDemo: true,
      executableInProduction: false,
      humanReviewRequired: true,
      scoringOrDecisionSummary:
        "Echo validated synthetic response codes and route urgent signals to human review; do not calculate clinical severity or level of care.",
      prohibitedUses: Object.freeze([
        "diagnosis",
        "clinical severity scoring",
        "level-of-care assignment",
        "production care updates",
      ]),
    }),
    escalationRules: Object.freeze([
      Object.freeze({
        ruleId: "SYNTH-M41C-STANDIN-URGENT",
        triggerSummary:
          "An urgent synthetic signal blocks continuation and routes a human safety review.",
        routeToRoles: Object.freeze([
          "clinical-director" as const,
          "clinical-supervisor" as const,
        ]),
        immediate: true,
        automatedDispositionAvailable: false,
        sourceIds: Object.freeze(["M41C-SRC-SYNTHETIC-INSTRUMENT-STANDIN"]),
      }),
    ]),
    requiredHumanApprover: Object.freeze([
      "clinical-director" as const,
      "bhc-director" as const,
    ]),
    humanGateTemplate: Object.freeze({
      gateId: "SYNTH-M41C-STANDIN-HUMAN-GATE",
      domain: "clinical",
      required: true,
      accountableRoles: Object.freeze([
        "clinical-director" as const,
        "bhc-director" as const,
      ]),
      qualifiedRoleRequired: true,
      competencyIdsRequired: Object.freeze([
        "M41C-COMP-SYNTHETIC-INSTRUMENT-USER",
      ]),
      status: "pending",
      decidedBy: null,
      decidedByRole: null,
      decidedAt: null,
      rationale: null,
      overrideReason: null,
    }),
    workplanEvents: cadenceEvents(),
    auditEventIds: Object.freeze(["SYNTH-M41C-STANDIN-REGISTERED"]),
    demoTestIds: Object.freeze([
      "M41C-GOLDEN-STANDIN-ROUTINE",
      "M41C-GOLDEN-STANDIN-MISSING",
      "M41C-GOLDEN-STANDIN-URGENT",
    ]),
    limitations: Object.freeze([
      "This synthetic stand-in is not a clinical instrument.",
    ]),
    missingEvidence: Object.freeze([]),
    productionActivationAvailable: false,
    evidenceClass: M41C_EVIDENCE_CLASS,
  });

  return Object.freeze({
    registryId: "SYNTH-M41C-CLINICAL-KNOWLEDGE-REGISTRY",
    registryVersion: "M4.1C-SYNTH-1.0",
    generatedAt: M41C_EVALUATION_AS_OF,
    sources,
    entries: Object.freeze([
      syntheticEntry,
      metadataEntry({
        entryId: "M41C-KNOWLEDGE-TRR-CANS-METADATA",
        title: "TRR CANS metadata profile",
        version: "Internal document update 2016; freshness review required",
        sourceIds: Object.freeze([
          "M41C-SRC-TRR-CANS-METADATA",
          "M41C-SRC-HHSC-TRR-HUB",
          "M41C-SRC-HHSC-UM-MANUAL-2025",
          "M41C-SRC-HHSC-TCOM",
          "M41C-SRC-HHSC-CMBHS",
          "M41C-SRC-HL7-FHIR-R4",
          "M41C-SRC-42-CFR-PART-2",
        ]),
        populationScope: trrScope,
        limitations: Object.freeze(["Metadata-only; scoring unavailable."]),
        missingEvidence: Object.freeze([
          "licensed authoritative instrument package",
          "clinical governance validation",
        ]),
      }),
      metadataEntry({
        entryId: "M41C-KNOWLEDGE-DFPS-CANS-3-METADATA",
        title: "DFPS CANS 3.0 metadata profile",
        version: "3.0 (2024)",
        sourceIds: Object.freeze([
          "M41C-SRC-DFPS-CANS-3-METADATA",
          "M41C-SRC-HL7-FHIR-R4",
          "M41C-SRC-42-CFR-PART-2",
        ]),
        populationScope: dfpsScope,
        limitations: Object.freeze(["Metadata-only; scoring unavailable."]),
        missingEvidence: Object.freeze([
          "licensed authoritative instrument package",
          "clinical governance validation",
        ]),
      }),
    ]),
    productionActivationAvailable: false,
    evidenceClass: M41C_EVIDENCE_CLASS,
  });
}

function validateSource(sourceRecord: M41cClinicalSource): readonly string[] {
  const errors: string[] = [];
  if (!sourceRecord.id.trim()) errors.push("SOURCE_ID_REQUIRED");
  if (!sourceRecord.title.trim()) errors.push("SOURCE_TITLE_REQUIRED");
  if (!sourceRecord.publisher.trim()) errors.push("SOURCE_PUBLISHER_REQUIRED");
  if (!sourceRecord.version.trim()) errors.push("SOURCE_VERSION_REQUIRED");
  if (!Number.isFinite(Date.parse(sourceRecord.reviewedAt)))
    errors.push("SOURCE_REVIEWED_AT_INVALID");
  if (!Number.isFinite(Date.parse(sourceRecord.reviewDueAt)))
    errors.push("SOURCE_REVIEW_DUE_AT_INVALID");
  if (sourceRecord.contentBinding.proprietaryContentStored !== false)
    errors.push("PROPRIETARY_CONTENT_BOUNDARY_VIOLATION");
  if (sourceRecord.evidenceClass !== M41C_EVIDENCE_CLASS)
    errors.push("SOURCE_EVIDENCE_BOUNDARY_VIOLATION");
  return Object.freeze(errors);
}

export function registerM41cClinicalSource(
  registry: M41cClinicalKnowledgeRegistry,
  sourceRecord: M41cClinicalSource,
): M41cClinicalKnowledgeRegistry {
  const errors = validateSource(sourceRecord);
  if (errors.length > 0)
    throw new Error(`M41C_SOURCE_INVALID:${errors.join(",")}`);
  if (registry.sources.some((candidate) => candidate.id === sourceRecord.id))
    throw new Error("M41C_SOURCE_ALREADY_REGISTERED");
  return Object.freeze({
    ...registry,
    sources: Object.freeze([...registry.sources, sourceRecord]),
  });
}

export function registerM41cKnowledgeEntry(
  registry: M41cClinicalKnowledgeRegistry,
  entry: M41cClinicalKnowledgeEntry,
): M41cClinicalKnowledgeRegistry {
  if (registry.entries.some((candidate) => candidate.entryId === entry.entryId))
    throw new Error("M41C_KNOWLEDGE_ENTRY_ALREADY_REGISTERED");
  const next = Object.freeze({
    ...registry,
    entries: Object.freeze([...registry.entries, entry]),
  });
  const validation = validateM41cRegistryEntry(next, entry.entryId);
  if (!validation.valid)
    throw new Error(
      `M41C_KNOWLEDGE_ENTRY_INVALID:${validation.errors.join(",")}`,
    );
  return next;
}

export function validateM41cRegistryEntry(
  registry: M41cClinicalKnowledgeRegistry,
  entryId: string,
  evaluatedAt = registry.generatedAt,
): M41cRegistryEntryValidation {
  const entry = registry.entries.find(
    (candidate) => candidate.entryId === entryId,
  );
  if (!entry) throw new Error("M41C_KNOWLEDGE_ENTRY_NOT_FOUND");
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!entry.title.trim()) errors.push("ENTRY_TITLE_REQUIRED");
  if (!entry.version.trim()) errors.push("ENTRY_VERSION_REQUIRED");
  if (entry.sourceIds.length === 0) errors.push("ENTRY_SOURCE_REQUIRED");
  if (entry.requiredHumanApprover.length === 0)
    errors.push("ENTRY_HUMAN_APPROVER_REQUIRED");
  if (!entry.humanGateTemplate.required)
    errors.push("ENTRY_HUMAN_GATE_REQUIRED");
  if (entry.workplanEvents.length === 0)
    errors.push("ENTRY_WORKPLAN_EVENT_REQUIRED");
  if (entry.demoTestIds.length === 0) errors.push("ENTRY_DEMO_TEST_REQUIRED");
  if (entry.productionActivationAvailable !== false)
    errors.push("ENTRY_PRODUCTION_ACTIVATION_DENIED");

  const sources = entry.sourceIds.map((sourceId) =>
    registry.sources.find((candidate) => candidate.id === sourceId),
  );
  if (sources.some((candidate) => !candidate))
    errors.push("ENTRY_SOURCE_NOT_FOUND");
  for (const sourceRecord of sources.filter(
    (candidate): candidate is M41cClinicalSource => Boolean(candidate),
  )) {
    errors.push(
      ...validateSource(sourceRecord).map(
        (code) => `${sourceRecord.id}:${code}`,
      ),
    );
    if (sourceRecord.state !== "current")
      warnings.push(`${sourceRecord.id}:SOURCE_NOT_CURRENT`);
    if (Date.parse(sourceRecord.reviewDueAt) <= Date.parse(evaluatedAt))
      warnings.push(`${sourceRecord.id}:SOURCE_REVIEW_OVERDUE`);
    if (sourceRecord.missingEvidence.length > 0)
      warnings.push(`${sourceRecord.id}:SOURCE_EVIDENCE_INCOMPLETE`);
    if (
      sourceRecord.licenseState !== "not_required" &&
      sourceRecord.licenseState !== "licensed_demo"
    ) {
      warnings.push(`${sourceRecord.id}:LICENSE_NOT_DEMO_READY`);
    }
  }
  warnings.push(...entry.missingEvidence.map((value) => `MISSING:${value}`));
  const eligibleForSyntheticDemo =
    errors.length === 0 &&
    warnings.length === 0 &&
    entry.activationState === "demo_approved" &&
    entry.decisionLogic.executableInSyntheticDemo &&
    entry.decisionLogic.humanReviewRequired &&
    sources.every(
      (sourceRecord) =>
        sourceRecord?.state === "current" &&
        Date.parse(sourceRecord.reviewDueAt) > Date.parse(evaluatedAt) &&
        (sourceRecord.licenseState === "not_required" ||
          sourceRecord.licenseState === "licensed_demo"),
    );

  return Object.freeze({
    entryId,
    valid: errors.length === 0,
    eligibleForSyntheticDemo,
    productionUseAuthorized: false,
    errors: Object.freeze([...new Set(errors)]),
    warnings: Object.freeze([...new Set(warnings)]),
    evaluatedAt,
  });
}

export function exportM41cClinicalKnowledgeRegistry(
  registry: M41cClinicalKnowledgeRegistry,
): M41cClinicalKnowledgeRegistryExport {
  const sources = Object.freeze(
    [...registry.sources].sort((left, right) =>
      left.id.localeCompare(right.id),
    ),
  );
  const entries = Object.freeze(
    [...registry.entries].sort((left, right) =>
      left.entryId.localeCompare(right.entryId),
    ),
  );
  const validations = Object.freeze(
    entries.map((entry) =>
      validateM41cRegistryEntry(registry, entry.entryId, registry.generatedAt),
    ),
  );
  return Object.freeze({
    registryId: registry.registryId,
    registryVersion: registry.registryVersion,
    generatedAt: registry.generatedAt,
    sourceCount: sources.length,
    entryCount: entries.length,
    sources,
    entries,
    validations,
    productionActivationAvailable: false,
    evidenceClass: M41C_EVIDENCE_CLASS,
  });
}

export function assertM41cRegistryEntryCanDriveSyntheticDemo(
  registry: M41cClinicalKnowledgeRegistry,
  entryId: string,
): void {
  const result = validateM41cRegistryEntry(registry, entryId);
  if (!result.eligibleForSyntheticDemo)
    throw new Error("M41C_KNOWLEDGE_ENTRY_NOT_DEMO_ELIGIBLE");
}

export function assertM41cProductionKnowledgeActivationUnavailable(): never {
  throw new Error("M41C_PRODUCTION_KNOWLEDGE_ACTIVATION_UNAVAILABLE");
}
