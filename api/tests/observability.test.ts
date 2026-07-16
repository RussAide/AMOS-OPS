import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import {
  createReadinessReport,
  createRequestTraceContext,
  createStructuredLogger,
  OperationalMonitor,
  redactLogValue,
  type StructuredLogRecord,
} from "../observability";

const databases: Database.Database[] = [];

function testDatabase(): Database.Database {
  const db = new Database(":memory:");
  databases.push(db);
  return db;
}

afterEach(() => {
  for (const db of databases.splice(0)) db.close();
});

describe("M1.1 structured logging and correlation", () => {
  it("preserves valid correlation and W3C trace IDs while creating a new span", () => {
    const headers = new Headers({
      "x-request-id": "request-123",
      "x-correlation-id": "case-456",
      traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
    });
    const context = createRequestTraceContext(headers);
    expect(context.requestId).toBe("request-123");
    expect(context.correlationId).toBe("case-456");
    expect(context.traceId).toBe("4bf92f3577b34da6a3ce929d0e0e4736");
    expect(context.traceparent).toMatch(
      /^00-4bf92f3577b34da6a3ce929d0e0e4736-[\da-f]{16}-01$/,
    );
  });

  it("rejects unsafe supplied identifiers and redacts nested secrets", () => {
    const context = createRequestTraceContext(
      new Headers({ "x-correlation-id": "unsafe value with spaces" }),
    );
    expect(context.correlationId).not.toBe("unsafe value with spaces");
    expect(
      redactLogValue({
        user: "synthetic-user",
        password: "never-log",
        nested: { authorization: "Bearer never-log", count: 2 },
      }),
    ).toEqual({
      user: "synthetic-user",
      password: "[REDACTED]",
      nested: { authorization: "[REDACTED]", count: 2 },
    });
  });

  it("emits one-line structured records without credential material", () => {
    const records: StructuredLogRecord[] = [];
    const logger = createStructuredLogger("test-service", (record) => records.push(record));
    logger.info("identity.test", {
      correlationId: "corr-1",
      details: { token: "secret-value", result: "ok" },
    });
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      level: "info",
      service: "test-service",
      event: "identity.test",
      correlationId: "corr-1",
      details: { token: "[REDACTED]", result: "ok" },
    });
    expect(JSON.stringify(records[0])).not.toContain("secret-value");
  });
});

describe("M1.1 durable local audit and alert capture", () => {
  it("persists redacted audit events and threshold alerts", () => {
    const db = testDatabase();
    const records: StructuredLogRecord[] = [];
    const logger = createStructuredLogger("test-service", (record) => records.push(record));
    const monitor = new OperationalMonitor(db, logger, 10);

    monitor.captureAuditEvent({
      eventType: "identity",
      action: "synthetic.login",
      actor: "synthetic-user@amos-ops.invalid",
      resource: "evaluation-session",
      outcome: "success",
      correlationId: "corr-audit",
      traceId: "trace-audit",
      details: { sessionToken: "never-store", division: "BHC" },
    });
    monitor.recordRequest({
      method: "POST",
      path: "/api/trpc/auth.login",
      status: 500,
      durationMs: 20,
      correlationId: "corr-alert",
      traceId: "trace-alert",
    });

    const audit = db
      .prepare("SELECT details_json AS detailsJson FROM operational_audit_events")
      .get() as { detailsJson: string };
    expect(audit.detailsJson).toContain("[REDACTED]");
    expect(audit.detailsJson).not.toContain("never-store");
    const alerts = db
      .prepare("SELECT code, status FROM operational_alerts ORDER BY code")
      .all() as Array<{ code: string; status: string }>;
    expect(alerts).toEqual([
      { code: "HTTP_5XX", status: "open" },
      { code: "HTTP_SLOW_REQUEST", status: "open" },
    ]);
    expect(monitor.snapshot()).toEqual({
      requests: 1,
      serverErrors: 1,
      slowRequests: 1,
      activeAlerts: 2,
    });
    expect(records.filter((record) => record.event === "operational.alert.emitted")).toHaveLength(2);
  });

  it("reports ready only after database and operational stores pass local checks", () => {
    const db = testDatabase();
    const logger = createStructuredLogger("test-service", () => undefined);
    const monitor = new OperationalMonitor(db, logger);
    const report = createReadinessReport(db, monitor, {
      version: "m1.1-test",
      environment: "synthetic-test",
    });
    expect(report).toMatchObject({
      status: "ready",
      ready: true,
      version: "m1.1-test",
      environment: "synthetic-test",
      checks: {
        database: { status: "ok" },
        auditStore: { status: "ok" },
        alertStore: { status: "ok" },
      },
    });
  });

  it("reports degraded readiness when demo startup continued after initialization failed", () => {
    const db = testDatabase();
    const logger = createStructuredLogger("test-service", () => undefined);
    const monitor = new OperationalMonitor(db, logger);
    const report = createReadinessReport(db, monitor, {
      environment: "demo",
      initializationError: new Error("synthetic initialization failure"),
    });
    expect(report).toMatchObject({
      status: "degraded",
      ready: false,
      environment: "demo",
      checks: {
        database: { status: "failed", detail: "database initialization failed" },
      },
    });
  });
});
