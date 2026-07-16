import type { M42ActorContext } from "@contracts/m42/shared";
import type {
  M42ConfigurationValue,
  M42ReportFieldDefinition,
} from "@contracts/m42/reporting";
import type { M42DocumentAction } from "@contracts/m42/records";
import { evaluateM42DocumentAccess, permissionTrimM42Documents } from "./document-access";
import { createSyntheticM42DocumentRegistry } from "./document-governance";
import {
  checkinM42Document,
  checkoutM42Document,
  createM42VersionLedger,
  decideM42VersionApproval,
  publishM42ApprovedVersion,
  submitM42VersionForApproval,
  validateM42VersionLedger,
} from "./document-versioning";
import { createSyntheticM42ReportBuilder } from "./report-builder";
import { createSyntheticM42ConfigurationAdmin } from "./configuration-admin";
import { buildM42ActorContext } from "./role-context";

function requireReviewer(actor: M42ActorContext): void {
  if (actor.tier !== "T1" && actor.tier !== "T2")
    throw new Error("M42_REVIEWER_TIER_REQUIRED");
}

function documentProjection(document: ReturnType<typeof createSyntheticM42DocumentRegistry>["documents"][number]) {
  return Object.freeze({
    documentId: document.documentId,
    stableObjectId: document.stableObjectId,
    title: document.title,
    description: document.description,
    documentType: document.documentType,
    taxonomyId: document.taxonomyId,
    divisionId: document.divisionId,
    ownerRole: document.ownerRole,
    classification: document.classification,
    lifecycleState: document.lifecycleState,
    currentVersion: document.currentVersion,
    currentVersionId: document.currentVersionId,
    retentionScheduleId: document.retentionScheduleId,
    reviewDueAt: document.reviewDueAt,
    tags: document.tags,
    downloadEnabled: document.downloadEnabled,
    exportEnabled: document.exportEnabled,
    canonicalUri: document.sourceOfTruth.canonicalUri,
    contentHash: document.sourceOfTruth.contentHash,
    synthetic: true as const,
  });
}

export function listM42GovernedDocuments(actor: M42ActorContext) {
  const registry = createSyntheticM42DocumentRegistry();
  const trimmed = permissionTrimM42Documents(
    registry.documents,
    actor,
    "metadata_read",
  );
  return Object.freeze({
    requestedBy: Object.freeze({ role: actor.role, tier: actor.tier }),
    documents: Object.freeze(trimmed.visibleDocuments.map(documentProjection)),
    visibleCount: trimmed.visibleDocuments.length,
    totalCount: registry.documents.length,
    permissionTrimmed: trimmed.trimmedDocumentIds.length > 0,
    deniedDocumentIdsDisclosed: false,
    synthetic: true,
  });
}

export function evaluateM42GovernedDocumentAction(
  actor: M42ActorContext,
  documentId: string,
  action: M42DocumentAction,
) {
  const registry = createSyntheticM42DocumentRegistry();
  const visibleDocuments = permissionTrimM42Documents(
    registry.documents,
    actor,
    "metadata_read",
  ).visibleDocuments;
  const document = visibleDocuments.find(
    (candidate) => candidate.documentId === documentId,
  );
  // Hidden and unknown identifiers intentionally share one response so this
  // endpoint cannot be used to discover the existence or classification of a
  // document outside the caller's metadata-visible corpus.
  if (!document) throw new Error("M42_DOCUMENT_NOT_AVAILABLE");
  const decision = evaluateM42DocumentAccess(document, actor, action);
  return Object.freeze({
    requestedBy: Object.freeze({ role: actor.role, tier: actor.tier }),
    action,
    allowed: decision.allowed,
    reasonCodes: decision.reasonCodes,
    permissionTrimmed: decision.permissionTrimmed,
    metadata: decision.allowed ? documentProjection(document) : null,
    liveDisclosureAvailable: false as const,
    externalWritePerformed: false as const,
    synthetic: true as const,
  });
}

