import { describe, expect, it } from "vitest";
import { ALL_ROLES } from "../../src/constants/roles";
import { ROLE_TIER_BY_ROLE } from "../../src/constants/access-control";
import {
  buildAllM42ActorContexts,
  buildM42ActorContext,
  resolveM42RoleTier,
} from "../services/m42/role-context";

describe("M4.2 shared document and knowledge role foundation", () => {
  it("builds one deterministic synthetic context for every canonical role", () => {
    const contexts = buildAllM42ActorContexts();
    expect(contexts).toHaveLength(36);
    expect(contexts.map((context) => context.role)).toEqual(ALL_ROLES);
    expect(contexts.every((context) => context.actorId.startsWith("SYNTH-M42-ACTOR-"))).toBe(true);
    expect(contexts.every((context) => context.synthetic)).toBe(true);
  });

  it("maps enterprise and division leadership to T2+ report access", () => {
    for (const role of ["super-admin", "managing-director", "administrator", "bhc-director", "gro-administrator", "clinical-director"] as const) {
      const context = buildM42ActorContext(role);
      expect(["T1", "T2"]).toContain(context.tier);
      expect(context.permissions).toContain("m42:report:build");
      expect(context.permissions).toContain("m42:admin:workspace");
    }
  });

  it("does not grant the governed report builder to T3 or T4", () => {
    for (const role of ["facilities-manager", "shift-supervisor", "case-manager", "rcs-day"] as const) {
      const context = buildM42ActorContext(role);
      expect(["T3", "T4"]).toContain(context.tier);
      expect(context.permissions).not.toContain("m42:report:build");
      expect(
        context.permissions.some((permission) =>
          permission.startsWith("m42:admin:"),
        ),
      ).toBe(false);
    }
  });

  it("reserves enterprise records and rollback authority to T1", () => {
    expect(buildM42ActorContext("managing-director").permissions).toContain("m42:admin:approve");
    expect(buildM42ActorContext("bhc-director").permissions).not.toContain("m42:admin:approve");
    expect(buildM42ActorContext("clinical-director").permissions).not.toContain("documents.enterprise.governance");
  });

  it("keeps synthetic Part 2 clearance role-specific", () => {
    expect(buildM42ActorContext("therapist").sensitivityClearance).toContain("part2");
    expect(buildM42ActorContext("rcs-day").sensitivityClearance).not.toContain("part2");
  });

  it("uses the canonical enterprise role tier mapping without drift", () => {
    for (const role of ALL_ROLES)
      expect(resolveM42RoleTier(role)).toBe(ROLE_TIER_BY_ROLE[role]);
    expect(resolveM42RoleTier("managing-director")).toBe("T1");
    expect(resolveM42RoleTier("bhc-director")).toBe("T2");
    expect(resolveM42RoleTier("clinical-director")).toBe("T2");
    expect(resolveM42RoleTier("facilities-manager")).toBe("T3");
    expect(resolveM42RoleTier("case-manager")).toBe("T4");
  });
});
