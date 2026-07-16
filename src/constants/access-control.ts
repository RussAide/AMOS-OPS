import {
  ALL_ROLES,
  getPermissions,
  getRoleDef,
  type Permissions,
  type UserRole,
} from "./roles";
import {
  BHC_DEPARTMENTS,
  DIVISIONS,
  isBhcDepartmentCode,
  isDivisionCategory,
  isDivisionId,
  normalizeBhcDepartment,
  type BhcDepartmentCode,
  type DivisionCategory,
  type DivisionId,
} from "./organization";

/** Canonical CTR-025 through CTR-028 role tiers. Tiers classify; they do not grant access alone. */
export type RoleTier = "T1" | "T2" | "T3" | "T4";

export const ROLE_TIER_LABELS: Record<RoleTier, string> = {
  T1: "Enterprise Leadership",
  T2: "Division Leadership",
  T3: "Branch Leadership",
  T4: "Frontline",
};

export const ROLE_TIER_BY_ROLE: Record<UserRole, RoleTier> = {
  "super-admin": "T1",
  "managing-director": "T1",
  administrator: "T1",
  "hr-director": "T2",
  "hr-compliance-officer": "T3",
  "revenue-cycle-manager": "T3",
  "billing-specialist": "T4",
  "training-coordinator": "T3",
  "facilities-manager": "T3",
  "gro-administrator": "T2",
  "program-director": "T2",
  "shift-supervisor": "T3",
  "rcs-lead": "T3",
  "rcs-day": "T4",
  "rcs-night": "T4",
  "rcs-prn": "T4",
  "youth-care-worker": "T4",
  "behavioral-support": "T4",
  "crisis-intervention-specialist": "T3",
  "recreation-coordinator": "T4",
  "medication-aide": "T4",
  "family-liaison": "T4",
  "bhc-director": "T2",
  "treatment-director": "T2",
  "clinical-director": "T2",
  "ccmg-program-director": "T3",
  "mhtcm-supervisor": "T3",
  "mhrs-supervisor": "T3",
  "clinical-supervisor": "T3",
  "chart-auditor": "T4",
  "qmhp-cs": "T4",
  "case-manager": "T4",
  therapist: "T4",
  nurse: "T3",
  "intake-coordinator": "T3",
  "bhc-front-desk": "T4",
};

export interface EnterpriseRoleRegistryEntry {
  role: UserRole;
  tier: RoleTier;
  tierName: string;
  division: DivisionId;
  divisionCategory: DivisionCategory;
  divisionCategoryTag: "PC" | "CO";
  department: string;
  bhcDepartment?: BhcDepartmentCode;
  permissions: Permissions;
}

export const ENTERPRISE_ROLE_REGISTRY: readonly EnterpriseRoleRegistryEntry[] =
  ALL_ROLES.map((role) => {
    const definition = getRoleDef(role);
    const tier = ROLE_TIER_BY_ROLE[role];
    return {
      role,
      tier,
      tierName: ROLE_TIER_LABELS[tier],
      division: definition.division,
      divisionCategory: definition.divisionCategory,
      divisionCategoryTag: DIVISIONS[definition.division].categoryTag,
      department: definition.department,
      bhcDepartment: normalizeBhcDepartment(definition.department),
      permissions: getPermissions(role),
    };
  });

export type AccessDomain =
  | "dashboard"
  | "care-coordination"
  | "clinical"
  | "revenue"
  | "compliance"
  | "hr"
  | "gro"
  | "operations"
  | "campus"
  | "admin"
  | "executive"
  | "decision-intelligence"
  | "documents"
  | "knowledge"
  | "reports"
  | "workflow"
  | "self-service";

export type AccessAction =
  "read" | "create" | "update" | "delete" | "approve" | "manage" | "administer";
export type RecordScope = "own" | "department" | "division" | "enterprise";

export interface AccessSubject {
  userId?: string;
  role: UserRole | string;
  /** Optional identity claims. When present they must match the role registry. */
  division?: DivisionId | string;
  divisionCategory?: DivisionCategory | string;
  department?: BhcDepartmentCode | string;
  tier?: RoleTier | string;
}

