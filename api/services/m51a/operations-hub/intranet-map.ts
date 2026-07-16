import {
  M51A_INTRANET_DESTINATION_CODES,
  type M51aHubSite,
  type M51aIntranetDestinationCode,
  type M51aIntranetRoute,
  type M51aIntranetRouteDecision,
  type M51aRoleRouteProjection,
} from "@contracts/m51a/operations-hub";
import {
  authorizeAccess,
  ENTERPRISE_ROLE_REGISTRY,
  ROLE_TIER_BY_ROLE,
} from "@/constants/access-control";
import { ALL_ROLES, type UserRole } from "@/constants/roles";
import {
  M51A_OPERATIONS_HUB_SITE_ID,
  m51aHubDeterministicId,
  m51aHubImmutable,
} from "./topology";

export const M51A_APPROVED_CAPABILITY_TARGET_KEYS = m51aHubImmutable([
  "AMOS-APP-EXECUTIVE-COMMAND",
  "AMOS-APP-MY-WORK-EIA",
  "AMOS-APP-CLINICAL-LANDING",
  "AMOS-APP-GRO-LANDING",
  "AMOS-APP-QUALITY-COMPLIANCE",
  "AMOS-APP-WORKFORCE-LEARNING",
  "AMOS-APP-FINANCE-REVENUE",
  "AMOS-APP-CONTRACTS-GROWTH",
  "AMOS-APP-ENTERPRISE-DMS-SEARCH",
  "AMOS-APP-SYSTEM-ADMINISTRATION",
] as const);

function route(
  input: Omit<
    M51aIntranetRoute,
    | "routeId"
    | "sourceTransparent"
    | "physicalPathIsIdentity"
    | "generalNavigation"
    | "synthetic"
  >,
): M51aIntranetRoute {
  return m51aHubImmutable({
    ...input,
    routeId: `SYNTH-M51A-ROUTE-${input.code.toUpperCase()}`,
    sourceTransparent: true,
    physicalPathIsIdentity: false,
    generalNavigation: true,
    synthetic: true,
  });
}

export function createSyntheticM51aIntranetMap(): readonly M51aIntranetRoute[] {
  return m51aHubImmutable([
    route({
      code: "home-enterprise-operations",
      label: "Home / Enterprise Operations",
      logicalPath: "/operations",
      targetKind: "hub_home",
      targetKey: M51A_OPERATIONS_HUB_SITE_ID,
      ownerRole: "administrator",
      accessDomain: "dashboard",
      accessAction: "read",
      resourceDivision: null,
    }),
    route({
      code: "executive-command",
      label: "Executive Command",
      logicalPath: "/executive",
      targetKind: "application_capability",
      targetKey: "AMOS-APP-EXECUTIVE-COMMAND",
      ownerRole: "managing-director",
      accessDomain: "executive",
      accessAction: "read",
      resourceDivision: null,
    }),
    route({
      code: "my-work-eia",
      label: "My Work / EIA",
      logicalPath: "/my-work/eia",
      targetKind: "application_capability",
      targetKey: "AMOS-APP-MY-WORK-EIA",
      ownerRole: "managing-director",
      accessDomain: "self-service",
      accessAction: "read",
      resourceDivision: null,
    }),
    route({
      code: "clinical",
      label: "Clinical",
      logicalPath: "/clinical",
      targetKind: "application_capability",
      targetKey: "AMOS-APP-CLINICAL-LANDING",
      ownerRole: "clinical-director",
      accessDomain: "clinical",
      accessAction: "read",
      resourceDivision: "bhc",
    }),
    route({
      code: "residential-gro",
      label: "Residential / GRO",
      logicalPath: "/residential/gro",
      targetKind: "application_capability",
      targetKey: "AMOS-APP-GRO-LANDING",
      ownerRole: "gro-administrator",
      accessDomain: "gro",
      accessAction: "read",
      resourceDivision: "gro",
    }),
    route({
      code: "quality-compliance",
      label: "Quality / Compliance",
      logicalPath: "/quality-compliance",
      targetKind: "application_capability",
      targetKey: "AMOS-APP-QUALITY-COMPLIANCE",
      ownerRole: "hr-compliance-officer",
      accessDomain: "compliance",
      accessAction: "read",
      resourceDivision: null,
    }),
    route({
      code: "workforce-learning",
      label: "Workforce / Learning",
      logicalPath: "/workforce-learning",
      targetKind: "application_capability",
      targetKey: "AMOS-APP-WORKFORCE-LEARNING",
      ownerRole: "hr-director",
      accessDomain: "hr",
      accessAction: "read",
      resourceDivision: null,
    }),
    route({
      code: "finance-revenue",
      label: "Finance / Revenue",
      logicalPath: "/finance-revenue",
      targetKind: "application_capability",
      targetKey: "AMOS-APP-FINANCE-REVENUE",
      ownerRole: "revenue-cycle-manager",
      accessDomain: "revenue",
      accessAction: "read",
      resourceDivision: null,
    }),
    route({
      code: "contracts-growth",
      label: "Contracts / Growth",
      logicalPath: "/contracts-growth",
      targetKind: "application_capability",
      targetKey: "AMOS-APP-CONTRACTS-GROWTH",
      ownerRole: "managing-director",
      accessDomain: "operations",
      accessAction: "read",
      resourceDivision: null,
    }),
    route({
      code: "enterprise-dms-search",
      label: "Enterprise DMS Search",
      logicalPath: "/dms/search",
      targetKind: "permission_trimmed_search",
      targetKey: "AMOS-APP-ENTERPRISE-DMS-SEARCH",
      ownerRole: "administrator",
      accessDomain: "knowledge",
      accessAction: "read",
      resourceDivision: null,
    }),
    route({
      code: "system-administration",
      label: "System Administration",
      logicalPath: "/system-administration",
      targetKind: "system_administration",
      targetKey: "AMOS-APP-SYSTEM-ADMINISTRATION",
      ownerRole: "super-admin",
      accessDomain: "admin",
      accessAction: "read",
      resourceDivision: null,
    }),
  ]);
}

