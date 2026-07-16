import {
  ALL_ROLES,
  ROLE_DEFINITIONS,
  type UserRole,
} from "../../../src/constants/roles";
import { ROLE_TIER_BY_ROLE } from "../../../src/constants/access-control";
import type {
  M42ActorContext,
  M42RoleTier,
  M42SensitivityLevel,
} from "../../../contracts/m42/shared";
import type { M42SearchActorContext } from "../../../contracts/m42/search";
import { requireM42SyntheticId } from "../../../contracts/m42/shared";

const RESTRICTED_RECORD_ROLES = new Set<UserRole>([
  "super-admin",
  "managing-director",
  "administrator",
  "hr-director",
  "hr-compliance-officer",
  "gro-administrator",
  "program-director",
  "shift-supervisor",
  "bhc-director",
  "treatment-director",
  "clinical-director",
  "ccmg-program-director",
  "mhtcm-supervisor",
  "mhrs-supervisor",
  "clinical-supervisor",
  "nurse",
  "intake-coordinator",
]);

const SYNTHETIC_PART2_ROLES = new Set<UserRole>([
  "super-admin",
  "managing-director",
  "administrator",
  "bhc-director",
  "treatment-director",
  "clinical-director",
  "clinical-supervisor",
  "chart-auditor",
  "therapist",
]);

const REPORT_CLINICAL_ROLES = new Set<UserRole>([
  "super-admin",
  "managing-director",
  "administrator",
  "bhc-director",
  "treatment-director",
  "clinical-director",
  "program-director",
  "gro-administrator",
]);

const REPORT_FINANCE_ROLES = new Set<UserRole>([
  "super-admin",
  "managing-director",
  "administrator",
  "hr-director",
]);

export const M42_AUTHORIZED_ROLES = Object.freeze([...ALL_ROLES]);
export const M42_REVIEWER_ROLES = Object.freeze(
  ALL_ROLES.filter((role) => {
    const tier = ROLE_TIER_BY_ROLE[role];
    return tier === "T1" || tier === "T2";
  }),
);

export function resolveM42RoleTier(role: UserRole): M42RoleTier {
  return ROLE_TIER_BY_ROLE[role];
}

function permissionsFor(role: UserRole, tier: M42RoleTier): readonly string[] {
  const permissions = new Set([
    "m42:experience:read",
    "documents.read",
    "knowledge:read",
  ]);
  if (tier !== "T4") {
    permissions.add("documents.checkout");
    permissions.add("documents.download");
    permissions.add("documents.confidential.read");
  }
  if (RESTRICTED_RECORD_ROLES.has(role))
    permissions.add("documents.restricted.read");
  if (tier === "T1" || tier === "T2") {
    [
      "documents.governance",
      "documents.approve",
      "documents.export",
      "documents.enterprise.read",
      "m42:report:build",
      "m42:report:export",
      "m42:admin:workspace",
    ].forEach((permission) => permissions.add(permission));
    if (REPORT_CLINICAL_ROLES.has(role))
      permissions.add("m42:report:clinical-aggregate");
    if (REPORT_FINANCE_ROLES.has(role))
      permissions.add("m42:report:finance");
    if (["hr-director", "gro-administrator", "program-director"].includes(role))
      permissions.add("m42:admin:records");
    if (["bhc-director", "treatment-director", "clinical-director"].includes(role)) {
      permissions.add("m42:admin:search");
      permissions.add("m42:admin:reporting");
    }
  }
  if (tier === "T1") {
    [
      "documents.enterprise.governance",
      "documents.legal_hold",
      "documents.disclose",
      "m42:report:clinical-aggregate",
      "m42:report:finance",
      "m42:report:restricted",
      "m42:admin:records",
      "m42:admin:search",
      "m42:admin:reporting",
      "m42:admin:workspace",
      "m42:admin:approve",
      "m42:admin:audit",
    ].forEach((permission) => permissions.add(permission));
  }
  if (SYNTHETIC_PART2_ROLES.has(role)) {
    permissions.add("documents.part2.read");
    permissions.add("documents.part2.consent_verified");
  }
  return Object.freeze([...permissions].sort());
}

function sensitivityFor(
  role: UserRole,
  tier: M42RoleTier,
): readonly M42SensitivityLevel[] {
  const levels = new Set<M42SensitivityLevel>(["public", "internal"]);
  if (tier !== "T4") levels.add("confidential");
  if (RESTRICTED_RECORD_ROLES.has(role)) levels.add("restricted");
  if (SYNTHETIC_PART2_ROLES.has(role)) levels.add("part2");
  return Object.freeze([...levels]);
}

export function buildM42ActorContext(
  role: UserRole,
  actorId = `SYNTH-M42-ACTOR-${role.toUpperCase()}`,
): M42ActorContext {
  requireM42SyntheticId(actorId, "actor");
  const definition = ROLE_DEFINITIONS.find((candidate) => candidate.id === role);
  if (!definition) throw new Error("M42_ROLE_DEFINITION_NOT_FOUND");
  const tier = resolveM42RoleTier(role);
  return Object.freeze({
    actorId,
    role,
    tier,
    divisionIds: Object.freeze([definition.division]),
    permissions: permissionsFor(role, tier),
    sensitivityClearance: sensitivityFor(role, tier),
    minimumNecessaryPurpose: `M4.2 synthetic document and knowledge evaluation for ${role}`,
    synthetic: true,
  });
}

export function buildM42SearchActorContext(
  actor: M42ActorContext,
): M42SearchActorContext {
  const division = actor.divisionIds[0];
  const segments = new Set(["enterprise"]);
  if (division === "bhc") segments.add("clinical");
  if (division === "eo" || actor.tier === "T1") segments.add("executive");
  const entitlements = new Set<string>();
  if (actor.permissions.includes("documents.read"))
    entitlements.add("document:read");
  if (actor.permissions.includes("documents.restricted.read"))
    entitlements.add("document:restricted:read");
  if (actor.permissions.includes("knowledge:read"))
    entitlements.add("knowledge:read");
  if (actor.tier === "T1" || actor.tier === "T2") {
    entitlements.add("metadata:sensitivity:read");
    entitlements.add("metadata:program-code:read");
  }
  if (actor.tier === "T1") entitlements.add("metadata:matter-code:read");
  return Object.freeze({
    actorId: actor.actorId,
    allowedLibraryIds: Object.freeze([
      "policy-library",
      "operations-library",
      "quality-library",
      "networked-intelligence-library",
    ]),
    allowedClassifications: Object.freeze(
      (["public", "internal", "restricted"] as const).filter((level) =>
        actor.sensitivityClearance.includes(level),
      ),
    ),
    allowedSegmentIds: Object.freeze([...segments]),
    entitlements: Object.freeze([...entitlements].sort()),
    synthetic: true,
  });
}

export function buildAllM42ActorContexts(): readonly M42ActorContext[] {
  return Object.freeze(
    M42_AUTHORIZED_ROLES.map((role) => buildM42ActorContext(role)),
  );
}
