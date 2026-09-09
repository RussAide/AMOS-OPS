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

export type RecordAccessResourceResolver =
  | AccessResource
  | ((record: RecordAuthorityCandidate) => AccessResource);

export interface RecordContextRequirements {
  requireAssignment: boolean;
  requireOperationMatch: boolean;
}

export type RecordContextRequirementsResolver =
  | RecordContextRequirements
  | ((record: RecordAuthorityCandidate) => RecordContextRequirements);

export interface ResolveAuthorizedRecordAuthorityInput {
  recordKey: string;
  user: IdentityUser | null;
  /**
   * Server policy may supply a resolver so the access domain/scope is derived
   * from the resolved controlling record instead of caller-controlled input.
   */
  resource: RecordAccessResourceResolver;
  assignment?: RecordAssignmentContext;
  /** Context requirements may also be derived only after authority resolves. */
  contextRequirements: RecordContextRequirementsResolver;
}

/**
 * Canonical S1 retrieval sequence:
 * 1) resolve record authority; 2) stop on conflict/unavailable; 3) derive the
 * access resource and contextual requirements from the controlling record;
 * 4) authorize identity/RBAC/workspace/context; 5) append immutable audit;
 * 6) return record only after an explicit allow decision.
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

  const resource =
    typeof input.resource === "function"
      ? input.resource(authority.record)
      : input.resource;
  const requirements =
    typeof input.contextRequirements === "function"
      ? input.contextRequirements(authority.record)
      : input.contextRequirements;

  const access = authorizeRecordContext({
    user: input.user,
    resource,
    record: authority.record,
    assignment: input.assignment,
    requireAssignment: requirements.requireAssignment,
    requireOperationMatch: requirements.requireOperationMatch,
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
      domain: resource.domain,
      action: resource.action,
      division: resource.division ?? null,
      department: resource.department ?? null,
      recordClass: authority.record.recordClass,
      requireAssignment: requirements.requireAssignment,
      requireOperationMatch: requirements.requireOperationMatch,
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
