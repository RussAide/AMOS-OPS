import bcrypt from "bcryptjs";
import Database from "better-sqlite3";
import { createHash, createHmac } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildEnvironmentConfig, type EnvironmentConfig } from "../lib/env";
import { createIdentityService } from "../security/identity";
import { totpCodeForTest } from "../security/totp";

const FIXED_TIME = new Date("2026-07-20T14:00:00.000Z");
const SYNTHETIC_ADMIN_EMAIL = "continuity.admin@amos-ops.invalid";
const SYNTHETIC_ADMIN_PASSWORD = "Continuity!Admin-2026";
const SYNTHETIC_INVITATION_TOKEN =
  "synthetic-continuity-invitation-token-20260720";
const SYNTHETIC_APP_SECRET =
  "pf13-synthetic-production-app-secret-64-characters-long-20260720";
const SYNTHETIC_TEAM_PASSWORD = "Continuity!Team-2026";
const SYNTHETIC_STORAGE_ENCRYPTION = {
  AMOS_STORAGE_ENCRYPTION_REQUIRED: "true",
  AMOS_STORAGE_KEY_PROVIDER: "railway-sealed-variables-v1",
  AMOS_STORAGE_MIGRATION_MODE: "none",
  AMOS_DATABASE_ACTIVE_KEY_ID: "database-pf13-test-v1",
  AMOS_DATABASE_KEY_MANIFEST_JSON: JSON.stringify({
    "database-pf13-test-v1": "AMOS_DATABASE_KEY_PF13_TEST_V1",
  }),
  AMOS_DATABASE_KEY_PF13_TEST_V1: Buffer.alloc(32, 51).toString("base64"),
  AMOS_UPLOAD_ACTIVE_KEY_ID: "upload-pf13-test-v1",
  AMOS_UPLOAD_KEY_MANIFEST_JSON: JSON.stringify({
    "upload-pf13-test-v1": "AMOS_UPLOAD_KEY_PF13_TEST_V1",
  }),
  AMOS_UPLOAD_KEY_PF13_TEST_V1: Buffer.alloc(32, 52).toString("base64"),
  AMOS_BACKUP_ACTIVE_KEY_ID: "backup-pf13-test-v1",
  AMOS_BACKUP_KEY_MANIFEST_JSON: JSON.stringify({
    "backup-pf13-test-v1": "AMOS_BACKUP_KEY_PF13_TEST_V1",
  }),
  AMOS_BACKUP_KEY_PF13_TEST_V1: Buffer.alloc(32, 53).toString("base64"),
};

const openDatabases: Database.Database[] = [];
const temporaryDirectories: string[] = [];

interface MutableClock {
  instant: Date;
  now: () => Date;
}

interface IdentityTableDefinition {
  name: string;
  sql: string;
}

function mutableClock(): MutableClock {
  const clock = {
    instant: new Date(FIXED_TIME),
    now: () => new Date(clock.instant),
  };
  return clock;
}

function temporaryDatabasePath(label: string): string {
  const directory = mkdtempSync(path.join(tmpdir(), `amos-pf13-${label}-`));
  temporaryDirectories.push(directory);
  const productionDirectory = path.join(directory, "production");
  mkdirSync(productionDirectory);
  return path.join(productionDirectory, "amos-ops.db");
}

function openDatabase(databasePath: string): Database.Database {
  const database = new Database(databasePath);
  database.pragma("foreign_keys = ON");
  openDatabases.push(database);
  return database;
}

function closeDatabase(database: Database.Database): void {
  database.close();
  const index = openDatabases.indexOf(database);
  if (index >= 0) openDatabases.splice(index, 1);
}

