import {
  M42_EVALUATION_AS_OF,
  requireM42SyntheticId,
  type M42ActorContext,
  type M42AuditEvent,
} from "@contracts/m42/shared";
import type {
  M42ApprovalRoute,
  M42CheckinInput,
  M42CheckoutLock,
  M42CheckoutResult,
  M42DocumentRecord,
  M42VersionEntry,
  M42VersionLedger,
} from "@contracts/m42/records";
import type { UserRole } from "@/constants/roles";
import { evaluateM42DocumentAccess } from "./document-access";
import {
  createM42AuditEvent,
  m42RecordsDeterministicId,
} from "./document-governance";

function immutable<T>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function assertIso(value: string, code: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new Error(code);
}

function assertHumanActor(actor: M42ActorContext): void {
  requireM42SyntheticId(actor.actorId, "version_actor_id");
  if (/^(?:SYNTH-)?(?:AI|AMOS|ASSISTANT|MODEL|SYSTEM)(?:$|[-_:])/i.test(actor.actorId)) {
    throw new Error("M42_HUMAN_VERSION_ACTOR_REQUIRED");
  }
}

function nextMinorVersion(version: string): string {
  const match = /^(\d+)\.(\d+)$/.exec(version);
  if (!match) throw new Error("M42_DOCUMENT_VERSION_FORMAT_INVALID");
  return `${match[1]}.${Number(match[2]) + 1}`;
}

function latestDraft(ledger: M42VersionLedger): M42VersionEntry {
  const entry = [...ledger.versions]
    .reverse()
    .find((candidate) => candidate.status === "draft" || candidate.status === "in_review");
  if (!entry) throw new Error("M42_DRAFT_VERSION_REQUIRED");
  return entry;
}

export function createM42VersionLedger(
  document: M42DocumentRecord,
): M42VersionLedger {
  const initialVersion = immutable({
    versionId: document.currentVersionId,
    documentId: document.documentId,
    version: document.currentVersion,
    baseVersionId: null,
    contentHash: document.sourceOfTruth.contentHash,
    changeSummary: "Initial governed synthetic publication.",
    createdBy: document.ownerId,
    createdByRole: document.ownerRole,
    createdAt: document.effectiveAt,
    status: "published" as const,
    approvalRoute: document.approvalRoute,
    immutableAfterPublish: true,
    synthetic: true as const,
  });
  return immutable({
    document,
    versions: immutable([initialVersion]),
    locks: immutable([]),
    auditEvents: immutable([]),
    appendOnlyHistory: true,
    synthetic: true,
  });
}

export function checkoutM42Document(
  ledger: M42VersionLedger,
  actor: M42ActorContext,
  expectedVersionId: string,
  checkedOutAt: string = M42_EVALUATION_AS_OF,
): M42CheckoutResult {
  assertHumanActor(actor);
  assertIso(checkedOutAt, "M42_CHECKOUT_TIME_INVALID");
  const access = evaluateM42DocumentAccess(
    ledger.document,
    actor,
    "checkout",
    checkedOutAt,
  );
  if (!access.allowed) throw new Error(`M42_DOCUMENT_CHECKOUT_DENIED:${access.reasonCodes.join(",")}`);
  if (ledger.document.currentVersionId !== expectedVersionId) {
    throw new Error("M42_OPTIMISTIC_VERSION_CONFLICT");
  }
  const now = Date.parse(checkedOutAt);
  const activeLock = ledger.locks.find(
    (lock) => lock.active && lock.releasedAt === null && Date.parse(lock.expiresAt) > now,
  );
  if (activeLock) throw new Error("M42_DOCUMENT_ALREADY_CHECKED_OUT");
  const expiresAt = new Date(now + 2 * 60 * 60 * 1000).toISOString();
  const lock: M42CheckoutLock = immutable({
    lockId: m42RecordsDeterministicId(
      "M42-LOCK",
      ledger.document.documentId,
      actor.actorId,
      checkedOutAt,
    ),
    documentId: ledger.document.documentId,
    versionId: expectedVersionId,
    checkedOutBy: actor.actorId,
    checkedOutAt,
    expiresAt,
    releasedAt: null,
    active: true,
    synthetic: true,
  });
  const updated = immutable({
    ...ledger,
    locks: immutable([...ledger.locks, lock]),
    auditEvents: immutable([...ledger.auditEvents, access.auditEvent]),
  });
  return immutable({ ledger: updated, lock });
}

