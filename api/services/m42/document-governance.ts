import {
  M42_EVALUATION_AS_OF,
  M42_EVIDENCE_CLASS,
  requireM42SyntheticId,
  type M42ActorContext,
  type M42AuditEvent,
  type M42RecordState,
} from "@contracts/m42/shared";
import type {
  M42ApprovalRoute,
  M42ApprovalStep,
  M42DispositionPreview,
  M42DocumentRecord,
  M42DocumentRegistry,
  M42DocumentType,
  M42LegalHold,
  M42RetentionSchedule,
  M42TaxonomyNode,
} from "@contracts/m42/records";
import type { UserRole } from "@/constants/roles";

function token(value: string): string {
  return (
    value
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 42) || "EMPTY"
  );
}

function stableHash(value: string): string {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(36).toUpperCase().padStart(7, "0");
}

export function m42RecordsDeterministicId(
  prefix: string,
  ...parts: readonly string[]
): string {
  return `SYNTH-${token(prefix)}-${stableHash(parts.join("|"))}`;
}

function immutable<T>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function unique<T>(values: readonly T[]): readonly T[] {
  return Object.freeze([...new Set(values)]);
}

function assertIso(value: string, code: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new Error(code);
}

function assertHumanActor(actor: M42ActorContext): void {
  requireM42SyntheticId(actor.actorId, "actor_id");
  if (/^(?:SYNTH-)?(?:AI|AMOS|ASSISTANT|MODEL|SYSTEM)(?:$|[-_:])/i.test(actor.actorId)) {
    throw new Error("M42_HUMAN_GOVERNANCE_ACTOR_REQUIRED");
  }
}

export function createM42AuditEvent(input: {
  eventType: M42AuditEvent["eventType"];
  actor: Pick<M42ActorContext, "actorId" | "role">;
  entityType: M42AuditEvent["entityType"];
  entityId: string;
  correlationId: string;
  sourceIds?: readonly string[];
  outcome: M42AuditEvent["outcome"];
  reason: string;
  occurredAt?: string;
}): M42AuditEvent {
  const occurredAt = input.occurredAt ?? M42_EVALUATION_AS_OF;
  assertIso(occurredAt, "M42_AUDIT_TIME_INVALID");
  requireM42SyntheticId(input.actor.actorId, "audit_actor_id");
  return immutable({
    eventId: m42RecordsDeterministicId(
      "M42-AUDIT",
      input.eventType,
      input.entityId,
      input.actor.actorId,
      input.correlationId,
      occurredAt,
    ),
    eventType: input.eventType,
    actorId: input.actor.actorId,
    actorRole: input.actor.role,
    entityType: input.entityType,
    entityId: input.entityId,
    correlationId: input.correlationId,
    sourceIds: unique(input.sourceIds ?? []),
    outcome: input.outcome,
    reason: input.reason,
    occurredAt,
    immutable: true,
    evidenceClass: M42_EVIDENCE_CLASS,
  });
}

const RECORDS_OWNER: M42ActorContext = immutable({
  actorId: "SYNTH-HUMAN-RECORDS-OWNER",
  role: "administrator",
  tier: "T1",
  divisionIds: immutable(["eo"]),
  permissions: immutable([
    "documents.governance",
    "documents.read",
    "documents.enterprise",
    "documents.approve",
    "documents.legal_hold",
  ]),
  sensitivityClearance: immutable([
    "public",
    "internal",
    "confidential",
    "restricted",
    "part2",
  ]),
  minimumNecessaryPurpose: "Synthetic enterprise records governance evaluation",
  synthetic: true,
});

function actor(
  actorId: string,
  role: UserRole,
  tier: M42ActorContext["tier"],
  divisionIds: M42ActorContext["divisionIds"],
  permissions: M42ActorContext["permissions"],
  sensitivityClearance: M42ActorContext["sensitivityClearance"],
  purpose: string,
): M42ActorContext {
  return immutable({
    actorId,
    role,
    tier,
    divisionIds: immutable(divisionIds),
    permissions: immutable(permissions),
    sensitivityClearance: immutable(sensitivityClearance),
    minimumNecessaryPurpose: purpose,
    synthetic: true,
  });
}

