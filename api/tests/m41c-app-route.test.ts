import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getBreadcrumbs, heroConfigs, navItems } from "../../src/data/navData";

const route = "/clinical/intelligence-fabric";

describe("M4.1C Clinical Intelligence Fabric application route", () => {
  it("mounts the page in the active and retained AppShell route trees", () => {
    const activeShell = fs.readFileSync(
      path.resolve("src/components/shell/app-shell.tsx"),
      "utf8",
    );
    const retainedRoutes = fs.readFileSync(
      path.resolve("src/components/shell/app-shell-routes.tsx"),
      "utf8",
    );
    for (const source of [activeShell, retainedRoutes]) {
      expect(source).toContain('path="/clinical/intelligence-fabric"');
      expect(source).toContain("M41cClinicalIntelligencePage");
      expect(source).toContain(
        "@/pages/clinical/m41c-clinical-intelligence-page",
      );
    }
  });

  it("routes both shell trees to the narrative-only intake assessment", () => {
    const activeShell = fs.readFileSync(
      path.resolve("src/components/shell/app-shell.tsx"),
      "utf8",
    );
    const retainedRoutes = fs.readFileSync(
      path.resolve("src/components/shell/app-shell-routes.tsx"),
      "utf8",
    );

    for (const source of [activeShell, retainedRoutes]) {
      expect(source).toContain("@/pages/intake/assessment-page");
      expect(source).not.toContain("@/pages/intake-assessment-page");
    }
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
