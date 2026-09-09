import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import {
  RECORD_AUTHORITY_STATES,
  resolveControllingRecord,
  type GovernedRecordClass,
  type RecordAuthorityCandidate,
  type RecordAuthorityResolution,
  type RecordAuthorityState,
} from "../../contracts/dms/record-authority";

export interface EstablishRecordAuthorityInput {
  documentId: string;
  recordKey: string;
  recordClass: GovernedRecordClass;
  authorityState: RecordAuthorityState;
  sourceSystem: string;
  sourceLocator: string;
  backendObjectId?: string | null;
  governingDocumentId?: string | null;
  governingVersion?: string | null;
  supersedesAuthorityId?: string | null;
  youthId?: string | null;
  caseId?: string | null;
  operationId?: string | null;
  division?: string | null;
  dataScope: "operational" | "training";
  rationale: string;
  establishedBy: string;
  establishedAt?: string;
  effectiveAt?: string;
}

export interface RecordAuthorityAuditInput {
  authorityId?: string | null;
  documentId?: string | null;
  recordKey: string;
  eventType: "AUTHORITY_ESTABLISHED" | "AUTHORITY_RESOLVED" | "AUTHORITY_CONFLICT" | "AUTHORITY_UNAVAILABLE" | "ACCESS_DECISION";
  actorId: string;
  actorRole?: string | null;
  decisionCode: string;
  requestContext?: unknown;
  resultContext?: unknown;
  occurredAt?: string;
}

interface AuthorityRow {
  id: string;
  document_id: string;
  record_key: string;
  record_class: GovernedRecordClass;
  authority_state: RecordAuthorityState;
  source_system: string;
  source_locator: string;
  backend_object_id: string | null;
  governing_document_id: string | null;
  governing_version: string | null;
  supersedes_authority_id: string | null;
  youth_id: string | null;
  case_id: string | null;
  operation_id: string | null;
  division: string | null;
  data_scope: "operational" | "training";
  rationale: string;
  established_by: string;
  established_at: string;
  effective_at: string;
}

function mapAuthorityRow(row: AuthorityRow): RecordAuthorityCandidate {
  return {
    id: row.id,
    documentId: row.document_id,
    recordKey: row.record_key,
    recordClass: row.record_class,
    authorityState: row.authority_state,
    sourceSystem: row.source_system,
    sourceLocator: row.source_locator,
    backendObjectId: row.backend_object_id,
    governingDocumentId: row.governing_document_id,
    governingVersion: row.governing_version,
    supersedesAuthorityId: row.supersedes_authority_id,
    youthId: row.youth_id,
    caseId: row.case_id,
    operationId: row.operation_id,
    division: row.division,
    dataScope: row.data_scope,
    rationale: row.rationale,
    establishedBy: row.established_by,
    establishedAt: row.established_at,
    effectiveAt: row.effective_at,
  };
}