function canonicalRole(value: string): UserRole | null {
  return ALL_ROLES.includes(value as UserRole) ? (value as UserRole) : null;
}

export function resolveM51aIntranetRoute(
  roleValue: string,
  routeCodeValue: string,
  routes: readonly M51aIntranetRoute[] = createSyntheticM51aIntranetMap(),
  sites: readonly M51aHubSite[] = [],
): M51aIntranetRouteDecision {
  const role = canonicalRole(roleValue);
  const route = routes.find((candidate) => candidate.code === routeCodeValue);
  let allowed = true;
  let reasonCode: M51aIntranetRouteDecision["reasonCode"] =
    "ALLOW_CANONICAL_POLICY";

  if (!role) {
    allowed = false;
    reasonCode = "DENY_UNKNOWN_ROLE";
  } else if (!route) {
    allowed = false;
    reasonCode = "DENY_UNKNOWN_ROUTE";
  } else {
    const targetSite = sites.find((candidate) => candidate.siteId === route.targetKey);
    if (
      targetSite &&
      (targetSite.kind === "restricted_record_zone" ||
        targetSite.kind === "system_managed_zone")
    ) {
      allowed = false;
      reasonCode = "DENY_RESTRICTED_TARGET";
    } else {
      const decision = authorizeAccess(
        { role },
        {
          domain: route.accessDomain,
          action: route.accessAction,
          ...(route.resourceDivision
            ? { division: route.resourceDivision }
            : {}),
        },
      );
      if (!decision.allowed) {
        allowed = false;
        reasonCode = "DENY_CANONICAL_POLICY";
      }
    }
  }

  return m51aHubImmutable({
    decisionId: m51aHubDeterministicId(
      "M51A-ROUTE-DECISION",
      roleValue,
      routeCodeValue,
    ),
    routeCode: route?.code ?? "unknown",
    role: roleValue,
    allowed,
    reasonCode,
    logicalPath: allowed && route ? route.logicalPath : null,
    targetKey: allowed && route ? route.targetKey : null,
    physicalMicrosoftUrl: null,
    permissionTrimmed: true,
    synthetic: true,
  });
}

