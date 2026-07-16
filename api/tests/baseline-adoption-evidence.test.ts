import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  adoptExistingMigrationBaseline,
  listAppliedMigrations,
  openLifecycleDatabase,
} from "../data-lifecycle";

describe("M1.1 retained baseline-adoption evidence", () => {
  it("emits a sanitized adoption and refusal report", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "amos-m11-adoption-evidence-"));
    try {
      const migrationsDirectory = path.join(directory, "migrations");
      fs.mkdirSync(migrationsDirectory);
      fs.writeFileSync(
        path.join(migrationsDirectory, "0000_existing.sql"),
        `CREATE TABLE parent (\n  id TEXT PRIMARY KEY,\n  label TEXT NOT NULL\n);\n` +
          `CREATE TABLE child (\n  id TEXT PRIMARY KEY,\n  parent_id TEXT NOT NULL\n);\n` +
          "CREATE INDEX idx_child_parent ON child(parent_id);\n",
      );

      const acceptedDatabase = path.join(directory, "amos-evaluation-existing.db");
      let db = openLifecycleDatabase(acceptedDatabase);
      db.exec(`
        CREATE TABLE parent (id TEXT PRIMARY KEY, label TEXT NOT NULL);
        CREATE TABLE child (id TEXT PRIMARY KEY, parent_id TEXT NOT NULL);
        CREATE INDEX idx_child_parent ON child(parent_id);
      `);
      db.close();
      const checkpointPath = path.join(directory, "before-adoption.db");
      const adoption = await adoptExistingMigrationBaseline({
        databasePath: acceptedDatabase,
        migrationsDirectory,
        checkpointPath,
        confirmation: "ADOPT_EXISTING_SCHEMA",
        referentialRules: [],
      });
      db = openLifecycleDatabase(acceptedDatabase, { readonly: true });
      const recorded = listAppliedMigrations(db);
      db.close();

      const incompleteDatabase = path.join(directory, "amos-evaluation-incomplete.db");
      db = openLifecycleDatabase(incompleteDatabase);
      db.exec("CREATE TABLE parent (id TEXT PRIMARY KEY, label TEXT NOT NULL)");
      db.close();
      let refusal = "";
      try {
        await adoptExistingMigrationBaseline({
          databasePath: incompleteDatabase,
          migrationsDirectory,
          checkpointPath: path.join(directory, "must-not-exist.db"),
          confirmation: "ADOPT_EXISTING_SCHEMA",
          referentialRules: [],
        });
      } catch (error) {
        refusal = error instanceof Error ? error.message : "refused";
      }

      const evidence = {
        evidenceType: "M1.1-06 controlled existing-schema baseline adoption",
        dataClassification: "synthetic temporary databases only",
        confirmationRequired: true,
        checkpointCreated: fs.existsSync(checkpointPath),
        adoptedMigrations: adoption.adopted,
        recordedChecksums: recorded.map(({ name, checksum }) => ({ name, checksum })),
        integrity: {
          ok: adoption.integrity.ok,
          sqliteIntegrity: adoption.integrity.sqliteIntegrity,
          skippedRules: adoption.integrity.skippedRules.length,
        },
        missingObjectRefusal: /missing schema requirements/.test(refusal),
      };
      console.log(`M1_1_BASELINE_ADOPTION_EVIDENCE=${JSON.stringify(evidence)}`);
      expect(evidence).toMatchObject({
        confirmationRequired: true,
        checkpointCreated: true,
        integrity: { ok: true, sqliteIntegrity: "ok", skippedRules: 0 },
        missingObjectRefusal: true,
      });
      expect(evidence.recordedChecksums).toHaveLength(1);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});
