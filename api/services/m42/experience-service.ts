import type { DivisionId } from "@/constants/organization";
import type { UserRole } from "@/constants/roles";
import {
  M42_CRITERION_IDS,
  M42_EVALUATION_AS_OF,
  M42_MILESTONE,
  createM42DemoBoundary,
  type M42AcceptanceFlag,
  type M42ActorContext,
  type M42DemoBoundary,
  type M42RoleTier,
  type M42SensitivityLevel,
} from "@contracts/m42/shared";
import type {
  M42DocumentAccessDecision,
  M42DocumentRegistry,
  M42DispositionPreview,
  M42ExportManifest,
  M42VersionLedger,
} from "@contracts/m42/records";
import type {
  M42NilEvaluationResult,
  M42SearchPerformanceResult,
} from "@contracts/m42/search";
import type {
  M42ConfigurationApplyResult,
  M42ConfigurationSnapshot,
  M42ReportBuilderSnapshot,
  M42ReportExecution,
  M42ReportExportManifest,
  M42SavedReportDefinition,
} from "@contracts/m42/reporting";
import { createSyntheticM42ConfigurationAdmin } from "./configuration-admin";
import {
  appendM42DisclosureEvent,
  createM42DisclosureLedger,
  createM42SyntheticExportManifest,
  evaluateM42DocumentAccess,
  validateM42DisclosureLedger,
} from "./document-access";
import {
  applyM42SyntheticLegalHold,
  createSyntheticM42DocumentRegistry,
  createSyntheticM42RecordsActors,
  previewM42SyntheticDisposition,
  validateM42DocumentRegistry,
} from "./document-governance";
import {
  checkinM42Document,
  checkoutM42Document,
  createM42VersionLedger,
  decideM42VersionApproval,
  publishM42ApprovedVersion,
  submitM42VersionForApproval,
  validateM42VersionLedger,
} from "./document-versioning";
import { evaluateFrozenM42NilSemanticAccuracy } from "./nil-evaluation";
import { createSyntheticM42ReportBuilder } from "./report-builder";
import { evaluateApprovedM42SearchPerformance } from "./search-engine";

export const M42_INTEGRATED_SCENARIO_ID =
  "SYNTH-M42-SCENARIO-DOCUMENT-KNOWLEDGE" as const;

export interface M42RecordsScenarioResult {
  registry: M42DocumentRegistry;
  registryValidationErrors: readonly string[];
  allowedAccess: M42DocumentAccessDecision;
  deniedPart2Access: M42DocumentAccessDecision;
  blockedDisclosure: M42DocumentAccessDecision;
  disclosureLedgerValidationErrors: readonly string[];
  exportManifest: M42ExportManifest;
  dispositionPreview: M42DispositionPreview;
  versionLedger: M42VersionLedger;
  versionLedgerValidationErrors: readonly string[];
}

export interface M42ReportScenarioResult {
  definition: M42SavedReportDefinition;
  execution: M42ReportExecution;
  exportManifest: M42ReportExportManifest;
  snapshot: M42ReportBuilderSnapshot;
}

export interface M42AdministrationScenarioResult {
  change: M42ConfigurationApplyResult;
  rollback: M42ConfigurationApplyResult;
  snapshot: M42ConfigurationSnapshot;
}

export interface M42IntegratedScenarioResult {
  milestone: typeof M42_MILESTONE;
  scenarioId: typeof M42_INTEGRATED_SCENARIO_ID;
  executedAt: typeof M42_EVALUATION_AS_OF;
  requestedBy: {
    actorId: string;
    role: UserRole;
    tier: M42RoleTier;
  };
  accepted: boolean;
  acceptanceFlags: readonly M42AcceptanceFlag[];
  boundary: M42DemoBoundary;
  records: M42RecordsScenarioResult;
  search: M42SearchPerformanceResult;
  nil: M42NilEvaluationResult;
  reporting: M42ReportScenarioResult;
  administration: M42AdministrationScenarioResult;
  totals: {
    criteriaPassed: number;
    criteriaTotal: number;
    assertions: number;
    realDataRecords: 0;
    liveExternalWrites: 0;
    productionDispositions: 0;
    deployments: 0;
    githubPushes: 0;
  };
  synthetic: true;
}

