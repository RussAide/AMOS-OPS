import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const binary = path.join(
  root,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "drizzle-kit.cmd" : "drizzle-kit",
);
const output = path.join(root, "db", "current-schema.sql");

const result = spawnSync(
  binary,
  ["export", "--dialect", "sqlite", "--schema", "./db/schema.ts"],
  {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, npm_config_loglevel: "silent" },
    maxBuffer: 16 * 1024 * 1024,
  },
);

if (result.status !== 0) {
  throw new Error(
    `Current schema export failed: ${result.stderr || result.stdout || "unknown error"}`,
  );
}

const sql = result.stdout.trim();
const requiredFragments = [
  "CREATE TABLE `users`",
  "CREATE TABLE `patients`",
  "`phone` text",
  "CREATE TABLE `agent_personas`",
  "`key` text NOT NULL",
];
for (const fragment of requiredFragments) {
  if (!sql.includes(fragment)) {
    throw new Error(`Current schema export is missing required fragment: ${fragment}`);
  }
}

fs.writeFileSync(output, `${sql}\n`);
console.log(`Exported current SQLite schema to ${path.relative(root, output)}.`);
