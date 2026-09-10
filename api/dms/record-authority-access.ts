import {
  authorizeAccess,
  type AccessResource,
  type AccessSubject,
} from "../../src/constants/access-control";
import type { IdentityUser } from "../security/identity";
import type { RecordAuthorityCandidate } from "../../contracts/dms/record-authority";

export type RecordContextAccessCode =
  | "ALLOW_CONTEXTUAL"
  | "DENY_NO_IDENTITY"
  | "DENY_ACCESS_STATUS"
  | "DENY_DATA_SCOPE"
  | "DENY_RBAC"
  | "DENY_OPERATION_CONTEXT"
  | "DENY_CASE_ASSIGNMENT"
  | "DENY_YOUTH_ASSIGNMENT";

export type RecordContextAccessDecision =
  | { allowed: true; code: "ALLOW_CONTEXTUAL"; reason: string }
  | {
      allowed: false;
      code: Exclude<RecordContextAccessCode, "ALLOW_CONTEXTUAL">;
      reason: string;
    };

export interface RecordAssignmentContext {
  assignedCaseIds?: readonly string[];
  assignedYouthIds?: readonly string[];
  operationIds?: readonly string[];
}

export interface RecordContextAccessInput {
  user: IdentityUser | null;
  resource: AccessResource;
  record: Pick<
    RecordAuthorityCandidate,
    "caseId" | "youthId" | "operationId" | "dataScope"
  >;
  assignment?: RecordAssignmentContext;
  /** Enable for record classes/actions whose governing policy requires active assignment. */
  requireAssignment: boolean;
  /** Enable when operation/site membership is a governing access condition. */
  requireOperationMatch: boolean;
}

function denied(
  code: Exclude<RecordContextAccessCode, "ALLOW_CONTEXTUAL">,
  reason: string,
): RecordContextAccessDecision {
  return { allowed: false, code, reason };
}

/**
 * Additive contextual policy boundary for governed records. It consumes the
 * existing AMOS role/scope decision first, then applies workspace, operation,
 * case and youth context. Denials return no record payload.
 */
export function authorizeRecordContext(
  input: RecordContextAccessInput,
): RecordContextAccessDecision {
  const { user, record, resource, assignment } = input;
  if (!user) {
    return denied("DENY_NO_IDENTITY", "A valid authenticated identity is required.");
  }

  if (record.dataScope === "operational" && user.accessStatus !== "cleared") {
    return denied(
      "DENY_ACCESS_STATUS",
      "Operational governed records require a cleared identity.",
    );
  }

  if (user.dataScope !== record.dataScope) {
    return denied(
      "DENY_DATA_SCOPE",
      "The authenticated workspace does not match the governed record workspace.",
    );
  }

  const subject: AccessSubject = {
    userId: user.id,
    role: user.role,
    department: user.department ?? undefined,
  };
  const base = authorizeAccess(subject, resource);
  if (!base.allowed) {
    return denied("DENY_RBAC", base.reason);
  }

  if (input.requireOperationMatch && record.operationId) {
    if (!assignment?.operationIds?.includes(record.operationId)) {
      return denied(
        "DENY_OPERATION_CONTEXT",
        "The identity is not assigned to the governed record operation.",
      );
    }
  }

  if (input.requireAssignment && record.caseId) {
    if (!assignment?.assignedCaseIds?.includes(record.caseId)) {
      return denied(
        "DENY_CASE_ASSIGNMENT",
        "The identity is not assigned to the governed record case.",
      );
    }
  }

  if (input.requireAssignment && record.youthId) {
    if (!assignment?.assignedYouthIds?.includes(record.youthId)) {
      return denied(
        "DENY_YOUTH_ASSIGNMENT",
        "The identity is not assigned to the governed record youth.",
      );
    }
  }

  return {
    allowed: true,
    code: "ALLOW_CONTEXTUAL",
    reason: "Role, workspace and required governed-record context are authorized.",
  };
}