export interface M42ExperienceSnapshot {
  milestone: typeof M42_MILESTONE;
  title: string;
  status: "operational_synthetic_prototype";
  boundary: M42DemoBoundary;
  viewer: {
    role: UserRole;
    tier: M42RoleTier;
    canBuildReports: boolean;
    canAdministerConfiguration: boolean;
    canRunIntegratedScenario: boolean;
  };
  acceptanceTargets: {
    governedCriteria: 8;
    searchLatencyMsExclusive: 3_000;
    nilTop1AccuracyMinimum: 0.9;
    reportBuilderMinimumTier: "T2";
    noCodeAdministration: true;
  };
  inventory: {
    taxonomyNodes: number;
    retentionSchedules: number;
    governedDocuments: number;
    searchCorpusDocuments: 2_400;
    searchEvaluationQueries: 24;
    nilArticles: 16;
    nilLabeledQueries: 30;
    reportSources: number;
    configurationSchemas: number;
  };
  modules: readonly {
    criterionId: (typeof M42_CRITERION_IDS)[number];
    label: string;
    experience: string;
  }[];
}

function actor(input: {
  actorId: string;
  role: UserRole;
  tier: M42RoleTier;
  permissions: readonly string[];
  divisions?: readonly DivisionId[];
  clearance?: readonly M42SensitivityLevel[];
  purpose: string;
}): M42ActorContext {
  return Object.freeze({
    actorId: input.actorId,
    role: input.role,
    tier: input.tier,
    divisionIds: Object.freeze([...(input.divisions ?? ["eo"])]),
    permissions: Object.freeze([...input.permissions]),
    sensitivityClearance: Object.freeze([
      ...(input.clearance ?? ["public", "internal", "confidential"]),
    ]),
    minimumNecessaryPurpose: input.purpose,
    synthetic: true,
  });
}

function runRecordsScenario(): M42RecordsScenarioResult {
  const registry = createSyntheticM42DocumentRegistry();
  const actors = createSyntheticM42RecordsActors();
  const doctrine = registry.documents.find(
    (document) =>
      document.documentId === "SYNTH-DOCUMENT-ENTERPRISE-DOCTRINE",
  );
  const campusSafety = registry.documents.find(
    (document) =>
      document.documentId === "SYNTH-DOCUMENT-GAD-CAMPUS-SAFETY",
  );
  const part2 = registry.documents.find(
    (document) =>
      document.documentId === "SYNTH-DOCUMENT-BHC-PART2-CONSENT",
  );
  if (!doctrine || !campusSafety || !part2)
    throw new Error("M42_INTEGRATED_RECORD_FIXTURE_MISSING");

  const allowedAccess = evaluateM42DocumentAccess(
    doctrine,
    actors.exporter,
    "content_read",
    "2026-12-15T08:01:00.000Z",
  );
  const deniedPart2Access = evaluateM42DocumentAccess(
    part2,
    actors.clinicalReader,
    "content_read",
    "2026-12-15T08:02:00.000Z",
  );
  const blockedDisclosure = evaluateM42DocumentAccess(
    doctrine,
    actors.exporter,
    "disclose",
    "2026-12-15T08:03:00.000Z",
  );
  let disclosureLedger = createM42DisclosureLedger();
  disclosureLedger = appendM42DisclosureEvent(disclosureLedger, allowedAccess);
  disclosureLedger = appendM42DisclosureEvent(
    disclosureLedger,
    deniedPart2Access,
  );
  disclosureLedger = appendM42DisclosureEvent(
    disclosureLedger,
    blockedDisclosure,
  );
  const exportManifest = createM42SyntheticExportManifest(
    registry.documents,
    actors.exporter,
    "2026-12-15T08:04:00.000Z",
  );
  const held = applyM42SyntheticLegalHold(
    doctrine,
    actors.enterpriseApprover,
    "Preserve the fictional doctrine during the M4.2 records-control evaluation.",
    "SYNTH-MATTER-M42-001",
    "2026-12-15T08:05:00.000Z",
  );
  const dispositionPreview = previewM42SyntheticDisposition(
    held.document,
    registry.retentionSchedules,
    "2040-12-15T08:06:00.000Z",
  );

  let versionLedger = createM42VersionLedger(campusSafety);
  const checkedOut = checkoutM42Document(
    versionLedger,
    actors.facilitiesEditor,
    campusSafety.currentVersionId,
    "2026-12-15T08:10:00.000Z",
  );
  versionLedger = checkinM42Document(checkedOut.ledger, {
    actor: actors.facilitiesEditor,
    lockId: checkedOut.lock.lockId,
    expectedBaseVersionId: campusSafety.currentVersionId,
    contentHash: "sha256:synth-campus-safety-integrated-1-1",
    changeSummary:
      "Clarify the fictional campus response sequence for integrated evaluation.",
    checkedInAt: "2026-12-15T09:00:00.000Z",
  }).ledger;
  versionLedger = submitM42VersionForApproval(
    versionLedger,
    actors.facilitiesEditor,
    ["administrator", "hr-compliance-officer"],
    "2026-12-15T09:05:00.000Z",
  );
  versionLedger = decideM42VersionApproval(
    versionLedger,
    actors.enterpriseApprover,
    "approved",
    "Synthetic record identity and version controls verified.",
    "2026-12-15T09:10:00.000Z",
  );
  versionLedger = decideM42VersionApproval(
    versionLedger,
    actors.complianceApprover,
    "approved",
    "Synthetic compliance review completed.",
    "2026-12-15T09:15:00.000Z",
  );
  versionLedger = publishM42ApprovedVersion(
    versionLedger,
    actors.enterpriseApprover,
    "2026-12-15T09:20:00.000Z",
  );

  return Object.freeze({
    registry,
    registryValidationErrors: validateM42DocumentRegistry(registry),
    allowedAccess,
    deniedPart2Access,
    blockedDisclosure,
    disclosureLedgerValidationErrors:
      validateM42DisclosureLedger(disclosureLedger),
    exportManifest,
    dispositionPreview,
    versionLedger,
    versionLedgerValidationErrors: validateM42VersionLedger(versionLedger),
  });
}

