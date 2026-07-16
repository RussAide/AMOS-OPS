import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildEnvironmentConfig } from "../lib/env";
import {
  acknowledgeM41aAlert,
  addM41aFollowUpEvidence,
  assignM41aAlert,
  getM41aDashboard,
  initializeM41aRuntime,
  listM41aAlerts,
  recordM41aDecision,
  resetM41aEvaluation,
  resolveM41aAlert,
  type M41aRuntimeControlContext,
} from "../services/m41a";
import { seedPhase3ControlScenario } from "../services/phase3/runtime-schema";

const DEMO_ENVIRONMENT = buildEnvironmentConfig({
  NODE_ENV: "test",
  APP_ENV: "demo",
  AMOS_RUNTIME_MODE: "demo",
  AMOS_ENVIRONMENT_ID: "amos-ops-demo-m41a-test",
  CREDENTIAL_NAMESPACE: "amos-ops/demo/m41a-test",
  DATABASE_PATH: "data/demo/m41a-test.db",
  UPLOAD_PATH: "uploads/demo/m41a-test",
});
const DEVELOPMENT_ENVIRONMENT = buildEnvironmentConfig({
  NODE_ENV: "test",
  APP_ENV: "development",
});
const DEMO_CONTROL = {
  environment: DEMO_ENVIRONMENT,
  asOf: "2026-07-14T22:00:00.000Z",
} as const satisfies M41aRuntimeControlContext;