export function createSyntheticM42RecordsActors() {
  return immutable({
    recordsOwner: RECORDS_OWNER,
    facilitiesEditor: actor(
      "SYNTH-HUMAN-FACILITIES-EDITOR",
      "facilities-manager",
      "T3",
      ["gad"],
      ["documents.read", "documents.checkout", "documents.governance"],
      ["public", "internal"],
      "Maintain the synthetic campus safety procedure",
    ),
    enterpriseApprover: actor(
      "SYNTH-HUMAN-ENTERPRISE-APPROVER",
      "administrator",
      "T1",
      ["eo"],
      [
        "documents.read",
        "documents.enterprise.read",
        "documents.approve",
        "documents.governance",
        "documents.enterprise.governance",
        "documents.legal_hold",
        "documents.download",
        "documents.export",
        "documents.confidential.read",
        "documents.restricted.read",
      ],
      ["public", "internal", "confidential", "restricted"],
      "Approve and govern synthetic enterprise records",
    ),
    complianceApprover: actor(
      "SYNTH-HUMAN-COMPLIANCE-APPROVER",
      "hr-compliance-officer",
      "T3",
      ["eo"],
      [
        "documents.read",
        "documents.enterprise.read",
        "documents.approve",
        "documents.confidential.read",
        "documents.restricted.read",
      ],
      ["public", "internal", "confidential", "restricted"],
      "Perform synthetic compliance approval",
    ),
    clinicalReader: actor(
      "SYNTH-HUMAN-CLINICAL-READER",
      "clinical-supervisor",
      "T3",
      ["bhc"],
      ["documents.read", "documents.download", "documents.restricted.read"],
      ["public", "internal", "restricted"],
      "Review governed synthetic clinical-reference metadata",
    ),
    part2Reader: actor(
      "SYNTH-HUMAN-PART2-READER",
      "clinical-director",
      "T2",
      ["bhc"],
      [
        "documents.read",
        "documents.part2.read",
        "documents.part2.consent_verified",
      ],
      ["public", "internal", "restricted", "part2"],
      "Review the synthetic Part 2 disclosure-control procedure",
    ),
    limitedResidentialReader: actor(
      "SYNTH-HUMAN-RESIDENTIAL-READER",
      "youth-care-worker",
      "T4",
      ["gro"],
      ["documents.read"],
      ["public", "internal"],
      "Read minimum-necessary synthetic residential procedures",
    ),
    exporter: actor(
      "SYNTH-HUMAN-ENTERPRISE-EXPORTER",
      "managing-director",
      "T1",
      ["eo"],
      [
        "documents.read",
        "documents.enterprise.read",
        "documents.export",
        "documents.confidential.read",
        "documents.restricted.read",
      ],
      ["public", "internal", "confidential", "restricted"],
      "Create a synthetic controlled export manifest for oversight",
    ),
  });
}

function approvedRoute(
  documentId: string,
  roles: readonly UserRole[],
): M42ApprovalRoute {
  const requestedAt = "2026-12-01T10:00:00.000Z";
  const steps: readonly M42ApprovalStep[] = roles.map((requiredRole, index) =>
    immutable({
      step: index + 1,
      requiredRole,
      decision: "approved" as const,
      decidedBy: `SYNTH-HUMAN-${token(requiredRole)}`,
      decidedAt: `2026-12-0${index + 2}T10:00:00.000Z`,
      rationale: "Synthetic approval confirms metadata, ownership, and control conformance.",
    }),
  );
  return immutable({
    routeId: m42RecordsDeterministicId("M42-ROUTE", documentId, ...roles),
    requestedBy: RECORDS_OWNER.actorId,
    requestedAt,
    steps: immutable(steps),
    status: "approved",
      completedAt: steps[steps.length - 1]?.decidedAt ?? requestedAt,
    synthetic: true,
  });
}