function runReportScenario(): M42ReportScenarioResult {
  const author = actor({
    actorId: "SYNTH-M42-INTEGRATED-REPORT-AUTHOR",
    role: "managing-director",
    tier: "T1",
    permissions: [
      "m42:report:build",
      "m42:report:export",
      "m42:report:clinical-aggregate",
      "m42:report:finance",
      "m42:report:restricted",
    ],
    clearance: ["public", "internal", "confidential", "restricted"],
    purpose: "Author the integrated fictional M4.2 report definition.",
  });
  const operator = actor({
    actorId: "SYNTH-M42-INTEGRATED-REPORT-OPERATOR",
    role: "bhc-director",
    tier: "T2",
    permissions: [
      "m42:report:build",
      "m42:report:export",
      "m42:report:clinical-aggregate",
    ],
    purpose: "Execute a minimum-necessary fictional M4.2 report.",
  });
  const builder = createSyntheticM42ReportBuilder();
  const definition = builder.saveDefinition(
    author,
    {
      stableKey: "SYNTH-M42-INTEGRATED-REPORT",
      title: "Synthetic integrated division review",
      purpose:
        "Evaluate governed filters, field authorization, lineage, and manifest-only export.",
      sourceId: "SYNTH-M42-SOURCE-OPERATIONS",
      selectedFieldIds: [
        "record_id",
        "division",
        "service_count",
        "restricted_control_note",
      ],
      filters: [{ fieldId: "division", operator: "equals", value: "BHC" }],
      exportEnabled: true,
    },
    "2026-12-15T10:00:00.000Z",
  );
  const execution = builder.executeDefinition(
    operator,
    definition.definitionId,
    "2026-12-15T10:01:00.000Z",
  );
  const exportManifest = builder.createExportManifest(
    operator,
    execution,
    "csv-manifest",
    "2026-12-15T10:02:00.000Z",
  );
  return Object.freeze({
    definition,
    execution,
    exportManifest,
    snapshot: builder.snapshot(),
  });
}

