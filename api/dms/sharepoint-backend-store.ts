import { createHash, randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import {
  resolveSharePointBackendBinding,
  stableSharePointObjectId,
  type SharePointBackendBindingCandidate,
  type SharePointBackendBindingState,
  type SharePointBackendResolution,
} from "../../contracts/dms/sharepoint-backend";

interface AuthorityRow {
  id: string;
  document_id: string;
  record_key: string;
  data_scope: "training" | "operational";
}

interface BindingRow {
  id: string;
  authority_id: string;
  document_id: string;
  record_key: string;
  stable_object_id: string;
  binding_state: SharePointBackendBindingState;
  tenant_host: string;
  site_id: string;
  drive_id: string;
  item_id: string;
  name: string;
  web_url: string;
  parent_item_id: string | null;
  relative_path: string | null;
  version_id: string | null;
  e_tag: string | null;
  c_tag: string | null;
  size_bytes: number | null;
  content_hash: string | null;
  metadata_hash: string;
  verification_method: "MICROSOFT_GRAPH" | "CONNECTOR_ATTESTATION";
  verified_at: string;
  verified_by: string;
  supersedes_binding_id: string | null;
  data_scope: "training" | "operational";
}

export interface EstablishSharePointBackendBindingInput {
  authorityId: string;
  documentId: string;
  recordKey: string;
  bindingState: SharePointBackendBindingState;
  tenantHost: string;
  siteId: string;
  driveId: string;
  itemId: string;
  name: string;
  webUrl: string;
  parentItemId?: string | null;
  relativePath?: string | null;
  versionId?: string | null;
  eTag?: string | null;
  cTag?: string | null;
  sizeBytes?: number | null;
  contentHash?: string | null;
  verificationMethod: "MICROSOFT_GRAPH" | "CONNECTOR_ATTESTATION";
  verifiedBy: string;
  verifiedAt?: string;
  supersedesBindingId?: string | null;
}

export function ensureSharePointBackendSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS dms_sharepoint_backend_binding (
      id TEXT PRIMARY KEY,
      authority_id TEXT NOT NULL,
      document_id TEXT NOT NULL,
      record_key TEXT NOT NULL,
      stable_object_id TEXT NOT NULL,
      binding_state TEXT NOT NULL CHECK(binding_state IN ('ACTIVE','RETIRED','QUARANTINED','TOMBSTONED')),
      tenant_host TEXT NOT NULL,
      site_id TEXT NOT NULL,
      drive_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      name TEXT NOT NULL,
      web_url TEXT NOT NULL,
      parent_item_id TEXT,
      relative_path TEXT,
      version_id TEXT,
      e_tag TEXT,
      c_tag TEXT,
      size_bytes INTEGER,
      content_hash TEXT,
      metadata_hash TEXT NOT NULL,
      verification_method TEXT NOT NULL CHECK(verification_method IN ('MICROSOFT_GRAPH','CONNECTOR_ATTESTATION')),
      verified_at TEXT NOT NULL,
      verified_by TEXT NOT NULL,
      supersedes_binding_id TEXT,
      data_scope TEXT NOT NULL CHECK(data_scope IN ('training','operational'))
    );

    CREATE INDEX IF NOT EXISTS idx_dms_sp_backend_authority
      ON dms_sharepoint_backend_binding(authority_id, binding_state);
    CREATE INDEX IF NOT EXISTS idx_dms_sp_backend_document
      ON dms_sharepoint_backend_binding(document_id);
    CREATE INDEX IF NOT EXISTS idx_dms_sp_backend_object
      ON dms_sharepoint_backend_binding(drive_id, item_id);

    CREATE TABLE IF NOT EXISTS dms_sharepoint_backend_audit (
      id TEXT PRIMARY KEY,
      binding_id TEXT,
      authority_id TEXT NOT NULL,
      document_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      outcome_code TEXT NOT NULL,
      details_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TRIGGER IF NOT EXISTS dms_sp_backend_binding_no_update
    BEFORE UPDATE ON dms_sharepoint_backend_binding
    BEGIN
      SELECT RAISE(ABORT, 'IMMUTABLE_SHAREPOINT_BACKEND_BINDING');
    END;

    CREATE TRIGGER IF NOT EXISTS dms_sp_backend_binding_no_delete
    BEFORE DELETE ON dms_sharepoint_backend_binding
    BEGIN
      SELECT RAISE(ABORT, 'IMMUTABLE_SHAREPOINT_BACKEND_BINDING');
    END;

    CREATE TRIGGER IF NOT EXISTS dms_sp_backend_audit_no_update
    BEFORE UPDATE ON dms_sharepoint_backend_audit
    BEGIN
      SELECT RAISE(ABORT, 'IMMUTABLE_SHAREPOINT_BACKEND_AUDIT');
    END;

    CREATE TRIGGER IF NOT EXISTS dms_sp_backend_audit_no_delete
    BEFORE DELETE ON dms_sharepoint_backend_audit
    BEGIN
      SELECT RAISE(ABORT, 'IMMUTABLE_SHAREPOINT_BACKEND_AUDIT');
    END;
  `);
}

function normalizeHost(value: string): string {
  return value.trim().toLowerCase();
}

function metadataHash(input: EstablishSharePointBackendBindingInput): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        tenantHost: normalizeHost(input.tenantHost),
        siteId: input.siteId,
        driveId: input.driveId,
        itemId: input.itemId,
        name: input.name,
        webUrl: input.webUrl,
        parentItemId: input.parentItemId ?? null,
        relativePath: input.relativePath ?? null,
        versionId: input.versionId ?? null,
        eTag: input.eTag ?? null,
        cTag: input.cTag ?? null,
        sizeBytes: input.sizeBytes ?? null,
        contentHash: input.contentHash ?? null,
      }),
    )
    .digest("hex");
}

function toCandidate(row: BindingRow): SharePointBackendBindingCandidate {
  return {
    id: row.id,
    authorityId: row.authority_id,
    documentId: row.document_id,
    recordKey: row.record_key,
    stableObjectId: row.stable_object_id,
    bindingState: row.binding_state,
    address: {
      tenantHost: row.tenant_host,
      siteId: row.site_id,
      driveId: row.drive_id,
      itemId: row.item_id,
    },
    name: row.name,
    webUrl: row.web_url,
    parentItemId: row.parent_item_id,
    relativePath: row.relative_path,
    versionId: row.version_id,
    eTag: row.e_tag,
    cTag: row.c_tag,
    sizeBytes: row.size_bytes,
    contentHash: row.content_hash,
    metadataHash: row.metadata_hash,
    verificationMethod: row.verification_method,
    verifiedAt: row.verified_at,
    verifiedBy: row.verified_by,
    supersedesBindingId: row.supersedes_binding_id,
    dataScope: row.data_scope,
  };
}

export function appendSharePointBackendAudit(
  db: Database.Database,
  input: {
    bindingId?: string | null;
    authorityId: string;
    documentId: string;
    eventType: string;
    actorId: string;
    outcomeCode: string;
    details?: unknown;
  },
): void {
  ensureSharePointBackendSchema(db);
  db.prepare(
    `INSERT INTO dms_sharepoint_backend_audit
      (id, binding_id, authority_id, document_id, event_type, actor_id, outcome_code, details_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    randomUUID(),
    input.bindingId ?? null,
    input.authorityId,
    input.documentId,
    input.eventType,
    input.actorId,
    input.outcomeCode,
    input.details === undefined ? null : JSON.stringify(input.details),
    new Date().toISOString(),
  );
}

export function listSharePointBackendBindings(
  db: Database.Database,
  authorityId: string,
): SharePointBackendBindingCandidate[] {
  ensureSharePointBackendSchema(db);
  const rows = db
    .prepare(
      `SELECT * FROM dms_sharepoint_backend_binding
       WHERE authority_id = ? ORDER BY verified_at ASC, id ASC`,
    )
    .all(authorityId) as BindingRow[];
  return rows.map(toCandidate);
}

export function resolvePersistedSharePointBackendBinding(
  db: Database.Database,
  input: {
    authorityId: string;
    documentId: string;
    actorId: string;
  },
): SharePointBackendResolution {
  const result = resolveSharePointBackendBinding(
    input.authorityId,
    listSharePointBackendBindings(db, input.authorityId),
  );
  appendSharePointBackendAudit(db, {
    bindingId: result.binding?.id ?? null,
    authorityId: input.authorityId,
    documentId: input.documentId,
    eventType: "BACKEND_BINDING_RESOLUTION",
    actorId: input.actorId,
    outcomeCode: result.code,
    details: { candidateIds: result.candidateIds },
  });
  return result;
}

export function establishSharePointBackendBinding(
  db: Database.Database,
  input: EstablishSharePointBackendBindingInput,
): SharePointBackendBindingCandidate {
  ensureSharePointBackendSchema(db);

  const authority = db
    .prepare(
      `SELECT id, document_id, record_key, data_scope
       FROM dms_record_authority_registry WHERE id = ?`,
    )
    .get(input.authorityId) as AuthorityRow | undefined;
  if (!authority) throw new Error("SHAREPOINT_BACKEND_AUTHORITY_NOT_FOUND");
  if (authority.document_id !== input.documentId)
    throw new Error("SHAREPOINT_BACKEND_DOCUMENT_AUTHORITY_MISMATCH");
  if (authority.record_key !== input.recordKey)
    throw new Error("SHAREPOINT_BACKEND_RECORD_KEY_MISMATCH");

  const tenantHost = normalizeHost(input.tenantHost);
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(input.webUrl);
  } catch {
    throw new Error("SHAREPOINT_BACKEND_WEB_URL_INVALID");
  }
  if (parsedUrl.protocol !== "https:" || parsedUrl.hostname.toLowerCase() !== tenantHost)
    throw new Error("SHAREPOINT_BACKEND_TENANT_HOST_MISMATCH");

  const existing = listSharePointBackendBindings(db, input.authorityId);
  const current = resolveSharePointBackendBinding(input.authorityId, existing);
  if (input.bindingState === "ACTIVE") {
    if (current.outcome === "CONFLICT")
      throw new Error("SHAREPOINT_BACKEND_EXISTING_CONFLICT");
    if (
      current.outcome === "RESOLVED" &&
      input.supersedesBindingId !== current.binding.id
    ) {
      throw new Error("SHAREPOINT_BACKEND_REPLACEMENT_REQUIRES_SUPERSESSION");
    }
  }

  if (input.supersedesBindingId) {
    const superseded = existing.find(
      (candidate) => candidate.id === input.supersedesBindingId,
    );
    if (!superseded)
      throw new Error("SHAREPOINT_BACKEND_SUPERSEDED_BINDING_NOT_FOUND");
    if (
      existing.some(
        (candidate) =>
          candidate.supersedesBindingId === input.supersedesBindingId,
      )
    ) {
      throw new Error("SHAREPOINT_BACKEND_BINDING_ALREADY_RETIRED");
    }
  }

  if (
    input.bindingState !== "ACTIVE" &&
    !input.supersedesBindingId
  ) {
    throw new Error("SHAREPOINT_BACKEND_NONACTIVE_REQUIRES_SUPERSESSION");
  }

  const objectRows = db
    .prepare(
      `SELECT * FROM dms_sharepoint_backend_binding
       WHERE drive_id = ? AND item_id = ?`,
    )
    .all(input.driveId, input.itemId) as BindingRow[];
  const retiredObjectBindingIds = new Set(
    objectRows
      .map((row) => row.supersedes_binding_id)
      .filter((value): value is string => Boolean(value)),
  );
  const effectiveActiveObjectBindings = objectRows.filter(
    (row) =>
      row.binding_state === "ACTIVE" &&
      !retiredObjectBindingIds.has(row.id),
  );
  if (
    effectiveActiveObjectBindings.some(
      (row) => row.document_id !== input.documentId,
    )
  ) {
    throw new Error("SHAREPOINT_BACKEND_OBJECT_ALREADY_BOUND");
  }

  const candidate: SharePointBackendBindingCandidate = {
    id: randomUUID(),
    authorityId: input.authorityId,
    documentId: input.documentId,
    recordKey: input.recordKey,
    stableObjectId: stableSharePointObjectId(input.documentId),
    bindingState: input.bindingState,
    address: {
      tenantHost,
      siteId: input.siteId,
      driveId: input.driveId,
      itemId: input.itemId,
    },
    name: input.name,
    webUrl: input.webUrl,
    parentItemId: input.parentItemId ?? null,
    relativePath: input.relativePath ?? null,
    versionId: input.versionId ?? null,
    eTag: input.eTag ?? null,
    cTag: input.cTag ?? null,
    sizeBytes: input.sizeBytes ?? null,
    contentHash: input.contentHash ?? null,
    metadataHash: metadataHash(input),
    verificationMethod: input.verificationMethod,
    verifiedAt: input.verifiedAt ?? new Date().toISOString(),
    verifiedBy: input.verifiedBy,
    supersedesBindingId: input.supersedesBindingId ?? null,
    dataScope: authority.data_scope,
  };

  db.prepare(
    `INSERT INTO dms_sharepoint_backend_binding
      (id, authority_id, document_id, record_key, stable_object_id, binding_state,
       tenant_host, site_id, drive_id, item_id, name, web_url, parent_item_id,
       relative_path, version_id, e_tag, c_tag, size_bytes, content_hash,
       metadata_hash, verification_method, verified_at, verified_by,
       supersedes_binding_id, data_scope)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    candidate.id,
    candidate.authorityId,
    candidate.documentId,
    candidate.recordKey,
    candidate.stableObjectId,
    candidate.bindingState,
    candidate.address.tenantHost,
    candidate.address.siteId,
    candidate.address.driveId,
    candidate.address.itemId,
    candidate.name,
    candidate.webUrl,
    candidate.parentItemId,
    candidate.relativePath,
    candidate.versionId,
    candidate.eTag,
    candidate.cTag,
    candidate.sizeBytes,
    candidate.contentHash,
    candidate.metadataHash,
    candidate.verificationMethod,
    candidate.verifiedAt,
    candidate.verifiedBy,
    candidate.supersedesBindingId,
    candidate.dataScope,
  );

  appendSharePointBackendAudit(db, {
    bindingId: candidate.id,
    authorityId: candidate.authorityId,
    documentId: candidate.documentId,
    eventType: "BACKEND_BINDING_ESTABLISHED",
    actorId: candidate.verifiedBy,
    outcomeCode: "SHAREPOINT_BACKEND_BINDING_ESTABLISHED",
    details: {
      stableObjectId: candidate.stableObjectId,
      bindingState: candidate.bindingState,
      driveId: candidate.address.driveId,
      itemId: candidate.address.itemId,
      verificationMethod: candidate.verificationMethod,
    },
  });

  return candidate;
}