function taxonomyNode(input: Omit<M42TaxonomyNode, "active" | "synthetic">): M42TaxonomyNode {
  return immutable({ ...input, allowedDocumentTypes: immutable(input.allowedDocumentTypes), active: true, synthetic: true });
}

function schedule(input: Omit<M42RetentionSchedule, "dispositionMethod" | "legalHoldOverride" | "productionDispositionAvailable" | "synthetic">): M42RetentionSchedule {
  return immutable({
    ...input,
    approvalRoles: immutable(input.approvalRoles),
    dispositionMethod: "synthetic_review",
    legalHoldOverride: true,
    productionDispositionAvailable: false,
    synthetic: true,
  });
}

function documentRecord(input: {
  documentId: string;
  title: string;
  description: string;
  documentType: M42DocumentType;
  taxonomyId: string;
  divisionId: M42DocumentRecord["divisionId"];
  ownerRole: UserRole;
  classification: M42DocumentRecord["classification"];
  retentionScheduleId: string;
  tags: readonly string[];
  contentHash: string;
  downloadEnabled?: boolean;
  exportEnabled?: boolean;
}): M42DocumentRecord {
  const stableObjectId = input.documentId.replace("DOCUMENT", "OBJECT");
  const currentVersion = "1.0";
  const currentVersionId = `${input.documentId}-V1-0`;
  return immutable({
    documentId: input.documentId,
    stableObjectId,
    title: input.title,
    description: input.description,
    documentType: input.documentType,
    taxonomyId: input.taxonomyId,
    divisionId: input.divisionId,
    ownerId: `SYNTH-HUMAN-${token(input.ownerRole)}`,
    ownerRole: input.ownerRole,
    classification: input.classification,
    lifecycleState: "published",
    currentVersion,
    currentVersionId,
    retentionScheduleId: input.retentionScheduleId,
    effectiveAt: "2026-12-05T08:00:00.000Z",
    reviewDueAt: "2027-12-05T08:00:00.000Z",
    tags: unique(input.tags),
    approvalRoute: approvedRoute(input.documentId, [input.ownerRole, "administrator"]),
    legalHolds: immutable([]),
    sourceOfTruth: immutable({
      stableObjectId,
      canonicalUri: `amos-ops://synthetic-dms/${stableObjectId}`,
      canonicalRepository: "amos_ops_synthetic_dms",
      currentVersionId,
      contentHash: input.contentHash,
      supersedesStableObjectId: null,
      supersededByStableObjectId: null,
      externalWriteAvailable: false,
      synthetic: true,
    }),
    downloadEnabled: input.downloadEnabled ?? true,
    exportEnabled: input.exportEnabled ?? true,
    productionDispositionAvailable: false,
    evidenceClass: M42_EVIDENCE_CLASS,
    synthetic: true,
  });
}