describe("M4.1A immutable runtime store", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    seedPhase3ControlScenario(db);
  });

  afterEach(() => db.close());

  it("initializes idempotently without duplicating alerts, events, or snapshots", () => {
    const first = initializeM41aRuntime(db, DEMO_CONTROL);
    const eventCount = (
      db
        .prepare("SELECT COUNT(*) AS count FROM m41a_decision_events")
        .get() as {
        count: number;
      }
    ).count;
    const second = initializeM41aRuntime(db);
    expect(second.runId).toBe(first.runId);
    expect(
      (
        db
          .prepare("SELECT COUNT(*) AS count FROM m41a_scenario_runs")
          .get() as {
          count: number;
        }
      ).count,
    ).toBe(1);
    expect(
      (
        db
          .prepare("SELECT COUNT(*) AS count FROM m41a_dashboard_snapshots")
          .get() as { count: number }
      ).count,
    ).toBe(5);
    expect(
      (
        db
          .prepare("SELECT COUNT(*) AS count FROM m41a_decision_events")
          .get() as {
          count: number;
        }
      ).count,
    ).toBe(eventCount);
    const naturalKeys = first.initialAlerts.map((item) => item.naturalKey);
    expect(new Set(naturalKeys).size).toBe(naturalKeys.length);
  });

  it("enforces lifecycle order, evidence-before-resolution, sequence checks, and nonblank records", () => {
    initializeM41aRuntime(db, DEMO_CONTROL);
    const envelope = listM41aAlerts("managing-director", "EO", db);
    const alert = envelope.alerts.find((item) => item.status === "open");
    expect(alert).toBeDefined();
    const base = {
      role: "managing-director" as const,
      scope: "EO" as const,
      alertId: alert?.id ?? "",
      actorId: "SYNTH-RUNTIME-TEST",
    };
    expect(() =>
      assignM41aAlert({ ...base, assignedTo: "SYNTH-OWNER" }, db),
    ).toThrow("M41A_INVALID_ALERT_TRANSITION");
    acknowledgeM41aAlert({ ...base, expectedSequence: 1 }, db);
    expect(() =>
      assignM41aAlert(
        { ...base, assignedTo: "SYNTH-OWNER", expectedSequence: 1 },
        db,
      ),
    ).toThrow("M41A_EVENT_SEQUENCE_CONFLICT");
    assignM41aAlert(
      { ...base, assignedTo: "SYNTH-OWNER", expectedSequence: 2 },
      db,
    );
    expect(() =>
      recordM41aDecision(
        { ...base, disposition: "approve_action", rationale: "   " },
        db,
      ),
    ).toThrow("M41A_DECISION_RATIONALE_REQUIRED");
    recordM41aDecision(
      {
        ...base,
        disposition: "approve_action",
        rationale: "Approve the controlled synthetic corrective action.",
        expectedSequence: 3,
      },
      db,
    );
    expect(() => resolveM41aAlert(base, db)).toThrow(
      "M41A_INVALID_ALERT_TRANSITION",
    );
    expect(() =>
      addM41aFollowUpEvidence(
        { ...base, evidenceRef: " ", summary: "Synthetic summary" },
        db,
      ),
    ).toThrow("M41A_EVIDENCE_REFERENCE_REQUIRED");
    addM41aFollowUpEvidence(
      {
        ...base,
        evidenceRef: "SYNTH-FOLLOW-UP-001",
        summary: "The synthetic corrective action was verified.",
        expectedSequence: 4,
      },
      db,
    );
    resolveM41aAlert({ ...base, expectedSequence: 5 }, db);
    const after = listM41aAlerts("managing-director", "EO", db);
    expect(after.alerts.find((item) => item.id === alert?.id)?.status).toBe(
      "resolved",
    );
    expect(after.decisions).toHaveLength(1);
    expect(after.decisions[0].rationale).toContain("controlled synthetic");
    expect(after.followUpEvidence).toHaveLength(1);
    expect(after.followUpEvidence[0].evidenceRef).toBe("SYNTH-FOLLOW-UP-001");
  });

  it("normalizes production-looking actor and assignee identifiers before persistence", () => {
    initializeM41aRuntime(db, DEMO_CONTROL);
    const alert = listM41aAlerts("managing-director", "EO", db).alerts.find(
      (item) => item.status === "open",
    );
    const base = {
      role: "managing-director" as const,
      scope: "EO" as const,
      alertId: alert?.id ?? "",
      actorId: "real-user-identifier",
    };
    acknowledgeM41aAlert(base, db);
    assignM41aAlert({ ...base, assignedTo: "real-assignee" }, db);
    const rows = db
      .prepare(
        "SELECT actor_id,payload_json FROM m41a_decision_events WHERE aggregate_id LIKE ? ORDER BY sequence",
      )
      .all(`%:${base.alertId}`) as Array<{
      actor_id: string;
      payload_json: string;
    }>;
    expect(rows.at(-1)?.actor_id).toBe("SYNTH-M41A-MANAGING_DIRECTOR");
    expect(rows.at(-1)?.payload_json).not.toContain("real-user-identifier");
    expect(rows.at(-1)?.payload_json).not.toContain("real-assignee");
  });

  it("makes audit and snapshot evidence immutable", () => {
    initializeM41aRuntime(db, DEMO_CONTROL);
    expect(() =>
      db.prepare("UPDATE m41a_decision_events SET actor_id='changed'").run(),
    ).toThrow("M41A_DECISION_EVENT_IMMUTABLE");
    expect(() => db.prepare("DELETE FROM m41a_decision_events").run()).toThrow(
      "M41A_DECISION_EVENT_IMMUTABLE",
    );
    expect(() =>
      db.prepare("UPDATE m41a_dashboard_snapshots SET payload_json='{}'").run(),
    ).toThrow("M41A_DASHBOARD_SNAPSHOT_IMMUTABLE");
    expect(() =>
      db.prepare("DELETE FROM m41a_dashboard_snapshots").run(),
    ).toThrow("M41A_DASHBOARD_SNAPSHOT_IMMUTABLE");
  });

  it("resets current state without deleting history and can initialize a new version", () => {
    const first = initializeM41aRuntime(db, DEMO_CONTROL);
    const reset = resetM41aEvaluation(
      {
        role: "managing-director",
        actorId: "SYNTH-RUNTIME-TEST",
        occurredAt: "2026-10-14T12:30:00.000Z",
      },
      db,
    );
    expect(reset).toMatchObject({
      resetRunId: first.runId,
      historyPreserved: true,
      productionActionsBlocked: true,
    });
    expect(() =>
      getM41aDashboard("managing-director", "ENTERPRISE", db),
    ).toThrow("M41A_DASHBOARD_NOT_INITIALIZED");
    const second = initializeM41aRuntime(db);
    expect(second.runId).not.toBe(first.runId);
    expect(
      (
        db
          .prepare("SELECT COUNT(*) AS count FROM m41a_scenario_runs")
          .get() as {
          count: number;
        }
      ).count,
    ).toBe(2);
    expect(
      (
        db
          .prepare("SELECT COUNT(*) AS count FROM m41a_dashboard_snapshots")
          .get() as { count: number }
      ).count,
    ).toBe(10);
    expect(
      (
        db
          .prepare(
            "SELECT COUNT(*) AS count FROM m41a_decision_events WHERE event_type='evaluation_reset'",
          )
          .get() as { count: number }
      ).count,
    ).toBe(1);
    expect(
      (
        db
          .prepare(
            "SELECT COUNT(*) AS count FROM m41a_scenario_runs WHERE is_current=1",
          )
          .get() as { count: number }
      ).count,
    ).toBe(1);
  });

  it("refuses to initialize or persist outside the controlled demo runtime", () => {
    expect(() =>
      initializeM41aRuntime(db, {
        environment: DEVELOPMENT_ENVIRONMENT,
        asOf: DEMO_CONTROL.asOf,
      }),
    ).toThrow("Synthetic milestone scenarios require");
    const m41aTables = (
      db
        .prepare(
          "SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table' AND name LIKE 'm41a_%'",
        )
        .get() as { count: number }
    ).count;
    expect(m41aTables).toBe(0);
  });

  it("fails closed when the authoritative demo-control record is missing", () => {
    db.prepare("DELETE FROM phase3_demo_controls").run();
    expect(() => initializeM41aRuntime(db, DEMO_CONTROL)).toThrow(
      "PHASE3_DEMO_CONTROL_MISSING",
    );
    expect(
      (
        db
          .prepare(
            "SELECT COUNT(*) AS count FROM phase3_demo_controls WHERE environment_id='AMOS-OPS-PHASE3-EVALUATION'",
          )
          .get() as { count: number }
      ).count,
    ).toBe(0);
  });

  it("honors the inherited kill switch while retaining reset authority", () => {
    const run = initializeM41aRuntime(db, DEMO_CONTROL);
    db.prepare(
      "UPDATE phase3_demo_controls SET kill_switch_enabled=1 WHERE environment_id='AMOS-OPS-PHASE3-EVALUATION'",
    ).run();
    expect(() =>
      getM41aDashboard("managing-director", "ENTERPRISE", db),
    ).toThrow("PHASE3_DEMO_KILL_SWITCH_ACTIVE");
    expect(
      resetM41aEvaluation(
        {
          role: "managing-director",
          actorId: "SYNTH-RUNTIME-TEST",
          occurredAt: "2026-07-14T22:05:00.000Z",
        },
        db,
      ),
    ).toMatchObject({ resetRunId: run.runId, historyPreserved: true });
  });

  it("denies expired, stale-review, and production-write-enabled controls", () => {
    initializeM41aRuntime(db, DEMO_CONTROL);
    const readDashboard = () =>
      getM41aDashboard("managing-director", "ENTERPRISE", db);
    db.prepare(
      "UPDATE phase3_demo_controls SET data_expires_at='2026-07-14T21:59:59.000Z'",
    ).run();
    expect(readDashboard).toThrow("PHASE3_DEMO_DATA_EXPIRED");

    db.prepare(
      "UPDATE phase3_demo_controls SET data_expires_at='2027-01-14T00:00:00.000Z', access_reviewed_at='2026-01-01T00:00:00.000Z'",
    ).run();
    expect(readDashboard).toThrow("PHASE3_ACCESS_REVIEW_STALE");

    db.prepare(
      "UPDATE phase3_demo_controls SET access_reviewed_at='2026-07-14T13:00:00.000Z', production_writes_blocked=0",
    ).run();
    expect(readDashboard).toThrow("PHASE3_PRODUCTION_WRITE_BLOCK_DISABLED");
  });
});
