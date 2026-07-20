import bcrypt from "bcryptjs";
import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { buildEnvironmentConfig } from "../lib/env";
import { ensureIdentitySchema } from "./identity-schema";
import {
  createIdentityOperator,
  operatorSignature,
  verifyOperatorRequest,
} from "./identity-operator";

// Every identity, credential, address, and device value in this file is a
// generated test fixture. None is sourced from a person or Production system.
const openDatabases: Database.Database[] = [];

afterEach(() => {
  for (const sqlite of openDatabases.splice(0)) sqlite.close();
});

function snapshotTables(sqlite: Database.Database): unknown {
  const tables = sqlite
    .prepare(
      `SELECT name FROM sqlite_master
        WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name`,
    )
    .all() as Array<{ name: string }>;
  return tables.map(({ name }) => ({
    name,
    rows: sqlite
      .prepare(`SELECT * FROM "${name.replaceAll('"', '""')}" ORDER BY rowid`)
      .all(),
  }));
}

describe("protected identity operator request", () => {
  const timestamp = "2026-07-19T17:00:00.000Z";
  const input = {
    secret: `not-a-secret-test-fixture-operator-${"s".repeat(32)}`,
    timestamp,
    operationId: "operation-123",
    method: "POST",
    path: "/api/operator/identity/recovery",
    body: '{"operationId":"operation-123"}',
  };

  it("accepts only the exact signed request inside the replay window", () => {
    const signature = operatorSignature(input);
    expect(
      verifyOperatorRequest({ ...input, signature, now: new Date(timestamp) }),
    ).toBe(true);
    expect(
      verifyOperatorRequest({
        ...input,
        signature,
        body: "{}",
        now: new Date(timestamp),
      }),
    ).toBe(false);
    expect(
      verifyOperatorRequest({
        ...input,
        signature,
        operationId: "replayed",
        now: new Date(timestamp),
      }),
    ).toBe(false);
    expect(
      verifyOperatorRequest({
        ...input,
        signature,
        now: new Date("2026-07-19T17:06:00.000Z"),
      }),
    ).toBe(false);
  });
});

