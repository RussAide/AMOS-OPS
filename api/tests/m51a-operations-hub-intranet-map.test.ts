import { describe, expect, it } from "vitest";
import { M51A_INTRANET_DESTINATION_CODES } from "@contracts/m51a/operations-hub";
import { ALL_ROLES } from "@/constants/roles";
import {
  buildAllM51aRoleRouteProjections,
  createSyntheticM51aIntranetMap,
  resolveM51aIntranetRoute,
  validateM51aIntranetMap,
} from "../services/m51a/operations-hub/intranet-map";
import { createSyntheticM51aHubTopology } from "../services/m51a/operations-hub/topology";

describe("M5.1A Hub A04 permission-trimmed intranet map", () => {
  it("defines all eleven stable logical destinations exactly once", () => {
    const routes = createSyntheticM51aIntranetMap();
    expect(routes).toHaveLength(11);
    expect(routes.map((route) => route.code)).toEqual(
      M51A_INTRANET_DESTINATION_CODES,
    );
    expect(routes.map((route) => route.label)).toEqual([
      "Home / Enterprise Operations",
      "Executive Command",
      "My Work / EIA",
      "Clinical",
      "Residential / GRO",
      "Quality / Compliance",
      "Workforce / Learning",
      "Finance / Revenue",
      "Contracts / Growth",
      "Enterprise DMS Search",
      "System Administration",
    ]);
    expect(new Set(routes.map((route) => route.logicalPath)).size).toBe(11);
  });

  it("uses logical target keys without treating physical Microsoft paths as identity", () => {
    const routes = createSyntheticM51aIntranetMap();
    for (const route of routes) {
      expect(route.logicalPath).toMatch(/^\//);
      expect(route.targetKey).not.toMatch(/^https?:\/\//i);
      expect(route.physicalPathIsIdentity).toBe(false);
      expect(route.sourceTransparent).toBe(true);
      expect(route.synthetic).toBe(true);
    }
    expect(
      validateM51aIntranetMap(routes, createSyntheticM51aHubTopology()),
    ).toEqual([]);
  });

  it("projects the map independently for every canonical role", () => {
    const routes = createSyntheticM51aIntranetMap();
    const projections = buildAllM51aRoleRouteProjections(
      routes,
      createSyntheticM51aHubTopology(),
    );
    expect(projections).toHaveLength(36);
    expect(projections.map((projection) => projection.role)).toEqual(ALL_ROLES);
    for (const projection of projections) {
      const allowed = new Set(projection.routes.map((route) => route.code));
      expect(allowed.has("home-enterprise-operations")).toBe(true);
      expect(allowed.has("my-work-eia")).toBe(true);
      expect(allowed.has("enterprise-dms-search")).toBe(true);
      expect(projection.permissionTrimmed).toBe(true);
      expect(projection.unknownRouteDisclosure).toBe(false);
    }
  });

  it("applies canonical role and division scope to specialized destinations", () => {
    const routes = createSyntheticM51aIntranetMap();
    const sites = createSyntheticM51aHubTopology();
    expect(
      resolveM51aIntranetRoute(
        "managing-director",
        "executive-command",
        routes,
        sites,
      ),
    ).toMatchObject({ allowed: true, reasonCode: "ALLOW_CANONICAL_POLICY" });
    expect(
      resolveM51aIntranetRoute("rcs-day", "executive-command", routes, sites),
    ).toMatchObject({ allowed: false, reasonCode: "DENY_CANONICAL_POLICY" });
    expect(
      resolveM51aIntranetRoute("therapist", "clinical", routes, sites),
    ).toMatchObject({ allowed: true, reasonCode: "ALLOW_CANONICAL_POLICY" });
    expect(
      resolveM51aIntranetRoute("therapist", "residential-gro", routes, sites),
    ).toMatchObject({ allowed: false, reasonCode: "DENY_CANONICAL_POLICY" });
  });

  it("denies unknown roles and routes without disclosing navigation or targets", () => {
    const routes = createSyntheticM51aIntranetMap();
    const sites = createSyntheticM51aHubTopology();
    for (const decision of [
      resolveM51aIntranetRoute(
        "unknown-role",
        "home-enterprise-operations",
        routes,
        sites,
      ),
      resolveM51aIntranetRoute(
        "managing-director",
        "unknown-route",
        routes,
        sites,
      ),
    ]) {
      expect(decision.allowed).toBe(false);
      expect(decision.logicalPath).toBeNull();
      expect(decision.targetKey).toBeNull();
      expect(decision.physicalMicrosoftUrl).toBeNull();
      expect(decision.permissionTrimmed).toBe(true);
    }
  });

  it("never returns a physical Microsoft URL in an authorized decision", () => {
    const decision = resolveM51aIntranetRoute(
      "managing-director",
      "home-enterprise-operations",
      createSyntheticM51aIntranetMap(),
      createSyntheticM51aHubTopology(),
    );
    expect(decision).toMatchObject({
      allowed: true,
      logicalPath: "/operations",
      physicalMicrosoftUrl: null,
      synthetic: true,
    });
  });

  it("rejects physical, unknown, and restricted targets from general navigation", () => {
    const routes = createSyntheticM51aIntranetMap();
    const sites = createSyntheticM51aHubTopology();
    const restrictedSite = sites.find(
      (site) => site.code === "restricted-sud-part2",
    )!;
    const corrupted = routes.map((route) => {
      if (route.code === "home-enterprise-operations")
        return { ...route, targetKey: restrictedSite.siteId };
      if (route.code === "executive-command")
        return { ...route, targetKey: "https://tenant.sharepoint.invalid/site" };
      return route;
    });
    expect(validateM51aIntranetMap(corrupted, sites)).toEqual(
      expect.arrayContaining([
        "ROUTE_TARGET_UNKNOWN:home-enterprise-operations",
        "RESTRICTED_ROUTE_IN_GENERAL_MAP:home-enterprise-operations",
        "PHYSICAL_URL_AS_IDENTITY:executive-command",
        "ROUTE_TARGET_UNKNOWN:executive-command",
      ]),
    );
  });
});
