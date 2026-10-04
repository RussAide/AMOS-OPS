import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyPendingMigrations,
  openLifecycleDatabase,
  planMigrations,
} from "../data-lifecycle";
import { runGadLogisticsR2WorkplanMigration } from "./gad-logistics-r2-migration";

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "logistics-r2-startup-"));
  const databasePath = path.join(root, "amos-ops.db");
  const backupRoot = path.join(root, "backups");
  const migrationsDirectory = path.join(root, "migrations");
  fs.mkdirSync(migrationsDirectory, { recursive: true });
  fs.copyFileSync(
    path.join(process.cwd(), "db/migrations/0011_gad_logistics_r1.sql"),
    path.join(migrationsDirectory, "0011_gad_logistics_r1.sql"),
  );
  return { root, databasePath, backupRoot, migrationsDirectory };
}

describe("GAD Logistics R2 normal-startup migration", () => {
  it("defers to fresh-schema bootstrap when the database does not exist", async () => {
    const fx = fixture();
    fs.copyFileSync(
      path.join(process.cwd(), "db/migrations/0012_gad_logistics_r2_workplans.sql"),
      path.join(fx.migrationsDirectory, "0012_gad_logistics_r2_workplans.sql"),
    );

    const result = await runGadLogisticsR2WorkplanMigration({
      databasePath: fx.databasePath,
      backupRoot: fx.backupRoot,
      migrationsDirectory: fx.migrationsDirectory,
    });

    expect(result.state).toBe("database_missing_bootstrap_deferred");
    expect(fs.existsSync(fx.databasePath)).toBe(false);
    fs.rmSync(fx.root, { recursive: true, force: true });
  });

  it("backs up and applies only 0012, then becomes idempotent", async () => {
    const fx = fixture();
    const db = openLifecycleDatabase(fx.databasePath);
    applyPendingMigrations(db, fx.migrationsDirectory);
    db.close();

    fs.copyFileSync(
      path.join(process.cwd(), "db/migrations/0012_gad_logistics_r2_workplans.sql"),
      path.join(fx.migrationsDirectory, "0012_gad_logistics_r2_workplans.sql"),
    );

    const first = await runGadLogisticsR2WorkplanMigration({
      databasePath: fx.databasePath,
      backupRoot: fx.backupRoot,
      migrationsDirectory: fx.migrationsDirectory,
    });

    expect(first.state).toBe("applied");
    expect(first.appliedNow).toBe(true);
    expect(first.integrity).toBe("ok");
    expect(first.foreignKeyViolations).toBe(0);
    expect(first.requiredTablePresent).toBe(true);
    expect(first.requiredIndexesPresent).toBe(true);
    expect(first.backupBasename).toMatch(/^gad-logistics-r2-pre-0012-/);
    expect(first.backupSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(
      fs.existsSync(path.join(fx.backupRoot, first.backupBasename!)),
    ).toBe(true);

    const verify = openLifecycleDatabase(fx.databasePath, { readonly: true });
    const target = planMigrations(verify, fx.migrationsDirectory).find(
      (item) => item.name === "0012_gad_logistics_r2_workplans.sql",
    );
    expect(target?.state).toBe("applied");
    expect(
      verify
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'gad_logistics_workplan_items'",
        )
        .get(),
    ).toBeTruthy();
    verify.close();

    const second = await runGadLogisticsR2WorkplanMigration({
      databasePath: fx.databasePath,
      backupRoot: fx.backupRoot,
      migrationsDirectory: fx.migrationsDirectory,
    });
    expect(second.state).toBe("already_applied");
    expect(second.appliedNow).toBe(false);
    expect(second.backupBasename).toBeNull();
    expect(second.backupSha256).toBeNull();

    fs.rmSync(fx.root, { recursive: true, force: true });
  });
});
