import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { appRoutePath } from "../../src/data/app-route-registry";
import { getBreadcrumbs, heroConfigs, navItems } from "../../src/data/navData";

const route = "/operations-hub/microsoft-integrations";
const routeId = "operations-hub-microsoft-integrations";

describe("M5.1B Microsoft 365 Integration application route", () => {
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
    expect(binding).toContain("element={<M51BMicrosoftIntegrationsPage />}");
    expect(routes).toContain(
      "@/pages/operations-hub/m51b-microsoft-integrations-page",
    );
  });

  it("publishes exactly one navigation item and governed metadata", () => {
    const items = navItems.filter((item) => item.href === route);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      label: "Microsoft 365 Integration",
      agent: "AMOS-DMS",
      section: "ADMIN",
    });
    expect(heroConfigs[route]).toMatchObject({
      category: "ENTERPRISE OPERATIONS",
      title: "Microsoft 365 Integration Control Center",
    });
    expect(heroConfigs[route].subtitle).toContain(
      "zero live Microsoft activity",
    );
  });

  it("provides stable Operations Hub breadcrumbs", () => {
    expect(getBreadcrumbs(route)).toEqual([
      { label: "Home", href: "/" },
      { label: "Operations Hub", href: "/operations-hub" },
      { label: "Microsoft 365 Integration" },
    ]);
  });
});
