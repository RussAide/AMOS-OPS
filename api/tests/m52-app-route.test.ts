import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getBreadcrumbs, heroConfigs, navItems } from "../../src/data/navData";

const route = "/operations-hub/mobile-offline";

describe("M5.2 mobile and offline application route", () => {
  it("mounts the experience in the active and retained shell trees", () => {
    const activeShell = fs.readFileSync(
      path.resolve("src/components/shell/app-shell.tsx"),
      "utf8",
    );
    const retainedRoutes = fs.readFileSync(
      path.resolve("src/components/shell/app-shell-routes.tsx"),
      "utf8",
    );
    for (const source of [activeShell, retainedRoutes]) {
      expect(source).toContain('path="/operations-hub/mobile-offline"');
      expect(source).toContain("M52MobileOfflinePage");
      expect(source).toContain(
        "@/pages/operations-hub/m52-mobile-offline-page",
      );
    }
  });

  it("publishes exactly one navigation item and governed metadata", () => {
    const items = navItems.filter((item) => item.href === route);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      label: "Mobile & Offline",
      agent: "AMOS-Core",
      section: "ADMIN",
    });
    expect(heroConfigs[route]).toMatchObject({
      category: "ENTERPRISE OPERATIONS",
      title: "Mobile & Offline Operations Center",
    });
    expect(heroConfigs[route].subtitle).toContain(
      "zero live device or production activity",
    );
  });

  it("provides stable Operations Hub breadcrumbs", () => {
    expect(getBreadcrumbs(route)).toEqual([
      { label: "Home", href: "/" },
      { label: "Operations Hub", href: "/operations-hub" },
      { label: "Mobile & Offline" },
    ]);
  });
});