describe("privacy-safe identity diagnosis", () => {
  const instant = new Date("2026-07-20T12:00:00.000Z");
  const adminId = "SYNTH-IDENTITY-DIAGNOSIS-ADMIN";
  const adminEmail = "diagnosis.admin@amos-ops.invalid";
  const rawIp = "192.0.2.91";
  const rawUserAgent = "AMOS-Synthetic-Browser/1.0 test-fixture";
  const rawTokenHash = createHash("sha256")
    .update("synthetic-identity-diagnosis-token-fixture")
    .digest("hex");
  const appSecret = `not-a-secret-test-fixture-identity-${"x".repeat(32)}`;

  function fixture() {
    const sqlite = new Database(":memory:");
    openDatabases.push(sqlite);
    ensureIdentitySchema(sqlite);
    const environment = {
      ...buildEnvironmentConfig({
        APP_ENV: "demo",
        NODE_ENV: "test",
        AMOS_RUNTIME_MODE: "demo",
        AMOS_ENVIRONMENT_ID: "amos-ops-demo-identity-diagnosis",
      }),
      initialAdminEmail: adminEmail,
      appSecret,
      jwtSecret: `not-a-secret-test-fixture-jwt-${"y".repeat(32)}`,
    };
    const passwordHash = bcrypt.hashSync("Synthetic!Diagnosis2026", 7);
    sqlite
      .prepare(
        `INSERT INTO users (
           id, email, password_hash, first_name, last_name, role, department,
           is_active, failed_login_count, locked_until, password_changed_at,
           must_change_password, mfa_enabled, mfa_method, last_login_at,
           access_status, identity_type, credential_version,
           authenticator_version, created_at, updated_at
         ) VALUES (?, ?, ?, 'Synthetic', 'Administrator', 'super-admin',
           'Executive Office', 1, 2, NULL, ?, 0, 1, 'totp', ?, 'cleared',
           'workforce', 4, 3, ?, ?)`,
      )
      .run(
        adminId,
        adminEmail,
        passwordHash,
        "2026-07-19T16:20:00.000Z",
        "2026-07-19T16:27:00.000Z",
        "2026-07-18T12:00:00.000Z",
        "2026-07-19T16:27:00.000Z",
      );

    const insertAttempt = sqlite.prepare(
      `INSERT INTO identity_login_attempts
         (id, user_id, normalized_email, successful, outcome, attempted_at,
          ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    insertAttempt.run(
      "attempt-1",
      adminId,
      adminEmail,
      0,
      "invalid_credentials",
      "2026-07-19T16:30:00.000Z",
      rawIp,
      rawUserAgent,
    );
    insertAttempt.run(
      "attempt-2",
      adminId,
      adminEmail,
      0,
      "locked_after_failures",
      "2026-07-19T16:31:00.000Z",
      rawIp,
      rawUserAgent,
    );
    insertAttempt.run(
      "attempt-3",
      adminId,
      adminEmail,
      1,
      "password_verified",
      "2026-07-19T16:26:00.000Z",
      rawIp,
      rawUserAgent,
    );
    insertAttempt.run(
      "attempt-old",
      adminId,
      adminEmail,
      0,
      "invalid_credentials",
      "2026-01-01T00:00:00.000Z",
      rawIp,
      rawUserAgent,
    );

    const insertSession = sqlite.prepare(
      `INSERT INTO identity_sessions
         (id, user_id, token_hash, environment_id, authenticated_at,
          last_seen_at, idle_expires_at, absolute_expires_at, revoked_at,
          revoke_reason, mfa_verified, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    );
    insertSession.run(
      "session-active",
      adminId,
      "b".repeat(64),
      environment.environmentId,
      "2026-07-20T11:45:00.000Z",
      "2026-07-20T11:50:00.000Z",
      "2026-07-20T12:30:00.000Z",
      "2026-07-20T20:00:00.000Z",
      null,
      null,
      rawIp,
      rawUserAgent,
    );
    insertSession.run(
      "session-reset",
      adminId,
      "c".repeat(64),
      environment.environmentId,
      "2026-07-19T15:00:00.000Z",
      "2026-07-19T15:30:00.000Z",
      "2026-07-19T16:00:00.000Z",
      "2026-07-19T23:00:00.000Z",
      "2026-07-19T16:20:00.000Z",
      "password_reset",
      rawIp,
      rawUserAgent,
    );
    insertSession.run(
      "session-recovery",
      adminId,
      "d".repeat(64),
      environment.environmentId,
      "2026-07-18T12:00:00.000Z",
      "2026-07-18T12:30:00.000Z",
      "2026-07-18T13:00:00.000Z",
      "2026-07-18T20:00:00.000Z",
      "2026-07-19T16:10:00.000Z",
      "administrator_account_recovery",
      rawIp,
      rawUserAgent,
    );

    const insertReset = sqlite.prepare(
      `INSERT INTO identity_password_reset_tokens
         (id, user_id, token_hash, created_at, expires_at, consumed_at,
          requested_ip)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    insertReset.run(
      "reset-operator",
      adminId,
      rawTokenHash,
      "2026-07-19T16:10:00.000Z",
      "2026-07-19T16:55:00.000Z",
      "2026-07-19T16:20:00.000Z",
      "controlled-operator-recovery",
    );
    insertReset.run(
      "reset-expired",
      adminId,
      "e".repeat(64),
      "2026-07-18T12:00:00.000Z",
      "2026-07-18T12:45:00.000Z",
      null,
      rawIp,
    );
    insertReset.run(
      "reset-pending",
      adminId,
      "f".repeat(64),
      "2026-07-20T11:50:00.000Z",
      "2026-07-20T12:30:00.000Z",
      null,
      "admin-account-recovery",
    );

    sqlite
      .prepare(
        `INSERT INTO identity_security_events
           (id, user_id, actor_id, event_type, rationale, occurred_at)
         VALUES (?, ?, NULL, ?, ?, ?)`,
      )
      .run(
        "security-reset",
        adminId,
        "password_reset_completed",
        `Synthetic fixture reset from ${rawIp} for ${adminEmail}`,
        "2026-07-19T16:20:00.000Z",
      );
    sqlite
      .prepare(
        `INSERT INTO identity_security_events
           (id, user_id, actor_id, event_type, rationale, occurred_at)
         VALUES (?, ?, NULL, ?, ?, ?)`,
      )
      .run(
        "security-synthetic-extension",
        adminId,
        "synthetic_extension_event",
        `Synthetic fixture contains ${rawTokenHash}`,
        "2026-07-19T16:25:00.000Z",
      );
    sqlite
      .prepare(
        `INSERT INTO identity_operator_operations
           (id, operation_type, target_user_id, outcome, requested_at,
            completed_at, details)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "operator-recovery",
        "activate-administrator-recovery",
        adminId,
        "activated",
        "2026-07-19T16:10:00.000Z",
        "2026-07-19T16:10:01.000Z",
        JSON.stringify({ rawTokenHash, adminEmail, rawIp }),
      );
    sqlite
      .prepare(
        `INSERT INTO identity_operator_operations
           (id, operation_type, target_user_id, outcome, requested_at,
            completed_at, details)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "operator-synthetic-extension",
        "synthetic_extension_operation",
        adminId,
        "rejected",
        "2026-07-19T16:11:00.000Z",
        "2026-07-19T16:11:01.000Z",
        rawUserAgent,
      );

    const keyFingerprint = createHash("sha256")
      .update("AMOS-OPS identity key binding v1\0")
      .update(appSecret)
      .digest("hex");
    sqlite
      .prepare(
        `INSERT INTO identity_runtime_key_bindings
           (environment_id, key_fingerprint, created_at, verified_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(
        environment.environmentId,
        keyFingerprint,
        "2026-07-19T15:00:00.000Z",
        "2026-07-20T11:00:00.000Z",
      );
    return { sqlite, environment, keyFingerprint, passwordHash };
  }

  it("returns the incident fields as categories and metadata without private values", () => {
    const { sqlite, environment, keyFingerprint, passwordHash } = fixture();
    const report = createIdentityOperator(
      sqlite,
      environment,
      () => instant,
    ).diagnose();

    expect(report).toMatchObject({
      diagnosisVersion: "privacy-safe-v2",
      generatedAt: instant.toISOString(),
      exists: true,
      environmentId: environment.environmentId,
      failedLoginCount: 2,
      passwordChangedAt: "2026-07-19T16:20:00.000Z",
      mustChangePassword: false,
      lastLoginAt: "2026-07-19T16:27:00.000Z",
      credentialVersion: 4,
      authenticatorVersion: 3,
      passwordCredentialMetadata: {
        algorithm: "bcrypt",
        validFormat: true,
        variant: "2b",
        cost: 7,
      },
      activeSessions: 1,
      loginOutcomes: {
        count: 3,
        categories: expect.arrayContaining([
          expect.objectContaining({
            category: "credential_rejected",
            count: 2,
          }),
          expect.objectContaining({ category: "password_verified", count: 1 }),
        ]),
      },
      sessionRevocations: {
        count: 2,
        latestAt: "2026-07-19T16:20:00.000Z",
        reasonCategories: expect.arrayContaining([
          expect.objectContaining({
            category: "credential_rotation",
            count: 1,
          }),
          expect.objectContaining({
            category: "administrator_recovery",
            count: 1,
          }),
        ]),
      },
      chronology: {
        passwordResets: {
          count: 3,
          consumedCount: 1,
          expiredCount: 1,
          pendingCount: 1,
        },
        securityEvents: { count: 2 },
        operatorOperations: { count: 2 },
      },
      database: {
        engine: "sqlite",
        fingerprintBasis: "schema-and-cardinality-v1",
        requiredIdentityTablesPresent: true,
        missingRequiredTables: [],
      },
      keyBinding: { present: true, matchesCurrentRuntime: true },
    });
    expect(report.database.fingerprint).toMatch(/^[a-f0-9]{64}$/);

    const serialized = JSON.stringify(report);
    for (const sensitiveFixtureValue of [
      adminId,
      adminEmail,
      rawIp,
      rawUserAgent,
      rawTokenHash,
      appSecret,
      keyFingerprint,
      passwordHash,
    ]) {
      expect(serialized).not.toContain(sensitiveFixtureValue);
    }
    expect(report).not.toHaveProperty("accountId");
    expect(report).not.toHaveProperty("email");
    expect(report).not.toHaveProperty("keyFingerprint");
  });

  it("performs no table row or content changes, including in query-only mode", () => {
    const { sqlite, environment } = fixture();
    const before = snapshotTables(sqlite);
    sqlite.pragma("query_only = ON");

    const report = createIdentityOperator(
      sqlite,
      environment,
      () => instant,
    ).diagnose();
    const after = snapshotTables(sqlite);

    expect(report).toMatchObject({
      exists: true,
      diagnosisVersion: "privacy-safe-v2",
    });
    expect(after).toEqual(before);
    sqlite.pragma("query_only = OFF");
  });
});