export function ensureRecordAuthoritySchema(db: Database.Database): void {
  const states = RECORD_AUTHORITY_STATES.map((state) => `'${state}'`).join(",");
  db.exec(`
    CREATE TABLE IF NOT EXISTS dms_record_authority_registry (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      record_key TEXT NOT NULL,
      record_class TEXT NOT NULL,
      authority_state TEXT NOT NULL CHECK(authority_state IN (${states})),
      source_system TEXT NOT NULL,
      source_locator TEXT NOT NULL,
      backend_object_id TEXT,
      governing_document_id TEXT,
      governing_version TEXT,
      supersedes_authority_id TEXT,
      youth_id TEXT,
      case_id TEXT,
      operation_id TEXT,
      division TEXT,
      data_scope TEXT NOT NULL CHECK(data_scope IN ('operational','training')),
      rationale TEXT NOT NULL,
      established_by TEXT NOT NULL,
      established_at TEXT NOT NULL,
      effective_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_dms_record_authority_key_state
      ON dms_record_authority_registry(record_key, authority_state);
    CREATE INDEX IF NOT EXISTS idx_dms_record_authority_document
      ON dms_record_authority_registry(document_id);
    CREATE INDEX IF NOT EXISTS idx_dms_record_authority_case
      ON dms_record_authority_registry(case_id);
    CREATE INDEX IF NOT EXISTS idx_dms_record_authority_youth
      ON dms_record_authority_registry(youth_id);

    CREATE TRIGGER IF NOT EXISTS trg_dms_record_authority_registry_no_update
      BEFORE UPDATE ON dms_record_authority_registry
      BEGIN
        SELECT RAISE(ABORT, 'IMMUTABLE_AUTHORITY_RECORD');
      END;

    CREATE TRIGGER IF NOT EXISTS trg_dms_record_authority_registry_no_delete
      BEFORE DELETE ON dms_record_authority_registry
      BEGIN
        SELECT RAISE(ABORT, 'IMMUTABLE_AUTHORITY_RECORD');
      END;

    CREATE TABLE IF NOT EXISTS dms_record_authority_audit (
      id TEXT PRIMARY KEY,
      authority_id TEXT,
      document_id TEXT,
      record_key TEXT NOT NULL,
      event_type TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      actor_role TEXT,
      decision_code TEXT NOT NULL,
      request_context_json TEXT NOT NULL,
      result_context_json TEXT NOT NULL,
      occurred_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_dms_record_authority_audit_key
      ON dms_record_authority_audit(record_key, occurred_at);

    CREATE TRIGGER IF NOT EXISTS trg_dms_record_authority_audit_no_update
      BEFORE UPDATE ON dms_record_authority_audit
      BEGIN
        SELECT RAISE(ABORT, 'IMMUTABLE_AUTHORITY_AUDIT');
      END;

    CREATE TRIGGER IF NOT EXISTS trg_dms_record_authority_audit_no_delete
      BEFORE DELETE ON dms_record_authority_audit
      BEGIN
        SELECT RAISE(ABORT, 'IMMUTABLE_AUTHORITY_AUDIT');
      END;
  `);
}