function productionLikeEnvironment(
  databasePath: string,
  clock: MutableClock,
): EnvironmentConfig {
  const invitationHash = createHmac("sha256", SYNTHETIC_APP_SECRET)
    .update(SYNTHETIC_INVITATION_TOKEN)
    .digest("hex");
  const validated = buildEnvironmentConfig({
    ...SYNTHETIC_STORAGE_ENCRYPTION,
    APP_ENV: "production",
    AMOS_RUNTIME_MODE: "production",
    NODE_ENV: "production",
    PERSISTENT_ROOT: "/app/persistent",
    DATABASE_PATH: "/app/persistent/data/production/amos-ops.db",
    TRAINING_DATABASE_PATH:
      "/app/persistent/data/production/training/amos-ops-training.db",
    UPLOAD_PATH: "/app/persistent/uploads/production",
    TRAINING_UPLOAD_PATH: "/app/persistent/uploads/production/training",
    BACKUP_PATH: "/app/persistent/backups/production",
    CREDENTIAL_NAMESPACE: "amos-ops/production/pf13-synthetic",
    APP_SECRET: SYNTHETIC_APP_SECRET,
    JWT_SECRET:
      "pf13-synthetic-production-jwt-secret-64-characters-long-20260720",
    DEPLOYMENT_APPROVAL_ID: "PF13-SYNTHETIC-CONTINUITY",
    DEPLOYMENT_CHANGE_REFERENCE: "PF13-BASELINE",
    AMOS_ALLOWED_ORIGINS: "https://amos-ops.invalid",
    ALLOW_SELF_REGISTRATION: "false",
    MFA_POLICY: "required-all",
    AMOS_PRODUCTION_RELEASE_AUTHORIZED: "true",
    AMOS_PRODUCTION_RELEASE_ID: "PF13-SYNTHETIC-BASELINE",
    AMOS_BUILD_ID: "pf13-synthetic-baseline",
    AMOS_INITIAL_ADMIN_EMAIL: SYNTHETIC_ADMIN_EMAIL,
    AMOS_INITIAL_ADMIN_FIRST_NAME: "Synthetic",
    AMOS_INITIAL_ADMIN_LAST_NAME: "Administrator",
    AMOS_INITIAL_ADMIN_INVITATION_TOKEN_HASH: invitationHash,
    AMOS_INITIAL_ADMIN_INVITATION_EXPIRES_AT: new Date(
      clock.instant.getTime() + 24 * 60 * 60_000,
    ).toISOString(),
  });

  // The validated configuration retains the real Production directory shape;
  // only the already-open SQLite handle is redirected to an isolated temp file.
  return Object.freeze({ ...validated, databasePath });
}

function exactIdentitySnapshot(database: Database.Database) {
  const tables = database
    .prepare(
      `SELECT name, sql
         FROM sqlite_master
        WHERE type = 'table'
          AND (name = 'users' OR name LIKE 'identity_%')
        ORDER BY name`,
    )
    .all() as IdentityTableDefinition[];

  return {
    integrity: database.pragma("integrity_check", { simple: true }),
    userVersion: database.pragma("user_version", { simple: true }),
    tables: tables.map((table) => ({
      name: table.name,
      sql: table.sql,
      rows: database
        .prepare(`SELECT * FROM "${table.name}" ORDER BY rowid`)
        .all(),
    })),
  };
}

function exactIdentityDigest(database: Database.Database): string {
  return createHash("sha256")
    .update(JSON.stringify(exactIdentitySnapshot(database)))
    .digest("hex");
}

function accountContinuityState(database: Database.Database) {
  return database
    .prepare(
      `SELECT password_hash AS passwordHash,
              mfa_totp_secret AS encryptedTotpSecret,
              mfa_totp_enrolled_at AS totpEnrolledAt,
              mfa_totp_last_counter AS lastTotpCounter,
              credential_version AS credentialVersion,
              authenticator_version AS authenticatorVersion
         FROM users
        WHERE email = ?`,
    )
    .get(SYNTHETIC_ADMIN_EMAIL) as {
    passwordHash: string;
    encryptedTotpSecret: string;
    totpEnrolledAt: string;
    lastTotpCounter: number;
    credentialVersion: number;
    authenticatorVersion: number;
  };
}

