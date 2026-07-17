import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { AsyncLocalStorage } from "node:async_hooks";
import * as schema from "@db/schema";
import { env, type EnvironmentConfig } from "../lib/env";
import {
  inspectEncryptedDatabase,
  openEncryptedDatabase,
  removeStaleDatabaseEncryptionTemporary,
  type DatabaseStorageScope,
} from "../security/storage-encryption";
import { assertPathConfined } from "../security/path-confinement";

// ─── SQLite evaluation-build database ─────────────────────

export type DataScope = "operational" | "training";

export interface ProductionStorageStartupOptions {
  mountInfo?: string;
  verifyDatabase?: (
    databasePath: string,
    scope: DatabaseStorageScope,
  ) => void;
}

function decodeMountInfoPath(value: string): string {
  return value.replace(/\\(040|011|012|134)/g, (_match, code: string) => {
    switch (code) {
      case "040":
        return " ";
      case "011":
        return "\t";
      case "012":
        return "\n";
      default:
        return "\\";
    }
  });
}

export function mountPointsFromProcMountInfo(mountInfo: string): Set<string> {
  const mountPoints = new Set<string>();
  for (const line of mountInfo.split("\n")) {
    if (!line.trim()) continue;
    const fields = line.split(" - ", 1)[0]?.split(" ") ?? [];
    if (fields.length < 5) continue;
    mountPoints.add(path.resolve(decodeMountInfoPath(fields[4])));
  }
  return mountPoints;
}

export function verifyExistingSqliteDatabase(
  databasePath: string,
  scope: DatabaseStorageScope = "operational",
  source: NodeJS.ProcessEnv = process.env,
): void {
  const resolvedPath = path.resolve(databasePath);
  if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
    throw new Error(
      `PRODUCTION_DATABASE_MISSING: expected an existing SQLite file at ${resolvedPath}.`,
    );
  }

  const isProduction = source.APP_ENV?.trim().toLowerCase() === "production";
  if (isProduction) {
    const inspection = inspectEncryptedDatabase(resolvedPath, scope, source);
    if (!inspection.encrypted || !inspection.activeKey) {
      throw new Error(
        "PRODUCTION_DATABASE_ENCRYPTION_FAILED: database is not protected by the active SQLCipher key.",
      );
    }
  }
  const verification = isProduction
    ? openEncryptedDatabase(
        resolvedPath,
        scope,
        { readonly: true, fileMustExist: true },
        source,
      )
    : new Database(resolvedPath, {
        readonly: true,
        fileMustExist: true,
      });
  try {
    const integrity = verification.pragma("integrity_check", { simple: true });
    if (integrity !== "ok") {
      throw new Error(
        `PRODUCTION_DATABASE_INTEGRITY_FAILED: ${resolvedPath}: ${String(integrity)}`,
      );
    }
    const usersTable = verification
      .prepare(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'users'",
      )
      .get();
    if (!usersTable) {
      throw new Error(
        `PRODUCTION_DATABASE_IDENTITY_FAILED: ${resolvedPath} does not contain the AMOS users schema.`,
      );
    }
  } finally {
    verification.close();
  }
}

/**
 * Fail closed before any directory creation or read-write database open. A
 * Production path with the right spelling is not evidence that Railway
 * attached the persistent volume there.
 */
export function assertProductionStorageStartup(
  environment: EnvironmentConfig,
  options: ProductionStorageStartupOptions = {},
): void {
  if (!environment.isProduction) return;

  const persistentRoot = path.resolve(environment.persistentRoot);
  const mountInfo =
    options.mountInfo ?? fs.readFileSync("/proc/self/mountinfo", "utf8");
  if (!mountPointsFromProcMountInfo(mountInfo).has(persistentRoot)) {
    throw new Error(
      `PRODUCTION_PERSISTENT_VOLUME_NOT_MOUNTED: ${persistentRoot} is not an active mount point.`,
    );
  }

  for (const databasePath of [
    environment.databasePath,
    environment.trainingDatabasePath,
  ]) {
    removeStaleDatabaseEncryptionTemporary(databasePath);
    assertPathConfined(persistentRoot, databasePath, {
      allowMissing: false,
      type: "file",
    });
  }
  for (const directoryPath of [
    environment.uploadPath,
    environment.trainingUploadPath,
    environment.backupPath,
  ]) {
    assertPathConfined(persistentRoot, directoryPath, {
      allowMissing: true,
      type: "directory",
    });
  }

  const verifyDatabase = options.verifyDatabase ?? verifyExistingSqliteDatabase;
  verifyDatabase(environment.databasePath, "operational");
  verifyDatabase(environment.trainingDatabasePath, "training");
}

function openDatabase(
  databasePath: string,
  scope: DatabaseStorageScope,
  options: { requireExisting?: boolean } = {},
): Database.Database {
  if (!options.requireExisting) {
    fs.mkdirSync(path.dirname(path.resolve(databasePath)), { recursive: true });
  }
  const database = env.isProduction
    ? openEncryptedDatabase(databasePath, scope, {
        fileMustExist: options.requireExisting ?? false,
      })
    : new Database(databasePath, {
        fileMustExist: options.requireExisting ?? false,
      });
  database.pragma("foreign_keys = ON");
  database.pragma("journal_mode = WAL");
  return database;
}

assertProductionStorageStartup(env);
export const operationalSqlite = openDatabase(env.databasePath, "operational", {
  requireExisting: env.isProduction,
});
export const trainingSqlite = openDatabase(env.trainingDatabasePath, "training", {
  requireExisting: env.isProduction,
});
const dataScopeStorage = new AsyncLocalStorage<DataScope>();

export function currentDataScope(): DataScope {
  return dataScopeStorage.getStore() ?? "operational";
}

export function runWithDataScope<T>(scope: DataScope, callback: () => T): T {
  return dataScopeStorage.run(scope, callback);
}

function scopedSqlite(): Database.Database {
  return currentDataScope() === "training" ? trainingSqlite : operationalSqlite;
}

let operationalDb: ReturnType<typeof drizzleSqlite<typeof schema>>;
let trainingDb: ReturnType<typeof drizzleSqlite<typeof schema>>;

function getSqliteDb() {
  if (currentDataScope() === "training") {
    trainingDb ??= drizzleSqlite(trainingSqlite, { schema });
    return trainingDb;
  }
  operationalDb ??= drizzleSqlite(operationalSqlite, { schema });
  return operationalDb;
}

export function getDb(): ReturnType<typeof drizzleSqlite<typeof schema>> {
  return getSqliteDb();
}

// ─── Raw SQLite for non-Drizzle queries ────────────────────

/**
 * Compatibility proxy for legacy raw-SQL callers. Every operation is routed
 * to the request's isolated data workspace.
 */
export const sqlite = new Proxy(operationalSqlite, {
  get(_target, property) {
    const database = scopedSqlite() as unknown as Record<PropertyKey, unknown>;
    const value = database[property];
    return typeof value === "function" ? value.bind(database) : value;
  },
}) as Database.Database;
