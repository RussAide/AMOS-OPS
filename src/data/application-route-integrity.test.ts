import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { clientRouteAccessResource } from "@/constants/access-control";
import {
  APP_ROUTE_REGISTRY,
  APP_SHELL_BOUNDARY_PATHS,
} from "@/data/app-route-registry";

const root = process.cwd();
const sourceRoot = path.join(root, "src");
const canonicalRouter = path.join(sourceRoot, "components/shell/app-shell.tsx");
const retiredDuplicateRouter = path.join(
  sourceRoot,
  "components/shell/app-shell-routes.tsx",
);

interface SourceTarget {
  file: string;
  line: number;
  target: string;
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(absolute);
    if (
      !/\.tsx?$/.test(entry.name) ||
      /\.(?:test|spec)\.[^.]+$/.test(entry.name)
    ) {
      return [];
    }
    return [absolute];
  });
}

function literalValue(node: ts.Node): string | undefined {
  if (ts.isStringLiteralLike(node)) return node.text;
  if (!ts.isTemplateExpression(node)) return undefined;
  let value = node.head.text;
  for (const span of node.templateSpans) {
    value += `:param${span.literal.text}`;
  }
  return value;
}

function jsxAttributeValue(attribute: ts.JsxAttribute): string | undefined {
  if (!attribute.initializer) return undefined;
  if (ts.isStringLiteral(attribute.initializer))
    return attribute.initializer.text;
  if (
    ts.isJsxExpression(attribute.initializer) &&
    attribute.initializer.expression
  ) {
    return literalValue(attribute.initializer.expression);
  }
  return undefined;
}

function normalizedTarget(target: string): string {
  return target.split(/[?#]/, 1)[0].replace(/\/+$/, "") || "/";
}

function routeMatches(target: string, route: string): boolean {
  if (route === "*") return false;
  const normalized = normalizedTarget(target);
  if (route.endsWith("/*")) {
    const prefix = route.slice(0, -2);
    return normalized === prefix || normalized.startsWith(`${prefix}/`);
  }
  const targetParts = normalized.split("/").filter(Boolean);
  const routeParts = route.split("/").filter(Boolean);
  if (targetParts.length !== routeParts.length) return false;
  return routeParts.every(
    (part, index) => part.startsWith(":") || part === targetParts[index],
  );
}

function registeredRoutes(): string[] {
  return [
    APP_SHELL_BOUNDARY_PATHS.login,
    APP_SHELL_BOUNDARY_PATHS.fallback,
    ...APP_ROUTE_REGISTRY.map((route) => route.path),
    APP_SHELL_BOUNDARY_PATHS.login,
    APP_SHELL_BOUNDARY_PATHS.fallback,
  ];
}

function internalNavigationTargets(): SourceTarget[] {
  const targets: SourceTarget[] = [];
  for (const absolute of sourceFiles(sourceRoot)) {
    const text = readFileSync(absolute, "utf8");
    const source = ts.createSourceFile(
      absolute,
      text,
      ts.ScriptTarget.Latest,
      true,
      absolute.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const add = (target: string | undefined, node: ts.Node): void => {
      if (!target?.startsWith("/")) return;
      const { line } = source.getLineAndCharacterOfPosition(
        node.getStart(source),
      );
      targets.push({
        file: path.relative(root, absolute),
        line: line + 1,
        target: normalizedTarget(target),
      });
    };
    function visit(node: ts.Node): void {
      if (ts.isJsxOpeningLikeElement(node)) {
        for (const property of node.attributes.properties) {
          if (!ts.isJsxAttribute(property)) continue;
          const name = property.name.getText(source);
          if (name === "to" || name === "href") {
            add(jsxAttributeValue(property), property);
          }
        }
      }
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "navigate" &&
        node.arguments.length > 0
      ) {
        add(literalValue(node.arguments[0]), node.arguments[0]);
      }
      if (ts.isPropertyAssignment(node)) {
        const name = node.name.getText(source).replace(/["']/g, "");
        if (["href", "route", "to", "path"].includes(name)) {
          add(literalValue(node.initializer), node.initializer);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  return targets;
}

describe("canonical application route integrity", () => {
  const routes = registeredRoutes();

  it("uses one canonical router and an explicit authenticated Not Found boundary", () => {
    const source = readFileSync(canonicalRouter, "utf8");
    expect(existsSync(retiredDuplicateRouter)).toBe(false);
    expect(source).toContain(
      "authorizeClientRoute(currentRole, location.pathname)",
    );
    expect(source).toContain("<Route element={<ClientRouteGuard />}");
    expect(source).toContain("path={appRoutePath(");
    expect(source).toMatch(
      /path=\{APP_SHELL_BOUNDARY_PATHS\.fallback\}\s+element=\{<NotFoundPage \/>\}/,
    );
    expect(source).not.toMatch(/<Route\s+path="/);
  });

  it("registers every internal navigation target", () => {
    const unmatched = internalNavigationTargets().filter(
      ({ target }) => !routes.some((route) => routeMatches(target, route)),
    );
    expect(
      unmatched.map(({ file, line, target }) => `${file}:${line} -> ${target}`),
    ).toEqual([]);
  });

  it("classifies every authenticated route in the client access policy", () => {
    const unclassified = [...new Set(routes)]
      .filter((route) => route !== "/login" && route !== "*")
      .filter((route) => {
        const sample = route
          .replace(/\*$/, "sample")
          .replace(/:[^/]+/g, "synthetic-id");
        return clientRouteAccessResource(sample) === undefined;
      });
    expect(unclassified).toEqual([]);
  });

  it("has no duplicate application routes outside the separate auth fallbacks", () => {
    const duplicates = [...new Set(routes)].filter(
      (route) => routes.filter((candidate) => candidate === route).length > 1,
    );
    expect(duplicates.sort()).toEqual(["*", "/login"].sort());
  });
});
