import { describe, expect, it } from "vitest";
import { APP_ROUTE_REGISTRY } from "@/data/app-route-registry";
import {
  flattenSidebarLinks,
  getSidebarNavigation,
} from "@/data/sidebar-navigation";

function registeredApplicationRoutes(): ReadonlySet<string> {
  return new Set(APP_ROUTE_REGISTRY.map((route) => route.path));
}

function matchesRegisteredRoute(target: string, route: string): boolean {
  const targetParts = target.split("/").filter(Boolean);
  const routeParts = route.split("/").filter(Boolean);
  return (
    targetParts.length === routeParts.length &&
    routeParts.every(
      (part, index) => part.startsWith(":") || part === targetParts[index],
    )
  );
}

describe("sidebar route integrity", () => {
  it("registers every production and demo sidebar destination", () => {
    const routes = registeredApplicationRoutes();
    const links = flattenSidebarLinks(
      getSidebarNavigation("super-admin", "demo"),
    );
    const missing = links
      .filter(
        (link) =>
          ![...routes].some((route) =>
            matchesRegisteredRoute(link.href, route),
          ),
      )
      .map((link) => `${link.label}: ${link.href}`);

    expect(missing).toEqual([]);
  });
});
