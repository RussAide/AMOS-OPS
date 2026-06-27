import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "@db/schema";
import { env } from "../lib/env";

const sqlite = new Database(env.databasePath);
sqlite.pragma("journal_mode = WAL");

let instance: ReturnType<typeof drizzle<typeof schema>>;

export function getDb() {
  if (!instance) {
    instance = drizzle(sqlite, { schema });
  }
  return instance;
}

export { sqlite };