export function checkinM42Document(
  ledger: M42VersionLedger,
  input: M42CheckinInput,
): { ledger: M42VersionLedger; version: M42VersionEntry; auditEvent: M42AuditEvent } {
  assertHumanActor(input.actor);
  const checkedInAt = input.checkedInAt ?? M42_EVALUATION_AS_OF;
  assertIso(checkedInAt, "M42_CHECKIN_TIME_INVALID");
  const lock = ledger.locks.find((candidate) => candidate.lockId === input.lockId);
  if (!lock || !lock.active || lock.releasedAt !== null) throw new Error("M42_ACTIVE_CHECKOUT_LOCK_REQUIRED");
  if (Date.parse(lock.expiresAt) <= Date.parse(checkedInAt)) throw new Error("M42_CHECKOUT_LOCK_EXPIRED");
  if (lock.checkedOutBy !== input.actor.actorId) throw new Error("M42_CHECKOUT_LOCK_OWNER_REQUIRED");
  if (
    input.expectedBaseVersionId !== lock.versionId ||
    input.expectedBaseVersionId !== ledger.document.currentVersionId
  ) {
    throw new Error("M42_OPTIMISTIC_VERSION_CONFLICT");
  }
  if (!/^sha256:[a-z0-9][a-z0-9-]{7,}$/i.test(input.contentHash)) throw new Error("M42_CONTENT_HASH_REQUIRED");
  if (input.contentHash === ledger.document.sourceOfTruth.contentHash) throw new Error("M42_CONTENT_HASH_UNCHANGED");
  if (!input.changeSummary.trim()) throw new Error("M42_VERSION_CHANGE_SUMMARY_REQUIRED");
  const version = nextMinorVersion(ledger.document.currentVersion);
  const versionId = `${ledger.document.documentId}-V${version.replace(".", "-")}`;
  if (ledger.versions.some((candidate) => candidate.versionId === versionId)) throw new Error("M42_VERSION_ID_CONFLICT");
  const entry = immutable({
    versionId,
    documentId: ledger.document.documentId,
    version,
    baseVersionId: input.expectedBaseVersionId,
    contentHash: input.contentHash,
    changeSummary: input.changeSummary,
    createdBy: input.actor.actorId,
    createdByRole: input.actor.role,
    createdAt: checkedInAt,
    status: "draft" as const,
    approvalRoute: null,
    immutableAfterPublish: false,
    synthetic: true as const,
  });
  const releasedLock: M42CheckoutLock = immutable({
    ...lock,
    active: false,
    releasedAt: checkedInAt,
  });
  const auditEvent = createM42AuditEvent({
    eventType: "version_created",
    actor: input.actor,
    entityType: "version",
    entityId: versionId,
    correlationId: lock.lockId,
    sourceIds: [ledger.document.stableObjectId, input.expectedBaseVersionId],
    outcome: "recorded",
    reason: input.changeSummary,
    occurredAt: checkedInAt,
  });
  const updated = immutable({
    ...ledger,
    versions: immutable([...ledger.versions, entry]),
    locks: immutable(
      ledger.locks.map((candidate) =>
        candidate.lockId === lock.lockId ? releasedLock : candidate,
      ),
    ),
    auditEvents: immutable([...ledger.auditEvents, auditEvent]),
  });
  return immutable({ ledger: updated, version: entry, auditEvent });
}

export function submitM42VersionForApproval(
  ledger: M42VersionLedger,
  actor: M42ActorContext,
  requiredRoles: readonly UserRole[],
  requestedAt: string = M42_EVALUATION_AS_OF,
): M42VersionLedger {
  assertHumanActor(actor);
  if (!actor.permissions.includes("documents.governance")) throw new Error("M42_DOCUMENT_GOVERNANCE_PERMISSION_REQUIRED");
  if (requiredRoles.length === 0) throw new Error("M42_APPROVAL_ROLE_REQUIRED");
  const draft = latestDraft(ledger);
  if (draft.status !== "draft") throw new Error("M42_VERSION_ALREADY_IN_REVIEW");
  if (draft.createdBy !== actor.actorId && !actor.permissions.includes("documents.enterprise.governance")) {
    throw new Error("M42_VERSION_AUTHOR_OR_ENTERPRISE_GOVERNOR_REQUIRED");
  }
  const route: M42ApprovalRoute = immutable({
    routeId: m42RecordsDeterministicId("M42-VERSION-ROUTE", draft.versionId, ...requiredRoles),
    requestedBy: actor.actorId,
    requestedAt,
    steps: immutable(requiredRoles.map((requiredRole, index) => immutable({
      step: index + 1,
      requiredRole,
      decision: "pending" as const,
      decidedBy: null,
      decidedAt: null,
      rationale: null,
    }))),
    status: "pending",
    completedAt: null,
    synthetic: true,
  });
  const updatedDraft = immutable({ ...draft, status: "in_review" as const, approvalRoute: route });
  const auditEvent = createM42AuditEvent({
    eventType: "approval_recorded",
    actor,
    entityType: "version",
    entityId: draft.versionId,
    correlationId: route.routeId,
    sourceIds: [ledger.document.stableObjectId, draft.baseVersionId ?? ledger.document.currentVersionId],
    outcome: "recorded",
    reason: "Synthetic sequential version approval requested.",
    occurredAt: requestedAt,
  });
  return immutable({
    ...ledger,
    versions: immutable(ledger.versions.map((candidate) => candidate.versionId === draft.versionId ? updatedDraft : candidate)),
    auditEvents: immutable([...ledger.auditEvents, auditEvent]),
  });
}

