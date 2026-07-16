import { describe, expect, it } from "vitest";
import { ALL_ROLES } from "../../src/constants/roles";
import { ROLE_TIER_BY_ROLE } from "../../src/constants/access-control";
import { authorizeClientRoute } from "../../src/constants/access-control";
import {
  M51A_AUTHORIZED_ROLES,
  M51A_REVIEWER_ROLES,
  buildAllM51AActorContexts,
  buildM51AActorContext,
} from "../services/m51a/role-context";
import {
  M51A_PROHIBITED_ACTIONS,
  createM51ADemoBoundary,
} from "../../contracts/m51a/shared";

describe("M5.1A canonical role and synthetic boundary foundation", () => {
  it("builds one deterministic actor for every canonical enterprise role", () => {
    const actors = buildAllM51AActorContexts();
    expect(M51A_AUTHORIZED_ROLES).toEqual(ALL_ROLES);
    expect(actors).toHaveLength(36);
    expect(new Set(actors.map((actor) => actor.role)).size).toBe(36);
    expect(actors.every((actor) => actor.synthetic)).toBe(true);
    expect(actors.every((actor) => actor.tier === ROLE_TIER_BY_ROLE[actor.role])).toBe(
      true,
    );
  });

  it("limits architecture review to canonical T1 and T2 roles", () => {
    expect(M51A_REVIEWER_ROLES).toHaveLength(9);
    expect(
      M51A_REVIEWER_ROLES.every((role) =>
        ["T1", "T2"].includes(ROLE_TIER_BY_ROLE[role]),
      ),
    ).toBe(true);
  });

  it("registers the Operations Hub route for every canonical role", () => {
    for (const role of ALL_ROLES)
      expect(authorizeClientRoute(role, "/operations-hub").allowed).toBe(true);
    expect(authorizeClientRoute("unknown-role", "/operations-hub").allowed).toBe(
      false,
    );
  });

  it("grants only T1 actors configuration and pilot execution authority", () => {
    for (const role of ALL_ROLES) {
      const actor = buildM51AActorContext(role);
      expect(actor.permissions.includes("m51a:architecture:admin")).toBe(
        actor.tier === "T1",
      );
      expect(actor.permissions.includes("m51a:pilot:execute")).toBe(
        actor.tier === "T1",
      );
    }
  });

  it("exposes no live Microsoft or production-write permission", () => {
    for (const actor of buildAllM51AActorContexts()) {
      expect(actor.permissions.some((permission) => /live|production.*write/i.test(permission))).toBe(
        false,
      );
    }
  });

  it("requires a synthetic server-derived actor identity", () => {
    expect(() => buildM51AActorContext("managing-director", "REAL-ACTOR-1")).toThrow(
      "M51A_ACTOR_SYNTHETIC_ID_REQUIRED",
    );
  });

  it("freezes the no-real-data and zero-live-Microsoft boundary", () => {
    const boundary = createM51ADemoBoundary();
    expect(boundary.syntheticOnly).toBe(true);
    expect(boundary.realDataUsed).toBe(false);
    expect(boundary.realFileContentRead).toBe(false);
    expect(boundary.productionRows).toBe(0);
    expect(boundary.liveWrites).toBe(0);
    expect(boundary.liveMicrosoftReads).toBe(0);
    expect(boundary.liveMicrosoftWrites).toBe(0);
    expect(boundary.prohibitedActions).toEqual(M51A_PROHIBITED_ACTIONS);
  });
});
