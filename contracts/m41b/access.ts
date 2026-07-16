import {
  ENTERPRISE_ROLE_REGISTRY,
  ROLE_TIER_BY_ROLE,
  type RoleTier,
} from "../../src/constants/access-control";
import type { DivisionId } from "../../src/constants/organization";
import {
  ALL_ROLES,
  getPermissions,
  type UserRole,
} from "../../src/constants/roles";
import type {
  M41bGovernedSource,
  M41bMaterialDomain,
  M41bRoleContext,
  M41bSourceSensitivity,
} from "./model";

export const M41B_AUTHORIZED_ROLES = Object.freeze([...ALL_ROLES]);
export const M41B_ENTERPRISE_CONTROL_ROLES = Object.freeze(
  ALL_ROLES.filter((role) => ROLE_TIER_BY_ROLE[role] === "T1"),
);

const TIER_RANK: Readonly<Record<RoleTier, number>> = {
  T1: 1,
  T2: 2,
  T3: 3,
  T4: 4,
};

const APPROVERS: Readonly<Record<M41bMaterialDomain, readonly UserRole[]>> = {
  clinical: ["administrator", "bhc-director", "treatment-director", "clinical-director"],
  supervisory: ["administrator", "bhc-director", "gro-administrator", "program-director", "hr-director"],
  financial: ["managing-director", "administrator", "revenue-cycle-manager"],
  regulatory: ["administrator", "hr-compliance-officer", "bhc-director", "gro-administrator"],
  personnel: ["administrator", "hr-director"],
  legal: ["managing-director", "administrator"],
  operational: ["administrator", "bhc-director", "gro-administrator", "program-director", "facilities-manager"],
};

const SUPERVISOR_ROUTES: Readonly<Partial<Record<UserRole, readonly UserRole[]>>> = {
  "managing-director": ["managing-director"],
  administrator: ["managing-director"],
  "bhc-director": ["administrator"],
  "treatment-director": ["bhc-director"],
  "clinical-director": ["bhc-director"],
  "gro-administrator": ["administrator"],
  "program-director": ["gro-administrator"],
  "hr-director": ["administrator"],
  "facilities-manager": ["administrator"],
};

function registry(role: UserRole) {
  const entry = ENTERPRISE_ROLE_REGISTRY.find((candidate) => candidate.role === role);
  if (!entry) throw new Error(`M41B_UNKNOWN_ROLE:${role}`);
  return entry;
}

export function assertM41bAuthorizedRole(role: UserRole): void {
  if (!M41B_AUTHORIZED_ROLES.includes(role)) throw new Error(`M41B_ROLE_ACCESS_DENIED:${role}`);
}

export function m41bTierAtLeast(actual: RoleTier, required: RoleTier): boolean {
  return TIER_RANK[actual] <= TIER_RANK[required];
}

export function m41bDivisionForRole(role: UserRole): DivisionId {
  return registry(role).division;
}

export function m41bAccountableRoles(domain: M41bMaterialDomain): readonly UserRole[] {
  return APPROVERS[domain];
}

export function canApproveM41b(role: UserRole, domain: M41bMaterialDomain): boolean {
  return APPROVERS[domain].includes(role);
}

/**
 * Canonical sensitivity boundary shared by workplans, Ask AMOS, and audit
 * lineage. A tier or division match never substitutes for this permission.
 */
export function canViewM41bSourceSensitivity(
  role: UserRole,
  sensitivity: M41bSourceSensitivity,
): boolean {
  const permissions = getPermissions(role);
  switch (sensitivity) {
    case "internal":
      return true;
    case "clinical":
    case "sud":
      return permissions.canViewClinical;
    case "personnel":
      return permissions.canViewHR;
    case "finance":
      return permissions.canViewRevenue;
    case "legal":
      return permissions.canViewAdmin || permissions.canViewExecutive;
  }
}

export function canViewM41bSource(
  role: UserRole,
  source: Pick<M41bGovernedSource, "sensitivity">,
): boolean {
  return canViewM41bSourceSensitivity(role, source.sensitivity);
}

export function m41bSupervisorRoles(role: UserRole): readonly UserRole[] {
  const direct = SUPERVISOR_ROUTES[role];
  if (direct) return direct;
  const entry = registry(role);
  if (entry.division === "bhc") return ["clinical-supervisor", "bhc-director"];
  if (entry.division === "gro") return ["shift-supervisor", "program-director"];
  if (entry.division === "gad") return ["facilities-manager", "administrator"];
  return ["hr-director", "administrator"];
}

export function buildM41bRoleContext(role: UserRole, userId = `SYNTH-M41B-${role.toUpperCase().replace(/-/g, "_")}`): M41bRoleContext {
  assertM41bAuthorizedRole(role);
  const entry = registry(role);
  const tier = ROLE_TIER_BY_ROLE[role];
  const enterprise = tier === "T1";
  return Object.freeze({
    userId,
    role,
    tier,
    division: entry.division,
    department: entry.department,
    caseloadIds: Object.freeze(
      entry.division === "bhc" || entry.division === "gro"
        ? [`SYNTH-${entry.division.toUpperCase()}-CASELOAD-${role.toUpperCase().replace(/-/g, "_")}`]
        : [],
    ),
    delegatedActions: Object.freeze([
      "read_own_workplan",
      "request_guidance",
      "submit_evidence",
      ...(tier !== "T4" ? ["route_workflow", "create_owned_task"] : []),
      ...(enterprise ? ["view_enterprise_aggregate", "route_cross_division"] : []),
    ]),
    supervisorRoles: Object.freeze([...m41bSupervisorRoles(role)]),
    evidenceClass: "synthetic_demo" as const,
  });
}

export function assertM41bDivisionAccess(context: M41bRoleContext, requestedDivision: DivisionId): void {
  if (context.tier === "T1") return;
  if (context.division !== requestedDivision)
    throw new Error(`M41B_CROSS_DIVISION_ACCESS_DENIED:${context.role}:${requestedDivision}`);
}