export function appendRecordAuthorityAudit(
  db: Database.Database,
  input: RecordAuthorityAuditInput,
): string {
  ensureRecordAuthoritySchema(db);
  const id = randomUUID();
  db.prepare(`
    INSERT INTO dms_record_authority_audit (
      id, authority_id, document_id, record_key, event_type,
      actor_id, actor_role, decision_code, request_context_json,
      result_context_json, occurred_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.authorityId ?? null,
    input.documentId ?? null,
    input.recordKey,
    input.eventType,
    input.actorId,
    input.actorRole ?? null,
    input.decisionCode,
    JSON.stringify(input.requestContext ?? null),
    JSON.stringify(input.resultContext ?? null),
    input.occurredAt ?? new Date().toISOString(),
  );
  return id;
}

function assertStableLineageContext(
  existing: readonly RecordAuthorityCandidate[],
  input: EstablishRecordAuthorityInput,
): void {
  if (existing.length === 0) return;

  if (existing.some((candidate) => candidate.recordClass !== input.recordClass)) {
    throw new Error("AUTHORITY_LINEAGE_RECORD_CLASS_MISMATCH");
  }
  if (existing.some((candidate) => candidate.dataScope !== input.dataScope)) {
    throw new Error("AUTHORITY_LINEAGE_DATA_SCOPE_MISMATCH");
  }

  const stableFields = [
    ["caseId", input.caseId ?? null],
    ["youthId", input.youthId ?? null],
    ["operationId", input.operationId ?? null],
    ["division", input.division ?? null],
  ] as const;

  for (const [field, nextValue] of stableFields) {
    const governedValues = new Set(
      existing
        .map((candidate) => candidate[field])
        .filter((value): value is string => Boolean(value)),
    );
    if (governedValues.size > 1) {
      throw new Error(`AUTHORITY_LINEAGE_${field.toUpperCase()}_CONFLICT`);
    }
    const [governedValue] = [...governedValues];
    if (governedValue && governedValue !== nextValue) {
      throw new Error(`AUTHORITY_LINEAGE_${field.toUpperCase()}_MISMATCH`);
    }
  }

  if (input.supersedesAuthorityId) {
    const target = existing.find(
      (candidate) => candidate.id === input.supersedesAuthorityId,
    );
    if (!target) throw new Error("AUTHORITY_SUPERSESSION_TARGET_NOT_IN_LINEAGE");
    if (
      existing.some(
        (candidate) =>
          candidate.supersedesAuthorityId === input.supersedesAuthorityId,
      )
    ) {
      throw new Error("AUTHORITY_SUPERSESSION_TARGET_ALREADY_RETIRED");
    }
  }
}

/** Authority records are append-only; changes are represented by a new row. */
export function establishRecordAuthority(
  db: Database.Database,
  input: EstablishRecordAuthorityInput,
): RecordAuthorityCandidate {
  ensureRecordAuthoritySchema(db);
  const existing = listRecordAuthorityCandidates(db, input.recordKey);
  assertStableLineageContext(existing, input);

  const id = randomUUID();
  const establishedAt = input.establishedAt ?? new Date().toISOString();
  const effectiveAt = input.effectiveAt ?? establishedAt;

  db.prepare(`
    INSERT INTO dms_record_authority_registry (
      id, document_id, record_key, record_class, authority_state,
      source_system, source_locator, backend_object_id,
      governing_document_id, governing_version, supersedes_authority_id,
      youth_id, case_id, operation_id, division, data_scope, rationale,
      established_by, established_at, effective_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.documentId,
    input.recordKey,
    input.recordClass,
    input.authorityState,
    input.sourceSystem,
    input.sourceLocator,
    input.backendObjectId ?? null,
    input.governingDocumentId ?? null,
    input.governingVersion ?? null,
    input.supersedesAuthorityId ?? null,
    input.youthId ?? null,
    input.caseId ?? null,
    input.operationId ?? null,
    input.division ?? null,
    input.dataScope,
    input.rationale,
    input.establishedBy,
    establishedAt,
    effectiveAt,
  );

  const row = db
    .prepare(`SELECT * FROM dms_record_authority_registry WHERE id = ?`)
    .get(id) as AuthorityRow;

  appendRecordAuthorityAudit(db, {
    authorityId: id,
    documentId: input.documentId,
    recordKey: input.recordKey,
    eventType: "AUTHORITY_ESTABLISHED",
    actorId: input.establishedBy,
    decisionCode: input.authorityState,
    requestContext: {
      recordClass: input.recordClass,
      sourceSystem: input.sourceSystem,
      sourceLocator: input.sourceLocator,
    },
    resultContext: { authorityId: id, authorityState: input.authorityState },
    occurredAt: establishedAt,
  });

  return mapAuthorityRow(row);
}

export function listRecordAuthorityCandidates(
  db: Database.Database,
  recordKey: string,
): RecordAuthorityCandidate[] {
  ensureRecordAuthoritySchema(db);
  const rows = db
    .prepare(`
      SELECT * FROM dms_record_authority_registry
      WHERE record_key = ?
      ORDER BY effective_at DESC, established_at DESC, id ASC
    `)
    .all(recordKey) as AuthorityRow[];
  return rows.map(mapAuthorityRow);
}

export function resolvePersistedRecordAuthority(
  db: Database.Database,
  input: { recordKey: string; actorId: string; actorRole?: string | null },
): RecordAuthorityResolution {
  const candidates = listRecordAuthorityCandidates(db, input.recordKey);
  const resolution = resolveControllingRecord(input.recordKey, candidates);
  const eventType =
    resolution.outcome === "RESOLVED"
      ? "AUTHORITY_RESOLVED"
      : resolution.outcome === "CONFLICT"
        ? "AUTHORITY_CONFLICT"
        : "AUTHORITY_UNAVAILABLE";

  appendRecordAuthorityAudit(db, {
    authorityId: resolution.record?.id ?? null,
    documentId: resolution.record?.documentId ?? null,
    recordKey: input.recordKey,
    eventType,
    actorId: input.actorId,
    actorRole: input.actorRole ?? null,
    decisionCode: resolution.code,
    requestContext: { candidateCount: candidates.length },
    resultContext: {
      outcome: resolution.outcome,
      candidateIds: resolution.candidateIds,
      selectedAuthorityId: resolution.record?.id ?? null,
    },
  });

  return resolution;
}
