import {
  ENTERPRISE_ROLE_REGISTRY,
  ROLE_TIER_BY_ROLE,
} from "../../src/constants/access-control";
import type { UserRole } from "../../src/constants/roles";
import type {
  M41aDashboardAccess,
  M41aDrillDepth,
  M41aScopeId,
  M41aSensitivity,
} from "./model";

export const M41A_ENTERPRISE_CONTROL_ROLES = [
  "super-admin",
  "managing-director",
  "administrator",
] as const satisfies readonly UserRole[];

const ENTERPRISE_ROLES = new Set<UserRole>(M41A_ENTERPRISE_CONTROL_ROLES);

const ROLE_SCOPES: Readonly<Partial<Record<UserRole, readonly M41aScopeId[]>>> = {
  "bhc-director": ["BHC"],
  "treatment-director": ["BHC"],
  "clinical-director": ["BHC"],
  "gro-administrator": ["GRO"],
  "program-director": ["GRO"],
  "hr-director": ["EO"],
  "hr-compliance-officer": ["EO"],
  "revenue-cycle-manager": ["EO"],
  "facilities-manager": ["GAD"],
};

const DECISION_ROLES = new Set<UserRole>([
  "super-admin",
  "managing-director",
  "administrator",
  "bhc-director",
  "gro-administrator",
  "program-director",
  "hr-director",
  "hr-compliance-officer",
  "revenue-cycle-manager",
  "facilities-manager",
]);

export const M41A_AUTHORIZED_ROLES = [
  "super-admin",
  "managing-director",
  "administrator",
  "bhc-director",
  "treatment-director",
  "clinical-director",
  "gro-administrator",
  "program-director",
  "hr-director",
  "hr-compliance-officer",
  "revenue-cycle-manager",
  "facilities-manager",
] as const satisfies readonly UserRole[];

export function authorizedM41aScopes(role: UserRole): readonly M41aScopeId[] {
  if (ENTERPRISE_ROLES.has(role))
    return ["ENTERPRISE", "BHC", "GRO", "EO", "GAD"];
  return ROLE_SCOPES[role] ?? [];
}

export function assertM41aScopeAuthorized(
  role: UserRole,
  requestedScope: M41aScopeId,
): void {
  if (ROLE_TIER_BY_ROLE[role] === "T4")
    throw new Error("M41A_T4_ACCESS_DENIED");
  if (!authorizedM41aScopes(role).includes(requestedScope))
    throw new Error(`M41A_SCOPE_ACCESS_DENIED:${role}:${requestedScope}`);
}

export function assertM41aEnterpriseControlRole(role: UserRole): void {
  if (!ENTERPRISE_ROLES.has(role))
    throw new Error(`M41A_ENTERPRISE_CONTROL_ACCESS_DENIED:${role}`);
}

function registryDivision(role: UserRole): string {
  return (
    ENTERPRISE_ROLE_REGISTRY.find((entry) => entry.role === role)?.division ??
    "unknown"
  );
}

export function maximumM41aDrillDepth(
  role: UserRole,
  scope: M41aScopeId,
  sensitivity: M41aSensitivity,
): 0 | M41aDrillDepth {
  assertM41aScopeAuthorized(role, scope);
  if (sensitivity === "sud") return 0;
  if (ENTERPRISE_ROLES.has(role)) return 3;
  if (sensitivity === "aggregate") return 3;
  if (sensitivity === "finance") return role === "revenue-cycle-manager" ? 3 : 2;

  const division = registryDivision(role);
  if (sensitivity === "staff") return division === "eo" ? 2 : 1;
  if (sensitivity === "youth") return 1;
  return 1;
}

export function buildM41aDashboardAccess(
  role: UserRole,
  requestedScope: M41aScopeId,
): M41aDashboardAccess {
  assertM41aScopeAuthorized(role, requestedScope);
  const enterprise = ENTERPRISE_ROLES.has(role);
  const controlledSensitivities = [
    "youth",
    "staff",
    "finance",
    "sud",
  ] as const satisfies readonly M41aSensitivity[];
  return {
    actorRole: role,
    requestedScope,
    authorizedScopes: authorizedM41aScopes(role),
    aggregateFinanceVisible:
      enterprise ||
      role === "revenue-cycle-manager" ||
      role === "facilities-manager" ||
      requestedScope === "BHC" ||
      requestedScope === "GRO",
    sensitiveDetailSuppressed: controlledSensitivities.filter(
      (sensitivity) =>
        maximumM41aDrillDepth(role, requestedScope, sensitivity) < 3,
    ),
    decisionActionsAllowed: DECISION_ROLES.has(role),
  };
}