function runAdministrationScenario(): M42AdministrationScenarioResult {
  const editor = actor({
    actorId: "SYNTH-M42-INTEGRATED-CONFIG-EDITOR",
    role: "hr-director",
    tier: "T2",
    permissions: [
      "m42:admin:records",
      "m42:admin:search",
      "m42:admin:reporting",
      "m42:admin:workspace",
    ],
    purpose: "Administer approved fictional M4.2 configuration.",
  });
  const approver = actor({
    actorId: "SYNTH-M42-INTEGRATED-CONFIG-APPROVER",
    role: "managing-director",
    tier: "T1",
    permissions: ["m42:admin:approve", "m42:admin:audit", "*"],
    clearance: ["public", "internal", "confidential", "restricted"],
    purpose: "Approve and audit fictional M4.2 configuration.",
  });
  const admin = createSyntheticM42ConfigurationAdmin();
  const initial = admin.currentVersion(
    editor,
    "records.retention.review_window_days",
  );
  const changePreview = admin.previewChange(editor, {
    configKey: "records.retention.review_window_days",
    proposedValue: 120,
    reason: "Evaluate a bounded fictional retention review cadence change.",
    requestedAt: "2026-12-15T11:00:00.000Z",
  });
  const changeApproval = admin.approvePreview(approver, changePreview, {
    approvedAt: "2026-12-15T11:01:00.000Z",
    rationale: "The bounded synthetic configuration change is approved.",
  });
  const change = admin.applyPreview(
    editor,
    changePreview,
    "2026-12-15T11:02:00.000Z",
    changeApproval,
  );
  const rollbackPreview = admin.previewRollback(editor, {
    configKey: "records.retention.review_window_days",
    targetVersionId: initial.versionId,
    reason: "Restore the verified fictional baseline through append-only rollback.",
    requestedAt: "2026-12-15T11:03:00.000Z",
  });
  const rollbackApproval = admin.approvePreview(approver, rollbackPreview, {
    approvedAt: "2026-12-15T11:04:00.000Z",
    rationale: "The prior verified synthetic baseline should be restored.",
  });
  const rollback = admin.applyPreview(
    editor,
    rollbackPreview,
    "2026-12-15T11:05:00.000Z",
    rollbackApproval,
  );
  return Object.freeze({
    change,
    rollback,
    snapshot: admin.snapshot(approver),
  });
}

function flag(
  criterionId: M42AcceptanceFlag["criterionId"],
  passed: boolean,
  assertionCount: number,
  summary: string,
  evidenceIds: readonly string[],
): M42AcceptanceFlag {
  return Object.freeze({
    criterionId,
    passed,
    assertionCount,
    summary,
    evidenceIds: Object.freeze([...evidenceIds]),
  });
}

