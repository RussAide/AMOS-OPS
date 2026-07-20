import { createHash } from "node:crypto";
import type Database from "better-sqlite3";

const DIAGNOSIS_VERSION = "privacy-safe-v1" as const;
const FINGERPRINT_BASIS = "open-alert-set-v1" as const;
const ISO_TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

interface OpenAlertRow {
  id: string;
  code: string;
  severity: string;
  createdAt: string;
}

export interface OperationalAlertDiagnosisGroup {
  code: string;
  severity: string;
  count: number;
  firstCreatedAt: string;
  latestCreatedAt: string;
}

export interface OperationalAlertDiagnosis {
  diagnosisVersion: typeof DIAGNOSIS_VERSION;
  scope: "open";
  fingerprint: string;
  fingerprintBasis: typeof FINGERPRINT_BASIS;
  openAlertCount: number;
  groups: OperationalAlertDiagnosisGroup[];
}

export type OperationalAlertReconciliationErrorCode =
  "INVALID_CUTOFF" | "FINGERPRINT_MISMATCH";

export class OperationalAlertReconciliationError extends Error {
  constructor(
    readonly code: OperationalAlertReconciliationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "OperationalAlertReconciliationError";
  }
}

function openAlerts(sqlite: Database.Database): OpenAlertRow[] {
  return sqlite
    .prepare(
      `SELECT id, code, severity, created_at AS createdAt
         FROM operational_alerts
        WHERE status = 'open'
        ORDER BY id`,
    )
    .all() as OpenAlertRow[];
}

function fingerprint(rows: OpenAlertRow[]): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        basis: FINGERPRINT_BASIS,
        alerts: rows.map(({ id, code, severity, createdAt }) => ({
          id,
          code,
          severity,
          createdAt,
        })),
      }),
    )
    .digest("hex");
}

function diagnosisFrom(rows: OpenAlertRow[]): OperationalAlertDiagnosis {
  const groups = new Map<string, OperationalAlertDiagnosisGroup>();
  for (const row of rows) {
    const key = JSON.stringify([row.code, row.severity]);
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      if (row.createdAt < existing.firstCreatedAt)
        existing.firstCreatedAt = row.createdAt;
      if (row.createdAt > existing.latestCreatedAt)
        existing.latestCreatedAt = row.createdAt;
      continue;
    }
    groups.set(key, {
      code: row.code,
      severity: row.severity,
      count: 1,
      firstCreatedAt: row.createdAt,
      latestCreatedAt: row.createdAt,
    });
  }

  return {
    diagnosisVersion: DIAGNOSIS_VERSION,
    scope: "open",
    fingerprint: fingerprint(rows),
    fingerprintBasis: FINGERPRINT_BASIS,
    openAlertCount: rows.length,
    groups: [...groups.values()].sort(
      (left, right) =>
        left.code.localeCompare(right.code) ||
        left.severity.localeCompare(right.severity),
    ),
  };
}

/**
 * Returns a privacy-safe, SELECT-only summary of the exact current open-alert set.
 * Alert identifiers are used only inside the one-way state fingerprint and are
 * never returned to the caller.
 */
export function diagnoseOperationalAlerts(
  sqlite: Database.Database,
): OperationalAlertDiagnosis {
  return diagnosisFrom(openAlerts(sqlite));
}

function canonicalCutoff(value: string): string {
  if (!ISO_TIMESTAMP.test(value)) {
    throw new OperationalAlertReconciliationError(
      "INVALID_CUTOFF",
      "The reconciliation cutoff must be an ISO-8601 timestamp with a timezone",
    );
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new OperationalAlertReconciliationError(
      "INVALID_CUTOFF",
      "The reconciliation cutoff must be a valid ISO-8601 timestamp",
    );
  }
  return new Date(parsed).toISOString();
}

function validFingerprint(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}

export interface OperationalAlertReconciliationInput {
  cutoff: string;
  diagnosisFingerprint: string;
}

export interface OperationalAlertReconciliationResult {
  reconciliationVersion: "bounded-v1";
  cutoff: string;
  diagnosisFingerprint: string;
  resolvedAt: string;
  resolvedCount: number;
  remainingOpenCount: number;
}

/**
 * Resolves, but never deletes, open alerts strictly older than the cutoff. The
 * mutation is admitted only when the caller proves it reviewed the exact open
 * alert set that still exists at the start of the immediate transaction.
 */
export function reconcileOperationalAlerts(
  sqlite: Database.Database,
  input: OperationalAlertReconciliationInput,
  now: () => Date = () => new Date(),
): OperationalAlertReconciliationResult {
  const cutoff = canonicalCutoff(input.cutoff);

  const reconcile = sqlite.transaction(() => {
    const current = diagnosisFrom(openAlerts(sqlite));
    if (
      !validFingerprint(input.diagnosisFingerprint) ||
      current.fingerprint !== input.diagnosisFingerprint
    ) {
      throw new OperationalAlertReconciliationError(
        "FINGERPRINT_MISMATCH",
        "The open-alert set changed after diagnosis; obtain a new diagnosis before reconciling",
      );
    }

    const resolvedAt = now().toISOString();
    const update = sqlite
      .prepare(
        `UPDATE operational_alerts
            SET status = 'resolved', resolved_at = ?
          WHERE status = 'open'
            AND julianday(created_at) < julianday(?)`,
      )
      .run(resolvedAt, cutoff);
    const remaining = sqlite
      .prepare(
        "SELECT COUNT(*) AS count FROM operational_alerts WHERE status = 'open'",
      )
      .get() as { count: number };

    return {
      reconciliationVersion: "bounded-v1" as const,
      cutoff,
      diagnosisFingerprint: input.diagnosisFingerprint,
      resolvedAt,
      resolvedCount: update.changes,
      remainingOpenCount: remaining.count,
    };
  });

  return reconcile.immediate();
}