export interface AccessResource {
  domain: AccessDomain;
  action: AccessAction;
  division?: DivisionId;
  divisionCategory?: DivisionCategory;
  department?: BhcDepartmentCode;
  recordScope?: RecordScope;
  ownerId?: string;
}

export interface AccessDecision {
  allowed: boolean;
  code:
    | "ALLOW_EXPLICIT"
    | "DENY_UNKNOWN_ROLE"
    | "DENY_CLAIM_MISMATCH"
    | "DENY_NO_PERMISSION"
    | "DENY_SCOPE"
    | "DENY_ACTION_TIER";
  reason: string;
}

const CANONICAL_ROLES = new Set<string>(ALL_ROLES);
const ENTERPRISE_SCOPE_ROLES = new Set<UserRole>([
  "super-admin",
  "managing-director",
  "administrator",
]);
const BHC_CROSS_DEPARTMENT_ROLES = new Set<UserRole>([
  "super-admin",
  "managing-director",
  "administrator",
  "bhc-director",
  "treatment-director",
  "clinical-director",
  "clinical-supervisor",
  "chart-auditor",
]);
/**
 * Cross-functional entry profile for M2.1 only. Record, queue, and mutation
 * authorization remains server-authoritative; this set only permits the
 * canonical roles with a CCMG oversight slice to reach that policy boundary.
 */
const CARE_COORDINATION_ROLES = new Set<UserRole>([
  "super-admin",
  "managing-director",
  "administrator",
  "bhc-director",
  "treatment-director",
  "clinical-director",
  "ccmg-program-director",
  "clinical-supervisor",
  "intake-coordinator",
  "chart-auditor",
  "nurse",
  "mhtcm-supervisor",
  "case-manager",
  "mhrs-supervisor",
  "therapist",
  "qmhp-cs",
  "revenue-cycle-manager",
  "gro-administrator",
  "program-director",
]);
interface CrossDivisionGrant {
  role: UserRole;
  targetDivision: DivisionId;
  domains: readonly AccessDomain[];
  actions: readonly AccessAction[];
}

/** Explicit continuum bridges. No role receives a blanket cross-division bypass. */
export const CROSS_DIVISION_GRANTS: readonly CrossDivisionGrant[] = [
  {
    role: "gro-administrator",
    targetDivision: "bhc",
    domains: ["clinical"],
    actions: ["read"],
  },
  {
    role: "program-director",
    targetDivision: "bhc",
    domains: ["clinical"],
    actions: ["read"],
  },
  {
    role: "behavioral-support",
    targetDivision: "bhc",
    domains: ["clinical"],
    actions: ["read"],
  },
  {
    role: "crisis-intervention-specialist",
    targetDivision: "bhc",
    domains: ["clinical"],
    actions: ["read", "create", "update"],
  },
  {
    role: "medication-aide",
    targetDivision: "bhc",
    domains: ["clinical"],
    actions: ["read", "administer", "update"],
  },
  {
    role: "family-liaison",
    targetDivision: "bhc",
    domains: ["clinical"],
    actions: ["read"],
  },
  {
    role: "bhc-director",
    targetDivision: "gro",
    domains: ["gro", "campus"],
    actions: ["read"],
  },
  {
    role: "treatment-director",
    targetDivision: "gro",
    domains: ["gro", "campus"],
    actions: ["read"],
  },
  {
    role: "clinical-director",
    targetDivision: "gro",
    domains: ["gro", "campus"],
    actions: ["read"],
  },
  {
    role: "clinical-supervisor",
    targetDivision: "gro",
    domains: ["gro", "campus"],
    actions: ["read"],
  },
  {
    role: "case-manager",
    targetDivision: "gro",
    domains: ["gro"],
    actions: ["read", "create", "update"],
  },
  {
    role: "nurse",
    targetDivision: "gro",
    domains: ["gro", "campus"],
    actions: ["read", "administer", "update"],
  },
];

function hasCrossDivisionGrant(
  role: UserRole,
  resource: AccessResource,
): boolean {
  return (
    resource.division !== undefined &&
    CROSS_DIVISION_GRANTS.some(
      (grant) =>
        grant.role === role &&
        grant.targetDivision === resource.division &&
        grant.domains.includes(resource.domain) &&
        grant.actions.includes(resource.action),
    )
  );
}

