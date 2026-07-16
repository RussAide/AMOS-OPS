import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";
import { applyPendingMigrations } from "./data-lifecycle";

interface TableColumn {
  name: string;
}

export interface FreshSchemaBootstrapResult {
  bootstrapped: boolean;
  appliedMigrations: number;
  createdCurrentTables: number;
  addedCurrentColumns: number;
}

function quoteIdentifier(identifier: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`);
  }
  return `"${identifier}"`;
}

function tableExists(db: Database.Database, tableName: string): boolean {
  return Boolean(
    db
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(tableName),
  );
}

function currentColumns(db: Database.Database, tableName: string): Set<string> {
  return new Set(
    (
      db
        .prepare(`PRAGMA table_info(${quoteIdentifier(tableName)})`)
        .all() as TableColumn[]
    ).map((column) => column.name),
  );
}

function reconcileCurrentSchema(
  db: Database.Database,
  currentSchemaSql: string,
): Pick<FreshSchemaBootstrapResult, "createdCurrentTables" | "addedCurrentColumns"> {
  let createdCurrentTables = 0;
  let addedCurrentColumns = 0;
  const tablePattern = /CREATE TABLE `([A-Za-z_][A-Za-z0-9_]*)` \(([\s\S]*?)\n\);/g;

  for (const match of currentSchemaSql.matchAll(tablePattern)) {
    const [statement, tableName, body] = match;
    if (!tableExists(db, tableName)) {
      db.exec(statement);
      createdCurrentTables += 1;
      continue;
    }

    const columns = currentColumns(db, tableName);
    for (const rawLine of body.split("\n")) {
      const line = rawLine.trim().replace(/,$/, "");
      const column = line.match(/^`([A-Za-z_][A-Za-z0-9_]*)`\s+(.+)$/);
      if (!column || columns.has(column[1])) continue;
      db.exec(
        `ALTER TABLE ${quoteIdentifier(tableName)} ADD COLUMN ${quoteIdentifier(column[1])} ${column[2]}`,
      );
      columns.add(column[1]);
      addedCurrentColumns += 1;
    }
  }

  const indexPattern = /CREATE (UNIQUE )?INDEX `([A-Za-z_][A-Za-z0-9_]*)` ON ([^;]+);/g;
  for (const match of currentSchemaSql.matchAll(indexPattern)) {
    const [, unique = "", indexName, tail] = match;
    db.exec(`CREATE ${unique}INDEX IF NOT EXISTS ${quoteIdentifier(indexName)} ON ${tail}`);
  }

  return { createdCurrentTables, addedCurrentColumns };
}

/**
 * Build an empty runtime database from the accepted migration history, then
 * reconcile it to the current Drizzle schema. Existing databases are never
 * modified by this bootstrap path; their migration strategy remains a
 * separate, explicitly approved production activity.
 */
export function bootstrapFreshDatabaseSchema(
  db: Database.Database,
  options: {
    migrationsDirectory?: string;
    currentSchemaPath?: string;
  } = {},
): FreshSchemaBootstrapResult {
  if (tableExists(db, "users")) {
    return {
      bootstrapped: false,
      appliedMigrations: 0,
      createdCurrentTables: 0,
      addedCurrentColumns: 0,
    };
  }

  const existingApplicationTables = (
    db
      .prepare(
        "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
      )
      .get() as { count: number }
  ).count;
  if (existingApplicationTables > 0) {
    throw new Error(
      "FRESH_SCHEMA_PARTIAL_DATABASE: refusing to bootstrap a partially initialized database.",
    );
  }

  const migrationsDirectory = path.resolve(
    options.migrationsDirectory ?? path.join(process.cwd(), "db", "migrations"),
  );
  const currentSchemaPath = path.resolve(
    options.currentSchemaPath ?? path.join(process.cwd(), "db", "current-schema.sql"),
  );
  if (!fs.existsSync(currentSchemaPath)) {
    throw new Error(`Current schema artifact is unavailable: ${currentSchemaPath}`);
  }

  const appliedMigrations = applyPendingMigrations(db, migrationsDirectory);
  const currentSchemaSql = fs.readFileSync(currentSchemaPath, "utf8");
  const reconciled = reconcileCurrentSchema(db, currentSchemaSql);
  const integrity = db.pragma("integrity_check", { simple: true });
  if (integrity !== "ok") {
    throw new Error(`Fresh schema integrity validation failed: ${String(integrity)}`);
  }

  return {
    bootstrapped: true,
    appliedMigrations: appliedMigrations.length,
    ...reconciled,
  };
}
