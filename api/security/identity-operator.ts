import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import type Database from "better-sqlite3";
import { env, type EnvironmentConfig } from "../lib/env";

const MAX_SKEW_MS = 5 * 60 * 1000;
const RECENT_LOGIN_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const DATABASE_IDENTITY_TABLES = [
  "users",
  "identity_sessions",
  "identity_login_attempts",
  "identity_mfa_challenges",
  "identity_password_reset_tokens",
  "identity_security_events",
  "identity_runtime_key_bindings",
  "identity_operator_operations",
] as const;

interface IdentityOperatorAccountRow {
  id: string;
  role: string;
  active: number;
  accessStatus: string;
  identityType: string;
  lockedUntil: string | null;
  mfaEnabled: number;
  mfaMethod: string;
  credentialVersion: number;
  authenticatorVersion: number;
  failedLoginCount: number;
  passwordChangedAt: string | null;
  mustChangePassword: number;
  lastLoginAt: string | null;
  passwordHash: string;
}

interface TimelineCountRow {
  category: string;
  count: number;
  firstAt: string | null;
  latestAt: string | null;
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function bodyDigest(body: string): string {
  return createHash("sha256").update(body).digest("hex");
}

export function operatorSignature(input: {
  secret: string;
  timestamp: string;
  operationId: string;
  method: string;
  path: string;
  body: string;
}): string {
  const canonical = [
    "v1",
    input.timestamp,
    input.operationId,
    input.method.toUpperCase(),
    input.path,
    bodyDigest(input.body),
  ].join("\n");
  return createHmac("sha256", input.secret).update(canonical).digest("hex");
}

export function verifyOperatorRequest(input: {
  secret: string;
  timestamp: string;
  operationId: string;
  signature: string;
  method: string;
  path: string;
  body: string;
  now?: Date;
}): boolean {
  const parsed = Date.parse(input.timestamp);
  if (
    !Number.isFinite(parsed) ||
    Math.abs((input.now ?? new Date()).getTime() - parsed) > MAX_SKEW_MS
  )
    return false;
  return safeEqual(operatorSignature(input), input.signature);
}

function bcryptMetadata(passwordHash: string) {
  const match = /^\$(2[aby])\$(\d{2})\$[./A-Za-z0-9]{53}$/.exec(passwordHash);
  return match
    ? {
        algorithm: "bcrypt" as const,
        validFormat: true,
        variant: match[1],
        cost: Number.parseInt(match[2], 10),
      }
    : {
        algorithm: "unknown" as const,
        validFormat: false,
        variant: null,
        cost: null,
      };
}

function runtimeKeyFingerprint(environment: EnvironmentConfig): string {
  return createHash("sha256")
    .update("AMOS-OPS identity key binding v1\0")
    .update(
      environment.appSecret ||
        environment.jwtSecret ||
        environment.environmentId,
    )
    .digest("hex");
}

function databaseIdentity(sqlite: Database.Database) {
  const schemaRows = sqlite
    .prepare(
      `SELECT type, name, tbl_name AS tableName, COALESCE(sql, '') AS sql
         FROM sqlite_master
        WHERE type IN ('table', 'index', 'trigger', 'view')
          AND name NOT LIKE 'sqlite_%'
        ORDER BY type, name`,
    )
    .all() as Array<{
    type: string;
    name: string;
    tableName: string;
    sql: string;
  }>;
  const tableNames = new Set(
    schemaRows.filter((row) => row.type === "table").map((row) => row.name),
  );
  const cardinalities = DATABASE_IDENTITY_TABLES.filter((name) =>
    tableNames.has(name),
  ).map((name) => ({
    table: name,
    rows: (
      sqlite.prepare(`SELECT COUNT(*) AS count FROM "${name}"`).get() as {
        count: number;
      }
    ).count,
  }));
  const pragmas = {
    applicationId: Number(sqlite.pragma("application_id", { simple: true })),
    schemaVersion: Number(sqlite.pragma("schema_version", { simple: true })),
    userVersion: Number(sqlite.pragma("user_version", { simple: true })),
    pageCount: Number(sqlite.pragma("page_count", { simple: true })),
  };
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        format: "amos-ops-database-identity-v1",
        pragmas,
        schemaRows,
        cardinalities,
      }),
    )
    .digest("hex");
  const missingRequiredTables = DATABASE_IDENTITY_TABLES.filter(
    (name) => !tableNames.has(name),
  );
  return {
    report: {
      engine: "sqlite" as const,
      fingerprint,
      fingerprintBasis: "schema-and-cardinality-v1" as const,
      ...pragmas,
      requiredIdentityTablesPresent: missingRequiredTables.length === 0,
      missingRequiredTables,
    },
    tableNames,
  };
}

