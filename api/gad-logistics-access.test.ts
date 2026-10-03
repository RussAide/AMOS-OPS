import { describe, expect, it } from "vitest";
import {
  authorizeAccess,
  authorizeClientRoute,
} from "../src/constants/access-control";
import { ALL_ROLES, getRoleDef } from "../src/constants/roles";
import { requiresMfa } from "./security/identity";

describe("GAD Logistics R1 access contract", () => {
  it("registers the two GAD Logistics roles in the canonical registry", () => {
    expect(ALL_ROLES).toContain("logistics-manager");
    expect(ALL_ROLES).toContain("logistics-coordinator");
    expect(ALL_ROLES).toHaveLength(38);
    expect(getRoleDef("logistics-manager")).toMatchObject({
      division: "gad",
      divisionCategory: "corporate-office",
    });
    expect(getRoleDef("logistics-coordinator")).toMatchObject({
      division: "gad",
      divisionCategory: "corporate-office",
    });
  });

  it("allows Logistics roles into GAD while keeping other divisions outside GAD", () => {
    expect(
      authorizeClientRoute(
        "logistics-manager",
        "/gad/transportation-logistics",
      ).allowed,
    ).toBe(true);
    expect(
      authorizeClientRoute(
        "logistics-coordinator",
        "/gad/transportation-logistics",
      ).allowed,
    ).toBe(true);
    expect(
      authorizeClientRoute("program-director", "/gad/transportation-logistics")
        .allowed,
    ).toBe(false);
  });

  it("exposes only the self-service Logistics request route across divisions", () => {
    expect(authorizeClientRoute("program-director", "/logistics").allowed).toBe(
      true,
    );
    expect(authorizeClientRoute("case-manager", "/logistics").allowed).toBe(
      true,
    );
    expect(authorizeClientRoute("billing-specialist", "/logistics").allowed).toBe(
      true,
    );
  });

  it("lets the Manager approve dispositions but blocks Coordinator approval", () => {
    const resource = {
      domain: "operations" as const,
      action: "approve" as const,
      division: "gad" as const,
      divisionCategory: "corporate-office" as const,
    };
    expect(
      authorizeAccess({ role: "logistics-manager" }, resource).allowed,
    ).toBe(true);
    const coordinator = authorizeAccess(
      { role: "logistics-coordinator" },
      resource,
    );
    expect(coordinator.allowed).toBe(false);
    expect(coordinator.code).toBe("DENY_ACTION_TIER");
  });

  it("requires privileged MFA for the Logistics Manager but not Coordinator", () => {
    expect(
      requiresMfa("logistics-manager", false, "required-privileged"),
    ).toBe(true);
    expect(
      requiresMfa("logistics-coordinator", false, "required-privileged"),
    ).toBe(false);
  });
});
