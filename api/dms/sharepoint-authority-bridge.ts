import { createHash } from "node:crypto";
import type Database from "better-sqlite3";
import type { IdentityUser } from "../security/identity";
import type { RecordAssignmentContext } from "./record-authority-access";
import {
  resolveAuthorizedRecordAuthority,
  type RecordAccessResourceResolver,
  type RecordContextRequirementsResolver,
} from "./record-authority-service";
import {
  appendSharePointBackendAudit,
  resolvePersistedSharePointBackendBinding,
} from "./sharepoint-backend-store";
import type { SharePointBackendBindingCandidate } from "../../contracts/dms/sharepoint-backend";
import type { SharePointGraphItemSnapshot } from "./sharepoint-graph-adapter";

export type AuthorizedSharePointBackendResult =
  | {
      outcome: "AUTHORIZED_BACKEND";
      code: "AUTHORIZED_SHAREPOINT_BACKEND";
      authorityId: string;
      documentId: string;
      recordKey: string;
      binding: SharePointBackendBindingCandidate;
    }
  | {
      outcome:
        | "DENIED"
        | "AUTHORITY_CONFLICT"
        | "NO_CONTROLLING_RECORD"
        | "BACKEND_CONFLICT"
        | "NO_BACKEND_BINDING";
      code: string;
      authorityId: string | null;
      documentId: string | null;
      recordKey: string;
      binding: null;
      reason?: string;
    };

export interface SharePointBackendReader {
  getItemMetadata(
    driveId: string,
    itemId: string,
  ): Promise<SharePointGraphItemSnapshot>;
  downloadItemContent(driveId: string, itemId: string): Promise<Uint8Array>;
}

export type AuthorizedSharePointBinaryResult =
  | {
      outcome: "AUTHORIZED_BINARY";
      code: "AUTHORIZED_SHAREPOINT_BINARY";
      authorityId: string;
      documentId: string;
      recordKey: string;
      bindingId: string;
      metadata: SharePointGraphItemSnapshot;
      content: Uint8Array;
    }
  | {
      outcome:
        | AuthorizedSharePointBackendResult["outcome"]
        | "BACKEND_STALE";
      code: string;
      authorityId: string | null;
      documentId: string | null;
      recordKey: string;
      bindingId: string | null;
      metadata: null;
      content: null;
      reason?: string;
    };

/**
 * S2 composition boundary. Authority and contextual access must both pass
 * before the exact SharePoint backend binding can be resolved. No binary
 * content is returned here; S3 may consume this descriptor for controlled
 * presentation only after its own presentation/audit requirements are met.
 */
export function resolveAuthorizedSharePointBackend(
  db: Database.Database,
  input: {
    recordKey: string;
    user: IdentityUser | null;
    resource: RecordAccessResourceResolver;
    assignment?: RecordAssignmentContext;
    contextRequirements: RecordContextRequirementsResolver;
  },
): AuthorizedSharePointBackendResult {
  const authority = resolveAuthorizedRecordAuthority(db, {
    recordKey: input.recordKey,
    user: input.user,
    resource: input.resource,
    assignment: input.assignment,
    contextRequirements: input.contextRequirements,
  });

  if (authority.outcome === "DENIED") {
    return {
      outcome: "DENIED",
      code: authority.code,
      authorityId: null,
      documentId: null,
      recordKey: input.recordKey,
      binding: null,
      reason: authority.reason,
    };
  }
  if (authority.outcome === "AUTHORITY_CONFLICT") {
    return {
      outcome: "AUTHORITY_CONFLICT",
      code: authority.code,
      authorityId: null,
      documentId: null,
      recordKey: input.recordKey,
      binding: null,
    };
  }
  if (authority.outcome === "NO_CONTROLLING_RECORD") {
    return {
      outcome: "NO_CONTROLLING_RECORD",
      code: authority.code,
      authorityId: null,
      documentId: null,
      recordKey: input.recordKey,
      binding: null,
    };
  }

  const backend = resolvePersistedSharePointBackendBinding(db, {
    authorityId: authority.record.id,
    documentId: authority.record.documentId,
    actorId: input.user?.id ?? "anonymous",
  });
  if (backend.outcome === "CONFLICT") {
    return {
      outcome: "BACKEND_CONFLICT",
      code: backend.code,
      authorityId: authority.record.id,
      documentId: authority.record.documentId,
      recordKey: authority.record.recordKey,
      binding: null,
    };
  }
  if (backend.outcome === "UNAVAILABLE") {
    return {
      outcome: "NO_BACKEND_BINDING",
      code: backend.code,
      authorityId: authority.record.id,
      documentId: authority.record.documentId,
      recordKey: authority.record.recordKey,
      binding: null,
    };
  }

  return {
    outcome: "AUTHORIZED_BACKEND",
    code: "AUTHORIZED_SHAREPOINT_BACKEND",
    authorityId: authority.record.id,
    documentId: authority.record.documentId,
    recordKey: authority.record.recordKey,
    binding: backend.binding,
  };
}

