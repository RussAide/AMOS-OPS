import { describe, it, expect } from "vitest";

// ─── Role System Tests ─────────────────────────────────────

describe("Role System (36 canonical roles)", async () => {
  // Dynamic import to handle module resolution
  const rolesModule = await import("../../src/constants/roles");

  it("should have exactly 36 unique roles", () => {
    expect(rolesModule.ALL_ROLES).toHaveLength(36);
    expect(new Set(rolesModule.ALL_ROLES).size).toBe(36);
  });

  it("should have super-admin as first role", () => {
    expect(rolesModule.ALL_ROLES[0]).toBe("super-admin");
  });

  it("should include all key BHC/GRO roles", () => {
    const roles = rolesModule.ALL_ROLES;
    expect(roles).toContain("super-admin");
    expect(roles).toContain("administrator");
    expect(roles).toContain("gro-administrator");
    expect(roles).toContain("treatment-director");
    expect(roles).toContain("clinical-director");
    expect(roles).toContain("qmhp-cs");
    expect(roles).toContain("case-manager");
    expect(roles).toContain("hr-director");
    expect(roles).toContain("hr-compliance-officer");
    expect(roles).toContain("rcs-day");
    expect(roles).toContain("rcs-night");
    expect(roles).toContain("rcs-lead");
    expect(roles).toContain("rcs-prn");
    expect(roles).toContain("behavioral-support");
    expect(roles).toContain("recreation-coordinator");
    expect(roles).toContain("medication-aide");
    expect(roles).toContain("therapist");
    expect(roles).toContain("nurse");
    expect(roles).toContain("program-director");
    expect(roles).toContain("clinical-supervisor");
    expect(roles).toContain("intake-coordinator");
    expect(roles).toContain("billing-specialist");
  });

  it("should have one ROLE_DEFINITION for every role", () => {
    expect(rolesModule.ROLE_DEFINITIONS).toHaveLength(rolesModule.ALL_ROLES.length);
    expect(rolesModule.ROLE_DEFINITIONS.map((role) => role.id).sort()).toEqual(
      [...rolesModule.ALL_ROLES].sort(),
    );
  });

  it("should have one PERMISSION_MATRIX entry for every role", () => {
    const keys = Object.keys(rolesModule.PERMISSION_MATRIX);
    expect(keys.sort()).toEqual([...rolesModule.ALL_ROLES].sort());
  });

  it("should have correct helper functions", () => {
    expect(typeof rolesModule.getRoleDef).toBe("function");
    expect(typeof rolesModule.getPermissions).toBe("function");
    expect(typeof rolesModule.getNavVisibility).toBe("function");
    expect(typeof rolesModule.isAdmin).toBe("function");
    expect(typeof rolesModule.canManageUsers).toBe("function");
    expect(typeof rolesModule.canViewModule).toBe("function");
  });

  it("should correctly identify admin roles", () => {
    expect(rolesModule.isAdmin("super-admin")).toBe(true);
    expect(rolesModule.isAdmin("administrator")).toBe(true);
    expect(rolesModule.isAdmin("hr-director")).toBe(true);
    expect(rolesModule.isAdmin("program-director")).toBe(true);
    expect(rolesModule.isAdmin("rcs-day")).toBe(false);
    expect(rolesModule.isAdmin("case-manager")).toBe(false);
  });

  it("super-admin should have all permissions", () => {
    const perms = rolesModule.getPermissions("super-admin");
    expect(perms.canViewHR).toBe(true);
    expect(perms.canEditHR).toBe(true);
    expect(perms.canViewClinical).toBe(true);
    expect(perms.canEditClinical).toBe(true);
    expect(perms.canViewAdmin).toBe(true);
    expect(perms.canEditAdmin).toBe(true);
    expect(perms.canViewExecutive).toBe(true);
  });
});
