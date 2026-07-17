import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

type DatabaseHandle = InstanceType<typeof Database>;

export interface MigrationRecord {
  name: string;
  checksum: string;
  appliedAt: string;
}

export interface MigrationPlanItem {
  name: string;
  path: string;
  checksum: string;
  state: "pending" | "applied";
}

export type MigrationDataMode = "include" | "schema-only";

interface SqliteSchemaObject {
  type: "table" | "index" | "trigger";
  name: string;
  sql: string;
}

export interface ReferentialRule {
  childTable: string;
  childColumn: string;
  parentTable: string;
  parentColumn?: string;
  nullable?: boolean;
}

export interface IntegrityFinding {
  kind: "sqlite" | "foreign-key" | "logical-reference";
  message: string;
  count?: number;
}

export interface IntegrityReport {
  ok: boolean;
  sqliteIntegrity: string;
  foreignKeyViolations: number;
  logicalReferenceViolations: number;
  evaluatedRules: number;
  skippedRules: Array<{ rule: ReferentialRule; reason: string }>;
  findings: IntegrityFinding[];
}

export interface MigrationSchemaRequirements {
  tables: Array<{ name: string; columns: string[] }>;
  indexes: string[];
}

export interface BaselineAdoptionReport {
  mode: "baseline-existing";
  databasePath: string;
  checkpointPath: string;
  adoptedAt: string;
  adopted: Array<{
    name: string;
    checksum: string;
    tableCount: number;
    indexCount: number;
    columnCount: number;
  }>;
  integrity: IntegrityReport;
}

const MIGRATION_TABLE = "_amos_migrations";

export const DEFAULT_REFERENTIAL_RULES: readonly ReferentialRule[] = [
  { childTable: "treatment_plans", childColumn: "patient_id", parentTable: "patients" },
  { childTable: "clinical_sessions", childColumn: "patient_id", parentTable: "patients" },
  {
    childTable: "clinical_sessions",
    childColumn: "treatment_plan_id",
    parentTable: "treatment_plans",
    nullable: true,
  },
  { childTable: "outcome_measures", childColumn: "patient_id", parentTable: "patients" },
  { childTable: "claim_line_items", childColumn: "claim_id", parentTable: "claims" },
  { childTable: "rooms", childColumn: "facility_id", parentTable: "facilities" },
  { childTable: "module_statuses", childColumn: "person_id", parentTable: "hr_people" },
] as const;

