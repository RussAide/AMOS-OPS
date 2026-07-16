import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const EXCLUDED_DIRECTORIES = new Set([
  ".git",
  ".cache",
  ".turbo",
  ".vite",
  "coverage",
  "dist",
  "dist-server",
  "logs",
  "node_modules",
  "uploads",
]);

export const DX1_REQUIRED_DATABASE_SOURCE_FILES = Object.freeze([
  "db/relations.ts",
  "db/schema.ts",
]);

export function normalizeDx1SourcePath(value) {
  return value.split(path.sep).join("/");
}

export function excludedFromDx1Source(relativePath) {
  const segments = normalizeDx1SourcePath(relativePath).split("/");
  if (segments.some((segment) => EXCLUDED_DIRECTORIES.has(segment))) return true;
  const fileName = segments.at(-1) ?? "";
  if (/\.(db|sqlite|sqlite3)(?:-shm|-wal)?$/i.test(fileName)) return true;
  if (/\.(log|tsbuildinfo)$/i.test(fileName) || fileName === ".DS_Store") return true;
  if (
    /^\.env(?:\..+)?$/.test(fileName) &&
    !/\.(?:example|sample|template)$/.test(fileName)
  )
    return true;
  return false;
}

export function collectDx1SourceFiles(root) {
  const files = [];
  const visit = (directory) => {
    for (const entry of fs
      .readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))) {
      const absolute = path.join(directory, entry.name);
      const relative = normalizeDx1SourcePath(path.relative(root, absolute));
      if (excludedFromDx1Source(relative)) continue;
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) files.push(relative);
      else throw new Error(`Unsupported DX.1 source entry: ${absolute}`);
    }
  };
  visit(root);
  return Object.freeze(files);
}

export function dx1DatabaseSourceFiles(files) {
  return Object.freeze(files.filter((relative) => relative.startsWith("db/")));
}

export function verifyDx1DatabaseSourceCoverage(files) {
  const databaseFiles = dx1DatabaseSourceFiles(files);
  for (const required of DX1_REQUIRED_DATABASE_SOURCE_FILES) {
    if (!databaseFiles.includes(required))
      throw new Error(`DX1_DATABASE_SOURCE_FILE_MISSING:${required}`);
  }
  const migrationFiles = databaseFiles.filter((relative) =>
    relative.startsWith("db/migrations/"),
  );
  if (migrationFiles.length === 0)
    throw new Error("DX1_DATABASE_MIGRATION_INVENTORY_EMPTY");
  return Object.freeze({
    databaseFiles,
    databaseSourceFileCount: databaseFiles.length,
    databaseMigrationFileCount: migrationFiles.length,
  });
}

function sourceHash(filePath) {
  return createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

export function compareDx1InheritedFiles(
  parentSource,
  derivedSource,
  files,
  approvedChanges = new Set(),
) {
  const approvedIntegrationChanges = [];
  const changed = [];
  const missing = [];
  for (const relative of files) {
    const parentFile = path.join(parentSource, relative);
    const derivedFile = path.join(derivedSource, relative);
    if (!fs.existsSync(derivedFile)) missing.push(relative);
    else if (sourceHash(parentFile) !== sourceHash(derivedFile)) {
      if (approvedChanges.has(relative)) approvedIntegrationChanges.push(relative);
      else changed.push(relative);
    }
  }
  return Object.freeze({
    approvedIntegrationChanges: Object.freeze(approvedIntegrationChanges),
    changed: Object.freeze(changed),
    missing: Object.freeze(missing),
  });
}
