import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { authorizeClientRoute } from "../../src/constants/access-control";
import { appRoutePath } from "../../src/data/app-route-registry";
import { getBreadcrumbs, heroConfigs, navItems } from "../../src/data/navData";

const route = "/operations-hub/enterprise-demo";
const routeId = "operations-hub-enterprise-demo";

describe("DX.1 final cross-enterprise demo application route", () => {
  it("mounts the experience in the canonical shell route tree", () => {
    const routes = fs.readFileSync(
      path.resolve("src/components/shell/app-shell.tsx"),
      "utf8",
    );
    expect(appRoutePath(routeId)).toBe(route);
    const binding = routes.slice(
      routes.indexOf(`path={appRoutePath("${routeId}")}`),
      routes.indexOf(`path={appRoutePath("${routeId}")}`) + 200,
    );
    expect(binding).toContain("element={<Dx1EnterpriseDemoPage />}");
    expect(routes).toContain("@/pages/operations-hub/dx1-enterprise-demo-page");
  });

  it("publishes exactly one navigation item and governed metadata", () => {
    const items = navItems.filter((item) => item.href === route);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      label: "Enterprise Demo Verification",
      agent: "AMOS-Enterprise",
      section: "ADMIN",
    });
    expect(heroConfigs[route]).toMatchObject({
      category: "ENTERPRISE OPERATIONS",
      title: "Final Cross-Enterprise Demo Verification",
    });
    expect(heroConfigs[route].subtitle).toContain(
      "all twelve enterprise criteria",
    );
  });

  it("inherits the permission-trimmed Operations Hub access policy", () => {
    expect(authorizeClientRoute("administrator", route).allowed).toBe(true);
    expect(authorizeClientRoute("therapist", route).allowed).toBe(true);
    expect(authorizeClientRoute("external-auditor", route).allowed).toBe(false);
  });

  it("provides stable Operations Hub breadcrumbs", () => {
    expect(getBreadcrumbs(route)).toEqual([
      { label: "Home", href: "/" },
      { label: "Operations Hub", href: "/operations-hub" },
      { label: "Enterprise Demo Verification" },
    ]);
  });
});