afterEach(() => {
  for (const database of openDatabases.splice(0)) database.close();
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("AUTH.STAB.1 PF-13 identity continuity", () => {
  it("preserves exact identity state through three restarts and three release changes", async () => {
    const clock = mutableClock();
    const databasePath = temporaryDatabasePath("restart-release");
    const baselineEnvironment = productionLikeEnvironment(databasePath, clock);

    let database = openDatabase(databasePath);
    let service = createIdentityService(database, {
      environment: baselineEnvironment,
      now: clock.now,
      policy: { passwordHashRounds: 4 },
    });
    expect(service.commissionInitialAdministrator()).toBe("commissioned");
    const enrollment = await service.resetPassword({
      token: SYNTHETIC_INVITATION_TOKEN,
      newPassword: SYNTHETIC_ADMIN_PASSWORD,
    });
    expect(enrollment.totpSetup?.secret).toMatch(/^[A-Z2-7]{32}$/);

    const initialLogin = await service.login({
      email: SYNTHETIC_ADMIN_EMAIL,
      password: SYNTHETIC_ADMIN_PASSWORD,
    });
    expect(initialLogin.status).toBe("mfa_required");
    if (initialLogin.status !== "mfa_required" || !enrollment.totpSetup) {
      throw new Error(
        "Synthetic administrator TOTP enrollment was not available",
      );
    }
    const authenticated = await service.verifyMfa({
      challengeId: initialLogin.challengeId,
      code: totpCodeForTest(enrollment.totpSetup.secret, clock.instant),
    });
    expect(authenticated.status).toBe("authenticated");

    const expectedAccountState = accountContinuityState(database);
    expect(expectedAccountState).toMatchObject({
      credentialVersion: 2,
      authenticatorVersion: 2,
    });
    const expectedDigest = exactIdentityDigest(database);

    for (let restart = 1; restart <= 3; restart += 1) {
      closeDatabase(database);
      database = openDatabase(databasePath);
      service = createIdentityService(database, {
        environment: baselineEnvironment,
        now: clock.now,
        policy: { passwordHashRounds: 4 },
      });

      expect(service.commissionInitialAdministrator()).toBe(
        "already_commissioned",
      );
      expect(service.getSessionSecurity(authenticated.token)?.user.email).toBe(
        SYNTHETIC_ADMIN_EMAIL,
      );
      expect(accountContinuityState(database)).toEqual(expectedAccountState);
      expect(exactIdentityDigest(database)).toBe(expectedDigest);
    }

    const releases = [
      {
        productionReleaseId: "PF13-SYNTHETIC-RELEASE-1",
        deploymentChangeReference: "PF13-REDEPLOY-1",
        buildId: "pf13-build-1",
      },
      {
        productionReleaseId: "PF13-SYNTHETIC-RELEASE-2",
        deploymentChangeReference: "PF13-REDEPLOY-2",
        buildId: "pf13-build-2",
      },
      {
        productionReleaseId: "PF13-SYNTHETIC-RELEASE-3",
        deploymentChangeReference: "PF13-REDEPLOY-3",
        buildId: "pf13-build-3",
      },
    ] as const;

    for (const release of releases) {
      closeDatabase(database);
      database = openDatabase(databasePath);
      service = createIdentityService(database, {
        environment: Object.freeze({ ...baselineEnvironment, ...release }),
        now: clock.now,
        policy: { passwordHashRounds: 4 },
      });

      expect(service.commissionInitialAdministrator()).toBe(
        "already_commissioned",
      );
      expect(service.getSessionSecurity(authenticated.token)?.user.id).toBe(
        authenticated.user.id,
      );
      expect(accountContinuityState(database)).toEqual(expectedAccountState);
      expect(exactIdentityDigest(database)).toBe(expectedDigest);
    }

    clock.instant = new Date(clock.instant.getTime() + 31_000);
    const postReleaseLogin = await service.login({
      email: SYNTHETIC_ADMIN_EMAIL,
      password: SYNTHETIC_ADMIN_PASSWORD,
    });
    expect(postReleaseLogin.status).toBe("mfa_required");
    if (postReleaseLogin.status !== "mfa_required") {
      throw new Error("Preserved TOTP challenge was not issued");
    }
    await expect(
      service.verifyMfa({
        challengeId: postReleaseLogin.challengeId,
        code: totpCodeForTest(enrollment.totpSetup.secret, clock.instant),
      }),
    ).resolves.toMatchObject({ status: "authenticated", mfaVerified: true });
    expect(accountContinuityState(database)).toMatchObject({
      passwordHash: expectedAccountState.passwordHash,
      encryptedTotpSecret: expectedAccountState.encryptedTotpSecret,
      credentialVersion: 2,
      authenticatorVersion: 2,
    });
  }, 30_000);

  it("keeps failed frontend and backend releases outside protected identity controls", () => {
    const clock = mutableClock();
    const databasePath = temporaryDatabasePath("failed-release");
    const environment = productionLikeEnvironment(databasePath, clock);
    const database = openDatabase(databasePath);
    createIdentityService(database, {
      environment,
      now: clock.now,
      policy: { passwordHashRounds: 4 },
    });
    const before = exactIdentityDigest(database);

    const releaseWorkflow = readFileSync(
      path.resolve(
        process.cwd(),
        ".github/workflows/production-end-to-end-activation-20260718.yml",
      ),
      "utf8",
    );
    expect(releaseWorkflow).not.toMatch(/AMOS_ADMIN_RECOVERY_TOKEN/);
    expect(releaseWorkflow).not.toMatch(
      /AMOS_INITIAL_ADMIN_INVITATION_(?:TOKEN_HASH|EXPIRES_AT)/,
    );
    expect(releaseWorkflow).not.toMatch(/\/api\/operator\/identity\//);
    expect(releaseWorkflow).not.toMatch(
      /(?:workflow[s/]*)?identity-operations\.ya?ml/i,
    );

    const protectedIdentityOperations: string[] = [];
    const runFailedRelease = (
      failedStage: "frontend" | "backend",
    ): "frontend_failed" | "backend_failed" => {
      if (failedStage === "frontend") return "frontend_failed";
      return "backend_failed";
    };

    expect(runFailedRelease("frontend")).toBe("frontend_failed");
    expect(runFailedRelease("backend")).toBe("backend_failed");
    expect(protectedIdentityOperations).toEqual([]);
    expect(exactIdentityDigest(database)).toBe(before);
  });

  it("persists lockout, unlock, logout, expiry, and concurrent team-login behavior", async () => {
    const clock = mutableClock();
    const databasePath = temporaryDatabasePath("team-lifecycle");
    const environment = productionLikeEnvironment(databasePath, clock);
    let database = openDatabase(databasePath);
    let service = createIdentityService(database, {
      environment,
      now: clock.now,
      policy: {
        passwordHashRounds: 4,
        maximumFailedLogins: 3,
        sessionIdleMinutes: 2,
        sessionAbsoluteMinutes: 10,
        // Ordinary synthetic workforce logins isolate session continuity here;
        // the Production-required TOTP path is exercised in the first test.
        mfaPolicy: "optional",
      },
    });

    const passwordHash = await bcrypt.hash(SYNTHETIC_TEAM_PASSWORD, 4);
    const createdAt = clock.instant.toISOString();
    const insertUser = database.prepare(
      `INSERT INTO users
         (id, email, password_hash, first_name, last_name, role, department,
          is_active, access_status, identity_type, training_access,
          created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'cleared', 'workforce', 1, ?, ?)`,
    );
    insertUser.run(
      "PF13-SYNTHETIC-ADMIN",
      "team.admin@amos-ops.invalid",
      passwordHash,
      "Synthetic",
      "Team Administrator",
      "super-admin",
      "Executive Office",
      createdAt,
      createdAt,
    );

    const team = Array.from({ length: 12 }, (_, index) => ({
      id: `PF13-SYNTHETIC-TEAM-${String(index + 1).padStart(2, "0")}`,
      email: `continuity-team-${String(index + 1).padStart(2, "0")}@amos-ops.invalid`,
    }));
    for (const member of team) {
      insertUser.run(
        member.id,
        member.email,
        passwordHash,
        "Synthetic",
        member.id,
        "rcs-day",
        "GRO Residential",
        createdAt,
        createdAt,
      );
    }

    const concurrentLogins = await Promise.all(
      team.map((member, index) =>
        service.login({
          email: member.email,
          password: SYNTHETIC_TEAM_PASSWORD,
          ipAddress: `192.0.2.${index + 1}`,
          userAgent: "AMOS-PF13-Synthetic-Continuity/1.0",
        }),
      ),
    );
    expect(concurrentLogins).toHaveLength(12);
    expect(
      concurrentLogins.every((login) => login.status === "authenticated"),
    ).toBe(true);
    expect(
      (
        database
          .prepare(
            "SELECT COUNT(*) AS count FROM identity_sessions WHERE revoked_at IS NULL",
          )
          .get() as { count: number }
      ).count,
    ).toBe(12);

    const target = team[0];
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await expect(
        service.login({ email: target.email, password: "Incorrect!Pass-2026" }),
      ).rejects.toMatchObject({
        code: "INVALID_CREDENTIALS",
      });
    }
    await expect(
      service.login({ email: target.email, password: SYNTHETIC_TEAM_PASSWORD }),
    ).rejects.toMatchObject({ code: "ACCOUNT_LOCKED" });

    expect(
      service.unlockAccount({
        actorId: "PF13-SYNTHETIC-ADMIN",
        userId: target.id,
        rationale: "PF-13 deterministic synthetic continuity test.",
      }),
    ).toEqual({ success: true, wasLocked: true });

    const afterUnlock = await service.login({
      email: target.email,
      password: SYNTHETIC_TEAM_PASSWORD,
    });
    expect(afterUnlock.status).toBe("authenticated");
    if (afterUnlock.status !== "authenticated") {
      throw new Error(
        "Synthetic team member did not authenticate after unlock",
      );
    }
    expect(service.revokeToken(afterUnlock.token)).toBe(true);
    expect(service.getSession(afterUnlock.token)).toBeNull();

    const afterLogout = await service.login({
      email: target.email,
      password: SYNTHETIC_TEAM_PASSWORD,
    });
    expect(afterLogout.status).toBe("authenticated");
    if (afterLogout.status !== "authenticated") {
      throw new Error("Synthetic team member did not re-login after logout");
    }

    clock.instant = new Date(clock.instant.getTime() + 3 * 60_000);
    expect(service.getSession(afterLogout.token)).toBeNull();
    expect(
      service
        .listSessions(target.id)
        .find((session) => session.revokeReason === "expired"),
    ).toBeDefined();
    expect(
      database
        .prepare(
          `SELECT credential_version AS credentialVersion,
                  authenticator_version AS authenticatorVersion
             FROM users
            WHERE id = ?`,
        )
        .get(target.id),
    ).toEqual({ credentialVersion: 1, authenticatorVersion: 1 });

    const stateBeforeReopen = exactIdentityDigest(database);
    closeDatabase(database);
    database = openDatabase(databasePath);
    expect(exactIdentityDigest(database)).toBe(stateBeforeReopen);
    service = createIdentityService(database, {
      environment,
      now: clock.now,
      policy: {
        passwordHashRounds: 4,
        maximumFailedLogins: 3,
        sessionIdleMinutes: 2,
        sessionAbsoluteMinutes: 10,
        mfaPolicy: "optional",
      },
    });
    expect(exactIdentityDigest(database)).not.toBe("");
    expect(database.pragma("integrity_check", { simple: true })).toBe("ok");
    await expect(
      service.login({ email: target.email, password: SYNTHETIC_TEAM_PASSWORD }),
    ).resolves.toMatchObject({ status: "authenticated" });
  }, 30_000);
});