export function createSyntheticM42DocumentRegistry(): M42DocumentRegistry {
  const taxonomy = immutable([
    taxonomyNode({ taxonomyId: "SYNTH-TAX-ENTERPRISE", parentTaxonomyId: null, code: "ENT", label: "Enterprise", divisionId: "enterprise", allowedDocumentTypes: ["policy", "procedure", "governance_record"], defaultClassification: "internal", defaultRetentionScheduleId: "SYNTH-RET-POLICY-7Y", ownerRole: "administrator" }),
    taxonomyNode({ taxonomyId: "SYNTH-TAX-ENTERPRISE-GOV", parentTaxonomyId: "SYNTH-TAX-ENTERPRISE", code: "ENT-GOV", label: "Enterprise Governance", divisionId: "enterprise", allowedDocumentTypes: ["policy", "governance_record"], defaultClassification: "internal", defaultRetentionScheduleId: "SYNTH-RET-POLICY-7Y", ownerRole: "managing-director" }),
    taxonomyNode({ taxonomyId: "SYNTH-TAX-EO-HR", parentTaxonomyId: "SYNTH-TAX-ENTERPRISE", code: "EO-HR", label: "Executive Office / Human Resources", divisionId: "eo", allowedDocumentTypes: ["policy", "form", "training_material", "operations_record"], defaultClassification: "confidential", defaultRetentionScheduleId: "SYNTH-RET-WORKFORCE-7Y", ownerRole: "hr-director" }),
    taxonomyNode({ taxonomyId: "SYNTH-TAX-GAD-OPS", parentTaxonomyId: "SYNTH-TAX-ENTERPRISE", code: "GAD-OPS", label: "General Administration / Operations", divisionId: "gad", allowedDocumentTypes: ["procedure", "form", "operations_record"], defaultClassification: "internal", defaultRetentionScheduleId: "SYNTH-RET-OPS-5Y", ownerRole: "facilities-manager" }),
    taxonomyNode({ taxonomyId: "SYNTH-TAX-GRO-OPS", parentTaxonomyId: "SYNTH-TAX-ENTERPRISE", code: "GRO-OPS", label: "Residential Operations", divisionId: "gro", allowedDocumentTypes: ["policy", "procedure", "form", "training_material"], defaultClassification: "restricted", defaultRetentionScheduleId: "SYNTH-RET-CARE-10Y", ownerRole: "gro-administrator" }),
    taxonomyNode({ taxonomyId: "SYNTH-TAX-BHC-CLIN", parentTaxonomyId: "SYNTH-TAX-ENTERPRISE", code: "BHC-CLIN", label: "Behavioral Health / Clinical Knowledge", divisionId: "bhc", allowedDocumentTypes: ["policy", "procedure", "clinical_reference", "form"], defaultClassification: "restricted", defaultRetentionScheduleId: "SYNTH-RET-CARE-10Y", ownerRole: "clinical-director" }),
    taxonomyNode({ taxonomyId: "SYNTH-TAX-BHC-PART2", parentTaxonomyId: "SYNTH-TAX-BHC-CLIN", code: "BHC-PART2", label: "Behavioral Health / Part 2 Segmented", divisionId: "bhc", allowedDocumentTypes: ["policy", "procedure", "clinical_reference", "form"], defaultClassification: "part2", defaultRetentionScheduleId: "SYNTH-RET-CARE-10Y", ownerRole: "clinical-director" }),
  ]);

  const retentionSchedules = immutable([
    schedule({ scheduleId: "SYNTH-RET-POLICY-7Y", code: "POL-07", title: "Policy and governance retention", trigger: "superseded", retentionYears: 7, approvalRoles: ["administrator", "hr-compliance-officer"] }),
    schedule({ scheduleId: "SYNTH-RET-WORKFORCE-7Y", code: "HR-07", title: "Synthetic workforce records retention", trigger: "withdrawn", retentionYears: 7, approvalRoles: ["hr-director", "hr-compliance-officer"] }),
    schedule({ scheduleId: "SYNTH-RET-OPS-5Y", code: "OPS-05", title: "Synthetic operating records retention", trigger: "fiscal_year_close", retentionYears: 5, approvalRoles: ["administrator", "facilities-manager"] }),
    schedule({ scheduleId: "SYNTH-RET-CARE-10Y", code: "CARE-10", title: "Synthetic care and clinical reference retention", trigger: "published", retentionYears: 10, approvalRoles: ["clinical-director", "hr-compliance-officer"] }),
  ]);

  const documents = immutable([
    documentRecord({ documentId: "SYNTH-DOCUMENT-ENTERPRISE-DOCTRINE", title: "Synthetic AMOS-OPS Enterprise Operating Doctrine", description: "Fictional demonstration doctrine and source-of-truth control.", documentType: "governance_record", taxonomyId: "SYNTH-TAX-ENTERPRISE-GOV", divisionId: "enterprise", ownerRole: "managing-director", classification: "internal", retentionScheduleId: "SYNTH-RET-POLICY-7Y", tags: ["doctrine", "governance", "source-of-truth"], contentHash: "sha256:synth-doctrine-1-0" }),
    documentRecord({ documentId: "SYNTH-DOCUMENT-GAD-CAMPUS-SAFETY", title: "Synthetic Campus Safety Procedure", description: "Fictional campus readiness and facilities response procedure.", documentType: "procedure", taxonomyId: "SYNTH-TAX-GAD-OPS", divisionId: "gad", ownerRole: "facilities-manager", classification: "internal", retentionScheduleId: "SYNTH-RET-OPS-5Y", tags: ["campus", "safety", "facilities"], contentHash: "sha256:synth-campus-safety-1-0" }),
    documentRecord({ documentId: "SYNTH-DOCUMENT-EO-WORKFORCE-TRAINING", title: "Synthetic Workforce Training Record", description: "Fictional workforce completion record with confidential segmentation.", documentType: "operations_record", taxonomyId: "SYNTH-TAX-EO-HR", divisionId: "eo", ownerRole: "hr-director", classification: "confidential", retentionScheduleId: "SYNTH-RET-WORKFORCE-7Y", tags: ["workforce", "training", "confidential"], contentHash: "sha256:synth-workforce-training-1-0", exportEnabled: false }),
    documentRecord({ documentId: "SYNTH-DOCUMENT-GRO-YOUTH-CONTINUUM", title: "Synthetic Youth Continuum Procedure", description: "Fictional residential-to-community continuum operating procedure.", documentType: "procedure", taxonomyId: "SYNTH-TAX-GRO-OPS", divisionId: "gro", ownerRole: "gro-administrator", classification: "restricted", retentionScheduleId: "SYNTH-RET-CARE-10Y", tags: ["youth", "continuum", "residential"], contentHash: "sha256:synth-youth-continuum-1-0" }),
    documentRecord({ documentId: "SYNTH-DOCUMENT-BHC-CLINICAL-REFERENCE", title: "Synthetic Clinical Team Evidence Reference", description: "Fictional metadata-only clinical knowledge reference; no real clinical content.", documentType: "clinical_reference", taxonomyId: "SYNTH-TAX-BHC-CLIN", divisionId: "bhc", ownerRole: "clinical-director", classification: "restricted", retentionScheduleId: "SYNTH-RET-CARE-10Y", tags: ["clinical", "evidence", "metadata-only"], contentHash: "sha256:synth-clinical-reference-1-0" }),
    documentRecord({ documentId: "SYNTH-DOCUMENT-BHC-PART2-CONSENT", title: "Synthetic Part 2 Disclosure Procedure", description: "Fictional segmented procedure; contains no person or treatment data.", documentType: "procedure", taxonomyId: "SYNTH-TAX-BHC-PART2", divisionId: "bhc", ownerRole: "clinical-director", classification: "part2", retentionScheduleId: "SYNTH-RET-CARE-10Y", tags: ["part2", "segmented", "consent"], contentHash: "sha256:synth-part2-procedure-1-0", downloadEnabled: false, exportEnabled: false }),
  ]);

  const auditEvents = immutable(documents.map((document) => createM42AuditEvent({
    eventType: "document_registered",
    actor: RECORDS_OWNER,
    entityType: "document",
    entityId: document.documentId,
    correlationId: "SYNTH-M42-REGISTRY-BOOTSTRAP",
    sourceIds: [document.stableObjectId, document.currentVersionId],
    outcome: "recorded",
    reason: "Synthetic governed document registered with complete records metadata.",
  })));

  const registry = immutable({
    taxonomy,
    retentionSchedules,
    documents,
    auditEvents,
    frozenAt: M42_EVALUATION_AS_OF,
    productionRepositoryConnected: false as const,
    synthetic: true as const,
  });
  const errors = validateM42DocumentRegistry(registry);
  if (errors.length > 0) throw new Error(`M42_DOCUMENT_REGISTRY_INVALID:${errors.join(",")}`);
  return registry;
}