function approvalRolesFor(actor: M42ActorContext) {
  if (actor.role === "managing-director")
    return ["administrator", "super-admin"] as const;
  if (actor.role === "administrator")
    return ["managing-director", "super-admin"] as const;
  if (actor.role === "super-admin")
    return ["managing-director", "administrator"] as const;
  return ["administrator", "managing-director"] as const;
}

export function runM42VersionControlDemo(actor: M42ActorContext) {
  requireReviewer(actor);
  const registry = createSyntheticM42DocumentRegistry();
  const document = registry.documents.find(
    (candidate) =>
      candidate.documentId === "SYNTH-DOCUMENT-ENTERPRISE-DOCTRINE",
  );
  if (!document) throw new Error("M42_VERSION_DEMO_DOCUMENT_NOT_FOUND");
  let ledger = createM42VersionLedger(document);
  const checkout = checkoutM42Document(
    ledger,
    actor,
    document.currentVersionId,
    "2026-12-15T12:00:00.000Z",
  );
  ledger = checkinM42Document(checkout.ledger, {
    actor,
    lockId: checkout.lock.lockId,
    expectedBaseVersionId: document.currentVersionId,
    contentHash: "sha256:synth-doctrine-interactive-1-1",
    changeSummary: "Run the requested fictional version-control demonstration.",
    checkedInAt: "2026-12-15T12:10:00.000Z",
  }).ledger;
  const roles = approvalRolesFor(actor);
  ledger = submitM42VersionForApproval(
    ledger,
    actor,
    roles,
    "2026-12-15T12:11:00.000Z",
  );
  const firstApprover = buildM42ActorContext(roles[0]);
  const secondApprover = buildM42ActorContext(roles[1]);
  ledger = decideM42VersionApproval(
    ledger,
    firstApprover,
    "approved",
    "The fictional version identity and source controls are verified.",
    "2026-12-15T12:12:00.000Z",
  );
  ledger = decideM42VersionApproval(
    ledger,
    secondApprover,
    "approved",
    "The fictional sequential approval is complete.",
    "2026-12-15T12:13:00.000Z",
  );
  ledger = publishM42ApprovedVersion(
    ledger,
    actor,
    "2026-12-15T12:14:00.000Z",
  );
  const validationErrors = validateM42VersionLedger(ledger);
  return Object.freeze({
    requestedBy: Object.freeze({ role: actor.role, tier: actor.tier }),
    documentId: ledger.document.documentId,
    currentVersion: ledger.document.currentVersion,
    currentVersionId: ledger.document.currentVersionId,
    sourceOfTruthHash: ledger.document.sourceOfTruth.contentHash,
    versions: Object.freeze(
      ledger.versions.map((version) => ({
        versionId: version.versionId,
        version: version.version,
        status: version.status,
        createdByRole: version.createdByRole,
        approvalStatus: version.approvalRoute?.status ?? null,
        immutableAfterPublish: version.immutableAfterPublish,
      })),
    ),
    approvalRoles: roles,
    auditEventCount: ledger.auditEvents.length,
    validationErrors,
    externalWritePerformed: false as const,
    synthetic: true as const,
  });
}

export function listM42ReportFields(
  actor: M42ActorContext,
): readonly M42ReportFieldDefinition[] {
  requireReviewer(actor);
  return createSyntheticM42ReportBuilder().listAvailableFields(
    actor,
    "SYNTH-M42-SOURCE-OPERATIONS",
  );
}

