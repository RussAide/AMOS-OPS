import type Database from "better-sqlite3";
import type { AccessResource } from "../../src/constants/access-control";
import type { IdentityUser } from "../security/identity";
import {
  appendRecordAuthorityAudit,
  resolvePersistedRecordAuthority,
} from "./record-authority-store";
import {
  authorizeRecordContext,
  type RecordAssignmentContext,
} from "./record-authority-access";
import type { RecordAuthorityCandidate } from "../../contracts/dms/record-authority";

export type AuthorizedRecordAuthorityResult =
  | {
      outcome: "AUTHORIZED";
      code: "CONTROLLING_RECORD_AUTHORIZED";
      record: RecordAuthorityCandidate;
    }
  | {
      outcome: "DENIED";
      code: string;
      record: null;
      reason: string;
    }
  | {
      outcome: "AUTHORITY_CONFLICT" | "NO_CONTROLLING_RECORD";
      code: "AUTHORITY_CONFLICT" | "NO_CONTROLLING_RECORD";
      record: null;
    };

export interface ResolveAuthorizedRecordAuthorityInput {
  recordKey: string;
  user: IdentityUser | null;
  resource: AccessResource;
  assignment?: RecordAssignmentContext;
  requireAssignment: boolean;
  requireOperationMatch: boolean;
}

/**
 * Canonical S1 retrieval sequence:
 * 1) resolve record authority; 2) stop on conflict/unavailable; 3) authorize
 * the resolved controlling record against identity/RBAC/workspace/context;
 * 4) append an immutable access-decision audit event; 5) return record only
 * after an explicit allow decision.
 */
export function resolveAuthorizedRecordAuthority(
  db: Database.Database,
  input: ResolveAuthorizedRecordAuthorityInput,
): AuthorizedRecordAuthorityResult {
  const actorId = input.user?.id ?? "anonymous";
  const actorRole = input.user?.role ?? null;
  const authority = resolvePersistedRecordAuthority(db, {
    recordKey: input.recordKey,
    actorId,
    actorRole,
  });

  if (authority.outcome === "CONFLICT") {
    return {
      outcome: "AUTHORITY_CONFLICT",
      code: "AUTHORITY_CONFLICT",
      record: null,
    };
  }

  if (authority.outcome === "UNAVAILABLE") {
    return {
      outcome: "NO_CONTROLLING_RECORD",
      code: "NO_CONTROLLING_RECORD",
      record: null,
    };
  }

  const access = authorizeRecordContext({
    user: input.user,
    resource: input.resource,
    record: authority.record,
    assignment: input.assignment,
    requireAssignment: input.requireAssignment,
    requireOperationMatch: input.requireOperationMatch,
  });

  appendRecordAuthorityAudit(db, {
    authorityId: authority.record.id,
    documentId: authority.record.documentId,
    recordKey: authority.record.recordKey,
    eventType: "ACCESS_DECISION",
    actorId,
    actorRole,
    decisionCode: access.code,
    requestContext: {
      domain: input.resource.domain,
      action: input.resource.action,
      division: input.resource.division ?? null,
      department: input.resource.department ?? null,
      requireAssignment: input.requireAssignment,
      requireOperationMatch: input.requireOperationMatch,
    },
    resultContext: { allowed: access.allowed },
  });

  if (!access.allowed) {
    return {
      outcome: "DENIED",
      code: access.code,
      record: null,
      reason: access.reason,
    };
  }

  return {
    outcome: "AUTHORIZED",
    code: "CONTROLLING_RECORD_AUTHORIZED",
    record: authority.record,
  };
}