function metadataMatchesBinding(
  binding: SharePointBackendBindingCandidate,
  metadata: SharePointGraphItemSnapshot,
): boolean {
  if (
    metadata.tenantHost !== binding.address.tenantHost ||
    metadata.siteId !== binding.address.siteId ||
    metadata.driveId !== binding.address.driveId ||
    metadata.itemId !== binding.address.itemId ||
    metadata.name !== binding.name
  )
    return false;
  if (binding.eTag && metadata.eTag !== binding.eTag) return false;
  if (binding.cTag && metadata.cTag !== binding.cTag) return false;
  if (binding.sizeBytes !== null && metadata.sizeBytes !== binding.sizeBytes)
    return false;
  if (binding.contentHash && metadata.contentHash !== binding.contentHash)
    return false;
  return true;
}

function verifiedContentHash(
  expected: string | null,
  content: Uint8Array,
): boolean {
  if (!expected) return true;
  const normalized = expected.trim().toLowerCase();
  if (/^[a-f0-9]{64}$/.test(normalized))
    return createHash("sha256").update(content).digest("hex") === normalized;
  if (/^[a-f0-9]{40}$/.test(normalized))
    return createHash("sha1").update(content).digest("hex") === normalized;
  return true;
}

/**
 * Internal S2 read-only binary bridge. The caller cannot nominate a SharePoint
 * path. The exact object is resolved from the authorized controlling DMS
 * record, re-verified immediately before download, and audited. S3 may call
 * this service; no M2/frontline router exposes raw binary content in S2.
 */
export async function retrieveAuthorizedSharePointBinary(
  db: Database.Database,
  input: {
    recordKey: string;
    user: IdentityUser | null;
    resource: RecordAccessResourceResolver;
    assignment?: RecordAssignmentContext;
    contextRequirements: RecordContextRequirementsResolver;
    reader: SharePointBackendReader;
  },
): Promise<AuthorizedSharePointBinaryResult> {
  const authorized = resolveAuthorizedSharePointBackend(db, input);
  if (authorized.outcome !== "AUTHORIZED_BACKEND") {
    return {
      ...authorized,
      bindingId: null,
      metadata: null,
      content: null,
    };
  }

  const binding = authorized.binding;
  let metadata: SharePointGraphItemSnapshot;
  try {
    metadata = await input.reader.getItemMetadata(
      binding.address.driveId,
      binding.address.itemId,
    );
  } catch (error) {
    appendSharePointBackendAudit(db, {
      bindingId: binding.id,
      authorityId: authorized.authorityId,
      documentId: authorized.documentId,
      eventType: "BACKEND_BINARY_RETRIEVAL",
      actorId: input.user?.id ?? "anonymous",
      outcomeCode: "SHAREPOINT_BACKEND_REVERIFY_FAILED",
      details: { error: error instanceof Error ? error.message : String(error) },
    });
    return {
      outcome: "BACKEND_STALE",
      code: "SHAREPOINT_BACKEND_REVERIFY_FAILED",
      authorityId: authorized.authorityId,
      documentId: authorized.documentId,
      recordKey: authorized.recordKey,
      bindingId: binding.id,
      metadata: null,
      content: null,
    };
  }

  if (!metadataMatchesBinding(binding, metadata)) {
    appendSharePointBackendAudit(db, {
      bindingId: binding.id,
      authorityId: authorized.authorityId,
      documentId: authorized.documentId,
      eventType: "BACKEND_BINARY_RETRIEVAL",
      actorId: input.user?.id ?? "anonymous",
      outcomeCode: "SHAREPOINT_BACKEND_STALE",
      details: { observedMetadataHash: metadata.metadataHash },
    });
    return {
      outcome: "BACKEND_STALE",
      code: "SHAREPOINT_BACKEND_STALE",
      authorityId: authorized.authorityId,
      documentId: authorized.documentId,
      recordKey: authorized.recordKey,
      bindingId: binding.id,
      metadata: null,
      content: null,
    };
  }

  const content = await input.reader.downloadItemContent(
    binding.address.driveId,
    binding.address.itemId,
  );
  if (
    (binding.sizeBytes !== null && content.byteLength !== binding.sizeBytes) ||
    !verifiedContentHash(binding.contentHash, content)
  ) {
    appendSharePointBackendAudit(db, {
      bindingId: binding.id,
      authorityId: authorized.authorityId,
      documentId: authorized.documentId,
      eventType: "BACKEND_BINARY_RETRIEVAL",
      actorId: input.user?.id ?? "anonymous",
      outcomeCode: "SHAREPOINT_BACKEND_CONTENT_INTEGRITY_FAILED",
    });
    return {
      outcome: "BACKEND_STALE",
      code: "SHAREPOINT_BACKEND_CONTENT_INTEGRITY_FAILED",
      authorityId: authorized.authorityId,
      documentId: authorized.documentId,
      recordKey: authorized.recordKey,
      bindingId: binding.id,
      metadata: null,
      content: null,
    };
  }

  appendSharePointBackendAudit(db, {
    bindingId: binding.id,
    authorityId: authorized.authorityId,
    documentId: authorized.documentId,
    eventType: "BACKEND_BINARY_RETRIEVAL",
    actorId: input.user?.id ?? "anonymous",
    outcomeCode: "AUTHORIZED_SHAREPOINT_BINARY",
    details: { byteLength: content.byteLength },
  });
  return {
    outcome: "AUTHORIZED_BINARY",
    code: "AUTHORIZED_SHAREPOINT_BINARY",
    authorityId: authorized.authorityId,
    documentId: authorized.documentId,
    recordKey: authorized.recordKey,
    bindingId: binding.id,
    metadata,
    content,
  };
}