const WRITE_ACTIONS = new Set<AccessAction>([
  "create",
  "update",
  "delete",
  "approve",
  "manage",
  "administer",
]);

function decision(
  allowed: boolean,
  code: AccessDecision["code"],
  reason: string,
): AccessDecision {
  return { allowed, code, reason };
}

function domainPermission(
  perms: Permissions,
  domain: AccessDomain,
  action: AccessAction,
): boolean {
  const write = WRITE_ACTIONS.has(action);
  switch (domain) {
    case "dashboard":
      return !write;
    case "care-coordination":
      return write
        ? perms.canEditClinical ||
            perms.canEditRevenue ||
            perms.canEditGRO ||
            perms.canEditOperations
        : perms.canViewClinical || perms.canViewRevenue || perms.canViewGRO;
    case "clinical":
      return write ? perms.canEditClinical : perms.canViewClinical;
    case "revenue":
      return write ? perms.canEditRevenue : perms.canViewRevenue;
    case "compliance":
      return write ? perms.canEditCompliance : perms.canViewCompliance;
    case "hr":
      return write ? perms.canEditHR : perms.canViewHR;
    case "gro":
    case "campus":
      return write ? perms.canEditGRO : perms.canViewGRO;
    case "operations":
      return write ? perms.canEditOperations : perms.canViewOperations;
    case "admin":
      return write ? perms.canEditAdmin : perms.canViewAdmin;
    case "executive":
      return !write && perms.canViewExecutive;
    case "decision-intelligence":
      return write
        ? perms.canViewExecutive ||
            perms.canEditRevenue ||
            perms.canEditCompliance ||
            perms.canEditHR ||
            perms.canEditGRO ||
            perms.canEditOperations ||
            perms.canEditClinical
        : perms.canViewExecutive ||
            perms.canViewReports ||
            perms.canViewRevenue ||
            perms.canViewCompliance ||
            perms.canViewHR ||
            perms.canViewGRO ||
            perms.canViewOperations ||
            perms.canViewClinical;
    case "documents":
      return perms.canManageDocuments;
    case "knowledge":
      return write ? perms.canManageDocuments : true;
    case "reports":
      return !write && perms.canViewReports;
    case "workflow":
      return write
        ? perms.canEditOperations ||
            perms.canEditHR ||
            perms.canEditGRO ||
            perms.canEditClinical ||
            perms.canEditRevenue ||
            perms.canEditCompliance
        : perms.canViewOperations ||
            perms.canViewOnboarding ||
            perms.canViewHR ||
            perms.canViewGRO ||
            perms.canViewClinical ||
            perms.canViewRevenue ||
            perms.canViewCompliance;
    case "self-service":
      return action !== "delete" && action !== "manage" && action !== "approve";
  }
}

function roleForSubject(subject: AccessSubject): UserRole | undefined {
  return CANONICAL_ROLES.has(subject.role)
    ? (subject.role as UserRole)
    : undefined;
}

function validateClaims(
  subject: AccessSubject,
  role: UserRole,
): AccessDecision | undefined {
  const registry = ENTERPRISE_ROLE_REGISTRY.find(
    (entry) => entry.role === role,
  )!;
  if (
    subject.division !== undefined &&
    (!isDivisionId(subject.division) || subject.division !== registry.division)
  ) {
    return decision(
      false,
      "DENY_CLAIM_MISMATCH",
      "Identity division claim does not match the Enterprise Role Registry.",
    );
  }
  if (
    subject.divisionCategory !== undefined &&
    (!isDivisionCategory(subject.divisionCategory) ||
      subject.divisionCategory !== registry.divisionCategory)
  ) {
    return decision(
      false,
      "DENY_CLAIM_MISMATCH",
      "Identity PC/CO category claim does not match the Enterprise Role Registry.",
    );
  }
  if (subject.tier !== undefined && subject.tier !== registry.tier) {
    return decision(
      false,
      "DENY_CLAIM_MISMATCH",
      "Identity tier claim does not match the Enterprise Role Registry.",
    );
  }
  if (
    subject.department !== undefined &&
    registry.bhcDepartment !== undefined
  ) {
    const claimedDepartment = normalizeBhcDepartment(subject.department);
    if (claimedDepartment !== registry.bhcDepartment) {
      return decision(
        false,
        "DENY_CLAIM_MISMATCH",
        "Identity department claim does not match the Enterprise Role Registry.",
      );
    }
  }
  return undefined;
}