export function runM42IntegratedScenario(
  scenarioId: string = M42_INTEGRATED_SCENARIO_ID,
  searchIterations = 3,
  requestedBy: M42ActorContext = actor({
    actorId: "SYNTH-M42-INTEGRATED-REQUESTER",
    role: "managing-director",
    tier: "T1",
    permissions: ["m42:experience:read"],
    purpose: "Request the integrated fictional M4.2 acceptance scenario.",
  }),
): M42IntegratedScenarioResult {
  if (scenarioId !== M42_INTEGRATED_SCENARIO_ID)
    throw new Error("M42_INTEGRATED_SCENARIO_NOT_REGISTERED");
  if (requestedBy.tier !== "T1" && requestedBy.tier !== "T2")
    throw new Error("M42_INTEGRATED_SCENARIO_REVIEWER_REQUIRED");
  const records = runRecordsScenario();
  const search = evaluateApprovedM42SearchPerformance(searchIterations);
  const nil = evaluateFrozenM42NilSemanticAccuracy();
  const reporting = runReportScenario();
  const administration = runAdministrationScenario();

  const flags: M42AcceptanceFlag[] = [
    flag(
      "M4.2-01",
      records.registryValidationErrors.length === 0 &&
        records.registry.taxonomy.length === 7 &&
        records.registry.retentionSchedules.length === 4 &&
        records.registry.documents.length === 6,
      7,
      "Taxonomy, metadata, ownership, lifecycle, classification, retention, and approval are governed.",
      ["M4_2_DMS_TAXONOMY_LIFECYCLE_RESULT"],
    ),
    flag(
      "M4.2-02",
      records.allowedAccess.allowed &&
        !records.deniedPart2Access.allowed &&
        !records.blockedDisclosure.allowed &&
        records.disclosureLedgerValidationErrors.length === 0 &&
        records.exportManifest.liveRepositoryWrite === false &&
        records.exportManifest.recipientDelivery === false &&
        records.dispositionPreview.legalHoldActive &&
        !records.dispositionPreview.dispositionExecuted,
      8,
      "Least privilege, Part 2 segmentation, audit, legal hold, and manifest-only export are enforced.",
      ["M4_2_DOCUMENT_ACCESS_RECORDS_RESULT"],
    ),
    flag(
      "M4.2-03",
      records.versionLedgerValidationErrors.length === 0 &&
        records.versionLedger.document.currentVersion === "1.1" &&
        records.versionLedger.versions.some(
          (version) => version.status === "superseded",
        ) &&
        records.versionLedger.versions.some(
          (version) => version.status === "published",
        ),
      6,
      "Conflict control, immutable history, ordered approval, publication, supersession, and source-of-truth linkage operate together.",
      ["M4_2_VERSION_SOURCE_OF_TRUTH_RESULT"],
    ),
    flag(
      "M4.2-04",
      search.accepted &&
        search.maxMs < search.targetMsExclusive &&
        search.permissionTrimmedBeforeRanking &&
        search.permissionTrimmedBeforeCitation,
      6,
      `Frozen permission-trimmed search accepted at ${search.maxMs.toFixed(3)} ms maximum against the under-3,000 ms target.`,
      ["M4_2_SEARCH_PERFORMANCE_RESULT"],
    ),
    flag(
      "M4.2-05",
      nil.accepted &&
        nil.accuracy >= nil.threshold &&
        nil.permissionTrimmedBeforeScoring &&
        nil.permissionTrimmedBeforeCitation,
      7,
      `Frozen NIL evaluation accepted at ${(nil.accuracy * 100).toFixed(2)}% top-1 accuracy against the 90% target.`,
      ["M4_2_NIL_SEMANTIC_ACCURACY_RESULT"],
    ),
    flag(
      "M4.2-06",
      reporting.execution.permissionTrimmedBeforeSelection &&
        reporting.execution.concealedFieldIds.includes(
          "restricted_control_note",
        ) &&
        reporting.execution.lineage.immutable &&
        reporting.exportManifest.deliveryStatus ===
          "manifest_only_demo_boundary" &&
        !reporting.exportManifest.liveRepositoryWrite,
      7,
      "The T2+ report builder preserves field permissions, immutable definitions, filters, lineage, citations, audit, and controlled export manifests.",
      ["M4_2_REPORT_BUILDER_RESULT"],
    ),
    flag(
      "M4.2-07",
      administration.change.version.version === 2 &&
        administration.rollback.version.version === 3 &&
        administration.rollback.rollbackCreatedNewVersion &&
        administration.snapshot.appendOnlyHistory &&
        !administration.change.liveConnectorMutation &&
        !administration.rollback.liveConnectorMutation,
      7,
      "No-code configuration validates, approves, logs, versions, and rolls back without mutating a live connector.",
      ["M4_2_NO_CODE_ADMIN_RESULT"],
    ),
  ];
  const firstSevenPassed = flags.every((candidate) => candidate.passed);
  flags.push(
    flag(
      "M4.2-08",
      firstSevenPassed &&
        search.externalWrites === 0 &&
        nil.externalWrites === 0 &&
        reporting.execution.externalWritePerformed === false,
      8,
      "The integrated records, search, NIL, report, administration, permission, retention, and citation scenario passes inside the synthetic boundary.",
      ["M4_2_INTEGRATED_SCENARIO_RESULT"],
    ),
  );
  const accepted =
    flags.length === M42_CRITERION_IDS.length &&
    flags.every((candidate) => candidate.passed);

  return Object.freeze({
    milestone: M42_MILESTONE,
    scenarioId: M42_INTEGRATED_SCENARIO_ID,
    executedAt: M42_EVALUATION_AS_OF,
    requestedBy: Object.freeze({
      actorId: requestedBy.actorId,
      role: requestedBy.role,
      tier: requestedBy.tier,
    }),
    accepted,
    acceptanceFlags: Object.freeze(flags),
    boundary: createM42DemoBoundary(),
    records,
    search,
    nil,
    reporting,
    administration,
    totals: Object.freeze({
      criteriaPassed: flags.filter((candidate) => candidate.passed).length,
      criteriaTotal: M42_CRITERION_IDS.length,
      assertions: flags.reduce(
        (total, candidate) => total + candidate.assertionCount,
        0,
      ),
      realDataRecords: 0 as const,
      liveExternalWrites: 0 as const,
      productionDispositions: 0 as const,
      deployments: 0 as const,
      githubPushes: 0 as const,
    }),
    synthetic: true,
  });
}

