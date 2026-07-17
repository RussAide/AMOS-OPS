import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import {
  assertDatabaseInitializationScope,
  ensureM21CcmgSchema,
  initializeSyntheticOperationalFixtures,
  shouldInitializeSyntheticOperationalFixtures,
} from "../db-init";
import { env, type EnvironmentConfig } from "../lib/env";
import { runWithDataScope } from "../queries/connection";
import { ensurePhase2ControlSchema } from "../services/phase2/runtime-schema";
import { ensurePhase3ControlSchema } from "../services/phase3/runtime-schema";

function runtime(overrides: Partial<EnvironmentConfig>): EnvironmentConfig {
  return {
    ...env,
    isDevelopment: false,
    isDemo: false,
    isStaging: false,
    isProduction: false,
    evaluationMode: false,
    reviewDeployment: false,
    productionReleaseAuthorized: false,
    ...overrides,
  };
}

function productionRuntime(): EnvironmentConfig {
  return runtime({
    appEnvironment: "production",
    runtimeMode: "production",
    isProduction: true,
    productionReleaseAuthorized: true,
  });
}

function demoRuntime(): EnvironmentConfig {
  return runtime({
    appEnvironment: "demo",
    runtimeMode: "demo",
    environmentId: "amos-ops-demo",
    credentialNamespace: "amos-ops/demo",
    databasePath: "data/demo/amos-ops.db",
    uploadPath: "uploads/demo",
    isDemo: true,
    evaluationMode: true,
  });
}

function installSyntheticSchemas(db: Database.Database): void {
  db.pragma("foreign_keys = ON");
  ensureM21CcmgSchema(db);
  ensurePhase2ControlSchema(db);
  ensurePhase3ControlSchema(db);
}

function rowCount(db: Database.Database, table: string): number {
  return (
    db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as {
      count: number;
    }
  ).count;
}

describe("RM.1 Production database initialization", () => {
  it("keeps the runtime fixture initializer out of Production operational storage", () => {
    const db = new Database(":memory:");
    try {
      installSyntheticSchemas(db);

      expect(
        initializeSyntheticOperationalFixtures(db, {}, productionRuntime()),
      ).toBe(false);
      expect(rowCount(db, "m21_ccmg_referrals")).toBe(0);
      expect(rowCount(db, "phase2_care_episodes")).toBe(0);
      expect(rowCount(db, "phase3_support_cases")).toBe(0);
      expect(rowCount(db, "phase3_demo_controls")).toBe(0);
    } finally {
      db.close();
    }
  });

  it("retains deterministic fixtures in an explicit Demo operational store", () => {
    const db = new Database(":memory:");
    try {
      installSyntheticSchemas(db);

      expect(
        initializeSyntheticOperationalFixtures(db, {}, demoRuntime()),
      ).toBe(true);
      expect(rowCount(db, "m21_ccmg_referrals")).toBe(4);
      expect(rowCount(db, "phase2_care_episodes")).toBe(1);
      expect(rowCount(db, "phase3_support_cases")).toBe(1);
    } finally {
      db.close();
    }
  });

  it("retains fixtures in the isolated training store of a Production deployment", () => {
    const db = new Database(":memory:");
    try {
      installSyntheticSchemas(db);

      const initialized = runWithDataScope("training", () =>
        initializeSyntheticOperationalFixtures(
          db,
          { trainingWorkspace: true },
          productionRuntime(),
        ),
      );
      expect(initialized).toBe(true);
      expect(rowCount(db, "m21_ccmg_referrals")).toBe(4);
      expect(rowCount(db, "phase2_care_episodes")).toBe(1);
      expect(rowCount(db, "phase3_support_cases")).toBe(1);
    } finally {
      db.close();
    }
  });

  it("rejects a training flag unless the training database scope is active", () => {
    expect(() =>
      assertDatabaseInitializationScope({ trainingWorkspace: true }),
    ).toThrow(/DATABASE_INITIALIZATION_SCOPE_MISMATCH/);
    expect(() =>
      runWithDataScope("training", () =>
        assertDatabaseInitializationScope({ trainingWorkspace: false }),
      ),
    ).toThrow(/DATABASE_INITIALIZATION_SCOPE_MISMATCH/);
  });

  it("does not treat ordinary development as an authorized fixture scope", () => {
    expect(
      shouldInitializeSyntheticOperationalFixtures(
        {},
        runtime({
          appEnvironment: "development",
          runtimeMode: "production",
          isDevelopment: true,
        }),
      ),
    ).toBe(false);
  });
});