export function authorizeAccess(
  subject: AccessSubject,
  resource: AccessResource,
): AccessDecision {
  const role = roleForSubject(subject);
  if (!role)
    return decision(
      false,
      "DENY_UNKNOWN_ROLE",
      "Role is not in the canonical 36-role Enterprise Role Registry.",
    );

  const claimFailure = validateClaims(subject, role);
  if (claimFailure) return claimFailure;

  const registry = ENTERPRISE_ROLE_REGISTRY.find(
    (entry) => entry.role === role,
  )!;
  if (
    resource.domain === "care-coordination" &&
    !CARE_COORDINATION_ROLES.has(role)
  ) {
    return decision(
      false,
      "DENY_NO_PERMISSION",
      `Role '${role}' has no explicit CCMG care-coordination slice.`,
    );
  }
  if (
    !domainPermission(registry.permissions, resource.domain, resource.action)
  ) {
    return decision(
      false,
      "DENY_NO_PERMISSION",
      `Role '${role}' has no explicit ${resource.action} permission for ${resource.domain}.`,
    );
  }

  if (
    resource.divisionCategory !== undefined &&
    resource.division !== undefined
  ) {
    if (DIVISIONS[resource.division].category !== resource.divisionCategory) {
      return decision(
        false,
        "DENY_SCOPE",
        "Resource division and PC/CO category tags are inconsistent.",
      );
    }
  }

  if (
    resource.division !== undefined &&
    resource.division !== registry.division &&
    !ENTERPRISE_SCOPE_ROLES.has(role) &&
    !hasCrossDivisionGrant(role, resource)
  ) {
    return decision(
      false,
      "DENY_SCOPE",
      `Role '${role}' is restricted to ${registry.division.toUpperCase()} records.`,
    );
  }

  if (resource.department !== undefined) {
    if (
      !isBhcDepartmentCode(resource.department) ||
      BHC_DEPARTMENTS[resource.department].division !== "bhc"
    ) {
      return decision(
        false,
        "DENY_SCOPE",
        "Resource department is not an authoritative BHC department.",
      );
    }
    if (
      !BHC_CROSS_DEPARTMENT_ROLES.has(role) &&
      registry.bhcDepartment !== resource.department
    ) {
      return decision(
        false,
        "DENY_SCOPE",
        `Role '${role}' is not authorized for ${resource.department.toUpperCase()} records.`,
      );
    }
  }

  if (
    resource.recordScope === "own" &&
    (!subject.userId ||
      !resource.ownerId ||
      subject.userId !== resource.ownerId)
  ) {
    return decision(
      false,
      "DENY_SCOPE",
      "Own-record access requires a matching authenticated owner.",
    );
  }
  if (
    resource.recordScope === "department" &&
    resource.department === undefined
  ) {
    return decision(
      false,
      "DENY_SCOPE",
      "Department-scoped records require an authoritative department tag.",
    );
  }
  if (resource.recordScope === "division" && resource.division === undefined) {
    return decision(
      false,
      "DENY_SCOPE",
      "Division-scoped records require an authoritative division tag.",
    );
  }
  if (
    resource.recordScope === "enterprise" &&
    !ENTERPRISE_SCOPE_ROLES.has(role)
  ) {
    return decision(
      false,
      "DENY_SCOPE",
      "Enterprise-scoped records require an explicit enterprise role.",
    );
  }

  if (
    (resource.action === "approve" || resource.action === "manage") &&
    registry.tier === "T4"
  ) {
    return decision(
      false,
      "DENY_ACTION_TIER",
      `${resource.action} requires an explicit leadership role and permission.`,
    );
  }
  if (
    resource.action === "delete" &&
    (registry.tier === "T3" || registry.tier === "T4")
  ) {
    return decision(
      false,
      "DENY_ACTION_TIER",
      "Delete requires explicit Enterprise or Division Leadership authority.",
    );
  }

  return decision(
    true,
    "ALLOW_EXPLICIT",
    `Role '${role}' has explicit permission and scope for this action.`,
  );
}

