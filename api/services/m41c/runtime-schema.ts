import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";
import { sqlite } from "../../queries/connection";

export type M41cRuntimeDatabase = Pick<Database.Database, "exec" | "prepare">;

function migrationPath(): string {
  return path.resolve(
    process.cwd(),
    "db",
    "migrations",
    "0010_m41c_clinical_intelligence_fabric.sql",
  );
}

export function ensureM41cRuntimeSchema(
  db: M41cRuntimeDatabase = sqlite,
): void {
  const filePath = migrationPath();
  if (!fs.existsSync(filePath))
    throw new Error(`M41C_RUNTIME_SCHEMA_MIGRATION_MISSING:${filePath}`);
  const sql = fs
    .readFileSync(filePath, "utf8")
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean)
    .join(";\n");
  db.exec(sql);
}
