import path from "path";
import process from "process";
import fs from "fs";
import {
  adoptExistingMigrationBaseline,
  applyPendingMigrations,
  createDatabaseBackup,
  openLifecycleDatabase,
  planMigrations,
  restoreDatabaseBackup,
  validateDatabaseIntegrity,
} from "../api/data-lifecycle.ts";

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function required(flag) {
  const value = valueAfter(flag);
  if (!value) throw new Error(`Missing required argument: ${flag}`);
  return value;
}

const command = process.argv[2] ?? "status";
const databasePath = path.resolve(
  valueAfter("--database") ?? process.env.DATABASE_PATH ?? "amos-ops.db",
);
const migrationsPath = path.resolve(valueAfter("--migrations") ?? "db/migrations");

if (command === "status") {
  const exists = fs.existsSync(databasePath);
  const db = openLifecycleDatabase(exists ? databasePath : ":memory:", { readonly: exists });
  try {
    const plan = planMigrations(db, migrationsPath);
    const integrity = validateDatabaseIntegrity(db);
    console.log(JSON.stringify({ databasePath, exists, plan, integrity }, null, 2));
  } finally {
    db.close();
  }
} else if (command === "migrate") {
  const exists = fs.existsSync(databasePath);
  const dryRun = !process.argv.includes("--apply");
  const db = openLifecycleDatabase(exists ? databasePath : ":memory:", {
    readonly: dryRun && exists,
  });
  try {
    const plan = planMigrations(db, migrationsPath);
    if (dryRun) {
      console.log(JSON.stringify({ dryRun: true, databasePath, exists, plan }, null, 2));
    } else {
      if (!exists) throw new Error("Migration apply requires an existing database checkpoint source");
      const checkpointPath = required("--checkpoint");
      db.close();
      await createDatabaseBackup(databasePath, checkpointPath);
      const writable = openLifecycleDatabase(databasePath);
      try {
        const applied = applyPendingMigrations(writable, migrationsPath);
        const integrity = validateDatabaseIntegrity(writable);
        if (!integrity.ok) throw new Error("Post-migration integrity validation failed");
        console.log(JSON.stringify({ applied, checkpointPath, integrity }, null, 2));
      } finally {
        writable.close();
      }
    }
  } finally {
    if (db.open) db.close();
  }
} else if (command === "backup") {
  const destination = required("--output");
  console.log(JSON.stringify({ backup: await createDatabaseBackup(databasePath, destination) }));
} else if (command === "restore") {
  if (!process.argv.includes("--confirm-restore")) {
    throw new Error("Restore requires --confirm-restore");
  }
  const source = required("--input");
  console.log(
    JSON.stringify({
      restored: restoreDatabaseBackup(source, databasePath, { allowOverwrite: true }),
    }),
  );
} else if (command === "baseline-existing") {
  if (!process.argv.includes("--confirm-adopt-existing")) {
    throw new Error("Baseline adoption requires --confirm-adopt-existing");
  }
  const checkpointPath = required("--checkpoint");
  const report = await adoptExistingMigrationBaseline({
    databasePath,
    migrationsDirectory: migrationsPath,
    checkpointPath,
    confirmation: "ADOPT_EXISTING_SCHEMA",
  });
  console.log(JSON.stringify(report, null, 2));
} else {
  throw new Error(`Unknown lifecycle command: ${command}`);
}