export interface ProcedureAccessProfile {
  domain: AccessDomain;
  division?: DivisionId;
  divisionCategory?: DivisionCategory;
  department?: BhcDepartmentCode;
}

export const PROCEDURE_ROOT_ACCESS: Readonly<
  Record<string, ProcedureAccessProfile>
> = {
  auth: { domain: "self-service" },
  dashboard: { domain: "dashboard" },
  analytics: { domain: "reports" },
  mgma: { domain: "reports" },
  m41a: { domain: "decision-intelligence" },
  m41b: { domain: "workflow" },
  m41c: { domain: "self-service" },
  m42: { domain: "self-service" },
  m51a: { domain: "self-service" },
  m51b: { domain: "self-service" },
  m52: { domain: "self-service" },
  dx1: { domain: "self-service" },
  hr: { domain: "hr", division: "eo", divisionCategory: "corporate-office" },
  credentials: {
    domain: "hr",
    division: "eo",
    divisionCategory: "corporate-office",
  },
  separation: {
    domain: "hr",
    division: "eo",
    divisionCategory: "corporate-office",
  },
  performance: {
    domain: "hr",
    division: "eo",
    divisionCategory: "corporate-office",
  },
  training: {
    domain: "hr",
    division: "eo",
    divisionCategory: "corporate-office",
  },
  forms: { domain: "hr", division: "eo", divisionCategory: "corporate-office" },
  bhc: {
    domain: "clinical",
    division: "bhc",
    divisionCategory: "profit-center",
  },
  m5: {
    domain: "clinical",
    division: "bhc",
    divisionCategory: "profit-center",
  },
  m13: {
    domain: "clinical",
    division: "bhc",
    divisionCategory: "profit-center",
  },
  m14: {
    domain: "clinical",
    division: "bhc",
    divisionCategory: "profit-center",
  },
  m15: {
    domain: "clinical",
    division: "bhc",
    divisionCategory: "profit-center",
  },
  m16: {
    domain: "clinical",
    division: "bhc",
    divisionCategory: "profit-center",
  },
  m17: {
    domain: "clinical",
    division: "bhc",
    divisionCategory: "profit-center",
  },
  ccmg: {
    domain: "clinical",
    division: "bhc",
    divisionCategory: "profit-center",
    department: "ccmg",
  },
  mhtcm: {
    domain: "clinical",
    division: "bhc",
    divisionCategory: "profit-center",
    department: "mhtcm",
  },
  mhrs: {
    domain: "clinical",
    division: "bhc",
    divisionCategory: "profit-center",
    department: "mhrs",
  },
  revenue: {
    domain: "revenue",
    division: "eo",
    divisionCategory: "corporate-office",
  },
  m4: {
    domain: "revenue",
    division: "eo",
    divisionCategory: "corporate-office",
  },
  qa: { domain: "compliance" },
  m3: { domain: "compliance" },
  part2: {
    domain: "compliance",
    division: "bhc",
    divisionCategory: "profit-center",
  },
  groCompliance: {
    domain: "compliance",
    division: "gro",
    divisionCategory: "profit-center",
  },
  regulatoryFramework: { domain: "compliance" },
  gad: {
    domain: "operations",
    division: "gad",
    divisionCategory: "corporate-office",
  },
  m7: {
    domain: "operations",
    division: "gad",
    divisionCategory: "corporate-office",
  },
  gro: { domain: "gro", division: "gro", divisionCategory: "profit-center" },
  m6: { domain: "gro", division: "gro", divisionCategory: "profit-center" },
  groResidential: {
    domain: "gro",
    division: "gro",
    divisionCategory: "profit-center",
  },
  m18: { domain: "gro", division: "gro", divisionCategory: "profit-center" },
  m19: { domain: "campus", division: "gro", divisionCategory: "profit-center" },
  m20: { domain: "gro", division: "gro", divisionCategory: "profit-center" },
  workflow: { domain: "workflow" },
  m1: { domain: "workflow" },
  m2: { domain: "documents" },
  documents: { domain: "documents" },
  email: { domain: "documents" },
  nil: { domain: "knowledge" },
  m9: { domain: "knowledge" },
  m21: { domain: "care-coordination" },
  phase2: { domain: "workflow" },
  phase3: { domain: "workflow" },
  m22: {
    domain: "clinical",
    division: "bhc",
    divisionCategory: "profit-center",
    department: "mhtcm",
  },
  m23: {
    domain: "clinical",
    division: "bhc",
    divisionCategory: "profit-center",
    department: "mhrs",
  },
  m24: { domain: "gro", division: "gro", divisionCategory: "profit-center" },
  m29: { domain: "knowledge" },
  persona: { domain: "knowledge" },
  notifications: { domain: "self-service" },
  msgraph: {
    domain: "admin",
    division: "eo",
    divisionCategory: "corporate-office",
  },
};

