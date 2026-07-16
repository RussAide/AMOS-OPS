import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  flattenSidebarLinks,
  getSidebarNavigation,
} from "@/data/sidebar-navigation";

function registeredApplicationRoutes(): ReadonlySet<string> {
  const source = readFileSync(
    resolve(process.cwd(), "src/components/shell/app-shell.tsx"),
    "utf8",
  );
  return new Set(
    [...source.matchAll(/<Route\s+path="([^"]+)"/gs)].map(
      (match) => match[1],
    ),
  );
}

describe("sidebar route integrity", () => {
  it("registers every production and demo sidebar destination", () => {
    const routes = registeredApplicationRoutes();
    const links = flattenSidebarLinks(
      getSidebarNavigation("super-admin", "demo"),
    );
    const missing = links
      .filter((link) => !routes.has(link.href))
      .map((link) => `${link.label}: ${link.href}`);

    expect(missing).toEqual([]);
  });
});
