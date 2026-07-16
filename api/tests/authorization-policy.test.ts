import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { appRouter } from "../router";
import { authorizeHttpIdentity } from "../authorization/http";
import {
  ENTERPRISE_ROLE_REGISTRY,
  PROCEDURE_ROOT_ACCESS,
  ROLE_TIER_BY_ROLE,
  authorizeAccess,
  authorizeClientRoute,
  procedureAccessResource,
} from "../../src/constants/access-control";
import { ALL_ROLES, getRoleDef } from "../../src/constants/roles";
import type { IdentityUser } from "../security/identity";

const identity = (
  role: string,
  department: string | null = null,
): IdentityUser => ({
  id: `user-${role}`,
  email: `${role}@amos-ops.invalid`,
  firstName: "Prototype",
  lastName: "Evaluator",
  name: "Prototype Evaluator",
  role,
  department,
  mfaEnabled: false,
  accessStatus: "cleared",
  identityType: "workforce",
  trainingAccess: false,
  sponsorName: null,
  accessExpiresAt: null,
  dataScope: "operational",
});

describe("M1.1 deny-by-default authorization", () => {
  it("maps all 36 canonical roles to exactly one tier and authoritative division", () => {
    expect(ALL_ROLES).toHaveLength(36);
    expect(new Set(ALL_ROLES)).toHaveLength(36);
    expect(Object.keys(ROLE_TIER_BY_ROLE).sort()).toEqual(
      [...ALL_ROLES].sort(),
    );
    expect(ENTERPRISE_ROLE_REGISTRY).toHaveLength(36);
    for (const role of ALL_ROLES) {
      const definition = getRoleDef(role);
      expect(["T1", "T2", "T3", "T4"]).toContain(ROLE_TIER_BY_ROLE[role]);
      expect(
        ENTERPRISE_ROLE_REGISTRY.find((entry) => entry.role === role)?.division,
      ).toBe(definition.division);
    }
  });

  it("enforces EO/GAD doctrine and explicit division bridges", () => {
    expect(getRoleDef("hr-director").division).toBe("eo");
    expect(getRoleDef("hr-compliance-officer").division).toBe("eo");
    expect(getRoleDef("revenue-cycle-manager").division).toBe("eo");
    expect(getRoleDef("billing-specialist").division).toBe("eo");
    expect(getRoleDef("training-coordinator").division).toBe("eo");
    expect(getRoleDef("facilities-manager").division).toBe("gad");

    expect(
      authorizeAccess(
        { role: "revenue-cycle-manager" },
        {
          domain: "revenue",
          action: "read",
          division: "eo",
          divisionCategory: "corporate-office",
        },
      ).allowed,
    ).toBe(true);
    expect(
      authorizeAccess(
        { role: "facilities-manager" },
        {
          domain: "operations",
          action: "read",
          division: "gad",
          divisionCategory: "corporate-office",
        },
      ).allowed,
    ).toBe(true);
    expect(
      authorizeAccess(
        { role: "hr-director" },
        {
          domain: "operations",
          action: "read",
          division: "gad",
          divisionCategory: "corporate-office",
        },
      ).allowed,
    ).toBe(false);
    expect(
      authorizeAccess(
        { role: "case-manager" },
        {
          domain: "gro",
          action: "read",
          division: "gro",
          divisionCategory: "profit-center",
        },
      ).allowed,
    ).toBe(true);
    expect(
      authorizeAccess(
        { role: "therapist" },
        {
          domain: "gro",
          action: "read",
          division: "gro",
          divisionCategory: "profit-center",
        },
      ).allowed,
    ).toBe(false);
  });

  it("enforces BHC department scope and rejects unknown or mismatched claims", () => {
    expect(
      authorizeAccess(
        { role: "case-manager", department: "mhtcm" },
        {
          domain: "clinical",
          action: "read",
          division: "bhc",
          department: "mhtcm",
        },
      ).allowed,
    ).toBe(true);
    expect(
      authorizeAccess(
        { role: "case-manager", department: "mhtcm" },
        {
          domain: "clinical",
          action: "read",
          division: "bhc",
          department: "ccmg",
        },
      ).code,
    ).toBe("DENY_SCOPE");
    expect(
      authorizeAccess(
        { role: "legacy-supervisor" },
        { domain: "dashboard", action: "read" },
      ).code,
    ).toBe("DENY_UNKNOWN_ROLE");
    expect(
      authorizeAccess(
        { role: "hr-director", division: "gad" },
        { domain: "hr", action: "read", division: "eo" },
      ).code,
    ).toBe("DENY_CLAIM_MISMATCH");
  });

  it("keeps identity self-service separate from identity administration", () => {
    const setMfa = procedureAccessResource("auth.setMfa", "mutation");
    const changePassword = procedureAccessResource(
      "auth.changePassword",
      "mutation",
    );
    const listReviews = procedureAccessResource(
      "auth.listAccessReviews",
      "query",
    );
    const completeReview = procedureAccessResource(
      "auth.completeAccessReview",
      "mutation",
    );

    expect(setMfa).toMatchObject({ domain: "self-service", action: "update" });
    expect(changePassword).toMatchObject({
      domain: "self-service",
      action: "update",
    });
    expect(listReviews).toMatchObject({
      domain: "admin",
      action: "read",
      division: "eo",
    });
    expect(completeReview).toMatchObject({
      domain: "admin",
      action: "update",
      division: "eo",
    });
    expect(authorizeAccess({ role: "rcs-day" }, setMfa!).allowed).toBe(true);
    expect(authorizeAccess({ role: "rcs-day" }, listReviews!).allowed).toBe(
      false,
    );
    expect(
      authorizeAccess({ role: "administrator" }, completeReview!).allowed,
    ).toBe(true);
    expect(
      authorizeAccess({ role: "hr-director" }, completeReview!).allowed,
    ).toBe(true);
  });

  it("has an explicit access profile for every mounted router root except anonymous ping", () => {
    const mountedRoots = Object.keys(appRouter._def.record).filter(
      (root) => root !== "ping",
    );
    for (const root of mountedRoots) {
      expect(
        PROCEDURE_ROOT_ACCESS,
        `missing policy for router root '${root}'`,
      ).toHaveProperty(root);
    }
  });

  it("denies unclassified direct client routes and unauthorized admin routes", () => {
    expect(
      authorizeClientRoute("administrator", "/admin/organization").allowed,
    ).toBe(true);
    expect(authorizeClientRoute("rcs-day", "/admin/organization").allowed).toBe(
      false,
    );
    expect(
      authorizeClientRoute("administrator", "/unmapped-prototype-route")
        .allowed,
    ).toBe(false);
  });

  it("protects non-tRPC HTTP resources with 401, 403, and explicit allow results", () => {
    const resource = { domain: "documents", action: "read" } as const;
    expect(authorizeHttpIdentity(null, resource)).toMatchObject({
      allowed: false,
      status: 401,
    });
    expect(
      authorizeHttpIdentity(identity("rcs-day", "GRO Residential"), resource),
    ).toMatchObject({ allowed: false, status: 403 });
    expect(
      authorizeHttpIdentity(identity("chart-auditor", "CCMG"), resource),
    ).toMatchObject({ allowed: true, status: 200 });
  });

  it("keeps configured seed and workflow role literals inside the canonical registry", () => {
    const canonical = new Set<string>(ALL_ROLES);
    const seed = readFileSync(
      resolve(process.cwd(), "db/seed-forms.ts"),
      "utf8",
    );
    const seedRoles = [...seed.matchAll(/\brole:\s*"([^"]+)"/g)].map(
      (match) => match[1],
    );
    expect(seedRoles.length).toBeGreaterThan(0);
    expect(seedRoles.filter((role) => !canonical.has(role))).toEqual([]);

    const dynamicSelectors = new Set([
      "all-admin",
      "person",
      "self",
      "audit",
      "employee",
      "assigned-clinician",
    ]);
    const workflowSources = [
      "api/lib/workflow.ts",
      "api/routers/m8.ts",
      "src/components/hr/workflow-status-panel.tsx",
    ]
      .map((path) => readFileSync(resolve(process.cwd(), path), "utf8"))
      .join("\n");
    const targets = [...workflowSources.matchAll(/\btarget:\s*"([^"]+)"/g)].map(
      (match) => match[1],
    );
    expect(
      targets.filter(
        (target) => !canonical.has(target) && !dynamicSelectors.has(target),
      ),
    ).toEqual([]);
  });

  it("contains no active BHC-name or EO/GAD ownership residue in controlled sources", () => {
    const controlled = [
      "src/constants/organization.ts",
      "src/constants/roles.ts",
      "src/components/shell/app-sidebar.tsx",
    ]
      .map((path) => readFileSync(resolve(process.cwd(), path), "utf8"))
      .join("\n");
    expect(controlled).not.toContain("Behavioral Health Collaborative");
    expect(controlled).not.toContain("GAD — HR leadership");
    expect(controlled).not.toContain("Corporate Office support roles (EO/GAD)");
  });
});