export function runM42ReportBuilderDemo(actor: M42ActorContext) {
  requireReviewer(actor);
  const author = buildM42ActorContext("managing-director");
  const builder = createSyntheticM42ReportBuilder();
  const definition = builder.saveDefinition(
    author,
    {
      stableKey: "SYNTH-M42-INTERACTIVE-REPORT",
      title: "Synthetic interactive division report",
      purpose:
        "Demonstrate viewer-specific field trimming, lineage, filters, audit, and controlled export.",
      sourceId: "SYNTH-M42-SOURCE-OPERATIONS",
      selectedFieldIds: [
        "record_id",
        "division",
        "service_count",
        "net_revenue",
      ],
      filters: [{ fieldId: "division", operator: "equals", value: "BHC" }],
      exportEnabled: true,
    },
    "2026-12-15T13:00:00.000Z",
  );
  const execution = builder.executeDefinition(
    actor,
    definition.definitionId,
    "2026-12-15T13:01:00.000Z",
  );
  const exportManifest = builder.createExportManifest(
    actor,
    execution,
    "csv-manifest",
    "2026-12-15T13:02:00.000Z",
  );
  return Object.freeze({
    requestedBy: Object.freeze({ role: actor.role, tier: actor.tier }),
    availableFields: listM42ReportFields(actor),
    definition: Object.freeze({
      definitionId: definition.definitionId,
      version: definition.version,
      title: definition.title,
      immutable: definition.immutable,
    }),
    execution,
    exportManifest,
    auditEventCount: builder.snapshot().auditEvents.length,
    synthetic: true as const,
  });
}

export function listM42ConfigurationSchemas(actor: M42ActorContext) {
  requireReviewer(actor);
  return createSyntheticM42ConfigurationAdmin().listSchemas(actor);
}

function demoValue(
  key: string,
  current: M42ConfigurationValue,
): M42ConfigurationValue {
  if (key === "records.retention.review_window_days") return 120;
  if (key === "search.result_limit") return 30;
  if (key === "reporting.export.max_rows") return 300;
  if (key === "workspace.documents.default_view") return "owned";
  if (key === "search.enabled_classifications")
    return ["public", "internal", "confidential", "restricted"];
  throw new Error(`M42_CONFIG_DEMO_VALUE_UNAVAILABLE:${key}:${String(current)}`);
}

export function runM42ConfigurationDemo(
  actor: M42ActorContext,
  requestedKey?: string,
) {
  requireReviewer(actor);
  const admin = createSyntheticM42ConfigurationAdmin();
  const available = admin.listSchemas(actor);
  const schema = requestedKey
    ? available.find((candidate) => candidate.configKey === requestedKey)
    : available[0];
  if (!schema) throw new Error("M42_CONFIG_DEMO_SCHEMA_NOT_AUTHORIZED");
  const initial = admin.currentVersion(actor, schema.configKey);
  const preview = admin.previewChange(actor, {
    configKey: schema.configKey,
    proposedValue: demoValue(schema.configKey, initial.value),
    reason: "Run the requested fictional no-code configuration demonstration.",
    requestedAt: "2026-12-15T14:00:00.000Z",
  });
  const approverRole =
    actor.role === "managing-director" ? "administrator" : "managing-director";
  const approver = buildM42ActorContext(approverRole);
  const changeApproval = preview.approvalRequired
    ? admin.approvePreview(approver, preview, {
        approvedAt: "2026-12-15T14:01:00.000Z",
        rationale: "The bounded fictional configuration change is approved.",
      })
    : null;
  const change = admin.applyPreview(
    actor,
    preview,
    "2026-12-15T14:02:00.000Z",
    changeApproval,
  );
  const rollbackPreview = admin.previewRollback(actor, {
    configKey: schema.configKey,
    targetVersionId: initial.versionId,
    reason: "Restore the verified fictional baseline through append-only rollback.",
    requestedAt: "2026-12-15T14:03:00.000Z",
  });
  const rollbackApproval = admin.approvePreview(approver, rollbackPreview, {
    approvedAt: "2026-12-15T14:04:00.000Z",
    rationale: "The verified fictional baseline should be restored.",
  });
  const rollback = admin.applyPreview(
    actor,
    rollbackPreview,
    "2026-12-15T14:05:00.000Z",
    rollbackApproval,
  );
  return Object.freeze({
    requestedBy: Object.freeze({ role: actor.role, tier: actor.tier }),
    schema,
    initial,
    change,
    rollback,
    history: admin.history(actor, schema.configKey),
    externalWritePerformed: false as const,
    synthetic: true as const,
  });
}