export function decideM42VersionApproval(
  ledger: M42VersionLedger,
  actor: M42ActorContext,
  decision: "approved" | "rejected",
  rationale: string,
  decidedAt: string = M42_EVALUATION_AS_OF,
): M42VersionLedger {
  assertHumanActor(actor);
  if (!actor.permissions.includes("documents.approve")) throw new Error("M42_DOCUMENT_APPROVAL_PERMISSION_REQUIRED");
  if (!rationale.trim()) throw new Error("M42_APPROVAL_RATIONALE_REQUIRED");
  const version = latestDraft(ledger);
  const route = version.approvalRoute;
  if (version.status !== "in_review" || !route || route.status !== "pending") throw new Error("M42_PENDING_VERSION_APPROVAL_REQUIRED");
  const pending = route.steps.find((step) => step.decision === "pending");
  if (!pending || pending.requiredRole !== actor.role) throw new Error("M42_SEQUENTIAL_APPROVER_ROLE_MISMATCH");
  if (route.requestedBy === actor.actorId || version.createdBy === actor.actorId) throw new Error("M42_APPROVAL_SEPARATION_OF_DUTIES_REQUIRED");
  const steps = immutable(route.steps.map((step) => step.step === pending.step ? immutable({ ...step, decision, decidedBy: actor.actorId, decidedAt, rationale }) : step));
  const routeStatus: M42ApprovalRoute["status"] = decision === "rejected" ? "rejected" : steps.every((step) => step.decision === "approved") ? "approved" : "pending";
  const updatedRoute: M42ApprovalRoute = immutable({ ...route, steps, status: routeStatus, completedAt: routeStatus === "pending" ? null : decidedAt });
  const updatedVersion: M42VersionEntry = immutable({ ...version, status: routeStatus === "approved" ? "approved" : routeStatus === "rejected" ? "draft" : "in_review", approvalRoute: updatedRoute });
  const auditEvent = createM42AuditEvent({
    eventType: "approval_recorded",
    actor,
    entityType: "version",
    entityId: version.versionId,
    correlationId: route.routeId,
    sourceIds: [ledger.document.stableObjectId, version.baseVersionId ?? ledger.document.currentVersionId],
    outcome: decision === "approved" ? "allowed" : "denied",
    reason: rationale,
    occurredAt: decidedAt,
  });
  return immutable({
    ...ledger,
    versions: immutable(ledger.versions.map((candidate) => candidate.versionId === version.versionId ? updatedVersion : candidate)),
    auditEvents: immutable([...ledger.auditEvents, auditEvent]),
  });
}

export function publishM42ApprovedVersion(
  ledger: M42VersionLedger,
  actor: M42ActorContext,
  publishedAt: string = M42_EVALUATION_AS_OF,
): M42VersionLedger {
  assertHumanActor(actor);
  if (!actor.permissions.includes("documents.governance")) throw new Error("M42_DOCUMENT_GOVERNANCE_PERMISSION_REQUIRED");
  const approved = [...ledger.versions].reverse().find((entry) => entry.status === "approved");
  if (!approved || approved.approvalRoute?.status !== "approved") throw new Error("M42_APPROVED_VERSION_REQUIRED");
  const versions = immutable(ledger.versions.map((entry) => {
    if (entry.versionId === approved.versionId) return immutable({ ...entry, status: "published" as const, immutableAfterPublish: true });
    if (entry.status === "published") return immutable({ ...entry, status: "superseded" as const, immutableAfterPublish: true });
    return entry;
  }));
  const document = immutable({
    ...ledger.document,
    currentVersion: approved.version,
    currentVersionId: approved.versionId,
    lifecycleState: "published" as const,
    approvalRoute: approved.approvalRoute,
    effectiveAt: publishedAt,
    sourceOfTruth: immutable({
      ...ledger.document.sourceOfTruth,
      currentVersionId: approved.versionId,
      contentHash: approved.contentHash,
    }),
  });
  const auditEvent = createM42AuditEvent({
    eventType: "record_superseded",
    actor,
    entityType: "version",
    entityId: approved.versionId,
    correlationId: m42RecordsDeterministicId("M42-PUBLISH", document.documentId, approved.versionId),
    sourceIds: [document.stableObjectId, approved.baseVersionId ?? "SYNTH-NO-BASE"],
    outcome: "recorded",
    reason: "Approved synthetic version published; prior version preserved as superseded history.",
    occurredAt: publishedAt,
  });
  return immutable({
    ...ledger,
    document,
    versions,
    auditEvents: immutable([...ledger.auditEvents, auditEvent]),
  });
}