const APPROVAL_PREFIXES = [
  "approve",
  "accept",
  "decline",
  "respond",
  "clear",
  "certify",
  "verify",
];
const DELETE_PREFIXES = ["delete", "remove", "vacate", "archive", "withdraw"];
const MANAGE_PREFIXES = [
  "seed",
  "sync",
  "reindex",
  "activate",
  "configure",
  "recalculate",
  "bulk",
];
const CREATE_PREFIXES = [
  "create",
  "add",
  "send",
  "submit",
  "assign",
  "register",
  "trigger",
];

export function inferProcedureAction(
  procedureName: string,
  procedureType: "query" | "mutation" | "subscription",
): AccessAction {
  if (procedureType === "query" || procedureType === "subscription")
    return "read";
  const normalized = procedureName.toLowerCase();
  if (normalized.startsWith("administer")) return "administer";
  if (APPROVAL_PREFIXES.some((prefix) => normalized.startsWith(prefix)))
    return "approve";
  if (DELETE_PREFIXES.some((prefix) => normalized.startsWith(prefix)))
    return "delete";
  if (MANAGE_PREFIXES.some((prefix) => normalized.startsWith(prefix)))
    return "manage";
  if (CREATE_PREFIXES.some((prefix) => normalized.startsWith(prefix)))
    return "create";
  return "update";
}

export function procedureAccessResource(
  path: string,
  procedureType: "query" | "mutation" | "subscription",
  scoped?: Partial<AccessResource>,
): AccessResource | undefined {
  const [root, procedureName = ""] = path.split(".");
  const profile = PROCEDURE_ROOT_ACCESS[root];
  if (!profile) return undefined;

  // Auth administration is never treated as ordinary self-service.
  const adminAuthProcedure =
    /^(listUsers|updateUser|deleteUser|listAccessReviews|completeAccessReview|resetMfa|disableUser)/.test(
      procedureName,
    );
  const executiveDashboard =
    root === "dashboard" && procedureName === "executiveKPIs";
  const m41bSelfService =
    root === "m41b" &&
    new Set([
      "getMyWorkplan",
      "getCadenceBrief",
      "askAmos",
      "addCompletionEvidence",
      "completeTask",
      "escalateTask",
      "getAuditLineage",
    ]).has(procedureName);
  const m41bHumanDisposition =
    root === "m41b" && procedureName === "recordHumanDisposition";
  const m41bReset = root === "m41b" && procedureName === "resetEvaluation";
  return {
    ...profile,
    ...(adminAuthProcedure
      ? {
          domain: "admin" as const,
          division: "eo" as const,
          divisionCategory: "corporate-office" as const,
        }
      : {}),
    ...(executiveDashboard
      ? {
          domain: "executive" as const,
          division: "eo" as const,
          divisionCategory: "corporate-office" as const,
        }
      : {}),
    ...(m41bSelfService ? { domain: "self-service" as const } : {}),
    action: m41bHumanDisposition
      ? "approve"
      : m41bReset
        ? "manage"
        : inferProcedureAction(procedureName, procedureType),
    ...scoped,
  };
}