function total(rows: TimelineCountRow[]): number {
  return rows.reduce((sum, row) => sum + row.count, 0);
}

export function createIdentityOperator(
  sqlite: Database.Database,
  environment: EnvironmentConfig = env,
  now: () => Date = () => new Date(),
) {
  const account = () =>
    sqlite
      .prepare(
        `SELECT id, role, password_hash AS passwordHash,
            is_active AS active, access_status AS accessStatus,
            identity_type AS identityType, locked_until AS lockedUntil,
            mfa_enabled AS mfaEnabled, mfa_method AS mfaMethod,
            credential_version AS credentialVersion,
            authenticator_version AS authenticatorVersion,
            failed_login_count AS failedLoginCount,
            password_changed_at AS passwordChangedAt,
            must_change_password AS mustChangePassword,
            last_login_at AS lastLoginAt
       FROM users WHERE lower(email) = lower(?)`,
      )
      .get(environment.initialAdminEmail) as
      IdentityOperatorAccountRow | undefined;

  const diagnose = () => {
    const instant = now();
    const database = databaseIdentity(sqlite);
    if (!database.tableNames.has("users")) {
      return {
        diagnosisVersion: "privacy-safe-v2",
        generatedAt: instant.toISOString(),
        exists: false,
        environmentId: environment.environmentId,
        database: database.report,
        keyBinding: { present: false, matchesCurrentRuntime: null },
      };
    }
    const user = account();
    const keyBinding = database.tableNames.has("identity_runtime_key_bindings")
      ? (sqlite
          .prepare(
            `SELECT key_fingerprint AS keyFingerprint
               FROM identity_runtime_key_bindings
              WHERE environment_id = ?`,
          )
          .get(environment.environmentId) as
          { keyFingerprint: string } | undefined)
      : undefined;
    const safeKeyBinding = {
      present: Boolean(keyBinding),
      matchesCurrentRuntime: keyBinding
        ? safeEqual(
            keyBinding.keyFingerprint,
            runtimeKeyFingerprint(environment),
          )
        : null,
    };
    if (!user) {
      return {
        diagnosisVersion: "privacy-safe-v2",
        generatedAt: instant.toISOString(),
        exists: false,
        environmentId: environment.environmentId,
        database: database.report,
        keyBinding: safeKeyBinding,
      };
    }

    const recentWindowStart = new Date(
      instant.getTime() - RECENT_LOGIN_WINDOW_MS,
    ).toISOString();
    const sessions = sqlite
      .prepare(
        `SELECT COUNT(*) AS count FROM identity_sessions WHERE user_id = ?
        AND revoked_at IS NULL AND idle_expires_at > ? AND absolute_expires_at > ?`,
      )
      .get(user.id, instant.toISOString(), instant.toISOString()) as {
      count: number;
    };
    const recentOutcomes = sqlite
      .prepare(
        `SELECT CASE
                  WHEN outcome IN ('invalid_credentials', 'locked_after_failures')
                    THEN 'credential_rejected'
                  WHEN outcome = 'account_locked' THEN 'account_locked'
                  WHEN outcome = 'password_change_required' THEN 'password_change_required'
                  WHEN outcome = 'password_verified' THEN 'password_verified'
                  WHEN outcome = 'mfa_verified' THEN 'mfa_verified'
                  WHEN outcome = 'registered' THEN 'account_registered'
                  ELSE 'other'
                END AS category,
                COUNT(*) AS count,
                MIN(attempted_at) AS firstAt,
                MAX(attempted_at) AS latestAt
           FROM identity_login_attempts
          WHERE (user_id = ? OR normalized_email = lower(?))
            AND attempted_at >= ?
          GROUP BY category
          ORDER BY category`,
      )
      .all(
        user.id,
        environment.initialAdminEmail,
        recentWindowStart,
      ) as TimelineCountRow[];
    const revocations = sqlite
      .prepare(
        `SELECT CASE
                  WHEN revoke_reason IN ('password_reset', 'password_changed')
                    THEN 'credential_rotation'
                  WHEN revoke_reason = 'administrator_account_recovery'
                    THEN 'administrator_recovery'
                  WHEN revoke_reason = 'expired' THEN 'expiry'
                  WHEN revoke_reason = 'logout' THEN 'logout'
                  WHEN revoke_reason IN (
                    'account_disabled', 'account_deactivated', 'role_changed',
                    'access_profile_changed', 'access_review_revoked'
                  ) THEN 'access_change'
                  ELSE 'other'
                END AS category,
                COUNT(*) AS count,
                MIN(revoked_at) AS firstAt,
                MAX(revoked_at) AS latestAt
           FROM identity_sessions
          WHERE user_id = ? AND revoked_at IS NOT NULL
          GROUP BY category
          ORDER BY category`,
      )
      .all(user.id) as TimelineCountRow[];
    const resetRows = sqlite
      .prepare(
        `SELECT CASE
                  WHEN requested_ip = 'controlled-operator-recovery'
                    THEN 'controlled_operator'
                  WHEN requested_ip = 'controlled-initial-admin-recovery'
                    THEN 'controlled_initial_administrator'
                  WHEN requested_ip = 'admin-account-recovery'
                    THEN 'administrator'
                  WHEN requested_ip = 'admin-invitation' THEN 'invitation'
                  ELSE 'self_service_or_legacy'
                END AS category,
                COUNT(*) AS count,
                MIN(created_at) AS firstAt,
                MAX(created_at) AS latestAt,
                SUM(CASE WHEN consumed_at IS NOT NULL THEN 1 ELSE 0 END) AS consumedCount,
                SUM(CASE WHEN consumed_at IS NULL AND expires_at <= ? THEN 1 ELSE 0 END) AS expiredCount,
                SUM(CASE WHEN consumed_at IS NULL AND expires_at > ? THEN 1 ELSE 0 END) AS pendingCount,
                MAX(consumed_at) AS latestConsumedAt,
                MAX(expires_at) AS latestExpiresAt
           FROM identity_password_reset_tokens
          WHERE user_id = ?
          GROUP BY category
          ORDER BY category`,
      )
      .all(instant.toISOString(), instant.toISOString(), user.id) as Array<
      TimelineCountRow & {
        consumedCount: number;
        expiredCount: number;
        pendingCount: number;
        latestConsumedAt: string | null;
        latestExpiresAt: string | null;
      }
    >;
    const securityEvents = sqlite
      .prepare(
        `SELECT CASE
                  WHEN event_type = 'password_reset_completed' THEN 'password_reset'
                  WHEN event_type = 'administrator_account_recovery_issued'
                    THEN 'administrator_recovery'
                  WHEN event_type = 'administrator_account_unlocked'
                    THEN 'account_unlock'
                  ELSE 'other_security'
                END AS category,
                COUNT(*) AS count,
                MIN(occurred_at) AS firstAt,
                MAX(occurred_at) AS latestAt
           FROM identity_security_events
          WHERE user_id = ?
          GROUP BY category
          ORDER BY category`,
      )
      .all(user.id) as TimelineCountRow[];
    const operatorOperations = sqlite
      .prepare(
        `SELECT CASE
                  WHEN operation_type = 'activate-administrator-recovery'
                    THEN 'recovery_activation'
                  ELSE 'other_operator'
                END AS category,
                CASE
                  WHEN outcome IN ('activated', 'completed', 'succeeded')
                    THEN 'succeeded'
                  WHEN outcome IN ('failed', 'rejected') THEN 'failed'
                  ELSE 'other'
                END AS outcomeCategory,
                COUNT(*) AS count,
                MIN(requested_at) AS firstAt,
                MAX(completed_at) AS latestAt
           FROM identity_operator_operations
          WHERE target_user_id = ?
          GROUP BY category, outcomeCategory
          ORDER BY category, outcomeCategory`,
      )
      .all(user.id) as Array<TimelineCountRow & { outcomeCategory: string }>;
    return {
      diagnosisVersion: "privacy-safe-v2",
      generatedAt: instant.toISOString(),
      exists: true,
      environmentId: environment.environmentId,
      role: user.role,
      active: user.active === 1,
      accessStatus: user.accessStatus,
      identityType: user.identityType,
      locked: Boolean(
        user.lockedUntil && Date.parse(user.lockedUntil) > instant.getTime(),
      ),
      failedLoginCount: user.failedLoginCount,
      passwordChangedAt: user.passwordChangedAt,
      mustChangePassword: user.mustChangePassword === 1,
      lastLoginAt: user.lastLoginAt,
      mfaEnabled: user.mfaEnabled === 1,
      mfaMethod: user.mfaMethod,
      credentialVersion: user.credentialVersion,
      authenticatorVersion: user.authenticatorVersion,
      passwordCredentialMetadata: bcryptMetadata(user.passwordHash),
      activeSessions: sessions.count,
      loginOutcomes: {
        windowStart: recentWindowStart,
        count: total(recentOutcomes),
        categories: recentOutcomes,
      },
      sessionRevocations: {
        count: total(revocations),
        latestAt:
          revocations
            .map((row) => row.latestAt)
            .filter((value): value is string => Boolean(value))
            .sort()
            .at(-1) ?? null,
        reasonCategories: revocations,
      },
      chronology: {
        passwordResets: {
          count: resetRows.reduce((sum, row) => sum + row.count, 0),
          consumedCount: resetRows.reduce(
            (sum, row) => sum + row.consumedCount,
            0,
          ),
          expiredCount: resetRows.reduce(
            (sum, row) => sum + row.expiredCount,
            0,
          ),
          pendingCount: resetRows.reduce(
            (sum, row) => sum + row.pendingCount,
            0,
          ),
          sourceCategories: resetRows,
        },
        securityEvents: {
          count: total(securityEvents),
          categories: securityEvents,
        },
        operatorOperations: {
          count: operatorOperations.reduce((sum, row) => sum + row.count, 0),
          categories: operatorOperations,
        },
      },
      database: database.report,
      keyBinding: safeKeyBinding,
    };
  };

  const activateRecovery = (input: {
    operationId: string;
    tokenHash: string;
    expiresAt: string;
  }) => {
    const existing = sqlite
      .prepare("SELECT outcome FROM identity_operator_operations WHERE id = ?")
      .get(input.operationId);
    if (existing) return { status: "already_activated" as const };
    const user = account();
    if (
      !user ||
      user.active !== 1 ||
      user.role !== "super-admin" ||
      user.accessStatus !== "cleared" ||
      user.identityType !== "workforce"
    )
      throw new Error("RECOVERY_TARGET_INVALID");
    const expiry = Date.parse(input.expiresAt);
    const instant = now();
    if (
      !/^[a-f0-9]{64}$/.test(input.tokenHash) ||
      !Number.isFinite(expiry) ||
      expiry <= instant.getTime() ||
      expiry > instant.getTime() + 60 * 60 * 1000
    )
      throw new Error("RECOVERY_REQUEST_INVALID");
    sqlite.transaction(() => {
      sqlite
        .prepare(
          "UPDATE identity_password_reset_tokens SET consumed_at = ? WHERE user_id = ? AND consumed_at IS NULL",
        )
        .run(instant.toISOString(), user.id);
      sqlite
        .prepare(
          `INSERT INTO identity_password_reset_tokens (id,user_id,token_hash,created_at,expires_at,requested_ip) VALUES (?,?,?,?,?,'controlled-operator-recovery')`,
        )
        .run(
          randomUUID(),
          user.id,
          input.tokenHash,
          instant.toISOString(),
          input.expiresAt,
        );
      sqlite
        .prepare(
          `INSERT INTO identity_operator_operations (id,operation_type,target_user_id,outcome,requested_at,completed_at,details) VALUES (?,'activate-administrator-recovery',?,'activated',?,?,?)`,
        )
        .run(
          input.operationId,
          user.id,
          instant.toISOString(),
          instant.toISOString(),
          JSON.stringify({ expiresAt: input.expiresAt }),
        );
    })();
    return { status: "activated" as const, expiresAt: input.expiresAt };
  };
  return { diagnose, activateRecovery };
}