export function validateM42DocumentRegistry(registry: M42DocumentRegistry): readonly string[] {
  const errors: string[] = [];
  const taxonomyIds = new Set(registry.taxonomy.map((node) => node.taxonomyId));
  const scheduleIds = new Set(registry.retentionSchedules.map((item) => item.scheduleId));
  const documentIds = new Set<string>();
  const stableObjectIds = new Set<string>();
  if (registry.productionRepositoryConnected !== false) errors.push("PRODUCTION_REPOSITORY_MUST_BE_DISCONNECTED");
  for (const node of registry.taxonomy) {
    if (node.parentTaxonomyId && !taxonomyIds.has(node.parentTaxonomyId)) errors.push(`TAXONOMY_PARENT_MISSING:${node.taxonomyId}`);
    if (!scheduleIds.has(node.defaultRetentionScheduleId)) errors.push(`TAXONOMY_RETENTION_MISSING:${node.taxonomyId}`);
  }
  for (const document of registry.documents) {
    if (documentIds.has(document.documentId)) errors.push(`DOCUMENT_ID_DUPLICATE:${document.documentId}`);
    if (stableObjectIds.has(document.stableObjectId)) errors.push(`STABLE_OBJECT_ID_DUPLICATE:${document.stableObjectId}`);
    documentIds.add(document.documentId);
    stableObjectIds.add(document.stableObjectId);
    const node = registry.taxonomy.find((candidate) => candidate.taxonomyId === document.taxonomyId);
    if (!node) errors.push(`DOCUMENT_TAXONOMY_MISSING:${document.documentId}`);
    else {
      if (!node.allowedDocumentTypes.includes(document.documentType)) errors.push(`DOCUMENT_TYPE_NOT_ALLOWED:${document.documentId}`);
      if (node.divisionId !== "enterprise" && node.divisionId !== document.divisionId) errors.push(`DOCUMENT_DIVISION_MISMATCH:${document.documentId}`);
    }
    if (!scheduleIds.has(document.retentionScheduleId)) errors.push(`DOCUMENT_RETENTION_MISSING:${document.documentId}`);
    if (document.sourceOfTruth.stableObjectId !== document.stableObjectId || document.sourceOfTruth.currentVersionId !== document.currentVersionId) errors.push(`SOURCE_OF_TRUTH_MISMATCH:${document.documentId}`);
    if (!document.approvalRoute || document.approvalRoute.status !== "approved") errors.push(`DOCUMENT_APPROVAL_INCOMPLETE:${document.documentId}`);
    if (document.productionDispositionAvailable !== false || !document.synthetic) errors.push(`DOCUMENT_BOUNDARY_INVALID:${document.documentId}`);
  }
  return immutable(errors);
}

