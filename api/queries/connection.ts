import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { AsyncLocalStorage } from "node:async_hooks";
import * as schema from "@db/schema";
import { env } from "../lib/env";

// ─── SQLite evaluation-build database ─────────────────────

export type DataScope = "operational" | "training";

function openDatabase(databasePath: string): Database.Database {
  fs.mkdirSync(path.dirname(path.resolve(databasePath)), { recursive: true });
  const database = new Database(databasePath);
  database.pragma("foreign_keys = ON");
  database.pragma("journal_mode = WAL");
  return database;
}

export const operationalSqlite = openDatabase(env.databasePath);
export const trainingSqlite = openDatabase(env.trainingDatabasePath);
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