export function linkM42DocumentSupersession(
  prior: M42DocumentRecord,
  replacement: M42DocumentRecord,
  actor: M42ActorContext,
  occurredAt: string = M42_EVALUATION_AS_OF,
): { prior: M42DocumentRecord; replacement: M42DocumentRecord; auditEvent: M42AuditEvent } {
  assertHumanActor(actor);
  if (!actor.permissions.includes("documents.governance")) throw new Error("M42_DOCUMENT_GOVERNANCE_PERMISSION_REQUIRED");
  if (prior.stableObjectId === replacement.stableObjectId) throw new Error("M42_SUPERSESSION_REPLACEMENT_MUST_BE_DISTINCT");
  if (prior.lifecycleState !== "published" || replacement.lifecycleState !== "published") throw new Error("M42_SUPERSESSION_PUBLISHED_RECORDS_REQUIRED");
  if (prior.sourceOfTruth.supersededByStableObjectId) throw new Error("M42_DOCUMENT_ALREADY_SUPERSEDED");
  const updatedPrior = immutable({
    ...prior,
    lifecycleState: "superseded" as const,
    sourceOfTruth: immutable({
      ...prior.sourceOfTruth,
      supersededByStableObjectId: replacement.stableObjectId,
    }),
  });
  const updatedReplacement = immutable({
    ...replacement,
    sourceOfTruth: immutable({
      ...replacement.sourceOfTruth,
      supersedesStableObjectId: prior.stableObjectId,
    }),
  });
  const auditEvent = createM42AuditEvent({
    eventType: "record_superseded",
    actor,
    entityType: "document",
    entityId: prior.documentId,
    correlationId: m42RecordsDeterministicId("M42-SUPERSESSION", prior.stableObjectId, replacement.stableObjectId),
    sourceIds: [prior.stableObjectId, replacement.stableObjectId],
    outcome: "recorded",
    reason: "Synthetic source-of-truth supersession link recorded bidirectionally.",
    occurredAt,
  });
  return immutable({ prior: updatedPrior, replacement: updatedReplacement, auditEvent });
}

export function validateM42VersionLedger(
  ledger: M42VersionLedger,
): readonly string[] {
  const errors: string[] = [];
  if (!ledger.appendOnlyHistory || !ledger.synthetic) errors.push("VERSION_LEDGER_BOUNDARY_INVALID");
  if (new Set(ledger.versions.map((entry) => entry.versionId)).size !== ledger.versions.length) errors.push("VERSION_ID_DUPLICATE");
  const published = ledger.versions.filter((entry) => entry.status === "published");
  if (published.length !== 1) errors.push("ONE_PUBLISHED_VERSION_REQUIRED");
  if (published[0]?.versionId !== ledger.document.currentVersionId) errors.push("CURRENT_VERSION_LINK_MISMATCH");
  if (published[0]?.contentHash !== ledger.document.sourceOfTruth.contentHash) errors.push("SOURCE_OF_TRUTH_HASH_MISMATCH");
  for (const version of ledger.versions) {
    if (!version.synthetic) errors.push(`VERSION_BOUNDARY_INVALID:${version.versionId}`);
    if ((version.status === "published" || version.status === "superseded") && !version.immutableAfterPublish) errors.push(`PUBLISHED_VERSION_MUTABLE:${version.versionId}`);
    if (version.baseVersionId && !ledger.versions.some((candidate) => candidate.versionId === version.baseVersionId)) errors.push(`VERSION_BASE_MISSING:${version.versionId}`);
  }
  for (const lock of ledger.locks) {
    if (!lock.synthetic || lock.documentId !== ledger.document.documentId) errors.push(`LOCK_BOUNDARY_INVALID:${lock.lockId}`);
    if (lock.active === (lock.releasedAt !== null)) errors.push(`LOCK_RELEASE_STATE_INVALID:${lock.lockId}`);
  }
  return immutable(errors);
}
