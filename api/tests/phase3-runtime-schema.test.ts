import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  assertPhase3DemoControlActive,
  assertPhase3DemoResetAllowed,
  getPhase3DemoControlState,
  recordPhase3AccessReview,
  recordPhase3DemoAction,
  resetPhase3ControlScenario,
  seedPhase3ControlScenario,
  setPhase3KillSwitch,
} from "../services/phase3/runtime-schema";

describe("Phase 3 runtime control schema", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
  });

  afterEach(() => db.close());

  it("initializes and seeds the nonredundant synthetic support case idempotently", () => {
    seedPhase3ControlScenario(db);
    seedPhase3ControlScenario(db);
    expect(
      (
        db
          .prepare("SELECT COUNT(*) AS count FROM phase3_support_cases")
          .get() as { count: number }
      ).count,
    ).toBe(1);
    expect(
      (
        db
          .prepare("SELECT COUNT(*) AS count FROM phase3_support_links")
          .get() as { count: number }
      ).count,
    ).toBe(4);
    expect(
      (
        db.prepare("SELECT COUNT(*) AS count FROM phase3_work_items").get() as {
          count: number;
        }
      ).count,
    ).toBe(4);
    expect(
      (
        db
          .prepare("SELECT COUNT(*) AS count FROM phase3_audit_events")
          .get() as { count: number }
      ).count,
    ).toBe(1);
    expect(
      (
        db
          .prepare(
            "SELECT COUNT(*) AS count FROM phase3_support_cases WHERE evidence_class='production'",
          )
          .get() as { count: number }
      ).count,
    ).toBe(0);
    expect(
      (
        db
          .prepare("SELECT production_writes_blocked FROM phase3_demo_controls")
          .get() as { production_writes_blocked: number }
      ).production_writes_blocked,
    ).toBe(1);
    expect(getPhase3DemoControlState(db)).toMatchObject({
      environmentId: "AMOS-OPS-PHASE3-EVALUATION",
      environmentLabel: "DEMO - NOT FOR CARE DELIVERY",
      dataStoreLabel: "phase3-synthetic-sqlite",
      killSwitchEnabled: false,
      productionWritesBlocked: true,
      accessReviewedBy: "SYNTH-MANAGING-DIRECTOR",
    });
  });

  it("prevents audit and snapshot evidence mutation", () => {
    seedPhase3ControlScenario(db);
    db.prepare(
      `INSERT INTO phase3_module_snapshots
      (id,support_case_id,milestone,aggregate_type,aggregate_id,aggregate_version,payload_json,evidence_class,is_current,created_at)
      VALUES ('SYNTH-P3-SNAPSHOT-TEST','SYNTH-PHASE3-SUPPORT-001','M3.1','test','SYNTH-M31-TEST',1,'{}','synthetic_demo',1,'2026-07-14T18:00:00.000Z')`,
    ).run();
    expect(() =>
      db.prepare("UPDATE phase3_audit_events SET reason='changed'").run(),
    ).toThrow("PHASE3_AUDIT_IMMUTABLE");
    expect(() => db.prepare("DELETE FROM phase3_audit_events").run()).toThrow(
      "PHASE3_AUDIT_IMMUTABLE",
    );
    expect(() =>
      db.prepare("UPDATE phase3_module_snapshots SET payload_json='{}'").run(),
    ).toThrow("PHASE3_SNAPSHOT_IMMUTABLE");
    expect(() =>
      db.prepare("DELETE FROM phase3_module_snapshots").run(),
    ).toThrow("PHASE3_SNAPSHOT_IMMUTABLE");
  });

  it("resets runtime work without weakening the production boundary", () => {
    seedPhase3ControlScenario(db);
    db.prepare(
      "UPDATE phase3_work_items SET status='completed',completed_at='2026-07-15T18:00:00.000Z'",
    ).run();
    const resetAt = "2026-07-16T15:45:00.000Z";
    resetPhase3ControlScenario(db, "SYNTH-ADMIN", "administrator", resetAt);
    expect(
      (
        db
          .prepare(
            "SELECT COUNT(*) AS count FROM phase3_work_items WHERE status='in_progress'",
          )
          .get() as { count: number }
      ).count,
    ).toBe(4);
    expect(
      (
        db
          .prepare("SELECT production_writes_blocked FROM phase3_demo_controls")
          .get() as { production_writes_blocked: number }
      ).production_writes_blocked,
    ).toBe(1);
    expect(getPhase3DemoControlState(db).lastResetAt).toBe(resetAt);
    expect(
      db
        .prepare(
          "SELECT DISTINCT updated_at FROM phase3_work_items ORDER BY updated_at",
        )
        .all(),
    ).toEqual([{ updated_at: resetAt }]);
    expect(
      db
        .prepare(
          "SELECT updated_at FROM phase3_support_cases WHERE id='SYNTH-PHASE3-SUPPORT-001'",
        )
        .get(),
    ).toEqual({ updated_at: resetAt });
    expect(
      (
        db
          .prepare(
            "SELECT COUNT(*) AS count FROM phase3_audit_events WHERE entity_type='phase3_demo_reset'",
          )
          .get() as { count: number }
      ).count,
    ).toBe(1);
  });

  it("preserves an engaged kill switch across idempotent seeding and permits reset", () => {
    seedPhase3ControlScenario(db);
    setPhase3KillSwitch(true, "SYNTH-ADMINISTRATOR", "administrator", db);
    seedPhase3ControlScenario(db);
    expect(getPhase3DemoControlState(db).killSwitchEnabled).toBe(true);
    expect(() => assertPhase3DemoControlActive(db)).toThrow(
      "PHASE3_DEMO_KILL_SWITCH_ACTIVE",
    );
    expect(() => assertPhase3DemoResetAllowed(db)).not.toThrow();
    resetPhase3ControlScenario(db);
    expect(getPhase3DemoControlState(db).killSwitchEnabled).toBe(true);
  });

  it("fails closed for expired data and stale access review", () => {
    seedPhase3ControlScenario(db);
    db.prepare(
      "UPDATE phase3_demo_controls SET data_expires_at='2026-07-14T18:29:00.000Z'",
    ).run();
    expect(() => assertPhase3DemoControlActive(db)).toThrow(
      "PHASE3_DEMO_DATA_EXPIRED",
    );
    db.prepare(
      "UPDATE phase3_demo_controls SET data_expires_at='2027-01-14T00:00:00.000Z',access_reviewed_at='2026-01-01T00:00:00.000Z'",
    ).run();
    expect(() => assertPhase3DemoControlActive(db)).toThrow(
      "PHASE3_ACCESS_REVIEW_STALE",
    );
    recordPhase3AccessReview(
      "SYNTH-MANAGING-DIRECTOR",
      "managing-director",
      db,
    );
    expect(() => assertPhase3DemoControlActive(db)).not.toThrow();
  });

  it("appends every reset, kill-switch, and access-review action", () => {
    seedPhase3ControlScenario(db);
    setPhase3KillSwitch(true, "SYNTH-ADMIN", "administrator", db);
    setPhase3KillSwitch(false, "SYNTH-ADMIN", "administrator", db);
    setPhase3KillSwitch(true, "SYNTH-ADMIN", "administrator", db);
    recordPhase3AccessReview("SYNTH-ADMIN", "administrator", db);
    recordPhase3AccessReview("SYNTH-ADMIN", "administrator", db);
    setPhase3KillSwitch(false, "SYNTH-ADMIN", "administrator", db);
    recordPhase3DemoAction(
      "component_evaluation",
      "SYNTH-DX1-M3.1-01-SCENARIO",
      "SYNTH-ADMIN",
      "administrator",
      db,
    );
    recordPhase3DemoAction(
      "integrated_run",
      "SYNTH-PHASE3-EXIT-RUN-001",
      "SYNTH-ADMIN",
      "administrator",
      db,
    );
    resetPhase3ControlScenario(db, "SYNTH-ADMIN", "administrator");
    resetPhase3ControlScenario(db, "SYNTH-ADMIN", "administrator");
    expect(
      db
        .prepare(
          `SELECT entity_type, COUNT(*) AS count FROM phase3_audit_events
           WHERE entity_type LIKE 'phase3_demo_%'
           GROUP BY entity_type ORDER BY entity_type`,
        )
        .all(),
    ).toEqual([
      { entity_type: "phase3_demo_access_review", count: 2 },
      { entity_type: "phase3_demo_action", count: 2 },
      { entity_type: "phase3_demo_control", count: 4 },
      { entity_type: "phase3_demo_reset", count: 2 },
    ]);
  });
});
