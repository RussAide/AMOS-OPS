import type Database from "better-sqlite3";
import type { IdentityUser } from "../security/identity";
import type { RecordAssignmentContext } from "./record-authority-access";
import {
  resolveAuthorizedRecordAuthority,
  type RecordAccessResourceResolver,
  type RecordContextRequirementsResolver,
} from "./record-authority-service";
import { resolvePersistedSharePointBackendBinding } from "./sharepoint-backend-store";
import type { SharePointBackendBindingCandidate } from "../../contracts/dms/sharepoint-backend";

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

/**
 * S2 composition boundary. Authority and contextual access must both pass
 * before the exact SharePoint backend binding can be resolved. No binary
 * content is returned here; S3 may consume this descriptor for controlled
 * retrieval only after its own presentation/audit requirements are met.
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
