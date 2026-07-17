import { createHash, randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import {
  decryptStoragePayload,
  decryptStoragePayloadWithMetadata,
  deriveStorageObjectId,
  encryptStoragePayload,
  inspectEncryptedDatabase,
  isEncryptedStoragePayload,
  migrateDatabaseEncryption,
  openEncryptedDatabase,
  rewrapEncryptedFileAtomic,
  type DatabaseStorageScope,
} from "./security/storage-encryption";
import { assertPathConfined } from "./security/path-confinement";
import {
  decodeDatabaseBackupContainer,
  encodeDatabaseBackupContainer,
} from "./security/database-backup-container";

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

function isStrictPathDescendant(root: string, candidate: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return (
    relative.length > 0 &&
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

function syncDirectory(directoryPath: string): void {
  const descriptor = fs.openSync(directoryPath, "r");
  try {
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

function syncFile(filePath: string): void {
  const descriptor = fs.openSync(filePath, "r");
  try {
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

function productionDatabaseScope(
  databasePath: string,
  options: { allowMissing?: boolean } = {},
): DatabaseStorageScope | null {
  if (process.env.APP_ENV?.trim().toLowerCase() !== "production") return null;
  const resolved = path.resolve(databasePath);
  const persistentRoot = process.env.PERSISTENT_ROOT?.trim();
  if (!persistentRoot) {
    throw new Error("PRODUCTION_PERSISTENT_ROOT_REQUIRED.");
  }
  assertPathConfined(persistentRoot, resolved, {
    allowMissing: options.allowMissing ?? false,
    type: "file",
  });
  if (resolved === path.resolve(process.env.DATABASE_PATH || "")) {
    return "operational";
  }
  if (resolved === path.resolve(process.env.TRAINING_DATABASE_PATH || "")) {
    return "training";
  }
  throw new Error(
    "PRODUCTION_DATABASE_PATH_REJECTED: lifecycle operations are limited to canonical databases.",
  );
}

function assertProductionBackupPath(
  backupPath: string,
  allowMissing: boolean,
): void {
  if (process.env.APP_ENV?.trim().toLowerCase() !== "production") return;
  const backupRoot = process.env.BACKUP_PATH?.trim();
  if (!backupRoot || !isStrictPathDescendant(backupRoot, backupPath)) {
    throw new Error(
      "PRODUCTION_BACKUP_PATH_REJECTED: backup artifacts must be stored beneath BACKUP_PATH.",
    );
  }
  assertPathConfined(backupRoot, backupPath, {
    allowMissing,
    type: "file",
  });
}

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
    restoreDatabaseBackup(checkpointPath, databasePath, {
      allowOverwrite: true,
      maintenanceConfirmed: true,
    });
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
  const productionScope = productionDatabaseScope(sourcePath);
  if (productionScope) assertProductionBackupPath(destinationPath, true);
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
  const temporaryPath = `${destinationPath}.amos-backup-partial`;
  const encryptedDatabasePath = `${temporaryPath}.amos-sqlcipher-partial`;
  fs.rmSync(temporaryPath, { force: true });
  fs.rmSync(encryptedDatabasePath, { force: true });

  const sourceInspection = productionScope
    ? inspectEncryptedDatabase(sourcePath, productionScope)
    : null;
  if (
    sourceInspection &&
    (!sourceInspection.encrypted ||
      !sourceInspection.activeKey ||
      !sourceInspection.keyId)
  ) {
    throw new Error(
      "PRODUCTION_BACKUP_DATABASE_KEY_INVALID: source must use the active database key.",
    );
  }
  const backupObjectId = productionScope
    ? deriveStorageObjectId(
        process.env.BACKUP_PATH || "",
        destinationPath,
        "backup-files",
      )
    : null;

  const source = productionScope
    ? openEncryptedDatabase(sourcePath, productionScope, {
        fileMustExist: true,
      })
    : new Database(sourcePath, { readonly: true, fileMustExist: true });
  try {
    if (productionScope) {
      source.prepare("VACUUM INTO ?").run(encryptedDatabasePath);
      const encryptedDatabase = fs.readFileSync(encryptedDatabasePath);
      const container = encodeDatabaseBackupContainer({
        backupId: randomUUID(),
        scope: productionScope,
        databaseKeyId: sourceInspection?.keyId ?? "",
        database: encryptedDatabase,
      });
      const protectedBackup = encryptStoragePayload(
        container,
        "backup-files",
        backupObjectId ?? "",
      );
      try {
        fs.writeFileSync(temporaryPath, protectedBackup, {
          flag: "wx",
          mode: 0o600,
        });
      } finally {
        encryptedDatabase.fill(0);
        container.fill(0);
        protectedBackup.fill(0);
      }
    } else {
      await source.backup(temporaryPath);
    }
  } catch (error) {
    fs.rmSync(temporaryPath, { force: true });
    fs.rmSync(encryptedDatabasePath, { force: true });
    removeDatabaseSidecars(temporaryPath);
    throw error;
  } finally {
    source.close();
  }

  try {
    let verificationPath = temporaryPath;
    if (productionScope) {
      const payload = fs.readFileSync(temporaryPath);
      if (!isEncryptedStoragePayload(payload)) {
        throw new Error("PRODUCTION_BACKUP_ENCRYPTION_FAILED.");
      }
      const decrypted = decryptStoragePayloadWithMetadata(
        payload,
        "backup-files",
        backupObjectId ?? "",
      );
      try {
        const decoded = decodeDatabaseBackupContainer(decrypted.plaintext);
        try {
          if (
            decoded.manifest.scope !== productionScope ||
            decoded.manifest.databaseKeyId !== sourceInspection?.keyId ||
            decrypted.keyId !== process.env.AMOS_BACKUP_ACTIVE_KEY_ID
          ) {
            throw new Error("PRODUCTION_BACKUP_METADATA_MISMATCH.");
          }
          fs.writeFileSync(encryptedDatabasePath, decoded.database, {
            mode: 0o600,
          });
        } finally {
          decoded.database.fill(0);
        }
      } finally {
        decrypted.plaintext.fill(0);
      }
      verificationPath = encryptedDatabasePath;
    }
    const verification = productionScope
      ? openEncryptedDatabase(
          verificationPath,
          productionScope,
          { readonly: true, fileMustExist: true },
        )
      : new Database(verificationPath, {
          readonly: true,
          fileMustExist: true,
        });
    try {
      const result = verification.pragma("integrity_check", { simple: true });
      if (result !== "ok") {
        throw new Error(`Backup integrity check failed: ${String(result)}`);
      }
    } finally {
      verification.close();
    }
  } finally {
    fs.rmSync(encryptedDatabasePath, { force: true });
  }

  try {
    syncFile(temporaryPath);
    fs.renameSync(temporaryPath, destinationPath);
    syncDirectory(path.dirname(destinationPath));
  } finally {
    fs.rmSync(temporaryPath, { force: true });
    removeDatabaseSidecars(temporaryPath);
  }
  return destinationPath;
}

export function restoreDatabaseBackup(
  backupPath: string,
  targetPath: string,
  options: { allowOverwrite?: boolean; maintenanceConfirmed?: boolean } = {},
): string {
  const sourcePath = path.resolve(backupPath);
  const destinationPath = path.resolve(targetPath);
  const productionScope = productionDatabaseScope(destinationPath, {
    allowMissing: true,
  });
  if (productionScope) assertProductionBackupPath(sourcePath, false);
  if (!fs.existsSync(sourcePath)) throw new Error(`Backup does not exist: ${sourcePath}`);
  if (sourcePath === destinationPath) throw new Error("Backup and restore target must differ");
  if (fs.existsSync(destinationPath) && !options.allowOverwrite) {
    throw new Error("Restore target exists; allowOverwrite must be explicitly enabled");
  }
  if (
    productionScope &&
    fs.existsSync(destinationPath) &&
    !options.maintenanceConfirmed
  ) {
    throw new Error(
      "PRODUCTION_RESTORE_MAINTENANCE_REQUIRED: stop the application and explicitly confirm maintenance.",
    );
  }
  if (
    fs.existsSync(`${destinationPath}-wal`) ||
    fs.existsSync(`${destinationPath}-shm`)
  ) {
    throw new Error(
      "RESTORE_TARGET_NOT_CLEANLY_STOPPED: database sidecars must be absent.",
    );
  }

  const temporaryPath = `${destinationPath}.amos-restore-partial`;
  fs.rmSync(temporaryPath, { force: true });
  removeDatabaseSidecars(temporaryPath);
  if (productionScope) {
    const payload = fs.readFileSync(sourcePath);
    if (!isEncryptedStoragePayload(payload)) {
      throw new Error("PLAINTEXT_PRODUCTION_BACKUP_REJECTED.");
    }
    const backupObjectId = deriveStorageObjectId(
      process.env.BACKUP_PATH || "",
      sourcePath,
      "backup-files",
    );
    const decrypted = decryptStoragePayload(
      payload,
      "backup-files",
      backupObjectId,
    );
    let declaredDatabaseKeyId: string;
    try {
      const decoded = decodeDatabaseBackupContainer(decrypted);
      try {
        if (decoded.manifest.scope !== productionScope) {
          throw new Error("DATABASE_BACKUP_SCOPE_MISMATCH.");
        }
        declaredDatabaseKeyId = decoded.manifest.databaseKeyId;
        fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
        fs.writeFileSync(temporaryPath, decoded.database, {
          flag: "wx",
          mode: 0o600,
        });
      } finally {
        decoded.database.fill(0);
      }
    } finally {
      decrypted.fill(0);
    }
    const inspection = inspectEncryptedDatabase(
      temporaryPath,
      productionScope,
    );
    if (
      !inspection.encrypted ||
      inspection.keyId !== declaredDatabaseKeyId
    ) {
      fs.rmSync(temporaryPath, { force: true });
      throw new Error("DATABASE_BACKUP_DECLARED_KEY_MISMATCH.");
    }
    if (!inspection.activeKey) {
      migrateDatabaseEncryption(temporaryPath, productionScope, {
        ...process.env,
        AMOS_STORAGE_MIGRATION_MODE: "rotate",
      });
    }
  } else {
    fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
    fs.copyFileSync(sourcePath, temporaryPath);
  }

  try {
    const backup = productionScope
      ? openEncryptedDatabase(
          temporaryPath,
          productionScope,
          { readonly: true, fileMustExist: true },
        )
      : new Database(temporaryPath, {
          readonly: true,
          fileMustExist: true,
        });
    try {
      const result = backup.pragma("integrity_check", { simple: true });
      if (result !== "ok") {
        throw new Error(`Backup integrity check failed: ${String(result)}`);
      }
    } finally {
      backup.close();
    }
  } catch (error) {
    fs.rmSync(temporaryPath, { force: true });
    removeDatabaseSidecars(temporaryPath);
    throw error;
  }

  try {
    syncFile(temporaryPath);
    fs.renameSync(temporaryPath, destinationPath);
    syncDirectory(path.dirname(destinationPath));
  } finally {
    fs.rmSync(temporaryPath, { force: true });
    removeDatabaseSidecars(temporaryPath);
  }
  return destinationPath;
}

export interface DatabaseBackupDirectoryReport {
  readonly directory: string;
  readonly inspected: number;
  readonly rewrapped: number;
  readonly outerBackupKeyIds: readonly string[];
  readonly innerDatabaseKeyIds: readonly string[];
}

function governedBackupFiles(directory: string): string[] {
  const root = path.resolve(directory);
  assertPathConfined(root, root, {
    allowRoot: true,
    allowMissing: false,
    type: "directory",
  });
  const files: string[] = [];
  const visit = (current: string): void => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const candidate = path.join(current, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error("BACKUP_SYMLINK_REJECTED.");
      }
      if (entry.isDirectory()) {
        visit(candidate);
      } else if (
        entry.isFile() &&
        /\.amos-(?:backup|restore|sqlcipher|encrypted)-partial$/u.test(
          entry.name,
        )
      ) {
        fs.rmSync(candidate);
        syncDirectory(current);
      } else if (entry.isFile()) {
        assertPathConfined(root, candidate, {
          allowMissing: false,
          type: "file",
        });
        files.push(candidate);
      }
    }
  };
  visit(root);
  return files.sort();
}

export function enforceDatabaseBackupDirectory(
  directory: string,
  source: NodeJS.ProcessEnv = process.env,
): DatabaseBackupDirectoryReport {
  const root = path.resolve(directory);
  const outerBackupKeyIds = new Set<string>();
  const innerDatabaseKeyIds = new Set<string>();
  let rewrapped = 0;
  const files = governedBackupFiles(root);

  for (const filePath of files) {
    if (source.AMOS_STORAGE_MIGRATION_MODE === "rotate") {
      if (
        rewrapEncryptedFileAtomic(
          filePath,
          "backup-files",
          root,
          source,
        )
      ) {
        rewrapped += 1;
      }
    }
    const payload = fs.readFileSync(filePath);
    if (!isEncryptedStoragePayload(payload)) {
      throw new Error("LEGACY_BACKUP_FORMAT_UNSUPPORTED.");
    }
    const decrypted = decryptStoragePayloadWithMetadata(
      payload,
      "backup-files",
      deriveStorageObjectId(root, filePath, "backup-files"),
      source,
    );
    const verificationPath = `${filePath}.amos-sqlcipher-partial`;
    fs.rmSync(verificationPath, { force: true });
    try {
      const decoded = decodeDatabaseBackupContainer(decrypted.plaintext);
      try {
        fs.writeFileSync(verificationPath, decoded.database, {
          flag: "wx",
          mode: 0o600,
        });
        const inspection = inspectEncryptedDatabase(
          verificationPath,
          decoded.manifest.scope,
          source,
        );
        if (
          !inspection.encrypted ||
          inspection.keyId !== decoded.manifest.databaseKeyId
        ) {
          throw new Error("DATABASE_BACKUP_DECLARED_KEY_MISMATCH.");
        }
        outerBackupKeyIds.add(decrypted.keyId);
        innerDatabaseKeyIds.add(decoded.manifest.databaseKeyId);
      } finally {
        decoded.database.fill(0);
      }
    } finally {
      decrypted.plaintext.fill(0);
      fs.rmSync(verificationPath, { force: true });
      removeDatabaseSidecars(verificationPath);
    }
  }

  return {
    directory: root,
    inspected: files.length,
    rewrapped,
    outerBackupKeyIds: [...outerBackupKeyIds].sort(),
    innerDatabaseKeyIds: [...innerDatabaseKeyIds].sort(),
  };
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
  const productionScope =
    databasePath === ":memory:" ? null : productionDatabaseScope(databasePath);
  const db = productionScope
    ? openEncryptedDatabase(databasePath, productionScope, {
        readonly,
        fileMustExist: readonly,
      })
    : new Database(databasePath, {
        readonly,
        fileMustExist: readonly,
      });
  if (!readonly) db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}
