import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import {
  diagnoseOperationalAlerts,
  OperationalAlertReconciliationError,
  reconcileOperationalAlerts,
} from "./operational-alert-operator";

const databases: Database.Database[] = [];

function fixture(): Database.Database {
  const sqlite = new Database(":memory:");
  databases.push(sqlite);
  sqlite.exec(`
    CREATE TABLE operational_alerts (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      severity TEXT NOT NULL,
      message TEXT NOT NULL,
      correlation_id TEXT,
      details_json TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL,
      resolved_at TEXT
    );
  `);
  return sqlite;
}

function insertAlert(
  sqlite: Database.Database,
  alert: {
    id: string;
    code: string;
    severity: string;
    createdAt: string;
    status?: "open" | "resolved";
    resolvedAt?: string;
    privateMarker?: string;
  },
): void {
  const privateMarker = alert.privateMarker ?? `private-${alert.id}`;
  sqlite
    .prepare(
      `INSERT INTO operational_alerts
       (id, code, severity, message, correlation_id, details_json, status, created_at, resolved_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      alert.id,
      alert.code,
      alert.severity,
      `message-${privateMarker}`,
      `correlation-${privateMarker}`,
      JSON.stringify({
        requestPath: `/private/${privateMarker}`,
        ip: "192.0.2.44",
        identity: `person-${privateMarker}`,
        secret: `secret-${privateMarker}`,
      }),
      alert.status ?? "open",
      alert.createdAt,
      alert.resolvedAt ?? null,
    );
}

function snapshot(sqlite: Database.Database): unknown[] {
  return sqlite.prepare("SELECT * FROM operational_alerts ORDER BY id").all();
}

afterEach(() => {
  for (const sqlite of databases.splice(0)) sqlite.close();
});

describe("operational alert diagnosis", () => {
  it("aggregates open alerts by code and severity without exposing private fields", () => {
    const sqlite = fixture();
    insertAlert(sqlite, {
      id: "alert-a",
      code: "HTTP_5XX",
      severity: "critical",
      createdAt: "2026-07-18T10:00:00.000Z",
      privateMarker: "alpha-private-value",
    });
    insertAlert(sqlite, {
      id: "alert-b",
      code: "HTTP_5XX",
      severity: "critical",
      createdAt: "2026-07-18T10:05:00.000Z",
      privateMarker: "beta-private-value",
    });
    insertAlert(sqlite, {
      id: "alert-c",
      code: "HTTP_SLOW_REQUEST",
      severity: "warning",
      createdAt: "2026-07-18T10:03:00.000Z",
      privateMarker: "gamma-private-value",
    });
    insertAlert(sqlite, {
      id: "alert-resolved",
      code: "HTTP_5XX",
      severity: "critical",
      createdAt: "2026-07-17T10:00:00.000Z",
      status: "resolved",
      resolvedAt: "2026-07-17T11:00:00.000Z",
    });

    const report = diagnoseOperationalAlerts(sqlite);

    expect(report).toEqual({
      diagnosisVersion: "privacy-safe-v1",
      scope: "open",
      fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      fingerprintBasis: "open-alert-set-v1",
      openAlertCount: 3,
      groups: [
        {
          code: "HTTP_5XX",
          severity: "critical",
          count: 2,
          firstCreatedAt: "2026-07-18T10:00:00.000Z",
          latestCreatedAt: "2026-07-18T10:05:00.000Z",
        },
        {
          code: "HTTP_SLOW_REQUEST",
          severity: "warning",
          count: 1,
          firstCreatedAt: "2026-07-18T10:03:00.000Z",
          latestCreatedAt: "2026-07-18T10:03:00.000Z",
        },
      ],
    });

    const serialized = JSON.stringify(report);
    for (const forbidden of [
      "alert-a",
      "alert-b",
      "alert-c",
      "alpha-private-value",
      "beta-private-value",
      "gamma-private-value",
      "192.0.2.44",
      "requestPath",
      "identity",
      "secret",
      "correlation",
      "message",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("performs no writes and succeeds while SQLite query_only is enabled", () => {
    const sqlite = fixture();
    insertAlert(sqlite, {
      id: "alert-query-only",
      code: "HTTP_5XX",
      severity: "critical",
      createdAt: "2026-07-18T10:00:00.000Z",
    });
    const before = snapshot(sqlite);
    sqlite.pragma("query_only = ON");

    const report = diagnoseOperationalAlerts(sqlite);
    const after = snapshot(sqlite);

    expect(report.openAlertCount).toBe(1);
    expect(after).toEqual(before);
    sqlite.pragma("query_only = OFF");
  });
});

describe("operational alert reconciliation", () => {
  it("rejects invalid cutoffs and an inexact diagnosis fingerprint without writing", () => {
    const sqlite = fixture();
    insertAlert(sqlite, {
      id: "alert-old",
      code: "HTTP_5XX",
      severity: "critical",
      createdAt: "2026-07-18T10:00:00.000Z",
    });
    const before = snapshot(sqlite);

    expect(() =>
      reconcileOperationalAlerts(sqlite, {
        cutoff: "not-an-iso-timestamp",
        diagnosisFingerprint: diagnoseOperationalAlerts(sqlite).fingerprint,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<OperationalAlertReconciliationError>>({
        code: "INVALID_CUTOFF",
      }),
    );
    expect(() =>
      reconcileOperationalAlerts(sqlite, {
        cutoff: "2026-07-18T10:05:00.000Z",
        diagnosisFingerprint: "0".repeat(64),
      }),
    ).toThrowError(
      expect.objectContaining<Partial<OperationalAlertReconciliationError>>({
        code: "FINGERPRINT_MISMATCH",
      }),
    );
    expect(snapshot(sqlite)).toEqual(before);
  });

  it("resolves only open alerts strictly older than the cutoff and is idempotent", () => {
    const sqlite = fixture();
    insertAlert(sqlite, {
      id: "alert-old",
      code: "HTTP_5XX",
      severity: "critical",
      createdAt: "2026-07-18T09:59:59.999Z",
    });
    insertAlert(sqlite, {
      id: "alert-boundary",
      code: "HTTP_5XX",
      severity: "critical",
      createdAt: "2026-07-18T10:00:00.000Z",
    });
    insertAlert(sqlite, {
      id: "alert-new",
      code: "HTTP_SLOW_REQUEST",
      severity: "warning",
      createdAt: "2026-07-18T10:00:00.001Z",
    });
    insertAlert(sqlite, {
      id: "alert-already-resolved",
      code: "HTTP_5XX",
      severity: "critical",
      createdAt: "2026-07-17T10:00:00.000Z",
      status: "resolved",
      resolvedAt: "2026-07-17T11:00:00.000Z",
    });
    const cutoff = "2026-07-18T10:00:00.000Z";
    const resolvedAt = new Date("2026-07-20T12:00:00.000Z");
    const reviewed = diagnoseOperationalAlerts(sqlite);

    const result = reconcileOperationalAlerts(
      sqlite,
      { cutoff, diagnosisFingerprint: reviewed.fingerprint },
      () => resolvedAt,
    );

    expect(result).toEqual({
      reconciliationVersion: "bounded-v1",
      cutoff,
      diagnosisFingerprint: reviewed.fingerprint,
      resolvedAt: resolvedAt.toISOString(),
      resolvedCount: 1,
      remainingOpenCount: 2,
    });
    expect(
      sqlite
        .prepare(
          "SELECT id, status, resolved_at AS resolvedAt FROM operational_alerts ORDER BY id",
        )
        .all(),
    ).toEqual([
      {
        id: "alert-already-resolved",
        status: "resolved",
        resolvedAt: "2026-07-17T11:00:00.000Z",
      },
      { id: "alert-boundary", status: "open", resolvedAt: null },
      { id: "alert-new", status: "open", resolvedAt: null },
      {
        id: "alert-old",
        status: "resolved",
        resolvedAt: "2026-07-20T12:00:00.000Z",
      },
    ]);
    expect(
      sqlite.prepare("SELECT COUNT(*) AS count FROM operational_alerts").get(),
    ).toEqual({ count: 4 });

    expect(() =>
      reconcileOperationalAlerts(
        sqlite,
        { cutoff, diagnosisFingerprint: reviewed.fingerprint },
        () => resolvedAt,
      ),
    ).toThrowError(
      expect.objectContaining<Partial<OperationalAlertReconciliationError>>({
        code: "FINGERPRINT_MISMATCH",
      }),
    );

    const current = diagnoseOperationalAlerts(sqlite);
    const retry = reconcileOperationalAlerts(
      sqlite,
      { cutoff, diagnosisFingerprint: current.fingerprint },
      () => resolvedAt,
    );
    expect(retry.resolvedCount).toBe(0);
    expect(retry.remainingOpenCount).toBe(2);
  });
});