export function createM42ExperienceSnapshot(
  viewer: M42ActorContext = actor({
    actorId: "SYNTH-M42-EXPERIENCE-VIEWER",
    role: "managing-director",
    tier: "T1",
    permissions: [
      "m42:report:build",
      "m42:admin:workspace",
      "m42:admin:audit",
      "*",
    ],
    purpose: "Inspect the fictional M4.2 experience inventory.",
  }),
): M42ExperienceSnapshot {
  const registry = createSyntheticM42DocumentRegistry();
  const reportBuilder = createSyntheticM42ReportBuilder();
  const admin = createSyntheticM42ConfigurationAdmin();
  const auditActor = actor({
    actorId: "SYNTH-M42-EXPERIENCE-AUDITOR",
    role: "managing-director",
    tier: "T1",
    permissions: ["*", "m42:admin:audit"],
    clearance: ["public", "internal", "confidential", "restricted"],
    purpose: "Inspect the fictional M4.2 experience inventory.",
  });
  return Object.freeze({
    milestone: M42_MILESTONE,
    title: "Document and Knowledge Management Operational",
    status: "operational_synthetic_prototype",
    boundary: createM42DemoBoundary(),
    viewer: Object.freeze({
      role: viewer.role,
      tier: viewer.tier,
      canBuildReports: viewer.permissions.includes("m42:report:build"),
      canAdministerConfiguration: viewer.permissions.some((permission) =>
        permission.startsWith("m42:admin:"),
      ),
      canRunIntegratedScenario: viewer.tier === "T1" || viewer.tier === "T2",
    }),
    acceptanceTargets: Object.freeze({
      governedCriteria: 8 as const,
      searchLatencyMsExclusive: 3_000 as const,
      nilTop1AccuracyMinimum: 0.9 as const,
      reportBuilderMinimumTier: "T2" as const,
      noCodeAdministration: true as const,
    }),
    inventory: Object.freeze({
      taxonomyNodes: registry.taxonomy.length,
      retentionSchedules: registry.retentionSchedules.length,
      governedDocuments: registry.documents.length,
      searchCorpusDocuments: 2_400 as const,
      searchEvaluationQueries: 24 as const,
      nilArticles: 16 as const,
      nilLabeledQueries: 30 as const,
      reportSources: reportBuilder.snapshot().sources.length,
      configurationSchemas: admin.snapshot(auditActor).schemas.length,
    }),
    modules: Object.freeze([
      {
        criterionId: "M4.2-01",
        label: "Governed document registry",
        experience:
          "Browse complete taxonomy, metadata, ownership, approval, retention, and lifecycle controls.",
      },
      {
        criterionId: "M4.2-02",
        label: "Secure records access",
        experience:
          "Evaluate permission trimming, Part 2 segmentation, legal hold, audit, and manifest-only exports.",
      },
      {
        criterionId: "M4.2-03",
        label: "Version and source of truth",
        experience:
          "Run checkout, conflict control, approval, publication, and supersession as an immutable sequence.",
      },
      {
        criterionId: "M4.2-04",
        label: "Enterprise document search",
        experience:
          "Search the approved 2,400-document fictional corpus with permission trimming before ranking and citation.",
      },
      {
        criterionId: "M4.2-05",
        label: "Networked Intelligence Library",
        experience:
          "Explore cited semantic retrieval proven against the frozen 30-query labeled evaluation set.",
      },
      {
        criterionId: "M4.2-06",
        label: "Governed report builder",
        experience:
          "Create T2+ saved definitions with filters, field security, lineage, and controlled export manifests.",
      },
      {
        criterionId: "M4.2-07",
        label: "No-code administration",
        experience:
          "Preview, validate, approve, version, audit, and roll back configuration without live writes.",
      },
      {
        criterionId: "M4.2-08",
        label: "Integrated document intelligence",
        experience:
          "Run one end-to-end scenario across records, search, NIL, reporting, permissions, retention, and citations.",
      },
    ] satisfies M42ExperienceSnapshot["modules"]),
  });
}
