import { readFileSync, readdirSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = join(import.meta.dirname, "../..");
const scannedRoots = ["api", "src", "public", "db"];
const textExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".sql",
  ".ts",
  ".tsx",
]);
const thisTest = "api/tests/evaluation-data-boundary.test.ts";

type SourceFile = {
  path: string;
  text: string;
};

function collectSourceFiles(directory: string): SourceFile[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      return collectSourceFiles(absolutePath);
    }
    if (!entry.isFile() || !textExtensions.has(extname(entry.name))) {
      return [];
    }

    const path = relative(repositoryRoot, absolutePath).replaceAll("\\", "/");
    if (path === thisTest) {
      return [];
    }
    return [{ path, text: readFileSync(absolutePath, "utf8") }];
  });
}

const sourceFiles = scannedRoots.flatMap((root) => collectSourceFiles(join(repositoryRoot, root)));

function matchingFiles(pattern: RegExp): string[] {
  return sourceFiles.filter(({ text }) => pattern.test(text)).map(({ path }) => path);
}

describe("fictional evaluation-data boundary", () => {
  it("contains no embedded bearer token or literal token bootstrap", () => {
    const jwtPrefix = ["e", "y", "J"].join("");
    const embeddedJwt = new RegExp(`${jwtPrefix}[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}`);
    const tokenBootstrap = new RegExp(
      ["setItem", "\\s*\\(", "\\s*[\"']amos_token[\"']", "\\s*,", "\\s*[\"'][^\"']+[\"']"].join(""),
    );

    expect(matchingFiles(embeddedJwt), "embedded JWT-like values").toEqual([]);
    expect(matchingFiles(tokenBootstrap), "literal authentication token bootstrap").toEqual([]);
  });

  it("uses a reserved non-deliverable domain for evaluation identities", () => {
    const operationalDomain = new RegExp(["@", "adolbi", "\\.", "com", "\\b"].join(""), "i");
    expect(matchingFiles(operationalDomain), "live-domain email values").toEqual([]);
  });

  it("contains no known staff identities in evaluation records", () => {
    const staffNames = [
      ["E. Russ", "Aideyan"].join(" "),
      ["Russ", "Aideyan"].join(" "),
      ["Dr.", "Hall"].join(" "),
      ["Lilian", "Ike"].join(" "),
      ["Jonthan", "Guidry"].join(" "),
    ];
    const knownIdentity = new RegExp(staffNames.map((name) => name.replace(".", "\\.")).join("|"), "i");
    expect(matchingFiles(knownIdentity), "known staff identity values").toEqual([]);
  });
});
