import { randomBytes, randomUUID } from "crypto";
import type Database from "better-sqlite3";

type DatabaseHandle = InstanceType<typeof Database>;
type LogLevel = "debug" | "info" | "warn" | "error";
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface StructuredLogRecord {
  timestamp: string;
  level: LogLevel;
  service: string;
  event: string;
  correlationId?: string;
  traceId?: string;
  details?: JsonValue;
}

export type StructuredLogSink = (record: StructuredLogRecord) => void;

export interface RequestTraceContext {
  requestId: string;
  correlationId: string;
  traceId: string;
  spanId: string;
  traceparent: string;
}

export interface OperationalAuditEvent {
  eventType: string;
  action: string;
  actor: string;
  resource?: string;
  outcome: "success" | "denied" | "failure";
  correlationId: string;
  traceId?: string;
  details?: unknown;
}

export interface OperationalAlert {
  code: string;
  severity: "warning" | "critical";
  message: string;
  correlationId?: string;
  details?: unknown;
}

export interface RequestObservation {
  method: string;
  path: string;
  status: number;
  durationMs: number;
  correlationId: string;
  traceId: string;
}

export interface OperationalSnapshot {
  requests: number;
  serverErrors: number;
  slowRequests: number;
  activeAlerts: number;
}

export interface ReadinessReport {
  status: "ready" | "degraded";
  ready: boolean;
  timestamp: string;
  service: string;
  version: string;
  environment: string;
  uptimeSeconds: number;
  checks: {
    database: { status: "ok" | "failed"; detail: string };
    encryption: { status: "ok" | "failed"; detail: string };
    auditStore: { status: "ok" | "failed"; detail: string };
    alertStore: { status: "ok" | "failed"; detail: string };
  };
  metrics: OperationalSnapshot;
}

const SENSITIVE_KEY = /password|passcode|secret|token|authorization|cookie|session|credential|private.?key/i;
const SAFE_IDENTIFIER = /^[A-Za-z0-9._:-]{1,128}$/;
const TRACEPARENT = /^[\da-f]{2}-([\da-f]{32})-([\da-f]{16})-([\da-f]{2})$/i;

function safeIdentifier(value: string | null | undefined): string | undefined {
  return value && SAFE_IDENTIFIER.test(value) ? value : undefined;
}

function randomHex(bytes: number): string {
  return randomBytes(bytes).toString("hex");
}

export function redactLogValue(value: unknown, key = ""): JsonValue {
  if (SENSITIVE_KEY.test(key)) return "[REDACTED]";
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (value instanceof Error) {
    return { name: value.name, message: value.message };
  }
  if (Array.isArray(value)) return value.map((item) => redactLogValue(item));
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([entryKey, entryValue]) => [
        entryKey,
        redactLogValue(entryValue, entryKey),
      ]),
    );
  }
  return String(value);
}

function defaultSink(record: StructuredLogRecord): void {
  const line = JSON.stringify(record);
  if (record.level === "error") console.error(line);
  else if (record.level === "warn") console.warn(line);
  else console.log(line);
}

export function createStructuredLogger(
  service = "amos-ops",
  sink: StructuredLogSink = defaultSink,
) {
  const write = (
    level: LogLevel,
    event: string,
    context: {
      correlationId?: string;
      traceId?: string;
      details?: unknown;
    } = {},
  ) => {
    sink({
      timestamp: new Date().toISOString(),
      level,
      service,
      event,
      correlationId: context.correlationId,
      traceId: context.traceId,
      details: context.details === undefined ? undefined : redactLogValue(context.details),
    });
  };
  return {
    debug: (event: string, context?: Parameters<typeof write>[2]) => write("debug", event, context),
    info: (event: string, context?: Parameters<typeof write>[2]) => write("info", event, context),
    warn: (event: string, context?: Parameters<typeof write>[2]) => write("warn", event, context),
    error: (event: string, context?: Parameters<typeof write>[2]) => write("error", event, context),
  };
}

export type StructuredLogger = ReturnType<typeof createStructuredLogger>;

export function createRequestTraceContext(headers: Headers): RequestTraceContext {
  const requestId = safeIdentifier(headers.get("x-request-id")) ?? randomUUID();
  const correlationId = safeIdentifier(headers.get("x-correlation-id")) ?? requestId;
  const suppliedTraceparent = headers.get("traceparent")?.trim();
  const traceMatch = suppliedTraceparent?.match(TRACEPARENT);
  const traceId = traceMatch?.[1]?.toLowerCase() ?? randomHex(16);
  const spanId = randomHex(8);
  return {
    requestId,
    correlationId,
    traceId,
    spanId,
    traceparent: `00-${traceId}-${spanId}-01`,
  };
}

