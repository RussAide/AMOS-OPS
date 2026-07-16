import {
  M42_EVALUATION_AS_OF,
  requireM42SyntheticId,
  type M42ActorContext,
} from "@contracts/m42/shared";
import type {
  M42DisclosureLedger,
  M42DocumentAccessDecision,
  M42DocumentAction,
  M42DocumentRecord,
  M42ExportManifest,
} from "@contracts/m42/records";
import {
  createM42AuditEvent,
  m42RecordsDeterministicId,
} from "./document-governance";

function immutable<T>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function unique<T>(values: readonly T[]): readonly T[] {
  return Object.freeze([...new Set(values)]);
}

function hasPermission(actor: M42ActorContext, permission: string): boolean {
  return actor.permissions.includes(permission);
}

function actionPermission(action: M42DocumentAction): string {
  switch (action) {
    case "metadata_read":
    case "content_read":
      return "documents.read";
    case "download":
      return "documents.download";
    case "export":
      return "documents.export";
    case "disclose":
      return "documents.disclose";
    case "checkout":
      return "documents.checkout";
    case "approve":
      return "documents.approve";
    case "legal_hold":
      return "documents.legal_hold";
  }
}

function classificationPermission(document: M42DocumentRecord): string | null {
  switch (document.classification) {
    case "public":
    case "internal":
      return null;
    case "confidential":
      return "documents.confidential.read";
    case "restricted":
      return "documents.restricted.read";
    case "part2":
      return "documents.part2.read";
  }
}

export function evaluateM42DocumentAccess(
  document: M42DocumentRecord,
  actor: M42ActorContext,
  action: M42DocumentAction,
  evaluatedAt: string = M42_EVALUATION_AS_OF,
): M42DocumentAccessDecision {
  requireM42SyntheticId(actor.actorId, "access_actor_id");
  const reasonCodes: string[] = [];
  const requiredActionPermission = actionPermission(action);
  if (!hasPermission(actor, requiredActionPermission)) {
    reasonCodes.push(`ACTION_PERMISSION_REQUIRED:${requiredActionPermission}`);
  }

  const divisionAllowed =
    document.divisionId === "enterprise" ||
    actor.divisionIds.includes(document.divisionId) ||
    hasPermission(actor, "documents.enterprise.read");
  if (!divisionAllowed) reasonCodes.push("DIVISION_SEGMENT_DENIED");

  if (!actor.sensitivityClearance.includes(document.classification)) {
    reasonCodes.push(`SENSITIVITY_CLEARANCE_REQUIRED:${document.classification}`);
  }
  const requiredClassificationPermission = classificationPermission(document);
  if (
    requiredClassificationPermission &&
    !hasPermission(actor, requiredClassificationPermission)
  ) {
    reasonCodes.push(
      `CLASSIFICATION_PERMISSION_REQUIRED:${requiredClassificationPermission}`,
    );
  }
  if (!actor.minimumNecessaryPurpose.trim()) {
    reasonCodes.push("MINIMUM_NECESSARY_PURPOSE_REQUIRED");
  }
  if (
    document.classification === "part2" &&
    !hasPermission(actor, "documents.part2.consent_verified")
  ) {
    reasonCodes.push("PART2_CONSENT_VERIFICATION_REQUIRED");
  }
  if (action === "download" && !document.downloadEnabled) {
    reasonCodes.push("DOCUMENT_DOWNLOAD_DISABLED");
  }
  if (action === "export" && !document.exportEnabled) {
    reasonCodes.push("DOCUMENT_EXPORT_DISABLED");
  }
  if (action === "disclose") {
    reasonCodes.push("LIVE_DISCLOSURE_UNAVAILABLE");
  }

  const allowed = reasonCodes.length === 0;
  const decisionId = m42RecordsDeterministicId(
    "M42-ACCESS",
    document.documentId,
    actor.actorId,
    action,
    evaluatedAt,
  );
  const auditEvent = createM42AuditEvent({
    eventType: action === "disclose" ? "disclosure_blocked" : "access_evaluated",
    actor,
    entityType: "document",
    entityId: document.documentId,
    correlationId: decisionId,
    sourceIds: [document.stableObjectId, document.currentVersionId],
    outcome: allowed ? "allowed" : action === "disclose" ? "blocked" : "denied",
    reason: allowed
      ? `Least-privilege ${action} access allowed after division, classification, purpose, and action checks.`
      : reasonCodes.join(";"),
    occurredAt: evaluatedAt,
  });
  return immutable({
    decisionId,
    documentId: document.documentId,
    actorId: actor.actorId,
    action,
    allowed,
    reasonCodes: immutable(reasonCodes),
    permissionTrimmed: !allowed,
    metadataVisible: allowed,
    contentVisible: allowed && action !== "metadata_read",
    downloadable: allowed && action === "download",
    exportManifestOnly: allowed && action === "export",
    liveDisclosureAvailable: false,
    evaluatedAt,
    auditEvent,
  });
}