function quoteIdentifier(identifier: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`);
  }
  return `"${identifier}"`;
}

function checksum(contents: string): string {
  return createHash("sha256").update(contents).digest("hex");
}

function removeDatabaseSidecars(databasePath: string): void {
  fs.rmSync(`${databasePath}-wal`, { force: true });
  fs.rmSync(`${databasePath}-shm`, { force: true });
}

function tableExists(db: DatabaseHandle, tableName: string): boolean {
  return Boolean(
    db
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(tableName),
  );
}

function columnExists(db: DatabaseHandle, tableName: string, columnName: string): boolean {
  if (!tableExists(db, tableName)) return false;
  const columns = db.prepare(`PRAGMA table_info(${quoteIdentifier(tableName)})`).all() as Array<{
    name: string;
  }>;
  return columns.some((column) => column.name === columnName);
}

export function extractMigrationSchemaRequirements(sql: string): MigrationSchemaRequirements {
  const tables: MigrationSchemaRequirements["tables"] = [];
  const tablePattern = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"]?([A-Za-z_][A-Za-z0-9_]*)[`"]?\s*\(([\s\S]*?)\)\s*;/gi;
  for (const match of sql.matchAll(tablePattern)) {
    const name = match[1];
    const body = match[2];
    const columns = body
      .split("\n")
      .map((line) => line.trim().replace(/,$/, ""))
      .filter((line) => line.length > 0)
      .filter((line) => !/^(?:CONSTRAINT|PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|CHECK)\b/i.test(line))
      .map((line) => line.match(/^[`"]?([A-Za-z_][A-Za-z0-9_]*)[`"]?\s+/)?.[1])
      .filter((column): column is string => Boolean(column));
    tables.push({ name, columns });
  }
  for (const match of sql.matchAll(
    /ALTER\s+TABLE\s+[`"]?([A-Za-z_][A-Za-z0-9_]*)[`"]?\s+ADD\s+(?:COLUMN\s+)?[`"]?([A-Za-z_][A-Za-z0-9_]*)[`"]?/gi,
  )) {
    const [, tableName, columnName] = match;
    const table = tables.find((candidate) => candidate.name === tableName);
    if (table) {
      if (!table.columns.includes(columnName)) table.columns.push(columnName);
    } else {
      tables.push({ name: tableName, columns: [columnName] });
    }
  }
  const indexes = [...sql.matchAll(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"]?([A-Za-z_][A-Za-z0-9_]*)[`"]?/gi)]
    .map((match) => match[1]);
  return { tables, indexes };
}

function missingMigrationRequirements(
  db: DatabaseHandle,
  requirements: MigrationSchemaRequirements,
): string[] {
  const missing: string[] = [];
  for (const table of requirements.tables) {
    if (!tableExists(db, table.name)) {
      missing.push(`table:${table.name}`);
      continue;
    }
    for (const column of table.columns) {
      if (!columnExists(db, table.name, column)) {
        missing.push(`column:${table.name}.${column}`);
      }
    }
  }
  for (const index of requirements.indexes) {
    const exists = db
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = ?")
      .get(index);
    if (!exists) missing.push(`index:${index}`);
  }
  return missing;
}

export async function adoptExistingMigrationBaseline(options: {
  databasePath: string;
  migrationsDirectory: string;
  checkpointPath: string;
  confirmation: "ADOPT_EXISTING_SCHEMA" | string;
  referentialRules?: readonly ReferentialRule[];
}): Promise<BaselineAdoptionReport> {
  if (options.confirmation !== "ADOPT_EXISTING_SCHEMA") {
    throw new Error("Baseline adoption requires confirmation ADOPT_EXISTING_SCHEMA");
  }
  const databasePath = path.resolve(options.databasePath);
  const checkpointPath = path.resolve(options.checkpointPath);
  if (!fs.existsSync(databasePath)) {
    throw new Error(`Database does not exist: ${databasePath}`);
  }

  let db = openLifecycleDatabase(databasePath, { readonly: true });
  let pending: MigrationPlanItem[];
  const summaries: BaselineAdoptionReport["adopted"] = [];
  try {
    pending = planMigrations(db, options.migrationsDirectory).filter(
      (migration) => migration.state === "pending",
    );
    for (const migration of pending) {
      const requirements = extractMigrationSchemaRequirements(
        fs.readFileSync(migration.path, "utf8"),
      );
      const missing = missingMigrationRequirements(db, requirements);
      if (missing.length > 0) {
        throw new Error(
          `Cannot adopt ${migration.name}; missing schema requirements: ${missing.join(", ")}`,
        );
      }
      summaries.push({
        name: migration.name,
        checksum: migration.checksum,
        tableCount: requirements.tables.length,
        indexCount: requirements.indexes.length,
        columnCount: requirements.tables.reduce(
          (total, table) => total + table.columns.length,
          0,
        ),
      });
    }
  } finally {
    db.close();
  }

  await createDatabaseBackup(databasePath, checkpointPath);
  const adoptedAt = new Date().toISOString();
  db = openLifecycleDatabase(databasePath);
  try {
    ensureMigrationControl(db);
    const recordBaseline = db.transaction(() => {
      for (const migration of pending) {
        db.prepare(
          `INSERT INTO ${MIGRATION_TABLE} (name, checksum, applied_at) VALUES (?, ?, ?)`,
        ).run(migration.name, migration.checksum, adoptedAt);
      }
    });
    recordBaseline();
    const integrity = validateDatabaseIntegrity(
      db,
      options.referentialRules ?? DEFAULT_REFERENTIAL_RULES,
    );
    if (!integrity.ok) {
      throw new Error(
        `Baseline adoption integrity validation failed: ${JSON.stringify(integrity.findings)}`,
      );
    }
    return {
      mode: "baseline-existing",
      databasePath,
      checkpointPath,
      adoptedAt,
      adopted: summaries,
      integrity,
    };
  } catch (error) {
    db.close();
    restoreDatabaseBackup(checkpointPath, databasePath, { allowOverwrite: true });
    throw error;
  } finally {
    if (db.open) db.close();
  }
}

export function ensureMigrationControl(db: DatabaseHandle): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${MIGRATION_TABLE} (
      name TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )
  `);
}

export function listAppliedMigrations(db: DatabaseHandle): MigrationRecord[] {
  if (!tableExists(db, MIGRATION_TABLE)) return [];
  return db
    .prepare(`SELECT name, checksum, applied_at AS appliedAt FROM ${MIGRATION_TABLE} ORDER BY name`)
    .all() as MigrationRecord[];
}

export function planMigrations(db: DatabaseHandle, migrationsDirectory: string): MigrationPlanItem[] {
  const applied = new Map(listAppliedMigrations(db).map((record) => [record.name, record]));
  const files = fs
    .readdirSync(migrationsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort();

  return files.map((name) => {
    const migrationPath = path.join(migrationsDirectory, name);
    const migrationChecksum = checksum(fs.readFileSync(migrationPath, "utf8"));
    const prior = applied.get(name);
    if (prior && prior.checksum !== migrationChecksum) {
      throw new Error(`Applied migration checksum mismatch: ${name}`);
    }
    return {
      name,
      path: migrationPath,
      checksum: migrationChecksum,
      state: prior ? "applied" : "pending",
    };
  });
}

export function applyPendingMigrations(
  db: DatabaseHandle,
  migrationsDirectory: string,
  options: { dataMode?: MigrationDataMode } = {},
): MigrationRecord[] {
  db.pragma("foreign_keys = ON");
  ensureMigrationControl(db);
  const pending = planMigrations(db, migrationsDirectory).filter((item) => item.state === "pending");
  if ((options.dataMode ?? "include") === "schema-only") {
    return applyFreshSchemaOnlyMigrations(db, migrationsDirectory, pending);
  }
  const applied: MigrationRecord[] = [];

  for (const migration of pending) {
    const sql = fs.readFileSync(migration.path, "utf8");
    const appliedAt = new Date().toISOString();
    const execute = db.transaction(() => {
      db.exec(sql);
      db.prepare(
        `INSERT INTO ${MIGRATION_TABLE} (name, checksum, applied_at) VALUES (?, ?, ?)`,
      ).run(migration.name, migration.checksum, appliedAt);
    });
    execute();
    applied.push({ name: migration.name, checksum: migration.checksum, appliedAt });
  }

  return applied;
}

/**
 * Apply immutable migration history to a fresh database without copying any
 * migration DML into the target. The migrations execute normally in an
 * isolated in-memory database, then SQLite's canonical schema definitions are
 * replayed into the empty target and the original migration checksums are
 * recorded. This avoids maintaining a second migration history or attempting
 * to parse trigger bodies as ordinary semicolon-delimited SQL.
 */
function applyFreshSchemaOnlyMigrations(
  db: DatabaseHandle,
  migrationsDirectory: string,
  pending: MigrationPlanItem[],
): MigrationRecord[] {
  if (listAppliedMigrations(db).length > 0) {
    throw new Error(
      "SCHEMA_ONLY_MIGRATIONS_REQUIRE_FRESH_DATABASE: existing migration history must use normal migrations.",
    );
  }

  const existingApplicationObjects = (
    db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM sqlite_master
         WHERE name NOT LIKE 'sqlite_%'
           AND name <> ?
           AND type IN ('table', 'index', 'trigger')`,
      )
      .get(MIGRATION_TABLE) as { count: number }
  ).count;
  if (existingApplicationObjects > 0) {
    throw new Error(
      "SCHEMA_ONLY_MIGRATIONS_REQUIRE_FRESH_DATABASE: application schema already exists.",
    );
  }

  if (pending.length === 0) return [];

  const staging = new Database(":memory:");
  try {
    const stagedRecords = applyPendingMigrations(staging, migrationsDirectory, {
      dataMode: "include",
    });
    const schemaObjects = staging
      .prepare(
        `SELECT type, name, sql
         FROM sqlite_master
         WHERE sql IS NOT NULL
           AND name NOT LIKE 'sqlite_%'
           AND name <> ?
           AND type IN ('table', 'index', 'trigger')
         ORDER BY CASE type
           WHEN 'table' THEN 1
           WHEN 'index' THEN 2
           WHEN 'trigger' THEN 3
           ELSE 4
         END, name`,
      )
      .all(MIGRATION_TABLE) as SqliteSchemaObject[];

    const stagedByName = new Map(
      stagedRecords.map((record) => [record.name, record]),
    );
    const applied = pending.map((migration) => {
      const staged = stagedByName.get(migration.name);
      if (!staged || staged.checksum !== migration.checksum) {
        throw new Error(
          `SCHEMA_ONLY_MIGRATION_HISTORY_MISMATCH: ${migration.name}`,
        );
      }
      return staged;
    });

    const installSchema = db.transaction(() => {
      for (const schemaObject of schemaObjects) {
        db.exec(schemaObject.sql);
      }
      for (const migration of applied) {
        db.prepare(
          `INSERT INTO ${MIGRATION_TABLE} (name, checksum, applied_at) VALUES (?, ?, ?)`,
        ).run(migration.name, migration.checksum, migration.appliedAt);
      }
    });
    installSchema();
    return applied;
  } finally {
    staging.close();
  }
}

export async function createDatabaseBackup(
  databasePath: string,
  backupPath: string,
  options: { allowOverwrite?: boolean } = {},
): Promise<string> {
  const sourcePath = path.resolve(databasePath);
  const destinationPath = path.resolve(backupPath);
  if (sourcePath === destinationPath) {
    throw new Error("Backup destination must differ from the source database");
  }
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Database does not exist: ${sourcePath}`);
  }
  if (fs.existsSync(destinationPath) && !options.allowOverwrite) {
    throw new Error("Backup destination exists; allowOverwrite must be explicitly enabled");
  }

  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  const temporaryPath = `${destinationPath}.partial`;
  fs.rmSync(temporaryPath, { force: true });

  const source = new Database(sourcePath, { readonly: true, fileMustExist: true });
  try {
    await source.backup(temporaryPath);
  } catch (error) {
    fs.rmSync(temporaryPath, { force: true });
    removeDatabaseSidecars(temporaryPath);
    throw error;
  } finally {
    source.close();
  }

  const verification = new Database(temporaryPath, { readonly: true, fileMustExist: true });
  try {
    const result = verification.pragma("integrity_check", { simple: true });
    if (result !== "ok") throw new Error(`Backup integrity check failed: ${String(result)}`);
  } finally {
    verification.close();
  }

  if (fs.existsSync(destinationPath)) fs.rmSync(destinationPath);
  removeDatabaseSidecars(destinationPath);
  fs.renameSync(temporaryPath, destinationPath);
  return destinationPath;
}

export function restoreDatabaseBackup(
  backupPath: string,
  targetPath: string,
  options: { allowOverwrite?: boolean } = {},
): string {
  const sourcePath = path.resolve(backupPath);
  const destinationPath = path.resolve(targetPath);
  if (!fs.existsSync(sourcePath)) throw new Error(`Backup does not exist: ${sourcePath}`);
  if (sourcePath === destinationPath) throw new Error("Backup and restore target must differ");
  if (fs.existsSync(destinationPath) && !options.allowOverwrite) {
    throw new Error("Restore target exists; allowOverwrite must be explicitly enabled");
  }

  const backup = new Database(sourcePath, { readonly: true, fileMustExist: true });
  try {
    const result = backup.pragma("integrity_check", { simple: true });
    if (result !== "ok") throw new Error(`Backup integrity check failed: ${String(result)}`);
  } finally {
    backup.close();
  }

  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  const temporaryPath = `${destinationPath}.restore-partial`;
  fs.rmSync(temporaryPath, { force: true });
  removeDatabaseSidecars(temporaryPath);
  fs.copyFileSync(sourcePath, temporaryPath);
  if (fs.existsSync(destinationPath)) fs.rmSync(destinationPath);
  removeDatabaseSidecars(destinationPath);
  fs.renameSync(temporaryPath, destinationPath);
  return destinationPath;
}

export function validateDatabaseIntegrity(
  db: DatabaseHandle,
  rules: readonly ReferentialRule[] = DEFAULT_REFERENTIAL_RULES,
): IntegrityReport {
  db.pragma("foreign_keys = ON");
  const findings: IntegrityFinding[] = [];
  const sqliteIntegrity = String(db.pragma("integrity_check", { simple: true }));
  if (sqliteIntegrity !== "ok") {
    findings.push({ kind: "sqlite", message: sqliteIntegrity });
  }

  const foreignKeyRows = db.pragma("foreign_key_check") as unknown[];
  if (foreignKeyRows.length > 0) {
    findings.push({
      kind: "foreign-key",
      message: "SQLite foreign-key violations detected",
      count: foreignKeyRows.length,
    });
  }

  let logicalReferenceViolations = 0;
  let evaluatedRules = 0;
  const skippedRules: IntegrityReport["skippedRules"] = [];
  for (const rule of rules) {
    const parentColumn = rule.parentColumn ?? "id";
    if (!tableExists(db, rule.childTable)) {
      skippedRules.push({ rule, reason: `missing child table ${rule.childTable}` });
      continue;
    }
    if (!tableExists(db, rule.parentTable)) {
      skippedRules.push({ rule, reason: `missing parent table ${rule.parentTable}` });
      continue;
    }
    if (!columnExists(db, rule.childTable, rule.childColumn)) {
      skippedRules.push({
        rule,
        reason: `missing child column ${rule.childTable}.${rule.childColumn}`,
      });
      continue;
    }
    if (!columnExists(db, rule.parentTable, parentColumn)) {
      skippedRules.push({
        rule,
        reason: `missing parent column ${rule.parentTable}.${parentColumn}`,
      });
      continue;
    }
    evaluatedRules += 1;
    const childTable = quoteIdentifier(rule.childTable);
    const childColumn = quoteIdentifier(rule.childColumn);
    const parentTable = quoteIdentifier(rule.parentTable);
    const parentKey = quoteIdentifier(parentColumn);
    const nullableClause = rule.nullable ? `AND child.${childColumn} IS NOT NULL` : "";
    const row = db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM ${childTable} child
         LEFT JOIN ${parentTable} parent ON child.${childColumn} = parent.${parentKey}
         WHERE parent.${parentKey} IS NULL ${nullableClause}`,
      )
      .get() as { count: number };
    if (row.count > 0) {
      logicalReferenceViolations += row.count;
      findings.push({
        kind: "logical-reference",
        message: `${rule.childTable}.${rule.childColumn} has orphaned references to ${rule.parentTable}.${parentColumn}`,
        count: row.count,
      });
    }
  }

  return {
    ok:
      sqliteIntegrity === "ok" &&
      foreignKeyRows.length === 0 &&
      logicalReferenceViolations === 0 &&
      skippedRules.length === 0,
    sqliteIntegrity,
    foreignKeyViolations: foreignKeyRows.length,
    logicalReferenceViolations,
    evaluatedRules,
    skippedRules,
    findings,
  };
}

export function openLifecycleDatabase(
  databasePath: string,
  options: { readonly?: boolean } = {},
): DatabaseHandle {
  const readonly = options.readonly ?? false;
  const db = new Database(databasePath, {
    readonly,
    fileMustExist: readonly,
  });
  if (!readonly) db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}
