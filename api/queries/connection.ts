import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@db/schema";
import { env } from "../lib/env";

// ─── SQLite (default / local dev) ──────────────────────────

const sqlite = new Database(env.databasePath);
sqlite.pragma("journal_mode = WAL");

let sqliteDb: ReturnType<typeof drizzleSqlite<typeof schema>>;

function getSqliteDb() {
  if (!sqliteDb) {
    sqliteDb = drizzleSqlite(sqlite, { schema });
  }
  return sqliteDb;
}

// ─── PostgreSQL (production / Railway) ─────────────────────

let pgPool: Pool | null = null;
let pgDb: ReturnType<typeof drizzlePg<typeof schema>> | null = null;

function getPgDb() {
  if (!env.databaseUrl) {
    throw new Error("DATABASE_URL not set but PostgreSQL mode requested");
  }
  if (!pgDb) {
    pgPool = new Pool({ connectionString: env.databaseUrl });
    pgDb = drizzlePg(pgPool, { schema });
  }
  return pgDb;
}

// ─── Unified DB ────────────────────────────────────────────

export function getDb() {
  // When DATABASE_URL is set, use PostgreSQL
  if (env.databaseUrl) {
    return getPgDb();
  }
  // Otherwise use SQLite (default for local dev)
  return getSqliteDb();
}

// ─── Raw SQLite for non-Drizzle queries ────────────────────

export { sqlite };

// ─── Raw PG pool for direct SQL if needed ──────────────────

export function getPgPool(): Pool | null {
  return pgPool;
}

// ─── Which DB is active? ───────────────────────────────────

export function isUsingPostgres(): boolean {
  return !!env.databaseUrl;
}