export function initializeOperationalStores(db: DatabaseHandle): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS operational_audit_events (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      action TEXT NOT NULL,
      actor TEXT NOT NULL,
      resource TEXT,
      outcome TEXT NOT NULL,
      correlation_id TEXT NOT NULL,
      trace_id TEXT,
      details_json TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_operational_audit_correlation
      ON operational_audit_events (correlation_id);
    CREATE INDEX IF NOT EXISTS idx_operational_audit_created
      ON operational_audit_events (created_at);
    CREATE TABLE IF NOT EXISTS operational_alerts (
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
    CREATE INDEX IF NOT EXISTS idx_operational_alert_status
      ON operational_alerts (status, created_at);
  `);
}

export class OperationalMonitor {
  private requests = 0;
  private serverErrors = 0;
  private slowRequests = 0;

  constructor(
    private readonly db: DatabaseHandle,
    private readonly logger: StructuredLogger,
    private readonly slowRequestThresholdMs = 5_000,
  ) {
    initializeOperationalStores(db);
  }

  captureAuditEvent(event: OperationalAuditEvent): string {
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO operational_audit_events
         (id, event_type, action, actor, resource, outcome, correlation_id, trace_id, details_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        event.eventType,
        event.action,
        event.actor,
        event.resource ?? null,
        event.outcome,
        event.correlationId,
        event.traceId ?? null,
        event.details ? JSON.stringify(redactLogValue(event.details)) : null,
        new Date().toISOString(),
      );
    return id;
  }

  emitAlert(alert: OperationalAlert): string {
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO operational_alerts
         (id, code, severity, message, correlation_id, details_json, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'open', ?)`,
      )
      .run(
        id,
        alert.code,
        alert.severity,
        alert.message,
        alert.correlationId ?? null,
        alert.details ? JSON.stringify(redactLogValue(alert.details)) : null,
        new Date().toISOString(),
      );
    this.logger.warn("operational.alert.emitted", {
      correlationId: alert.correlationId,
      details: { alertId: id, ...alert },
    });
    return id;
  }

  recordRequest(observation: RequestObservation): void {
    this.requests += 1;
    if (observation.status >= 500) {
      this.serverErrors += 1;
      this.emitAlert({
        code: "HTTP_5XX",
        severity: "critical",
        message: "A server request failed",
        correlationId: observation.correlationId,
        details: observation,
      });
    }
    if (observation.durationMs >= this.slowRequestThresholdMs) {
      this.slowRequests += 1;
      this.emitAlert({
        code: "HTTP_SLOW_REQUEST",
        severity: "warning",
        message: "A request exceeded the local latency threshold",
        correlationId: observation.correlationId,
        details: observation,
      });
    }
  }

  snapshot(): OperationalSnapshot {
    const row = this.db
      .prepare("SELECT COUNT(*) AS count FROM operational_alerts WHERE status = 'open'")
      .get() as { count: number };
    return {
      requests: this.requests,
      serverErrors: this.serverErrors,
      slowRequests: this.slowRequests,
      activeAlerts: row.count,
    };
  }
}

function storeCheck(db: DatabaseHandle, tableName: string): { status: "ok" | "failed"; detail: string } {
  try {
    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(tableName) as { name: string } | undefined;
    return row?.name === tableName
      ? { status: "ok", detail: "available" }
      : { status: "failed", detail: "missing" };
  } catch (error) {
    return { status: "failed", detail: error instanceof Error ? error.message : "unavailable" };
  }
}

export function createReadinessReport(
  db: DatabaseHandle,
  monitor: OperationalMonitor,
  options: {
    version?: string;
    environment?: string;
    initializationError?: unknown;
    encryption?: { required: boolean; ready: boolean };
  } = {},
): ReadinessReport {
  let database: ReadinessReport["checks"]["database"];
  if (options.initializationError !== undefined) {
    database = {
      status: "failed",
      detail: "database initialization failed",
    };
  } else try {
    db.prepare("SELECT 1").get();
    const quickCheck = String(db.pragma("quick_check", { simple: true }));
    database = quickCheck === "ok"
      ? { status: "ok", detail: "reachable; quick_check=ok" }
      : { status: "failed", detail: `quick_check=${quickCheck}` };
  } catch (error) {
    database = {
      status: "failed",
      detail: error instanceof Error ? error.message : "unavailable",
    };
  }
  const auditStore = storeCheck(db, "operational_audit_events");
  const alertStore = storeCheck(db, "operational_alerts");
  const encryption = options.encryption?.required
    ? options.encryption.ready
      ? {
          status: "ok" as const,
          detail: "sqlcipher and authenticated file encryption active",
        }
      : {
          status: "failed" as const,
          detail: "required storage encryption is unavailable",
        }
    : { status: "ok" as const, detail: "not required in this environment" };
  const ready =
    database.status === "ok" &&
    encryption.status === "ok" &&
    auditStore.status === "ok" &&
    alertStore.status === "ok";
  return {
    status: ready ? "ready" : "degraded",
    ready,
    timestamp: new Date().toISOString(),
    service: "amos-ops-api",
    version: options.version ?? "1.0.0",
    environment: options.environment ?? process.env.NODE_ENV ?? "unknown",
    uptimeSeconds: Math.round(process.uptime()),
    checks: { database, encryption, auditStore, alertStore },
    metrics: monitor.snapshot(),
  };
}
