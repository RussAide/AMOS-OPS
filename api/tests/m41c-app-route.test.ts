import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { appRoutePath } from "../../src/data/app-route-registry";
import { getBreadcrumbs, heroConfigs, navItems } from "../../src/data/navData";

const route = "/clinical/intelligence-fabric";
const routeId = "clinical-intelligence-fabric";

describe("M4.1C Clinical Intelligence Fabric application route", () => {
  it("mounts the page in the canonical AppShell route tree", () => {
    const routes = fs.readFileSync(
      path.resolve("src/components/shell/app-shell.tsx"),
      "utf8",
    );
    expect(appRoutePath(routeId)).toBe(route);
    const binding = routes.slice(
      routes.indexOf(`path={appRoutePath("${routeId}")}`),
      routes.indexOf(`path={appRoutePath("${routeId}")}`) + 200,
    );
    expect(binding).toContain("element={<M41cClinicalIntelligencePage />}");
    expect(routes).toContain(
      "@/pages/clinical/m41c-clinical-intelligence-page",
    );
  });

  it("routes the canonical shell to the narrative-only intake assessment", () => {
    const routes = fs.readFileSync(
      path.resolve("src/components/shell/app-shell.tsx"),
      "utf8",
    );
    expect(routes).toContain("@/pages/intake/assessment-page");
    expect(routes).not.toContain("@/pages/intake-assessment-page");
  });

  it("publishes one navigation item and governed page metadata", () => {
    const items = navItems.filter((item) => item.href === route);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      label: "Clinical Intelligence Fabric",
      agent: "AMOS-Clinical",
      section: "OPERATIONS",
    });
    expect(heroConfigs[route]).toMatchObject({
      category: "CLINICAL INTELLIGENCE",
      title: "Clinical Intelligence Fabric",
    });
    expect(heroConfigs[route].subtitle).toContain("zero live writes");
  });

  it("provides stable Clinical-to-Fabric breadcrumbs", () => {
    expect(getBreadcrumbs(route)).toEqual([
      { label: "Home", href: "/" },
      { label: "Clinical", href: "/clinical" },
      { label: "Clinical Intelligence Fabric" },
    ]);
  });
});