export function requestM42DocumentApproval(
  document: M42DocumentRecord,
  actor: M42ActorContext,
  requiredRoles: readonly UserRole[],
  requestedAt: string = M42_EVALUATION_AS_OF,
): { document: M42DocumentRecord; auditEvent: M42AuditEvent } {
  assertHumanActor(actor);
  assertIso(requestedAt, "M42_APPROVAL_REQUEST_TIME_INVALID");
  if (!actor.permissions.includes("documents.governance")) throw new Error("M42_DOCUMENT_GOVERNANCE_PERMISSION_REQUIRED");
  if (requiredRoles.length === 0) throw new Error("M42_APPROVAL_ROLE_REQUIRED");
  if (!["draft", "in_review"].includes(document.lifecycleState)) throw new Error("M42_APPROVAL_REQUEST_STATE_INVALID");
  const route: M42ApprovalRoute = immutable({
    routeId: m42RecordsDeterministicId("M42-ROUTE", document.documentId, requestedAt, ...requiredRoles),
    requestedBy: actor.actorId,
    requestedAt,
    steps: immutable(requiredRoles.map((requiredRole, index) => immutable({ step: index + 1, requiredRole, decision: "pending" as const, decidedBy: null, decidedAt: null, rationale: null }))),
    status: "pending",
    completedAt: null,
    synthetic: true,
  });
  const updated = immutable({ ...document, lifecycleState: "in_review" as const, approvalRoute: route });
  return immutable({
    document: updated,
    auditEvent: createM42AuditEvent({ eventType: "approval_recorded", actor, entityType: "document", entityId: document.documentId, correlationId: route.routeId, sourceIds: [document.stableObjectId], outcome: "recorded", reason: "Synthetic sequential approval route requested.", occurredAt: requestedAt }),
  });
}

