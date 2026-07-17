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

    assertProductionStorageStartup(runtime, {
      mountInfo: mountInfoFor(runtime.persistentRoot),
      verifyDatabase,
    });

    expect(verifyDatabase.mock.calls).toEqual([
      [runtime.databasePath],
      [runtime.trainingDatabasePath],
    ]);
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