export function projectM51aIntranetRoutes(
  role: UserRole,
  routes: readonly M51aIntranetRoute[] = createSyntheticM51aIntranetMap(),
  sites: readonly M51aHubSite[] = [],
): M51aRoleRouteProjection {
  const decisions = routes.map((candidate) =>
    resolveM51aIntranetRoute(role, candidate.code, routes, sites),
  );
  const allowedCodes = new Set(
    decisions
      .filter((decision) => decision.allowed)
      .map((decision) => decision.routeCode),
  );
  const registry = ENTERPRISE_ROLE_REGISTRY.find(
    (candidate) => candidate.role === role,
  );
  if (!registry) throw new Error("M51A_CANONICAL_ROLE_REQUIRED");
  return m51aHubImmutable({
    role,
    tier: ROLE_TIER_BY_ROLE[role],
    division: registry.division,
    routes: m51aHubImmutable(
      routes.filter((candidate) => allowedCodes.has(candidate.code)),
    ),
    deniedRouteCodes: m51aHubImmutable(
      decisions
        .filter((decision) => !decision.allowed)
        .map((decision) => decision.routeCode)
        .filter(
          (code): code is M51aIntranetDestinationCode => code !== "unknown",
        ),
    ),
    unknownRouteDisclosure: false,
    permissionTrimmed: true,
    synthetic: true,
  });
}

export function buildAllM51aRoleRouteProjections(
  routes: readonly M51aIntranetRoute[] = createSyntheticM51aIntranetMap(),
  sites: readonly M51aHubSite[] = [],
): readonly M51aRoleRouteProjection[] {
  return m51aHubImmutable(
    ALL_ROLES.map((role) => projectM51aIntranetRoutes(role, routes, sites)),
  );
}

export function validateM51aIntranetMap(
  routes: readonly M51aIntranetRoute[],
  sites: readonly M51aHubSite[],
): readonly string[] {
  const errors: string[] = [];
  const codes = new Set<M51aIntranetDestinationCode>();
  const routeIds = new Set<string>();
  const logicalPaths = new Set<string>();
  const approvedTargets = new Set<string>([
    M51A_OPERATIONS_HUB_SITE_ID,
    ...M51A_APPROVED_CAPABILITY_TARGET_KEYS,
  ]);
  const siteById = new Map(sites.map((candidate) => [candidate.siteId, candidate]));
  for (const item of routes) {
    if (codes.has(item.code)) errors.push(`DUPLICATE_ROUTE_CODE:${item.code}`);
    if (routeIds.has(item.routeId)) errors.push(`DUPLICATE_ROUTE_ID:${item.routeId}`);
    if (logicalPaths.has(item.logicalPath)) errors.push(`DUPLICATE_LOGICAL_PATH:${item.logicalPath}`);
    codes.add(item.code);
    routeIds.add(item.routeId);
    logicalPaths.add(item.logicalPath);
    if (!item.ownerRole || !item.sourceTransparent || item.physicalPathIsIdentity)
      errors.push(`ROUTE_GOVERNANCE_INVALID:${item.code}`);
    if (/^https?:\/\//i.test(item.targetKey))
      errors.push(`PHYSICAL_URL_AS_IDENTITY:${item.code}`);
    if (!approvedTargets.has(item.targetKey))
      errors.push(`ROUTE_TARGET_UNKNOWN:${item.code}`);
    const targetSite = siteById.get(item.targetKey);
    if (
      targetSite &&
      (targetSite.kind === "restricted_record_zone" ||
        targetSite.kind === "system_managed_zone")
    )
      errors.push(`RESTRICTED_ROUTE_IN_GENERAL_MAP:${item.code}`);
  }
  for (const code of M51A_INTRANET_DESTINATION_CODES)
    if (!codes.has(code)) errors.push(`REQUIRED_ROUTE_MISSING:${code}`);
  for (const item of routes) {
    const accessible = ALL_ROLES.some((role) =>
      resolveM51aIntranetRoute(role, item.code, routes, sites).allowed,
    );
    if (!accessible) errors.push(`ROUTE_HAS_NO_AUTHORIZED_AUDIENCE:${item.code}`);
  }
  return m51aHubImmutable([...new Set(errors)]);
}
