import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  APP_DEEP_LINK_TARGETS,
  APP_ROUTE_REGISTRY,
  APP_SHELL_BOUNDARY_PATHS,
  appDeepLinkPath,
  appRoutePath,
} from "@/data/app-route-registry";

function matchesRegisteredRoute(target: string, route: string): boolean {
  const targetParts = target.split("/").filter(Boolean);
  const routeParts = route.split("/").filter(Boolean);
  if (route.endsWith("/*")) {
    const prefix = routeParts.slice(0, -1);
    return prefix.every((part, index) => part === targetParts[index]);
  }
  return (
    targetParts.length === routeParts.length &&
    routeParts.every(
      (part, index) => part.startsWith(":") || part === targetParts[index],
    )
  );
}

describe("canonical application route registry", () => {
  it("publishes one unique inventory for every authenticated AppShell route", () => {
    const ids = APP_ROUTE_REGISTRY.map((route) => route.id);
    const paths = APP_ROUTE_REGISTRY.map((route) => route.path);

    expect(APP_ROUTE_REGISTRY).toHaveLength(156);
    expect(new Set(ids)).toHaveLength(ids.length);
    expect(new Set(paths)).toHaveLength(paths.length);
    expect(paths.filter((path) => path.includes(":"))).toHaveLength(8);
    expect(paths.filter((path) => path.startsWith("/admin"))).toHaveLength(11);
    expect(
      paths.filter((path) => path.startsWith("/operations-hub")),
    ).toHaveLength(4);
    expect(paths.filter((path) => path.startsWith("/nil"))).toHaveLength(2);
  });

  it("resolves route ids and dynamic deep links without duplicating path literals", () => {
    for (const route of APP_ROUTE_REGISTRY) {
      expect(appRoutePath(route.id)).toBe(route.path);
    }
    for (const [id, target] of Object.entries(APP_DEEP_LINK_TARGETS)) {
      expect(appDeepLinkPath(id as keyof typeof APP_DEEP_LINK_TARGETS)).toBe(
        target,
      );
      expect(
        APP_ROUTE_REGISTRY.some((route) =>
          matchesRegisteredRoute(target, route.path),
        ),
      ).toBe(true);
    }
  });

  it("binds every authenticated registry entry exactly once in AppShell", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/shell/app-shell.tsx"),
      "utf8",
    );
    const routeIds = [
      ...source.matchAll(/path=\{appRoutePath\(\s*"([^"]+)"\s*,?\s*\)\}/g),
    ].map((match) => match[1]);

    expect(routeIds).toEqual(APP_ROUTE_REGISTRY.map((route) => route.id));
    expect(source).not.toMatch(/<Route\s+path="/);
    expect(
      source.match(/path=\{APP_SHELL_BOUNDARY_PATHS\.login\}/g),
    ).toHaveLength(2);
    expect(
      source.match(/path=\{APP_SHELL_BOUNDARY_PATHS\.fallback\}/g),
    ).toHaveLength(2);
    expect(APP_SHELL_BOUNDARY_PATHS).toEqual({
      login: "/login",
      fallback: "*",
    });
  });

  it("keeps sidebar route targets sourced from the canonical registry module", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/data/sidebar-navigation.ts"),
      "utf8",
    );

    expect(source).toContain("appRoutePath(");
    expect(source).toContain("appDeepLinkPath(");
    expect(source).not.toMatch(/"\/(?!\/)[^"]*"/);
  });
});