export function permissionTrimM42Documents(
  documents: readonly M42DocumentRecord[],
  actor: M42ActorContext,
  action: "metadata_read" | "content_read" = "metadata_read",
  evaluatedAt: string = M42_EVALUATION_AS_OF,
): {
  visibleDocuments: readonly M42DocumentRecord[];
  decisions: readonly M42DocumentAccessDecision[];
  trimmedDocumentIds: readonly string[];
} {
  const decisions = immutable(
    documents.map((document) =>
      evaluateM42DocumentAccess(document, actor, action, evaluatedAt),
    ),
  );
  const allowedIds = new Set(
    decisions.filter((decision) => decision.allowed).map((decision) => decision.documentId),
  );
  return immutable({
    visibleDocuments: immutable(
      documents.filter((document) => allowedIds.has(document.documentId)),
    ),
    decisions,
    trimmedDocumentIds: immutable(
      decisions
        .filter((decision) => !decision.allowed)
        .map((decision) => decision.documentId),
    ),
  });
}

export function createM42DisclosureLedger(): M42DisclosureLedger {
  return immutable({ events: immutable([]), appendOnly: true, synthetic: true });
}

export function appendM42DisclosureEvent(
  ledger: M42DisclosureLedger,
  decision: M42DocumentAccessDecision,
): M42DisclosureLedger {
  if (
    !["access_evaluated", "disclosure_blocked"].includes(
      decision.auditEvent.eventType,
    )
  ) {
    throw new Error("M42_DISCLOSURE_LEDGER_EVENT_TYPE_INVALID");
  }
  if (ledger.events.some((event) => event.eventId === decision.auditEvent.eventId)) {
    throw new Error("M42_DISCLOSURE_LEDGER_EVENT_DUPLICATE");
  }
  return immutable({
    ...ledger,
    events: immutable([...ledger.events, decision.auditEvent]),
  });
}

export function createM42SyntheticExportManifest(
  documents: readonly M42DocumentRecord[],
  actor: M42ActorContext,
  requestedAt: string = M42_EVALUATION_AS_OF,
): M42ExportManifest {
  const decisions = documents.map((document) =>
    evaluateM42DocumentAccess(document, actor, "export", requestedAt),
  );
  const allowedIds = new Set(
    decisions.filter((decision) => decision.allowed).map((decision) => decision.documentId),
  );
  const allowedDocuments = documents.filter((document) =>
    allowedIds.has(document.documentId),
  );
  const manifestId = m42RecordsDeterministicId(
    "M42-EXPORT-MANIFEST",
    actor.actorId,
    requestedAt,
    ...documents.map((document) => document.documentId),
  );
  const manifestEvent = createM42AuditEvent({
    eventType: "export_manifest_created",
    actor,
    entityType: "document",
    entityId: manifestId,
    correlationId: manifestId,
    sourceIds: allowedDocuments.map((document) => document.stableObjectId),
    outcome: "recorded",
    reason:
      "Synthetic manifest created without binary content, recipient delivery, or live repository write.",
    occurredAt: requestedAt,
  });
  return immutable({
    manifestId,
    requestedBy: actor.actorId,
    requestedAt,
    documentIds: immutable(allowedDocuments.map((document) => document.documentId)),
    versionIds: immutable(allowedDocuments.map((document) => document.currentVersionId)),
    contentHashes: immutable(
      allowedDocuments.map((document) => document.sourceOfTruth.contentHash),
    ),
    deniedDocumentIds: immutable(
      decisions
        .filter((decision) => !decision.allowed)
        .map((decision) => decision.documentId),
    ),
    recipientDelivery: false,
    binaryContentIncluded: false,
    liveRepositoryWrite: false,
    synthetic: true,
    auditEvents: immutable([
      ...decisions.map((decision) => decision.auditEvent),
      manifestEvent,
    ]),
  });
}

export function validateM42DisclosureLedger(
  ledger: M42DisclosureLedger,
): readonly string[] {
  const errors: string[] = [];
  if (!ledger.appendOnly || !ledger.synthetic) errors.push("LEDGER_BOUNDARY_INVALID");
  if (new Set(ledger.events.map((event) => event.eventId)).size !== ledger.events.length) {
    errors.push("LEDGER_EVENT_ID_DUPLICATE");
  }
  for (const event of ledger.events) {
    if (!event.immutable) errors.push(`LEDGER_EVENT_MUTABLE:${event.eventId}`);
    if (!event.reason.trim()) errors.push(`LEDGER_EVENT_REASON_REQUIRED:${event.eventId}`);
    if (event.sourceIds.length === 0) errors.push(`LEDGER_EVENT_SOURCE_REQUIRED:${event.eventId}`);
  }
  return immutable(unique(errors));
}

export function assertM42LiveDisclosureUnavailable(): never {
  throw new Error("M42_LIVE_DISCLOSURE_UNAVAILABLE");
}
