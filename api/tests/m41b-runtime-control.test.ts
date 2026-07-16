import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildEnvironmentConfig } from "../lib/env";
import {
  assertM41bRuntimeActive,
  assertM41bRuntimeResetAllowed,
  ensureM41bRuntimeSchema,
  type M41bRuntimeControlContext,
} from "../services/m41b";
import { seedPhase3ControlScenario } from "../services/phase3/runtime-schema";

const DEMO_ENVIRONMENT = buildEnvironmentConfig({
  NODE_ENV: "test",
  APP_ENV: "demo",
  AMOS_RUNTIME_MODE: "demo",
  AMOS_ENVIRONMENT_ID: "amos-ops-demo-m41b-test",
  CREDENTIAL_NAMESPACE: "amos-ops/demo/m41b-test",
  DATABASE_PATH: "data/demo/m41b-test.db",
  UPLOAD_PATH: "uploads/demo/m41b-test",
});
const DEVELOPMENT_ENVIRONMENT = buildEnvironmentConfig({ NODE_ENV: "test", APP_ENV: "development" });
const CONTROL = {
  environment: DEMO_ENVIRONMENT,
  asOf: "2026-07-14T22:00:00.000Z",
} as const satisfies M41bRuntimeControlContext;

describe("M4.1B inherited synthetic runtime controls", () => {
  let db: Database.Database;
  beforeEach(() => {
    db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    seedPhase3ControlScenario(db);
  });
  afterEach(() => db.close());

  it("fails before persistence outside demo evaluation mode", () => {
    expect(() => assertM41bRuntimeActive(db, { environment: DEVELOPMENT_ENVIRONMENT })).toThrow("Synthetic milestone scenarios require");
    expect(db.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE name LIKE 'm41b_%'").get()).toEqual({ count: 0 });
  });

  it("fails closed for a missing authoritative control", () => {
    db.prepare("DELETE FROM phase3_demo_controls").run();
    expect(() => assertM41bRuntimeActive(db, CONTROL)).toThrow("PHASE3_DEMO_CONTROL_MISSING");
  });

  it("honors kill switch while preserving reset authority", () => {
    assertM41bRuntimeActive(db, CONTROL);
    db.prepare("UPDATE phase3_demo_controls SET kill_switch_enabled=1").run();
    expect(() => assertM41bRuntimeActive(db)).toThrow("PHASE3_DEMO_KILL_SWITCH_ACTIVE");
    expect(() => assertM41bRuntimeResetAllowed(db)).not.toThrow();
  });

  it("denies expired stale-review and production-write-enabled controls", () => {
    assertM41bRuntimeActive(db, CONTROL);
    db.prepare("UPDATE phase3_demo_controls SET data_expires_at='2026-07-14T21:59:59.000Z'").run();
    expect(() => assertM41bRuntimeActive(db)).toThrow("PHASE3_DEMO_DATA_EXPIRED");
    db.prepare("UPDATE phase3_demo_controls SET data_expires_at='2027-01-14T00:00:00.000Z',access_reviewed_at='2026-01-01T00:00:00.000Z'").run();
    expect(() => assertM41bRuntimeActive(db)).toThrow("PHASE3_ACCESS_REVIEW_STALE");
    db.prepare("UPDATE phase3_demo_controls SET access_reviewed_at='2026-07-14T13:00:00.000Z',production_writes_blocked=0").run();
    expect(() => assertM41bRuntimeActive(db)).toThrow("PHASE3_PRODUCTION_WRITE_BLOCK_DISABLED");
  });

  it("creates immutable M4.1B runtime tables only after active control", () => {
    assertM41bRuntimeActive(db, CONTROL);
    ensureM41bRuntimeSchema(db);
    const names = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'm41b_%' ORDER BY name").all();
    expect(names).toEqual([
      { name: "m41b_interaction_events" },
      { name: "m41b_scenario_runs" },
      { name: "m41b_workplan_snapshots" },
    ]);
  });
});
