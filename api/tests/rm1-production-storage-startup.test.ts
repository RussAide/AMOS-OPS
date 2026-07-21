import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it, vi } from "vitest";
import { env, type EnvironmentConfig } from "../lib/env";
import {
  assertProductionStorageStartup,
  mountPointsFromProcMountInfo,
  verifyExistingSqliteDatabase,
} from "../queries/connection";

const temporaryRoots: string[] = [];

function temporaryRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "amos-rm1-storage-"));
  temporaryRoots.push(root);
  return root;
}

function productionRuntime(root: string): EnvironmentConfig {
  return {
    ...env,
    appEnvironment: "production",
    runtimeMode: "production",
    isDevelopment: false,
    isDemo: false,
    isStaging: false,
    isProduction: true,
    persistentRoot: root,
    databasePath: path.join(root, "data/production/amos-ops.db"),
    trainingDatabasePath: path.join(
      root,
      "data/production/training/amos-ops-training.db",
    ),
    uploadPath: path.join(root, "uploads/production"),
    trainingUploadPath: path.join(root, "uploads/production/training"),
    backupPath: path.join(root, "backups/production"),
  };
}

function mountInfoFor(mountPoint: string): string {
  const encoded = mountPoint
    .replaceAll("\\", "\\134")
    .replaceAll(" ", "\\040")
    .replaceAll("\t", "\\011")
    .replaceAll("\n", "\\012");
  return `36 25 0:31 / ${encoded} rw,relatime - ext4 /dev/volume rw`;
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("RM.1 Production storage startup gate", () => {
  it("recognizes an exact escaped mount point from proc mountinfo", () => {
    const root = path.join(temporaryRoot(), "persistent volume");
    expect(mountPointsFromProcMountInfo(mountInfoFor(root))).toContain(
      path.resolve(root),
    );
  });

  it("fails before database verification when the persistent root is not mounted", () => {
    const runtime = productionRuntime(temporaryRoot());
    const verifyDatabase = vi.fn();

    expect(() =>
      assertProductionStorageStartup(runtime, {
        mountInfo: mountInfoFor("/different/mount"),
        verifyDatabase,
      }),
    ).toThrow(/PRODUCTION_PERSISTENT_VOLUME_NOT_MOUNTED/);
    expect(verifyDatabase).not.toHaveBeenCalled();
  });

  it("verifies both existing Production databases only after proving the mount", () => {
    const runtime = productionRuntime(temporaryRoot());
    const verifyDatabase = vi.fn();
    for (const databasePath of [
      runtime.databasePath,
      runtime.trainingDatabasePath,
    ]) {
      fs.mkdirSync(path.dirname(databasePath), { recursive: true });
      fs.writeFileSync(databasePath, "placeholder");
    }

    assertProductionStorageStartup(runtime, {
      mountInfo: mountInfoFor(runtime.persistentRoot),
      verifyDatabase,
    });

    expect(verifyDatabase.mock.calls).toEqual([
      [runtime.databasePath, "operational"],
      [runtime.trainingDatabasePath, "training"],
    ]);
  });

  it("removes an uncommitted database-encryption temporary before verification", () => {
    const runtime = productionRuntime(temporaryRoot());
    const verifyDatabase = vi.fn();
    for (const databasePath of [
      runtime.databasePath,
      runtime.trainingDatabasePath,
    ]) {
      fs.mkdirSync(path.dirname(databasePath), { recursive: true });
      fs.writeFileSync(databasePath, "placeholder");
    }
    const stale = `${runtime.databasePath}.amos-rm2-partial`;
    fs.writeFileSync(stale, "uncommitted-temporary");

    assertProductionStorageStartup(runtime, {
      mountInfo: mountInfoFor(runtime.persistentRoot),
      verifyDatabase,
    });
    expect(fs.existsSync(stale)).toBe(false);
    expect(verifyDatabase).toHaveBeenCalledTimes(2);
  });

  it("rejects a database path that traverses a symbolic link", () => {
    const root = temporaryRoot();
    const outside = temporaryRoot();
    const runtime = productionRuntime(root);
    fs.mkdirSync(path.dirname(runtime.databasePath), { recursive: true });
    fs.writeFileSync(runtime.databasePath, "placeholder");
    fs.mkdirSync(path.dirname(runtime.trainingDatabasePath), {
      recursive: true,
    });
    fs.rmSync(path.dirname(runtime.trainingDatabasePath), {
      recursive: true,
      force: true,
    });
    fs.symlinkSync(outside, path.dirname(runtime.trainingDatabasePath), "dir");
    fs.writeFileSync(path.join(outside, "amos-ops-training.db"), "placeholder");

    expect(() =>
      assertProductionStorageStartup(runtime, {
        mountInfo: mountInfoFor(root),
        verifyDatabase: vi.fn(),
      }),
    ).toThrow(/Symbolic-link path component rejected/);
  });

  it("requires an existing, intact SQLite file", () => {
    const root = temporaryRoot();
    const validPath = path.join(root, "valid.db");
    const valid = new Database(validPath);
    valid.exec("CREATE TABLE users (id TEXT PRIMARY KEY)");
    valid.close();

    expect(() => verifyExistingSqliteDatabase(validPath)).not.toThrow();
    expect(() =>
      verifyExistingSqliteDatabase(path.join(root, "missing.db")),
    ).toThrow(/PRODUCTION_DATABASE_MISSING/);

    const unrelatedPath = path.join(root, "unrelated.db");
    const unrelated = new Database(unrelatedPath);
    unrelated.exec("CREATE TABLE evidence (id TEXT PRIMARY KEY)");
    unrelated.close();
    expect(() => verifyExistingSqliteDatabase(unrelatedPath)).toThrow(
      /PRODUCTION_DATABASE_IDENTITY_FAILED/,
    );

    const invalidPath = path.join(root, "invalid.db");
    fs.writeFileSync(invalidPath, "not a sqlite database");
    expect(() => verifyExistingSqliteDatabase(invalidPath)).toThrow();
  });

  it("keeps the RM.1 Production database gate active while RM.2 is paused", () => {
    const root = temporaryRoot();
    const validPath = path.join(root, "paused-production.db");
    const valid = new Database(validPath);
    valid.exec("CREATE TABLE users (id TEXT PRIMARY KEY)");
    valid.close();

    expect(() =>
      verifyExistingSqliteDatabase(validPath, "operational", {
        APP_ENV: "production",
        AMOS_RM2_STATUS: "paused",
      }),
    ).not.toThrow();
    expect(() =>
      verifyExistingSqliteDatabase(validPath, "operational", {
        APP_ENV: "production",
        AMOS_RM2_STATUS: "active",
        AMOS_STORAGE_ENCRYPTION_REQUIRED: "true",
      }),
    ).toThrow(/AMOS_DATABASE_ACTIVE_KEY_ID|PRODUCTION_STORAGE_ENCRYPTION_REQUIRED/);
  });

  it("does not apply the Production mount or database gate outside Production", () => {
    const verifyDatabase = vi.fn();
    expect(() =>
      assertProductionStorageStartup(
        { ...env, isProduction: false },
        { mountInfo: "", verifyDatabase },
      ),
    ).not.toThrow();
    expect(verifyDatabase).not.toHaveBeenCalled();
  });
});
