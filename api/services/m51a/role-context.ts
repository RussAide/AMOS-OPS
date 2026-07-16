import {
  ALL_ROLES,
  ROLE_DEFINITIONS,
  type UserRole,
} from "../../../src/constants/roles";
import { ROLE_TIER_BY_ROLE } from "../../../src/constants/access-control";
import type { M51AActorContext } from "../../../contracts/m51a/shared";
import { requireM51ASyntheticId } from "../../../contracts/m51a/shared";
import { buildM42ActorContext } from "../m42/role-context";

const WORKFORCE_FINANCE_METADATA_ROLES = new Set<UserRole>([
  "super-admin",
  "managing-director",
  "administrator",
  "hr-director",
  "hr-compliance-officer",
  "revenue-cycle-manager",
  "billing-specialist",
]);

export const M51A_AUTHORIZED_ROLES = Object.freeze([...ALL_ROLES]);
export const M51A_REVIEWER_ROLES = Object.freeze(
  ALL_ROLES.filter((role) => {
    const tier = ROLE_TIER_BY_ROLE[role];
    return tier === "T1" || tier === "T2";
  }),
);

function permissionsFor(role: UserRole): readonly string[] {
  const tier = ROLE_TIER_BY_ROLE[role];
  const inherited = buildM42ActorContext(role);
  const permissions = new Set([
    "m51a:hub:read",
    "m51a:route:resolve",
    "m51a:published-guidance:read",
  ]);
  if (tier !== "T4") permissions.add("m51a:inventory:metadata:read");
  if (tier === "T1" || tier === "T2") {
    permissions.add("m51a:registry:read");
    permissions.add("m51a:inventory:read");
    permissions.add("m51a:pilot:review");
  }
  if (tier === "T1") {
    permissions.add("m51a:architecture:admin");
    permissions.add("m51a:registry:configure");
    permissions.add("m51a:pilot:execute");
    permissions.add("m51a:exceptions:review");
  }
  if (inherited.permissions.includes("documents.restricted.read"))
    permissions.add("m51a:restricted:metadata");
  if (inherited.permissions.includes("documents.part2.read"))
    permissions.add("m51a:part2:metadata");
  if (WORKFORCE_FINANCE_METADATA_ROLES.has(role))
    permissions.add("m51a:workforce-finance:metadata");
  return Object.freeze([...permissions].sort());
}

export function buildM51AActorContext(
  role: UserRole,
  actorId = `SYNTH-M51A-ACTOR-${role.toUpperCase()}`,
): M51AActorContext {
  requireM51ASyntheticId(actorId, "actor");
  const definition = ROLE_DEFINITIONS.find((candidate) => candidate.id === role);
  if (!definition) throw new Error("M51A_ROLE_DEFINITION_NOT_FOUND");
  return Object.freeze({
    actorId,
    role,
    tier: ROLE_TIER_BY_ROLE[role],
    divisionIds: Object.freeze([definition.division]),
    permissions: permissionsFor(role),
    minimumNecessaryPurpose: `M5.1A synthetic Operations Hub and connector architecture evaluation for ${role}`,
    synthetic: true,
  });
}

export function buildAllM51AActorContexts(): readonly M51AActorContext[] {
  return Object.freeze(
    M51A_AUTHORIZED_ROLES.map((role) => buildM51AActorContext(role)),
  );
}