const CLIENT_ROUTE_ACCESS: readonly [
  prefix: string,
  profile: ProcedureAccessProfile,
][] = [
  ["/home", { domain: "dashboard" }],
  ["/operations-hub", { domain: "self-service" }],
  ["/clinical/intelligence-fabric", { domain: "self-service" }],
  ["/executive/decision-intelligence", { domain: "decision-intelligence" }],
  [
    "/admin",
    { domain: "admin", division: "eo", divisionCategory: "corporate-office" },
  ],
  [
    "/executive",
    {
      domain: "executive",
      division: "eo",
      divisionCategory: "corporate-office",
    },
  ],
  ["/ccmg", { domain: "care-coordination" }],
  ["/continuum", { domain: "workflow" }],
  ["/corporate-operations", { domain: "dashboard" }],
  [
    "/mhtcm",
    {
      domain: "clinical",
      division: "bhc",
      divisionCategory: "profit-center",
      department: "mhtcm",
    },
  ],
  [
    "/mhrs",
    {
      domain: "clinical",
      division: "bhc",
      divisionCategory: "profit-center",
      department: "mhrs",
    },
  ],
  [
    "/clinical",
    { domain: "clinical", division: "bhc", divisionCategory: "profit-center" },
  ],
  [
    "/bhc",
    { domain: "clinical", division: "bhc", divisionCategory: "profit-center" },
  ],
  [
    "/intake",
    { domain: "clinical", division: "bhc", divisionCategory: "profit-center" },
  ],
  [
    "/cases",
    { domain: "clinical", division: "bhc", divisionCategory: "profit-center" },
  ],
  [
    "/crisis",
    { domain: "clinical", division: "bhc", divisionCategory: "profit-center" },
  ],
  ["/medications", { domain: "clinical" }],
  ["/mobile-mar", { domain: "clinical" }],
  [
    "/revenue",
    { domain: "revenue", division: "eo", divisionCategory: "corporate-office" },
  ],
  [
    "/authorizations",
    { domain: "revenue", division: "eo", divisionCategory: "corporate-office" },
  ],
  ["/qa", { domain: "compliance" }],
  ["/compliance", { domain: "compliance" }],
  ["/toolkits", { domain: "compliance" }],
  [
    "/hr",
    { domain: "hr", division: "eo", divisionCategory: "corporate-office" },
  ],
  [
    "/onboarding",
    { domain: "hr", division: "eo", divisionCategory: "corporate-office" },
  ],
  [
    "/training",
    { domain: "hr", division: "eo", divisionCategory: "corporate-office" },
  ],
  [
    "/gro",
    { domain: "gro", division: "gro", divisionCategory: "profit-center" },
  ],
  [
    "/residential",
    { domain: "gro", division: "gro", divisionCategory: "profit-center" },
  ],
  [
    "/observations",
    { domain: "gro", division: "gro", divisionCategory: "profit-center" },
  ],
  [
    "/meetings",
    { domain: "gro", division: "gro", divisionCategory: "profit-center" },
  ],
  [
    "/handoffs",
    { domain: "gro", division: "gro", divisionCategory: "profit-center" },
  ],
  [
    "/family",
    { domain: "gro", division: "gro", divisionCategory: "profit-center" },
  ],
  [
    "/campus",
    { domain: "campus", division: "gro", divisionCategory: "profit-center" },
  ],
  [
    "/gad",
    {
      domain: "operations",
      division: "gad",
      divisionCategory: "corporate-office",
    },
  ],
  ["/workflows", { domain: "workflow" }],
  ["/documents", { domain: "documents" }],
  ["/knowledge", { domain: "knowledge" }],
  ["/nil", { domain: "knowledge" }],
  ["/analytics", { domain: "reports" }],
  ["/", { domain: "dashboard" }],
];

export function clientRouteAccessResource(
  pathname: string,
): AccessResource | undefined {
  const match = CLIENT_ROUTE_ACCESS.find(([prefix]) =>
    prefix === "/"
      ? pathname === "/"
      : pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  return match ? { ...match[1], action: "read" } : undefined;
}

export function authorizeClientRoute(
  role: UserRole | string,
  pathname: string,
): AccessDecision {
  const resource = clientRouteAccessResource(pathname);
  if (!resource)
    return decision(
      false,
      "DENY_NO_PERMISSION",
      "Route has no explicit access policy.",
    );
  return authorizeAccess({ role }, resource);
}
