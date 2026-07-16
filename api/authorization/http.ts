import {
  authorizeAccess,
  type AccessResource,
} from "../../src/constants/access-control";
import {
  resolveIdentityUser,
  resolveRequestedDataScope,
  type IdentityUser,
} from "../security/identity";

export type HttpAuthorizationResult =
  | { allowed: true; status: 200; user: IdentityUser }
  | {
      allowed: false;
      status: 401 | 403;
      code: "UNAUTHORIZED" | "FORBIDDEN";
      reason: string;
    };

/** Pure policy boundary used by both the HTTP adapter and focused authorization tests. */
export function authorizeHttpIdentity(
  user: IdentityUser | null,
  resource: AccessResource,
): HttpAuthorizationResult {
  if (!user) {
    return {
      allowed: false,
      status: 401,
      code: "UNAUTHORIZED",
      reason: "A valid environment-scoped session is required.",
    };
  }

  const decision = authorizeAccess(
    {
      userId: user.id,
      role: user.role,
      department: user.department ?? undefined,
    },
    resource,
  );
  if (!decision.allowed) {
    return {
      allowed: false,
      status: 403,
      code: "FORBIDDEN",
      reason: decision.reason,
    };
  }
  return { allowed: true, status: 200, user };
}

/**
 * Shared authorization predicate for non-tRPC HTTP routes.
 * Health/readiness routes intentionally do not call this function.
 */
export function authorizeHttpRequest(
  request: Request,
  resource: AccessResource,
): HttpAuthorizationResult {
  const user = resolveIdentityUser(request);
  if (!user) return authorizeHttpIdentity(null, resource);
  const dataScope = resolveRequestedDataScope(user, request);
  if (!dataScope) {
    return {
      allowed: false,
      status: 403,
      code: "FORBIDDEN",
      reason: "This account cannot access the requested workspace.",
    };
  }
  return authorizeHttpIdentity({ ...user, dataScope }, resource);
}