export function decideM42DocumentApproval(
  document: M42DocumentRecord,
  actor: M42ActorContext,
  decision: "approved" | "rejected",
  rationale: string,
  decidedAt: string = M42_EVALUATION_AS_OF,
): { document: M42DocumentRecord; auditEvent: M42AuditEvent } {
  assertHumanActor(actor);
  assertIso(decidedAt, "M42_APPROVAL_DECISION_TIME_INVALID");
  if (!actor.permissions.includes("documents.approve")) throw new Error("M42_DOCUMENT_APPROVAL_PERMISSION_REQUIRED");
  if (!rationale.trim()) throw new Error("M42_APPROVAL_RATIONALE_REQUIRED");
  const route = document.approvalRoute;
  if (!route || route.status !== "pending") throw new Error("M42_PENDING_APPROVAL_ROUTE_REQUIRED");
  const pending = route.steps.find((step) => step.decision === "pending");
  if (!pending || pending.requiredRole !== actor.role) throw new Error("M42_SEQUENTIAL_APPROVER_ROLE_MISMATCH");
  if (actor.actorId === route.requestedBy) throw new Error("M42_APPROVAL_SEPARATION_OF_DUTIES_REQUIRED");
  const steps = immutable(route.steps.map((step) => step.step === pending.step ? immutable({ ...step, decision, decidedBy: actor.actorId, decidedAt, rationale }) : step));
  const status: M42ApprovalRoute["status"] = decision === "rejected" ? "rejected" : steps.every((step) => step.decision === "approved") ? "approved" : "pending";
  const updatedRoute: M42ApprovalRoute = immutable({ ...route, steps, status, completedAt: status === "pending" ? null : decidedAt });
  const lifecycleState: M42RecordState = status === "approved" ? "approved" : status === "rejected" ? "draft" : "in_review";
  const updated = immutable({ ...document, approvalRoute: updatedRoute, lifecycleState });
  return immutable({
    document: updated,
    auditEvent: createM42AuditEvent({ eventType: "approval_recorded", actor, entityType: "document", entityId: document.documentId, correlationId: route.routeId, sourceIds: [document.currentVersionId], outcome: decision === "approved" ? "allowed" : "denied", reason: rationale, occurredAt: decidedAt }),
  });
}

const ALLOWED_TRANSITIONS: Readonly<Record<M42RecordState, readonly M42RecordState[]>> = immutable({
  draft: immutable(["in_review", "withdrawn"]),
  in_review: immutable(["draft", "approved", "withdrawn"]),
  approved: immutable(["published", "withdrawn"]),
  published: immutable(["superseded", "withdrawn"]),
  superseded: immutable(["retained"]),
  withdrawn: immutable(["retained"]),
  retained: immutable([]),
});

export function transitionM42DocumentLifecycle(
  document: M42DocumentRecord,
  actor: M42ActorContext,
  targetState: M42RecordState,
  occurredAt: string = M42_EVALUATION_AS_OF,
): { document: M42DocumentRecord; auditEvent: M42AuditEvent } {
  assertHumanActor(actor);
  if (!actor.permissions.includes("documents.governance")) throw new Error("M42_DOCUMENT_GOVERNANCE_PERMISSION_REQUIRED");
  if (!ALLOWED_TRANSITIONS[document.lifecycleState].includes(targetState)) throw new Error("M42_DOCUMENT_LIFECYCLE_TRANSITION_INVALID");
  if (targetState === "published" && document.approvalRoute?.status !== "approved") throw new Error("M42_APPROVAL_REQUIRED_BEFORE_PUBLISH");
  if (targetState === "retained" && !["superseded", "withdrawn"].includes(document.lifecycleState)) throw new Error("M42_RETENTION_STATE_INVALID");
  const updated = immutable({ ...document, lifecycleState: targetState });
  return immutable({
    document: updated,
    auditEvent: createM42AuditEvent({ eventType: targetState === "superseded" ? "record_superseded" : "approval_recorded", actor, entityType: "document", entityId: document.documentId, correlationId: m42RecordsDeterministicId("M42-LIFECYCLE", document.documentId, document.lifecycleState, targetState), sourceIds: [document.currentVersionId], outcome: "recorded", reason: `Synthetic lifecycle transition ${document.lifecycleState} -> ${targetState}.`, occurredAt }),
  });
}

