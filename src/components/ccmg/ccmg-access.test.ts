import { describe, expect, it } from "vitest";
import {
  authorizeAccess,
  authorizeClientRoute,
  procedureAccessResource,
} from "@/constants/access-control";

describe("CCMG oversight access integration", () => {
  it("allows BHC program supervisors to reach the server-filtered oversight surface", () => {
    expect(authorizeClientRoute("ccmg-program-director", "/ccmg").allowed).toBe(
      true,
    );
    expect(authorizeClientRoute("mhtcm-supervisor", "/ccmg").allowed).toBe(
      true,
    );
    expect(authorizeClientRoute("mhrs-supervisor", "/ccmg").allowed).toBe(true);
  });

  it("admits the minimum-necessary revenue authorization and GRO capacity slices", () => {
    expect(authorizeClientRoute("revenue-cycle-manager", "/ccmg").allowed).toBe(
      true,
    );
    expect(authorizeClientRoute("gro-administrator", "/ccmg").allowed).toBe(
      true,
    );
    expect(authorizeClientRoute("program-director", "/ccmg").allowed).toBe(
      true,
    );
    const dashboardResource = procedureAccessResource(
      "m21.getOversightDashboard",
      "query",
    );
    if (!dashboardResource)
      throw new Error("M2.1 dashboard resource is missing");
    expect(
      authorizeAccess({ role: "revenue-cycle-manager" }, dashboardResource)
        .allowed,
    ).toBe(true);
    expect(
      authorizeAccess({ role: "gro-administrator" }, dashboardResource).allowed,
    ).toBe(true);
  });

  it("does not turn the CCMG route into an enterprise-wide clinical bypass", () => {
    expect(authorizeClientRoute("rcs-day", "/ccmg").allowed).toBe(false);
    expect(authorizeClientRoute("hr-director", "/ccmg").allowed).toBe(false);
    expect(authorizeClientRoute("billing-specialist", "/ccmg").allowed).toBe(
      false,
    );
    expect(authorizeClientRoute("facilities-manager", "/ccmg").allowed).toBe(
      false,
    );
  });

  it("uses a dedicated cross-functional m21 policy without client scope claims", () => {
    expect(
      procedureAccessResource("m21.getOversightDashboard", "query"),
    ).toMatchObject({
      domain: "care-coordination",
      action: "read",
    });
    const resource = procedureAccessResource(
      "m21.getOversightDashboard",
      "query",
    );
    expect(resource).not.toHaveProperty("division");
    expect(resource).not.toHaveProperty("department");
  });
});