export function applyM42SyntheticLegalHold(
  document: M42DocumentRecord,
  actor: M42ActorContext,
  reason: string,
  matterReference: string,
  appliedAt: string = M42_EVALUATION_AS_OF,
): { document: M42DocumentRecord; hold: M42LegalHold; auditEvent: M42AuditEvent } {
  assertHumanActor(actor);
  if (!actor.permissions.includes("documents.legal_hold")) throw new Error("M42_LEGAL_HOLD_PERMISSION_REQUIRED");
  if (!reason.trim() || !matterReference.trim()) throw new Error("M42_LEGAL_HOLD_METADATA_REQUIRED");
  const hold: M42LegalHold = immutable({
    holdId: m42RecordsDeterministicId("M42-HOLD", document.documentId, matterReference, appliedAt),
    reason,
    matterReference,
    appliedBy: actor.actorId,
    appliedByRole: actor.role,
    appliedAt,
    releasedAt: null,
    active: true,
    productionEffect: false as const,
    synthetic: true as const,
  });
  const updated = immutable({ ...document, legalHolds: immutable([...document.legalHolds, hold]) });
  return immutable({
    document: updated,
    hold,
    auditEvent: createM42AuditEvent({ eventType: "legal_hold_applied", actor, entityType: "document", entityId: document.documentId, correlationId: hold.holdId, sourceIds: [document.stableObjectId], outcome: "recorded", reason: `${reason} Production legal-hold mutation remains unavailable.`, occurredAt: appliedAt }),
  });
}

function addYears(iso: string, years: number): number {
  const date = new Date(iso);
  date.setUTCFullYear(date.getUTCFullYear() + years);
  return date.getTime();
}

export function previewM42SyntheticDisposition(
  document: M42DocumentRecord,
  schedules: readonly M42RetentionSchedule[],
  evaluatedAt: string = M42_EVALUATION_AS_OF,
): M42DispositionPreview {
  assertIso(evaluatedAt, "M42_DISPOSITION_EVALUATION_TIME_INVALID");
  const schedule = schedules.find((candidate) => candidate.scheduleId === document.retentionScheduleId);
  if (!schedule) throw new Error("M42_RETENTION_SCHEDULE_NOT_FOUND");
  const legalHoldActive = document.legalHolds.some((hold) => hold.active && hold.releasedAt === null);
  const retentionComplete = Date.parse(evaluatedAt) >= addYears(document.effectiveAt, schedule.retentionYears);
  const reasons: string[] = [];
  if (!retentionComplete) reasons.push("RETENTION_PERIOD_NOT_COMPLETE");
  if (legalHoldActive) reasons.push("ACTIVE_LEGAL_HOLD");
  reasons.push("SYNTHETIC_REVIEW_ONLY");
  reasons.push("PRODUCTION_DISPOSITION_UNAVAILABLE");
  return immutable({
    documentId: document.documentId,
    scheduleId: schedule.scheduleId,
    evaluatedAt,
    retentionComplete,
    legalHoldActive,
    eligibleForSyntheticReview: retentionComplete && !legalHoldActive,
    dispositionExecuted: false,
    reasons: immutable(reasons),
    approvalRoles: schedule.approvalRoles,
    productionDispositionAvailable: false,
  });
}

export function assertM42ProductionDispositionUnavailable(): never {
  throw new Error("M42_PRODUCTION_DISPOSITION_UNAVAILABLE");
}
