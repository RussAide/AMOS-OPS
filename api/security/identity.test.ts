import Database from "better-sqlite3";
import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { buildEnvironmentConfig } from "../lib/env";
import {
  createIdentityService,
  IdentityError,
  resolveEvaluationIdentity,
  resolveRequestedDataScope,
  requiresMfa,
  validatePassword,
} from "./identity";
import { totpCodeForTest } from "./totp";

const openDatabases: Database.Database[] = [];

function makeService(options?: {
  mfaPolicy?: "optional" | "required-privileged" | "required-all";
  maximumFailedLogins?: number;
  environmentId?: string;
  sessionIdleMinutes?: number;
  sessionAbsoluteMinutes?: number;
  now?: () => Date;
}) {
  return makeFixture(options).service;
}

function makeFixture(options?: {
  mfaPolicy?: "optional" | "required-privileged" | "required-all";
  maximumFailedLogins?: number;
  environmentId?: string;
  sessionIdleMinutes?: number;
  sessionAbsoluteMinutes?: number;
  now?: () => Date;
}) {
  const sqlite = new Database(":memory:");
  openDatabases.push(sqlite);
  const environment = buildEnvironmentConfig({
    APP_ENV: "demo",
    NODE_ENV: "production",
    AMOS_RUNTIME_MODE: "demo",
    ALLOW_SELF_REGISTRATION: "true",
    MFA_POLICY: options?.mfaPolicy ?? "optional",
    AMOS_ENVIRONMENT_ID: options?.environmentId ?? "amos-ops-demo-test",
  });
  const service = createIdentityService(sqlite, {
    environment,
    now: options?.now,
    policy: {
      passwordHashRounds: 4,
      maximumFailedLogins: options?.maximumFailedLogins ?? 5,
      sessionIdleMinutes: options?.sessionIdleMinutes ?? 30,
      sessionAbsoluteMinutes: options?.sessionAbsoluteMinutes ?? 480,
    },
  });
  return { service, sqlite, environment };
}

afterEach(() => {
  for (const sqlite of openDatabases.splice(0)) sqlite.close();
});

describe("synthetic evaluation identity", () => {
  const demo = buildEnvironmentConfig({
    APP_ENV: "demo",
    NODE_ENV: "production",
    AMOS_RUNTIME_MODE: "demo",
    AMOS_ENVIRONMENT_ID: "amos-ops-demo-test",
  });

  it("resolves a canonical persona only inside the isolated demo profile", () => {
    const request = new Request("https://demo.amos-ops.invalid/api/trpc", {
      headers: {
        authorization: "Bearer amos-evaluation-session",
        "x-amos-evaluation-role": "administrator",
      },
    });
    expect(resolveEvaluationIdentity(request, demo)).toMatchObject({
      id: "SYNTH-EVALUATION-ADMINISTRATOR",
      role: "administrator",
      department: "Executive Office",
    });
    expect(
      resolveEvaluationIdentity(
        request,
        buildEnvironmentConfig({ APP_ENV: "development", NODE_ENV: "test" }),
      ),
    ).toBeNull();
  });

  it("rejects an unknown role assertion", () => {
    const request = new Request("https://demo.amos-ops.invalid/api/trpc", {
      headers: {
        authorization: "Bearer amos-evaluation-session",
        "x-amos-evaluation-role": "qa-coordinator",
      },
    });
    expect(resolveEvaluationIdentity(request, demo)).toBeNull();
  });
});

describe("identity policy", () => {
  it("enforces the controlled password baseline", () => {
    expect(validatePassword("short")).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/12 characters/),
        expect.stringMatching(/uppercase/),
        expect.stringMatching(/number/),
        expect.stringMatching(/special/),
      ]),
    );
    expect(validatePassword("Fictional!Youth2026")).toEqual([]);
  });

  it("requires MFA for privileged roles under the privileged policy", () => {
    expect(requiresMfa("super-admin", false, "required-privileged")).toBe(true);
    expect(requiresMfa("rcs-day", false, "required-privileged")).toBe(false);
    expect(requiresMfa("rcs-day", true, "optional")).toBe(true);
  });
});

describe("identity lifecycle", () => {
  it("bootstraps the authorized production administrator through one-time TOTP enrollment", async () => {
    const sqlite = new Database(":memory:");
    openDatabases.push(sqlite);
    const now = new Date();
    const appSecret = `production-bootstrap-test-${"x".repeat(40)}`;
    const invitationToken = "initial-admin-invitation-token-fixture-2026";
    const invitationTokenHash = createHmac("sha256", appSecret)
      .update(invitationToken)
      .digest("hex");
    const environment = buildEnvironmentConfig({
      APP_ENV: "production",
      AMOS_RUNTIME_MODE: "production",
      NODE_ENV: "production",
      DATABASE_PATH: "/data/production/amos-ops.db",
      UPLOAD_PATH: "/uploads/production",
      CREDENTIAL_NAMESPACE: "amos-ops/production",
      APP_SECRET: appSecret,
      JWT_SECRET: `production-bootstrap-jwt-${"y".repeat(40)}`,
      DEPLOYMENT_APPROVAL_ID: "USER-AUTHORIZED-INITIAL-ADMIN",
      DEPLOYMENT_CHANGE_REFERENCE: "AMOS-OPS-INITIAL-ADMIN",
      AMOS_ALLOWED_ORIGINS: "https://amos-ops.example.invalid",
      ALLOW_SELF_REGISTRATION: "false",
      MFA_POLICY: "required-all",
      AMOS_PRODUCTION_RELEASE_AUTHORIZED: "true",
      AMOS_PRODUCTION_RELEASE_ID: "AMOS-OPS-V1.3.0",
      AMOS_INITIAL_ADMIN_EMAIL: "e.o.aideyan@adobicarebhc.com",
      AMOS_INITIAL_ADMIN_FIRST_NAME: "Eghosa",
      AMOS_INITIAL_ADMIN_LAST_NAME: "Aideyan",
      AMOS_INITIAL_ADMIN_INVITATION_TOKEN_HASH: invitationTokenHash,
      AMOS_INITIAL_ADMIN_INVITATION_EXPIRES_AT: new Date(
        now.getTime() + 60 * 60_000,
      ).toISOString(),
    });
    const service = createIdentityService(sqlite, {
      environment,
      now: () => now,
      policy: { passwordHashRounds: 4 },
    });

    expect(service.listUsers()).toEqual([
      expect.objectContaining({
        email: "e.o.aideyan@adobicarebhc.com",
        firstName: "Eghosa",
        lastName: "Aideyan",
        role: "super-admin",
        department: "Executive Office",
        accessStatus: "cleared",
        identityType: "workforce",
        mfaEnabled: true,
      }),
    ]);

    const reset = await service.resetPassword({
      token: invitationToken,
      newPassword: "Authorized!Admin2026",
    });
    expect(reset.totpSetup).toMatchObject({
      accountName: "e.o.aideyan@adobicarebhc.com",
      issuer: "AMOS-OPS",
    });
    expect(reset.totpSetup?.secret).toMatch(/^[A-Z2-7]{32}$/);

    const login = await service.login({
      email: "e.o.aideyan@adobicarebhc.com",
      password: "Authorized!Admin2026",
    });
    expect(login).toMatchObject({
      status: "mfa_required",
      deliveryMethod: "totp",
      destination: "your authenticator app",
    });
    if (login.status !== "mfa_required" || !reset.totpSetup) {
      throw new Error("expected TOTP challenge");
    }
    const authenticated = await service.verifyMfa({
      challengeId: login.challengeId,
      code: totpCodeForTest(reset.totpSetup.secret, now),
    });
    expect(authenticated).toMatchObject({
      status: "authenticated",
      mfaVerified: true,
      user: {
        email: "e.o.aideyan@adobicarebhc.com",
        role: "super-admin",
        dataScope: "operational",
      },
    });
  });

  it("keeps new accounts in Training and rejects Operational workspace requests", async () => {
    const service = makeService();
    const registered = await service.register({
      email: "training.user@amos-ops.invalid",
      password: "Fictional!Youth2026",
      firstName: "Training",
      lastName: "User",
    });
    if (registered.status !== "authenticated")
      throw new Error("expected session");
    expect(registered.user).toMatchObject({
      accessStatus: "training",
      dataScope: "training",
      trainingAccess: true,
    });
    expect(
      resolveRequestedDataScope(
        registered.user,
        new Request("https://amos-ops.invalid", {
          headers: { "x-amos-workspace": "operational" },
        }),
      ),
    ).toBeNull();
    expect(
      resolveRequestedDataScope(
        registered.user,
        new Request("https://amos-ops.invalid", {
          headers: { "x-amos-workspace": "training" },
        }),
      ),
    ).toBe("training");
  });

  it("requires clearance evidence, revokes sessions, and records the profile event", async () => {
    const { service, sqlite } = makeFixture();
    const registered = await service.register({
      email: "clearance.user@amos-ops.invalid",
      password: "Fictional!Youth2026",
      firstName: "Clearance",
      lastName: "User",
    });
    if (registered.status !== "authenticated")
      throw new Error("expected session");
    expect(() =>
      service.updateUser({
        id: registered.user.id,
        actorId: registered.user.id,
        accessStatus: "cleared",
        rationale: "Clearance completed.",
      }),
    ).toThrow("clearance evidence reference");

    const updated = service.updateUser({
      id: registered.user.id,
      actorId: registered.user.id,
      accessStatus: "cleared",
      trainingAccess: true,
      evidenceReference: "HR-CLEARANCE-2026-001",
      rationale: "All workforce clearance requirements completed.",
    });
    expect(updated.sessionsRevoked).toBe(1);
    expect(service.getSession(registered.token)).toBeNull();
    expect(service.listUsers()[0]).toMatchObject({
      accessStatus: "cleared",
      clearanceEvidenceReference: "HR-CLEARANCE-2026-001",
    });
    expect(
      sqlite
        .prepare(
          "SELECT new_status, evidence_reference FROM identity_access_profile_events",
        )
        .get(),
    ).toEqual({
      new_status: "cleared",
      evidence_reference: "HR-CLEARANCE-2026-001",
    });
  });

  it("creates a sponsored external Training invitation that can set a password", async () => {
    const { service } = makeFixture();
    const actorRegistration = await service.register({
      email: "sponsor@amos-ops.invalid",
      password: "Fictional!Youth2026",
      firstName: "Training",
      lastName: "Sponsor",
    });
    if (actorRegistration.status !== "authenticated")
      throw new Error("expected session");
    const invitation = await service.createTrainingAccount({
      actorId: actorRegistration.user.id,
      email: "stakeholder@example.invalid",
      firstName: "External",
      lastName: "Stakeholder",
      role: "rcs-day",
      identityType: "external_guest",
      sponsorName: "Training Sponsor",
      rationale: "Authorized stakeholder orientation.",
    });
    expect(invitation.invitationToken.length).toBeGreaterThan(20);
    await service.resetPassword({
      token: invitation.invitationToken,
      newPassword: "Stakeholder!Access2026",
    });
    const login = await service.login({
      email: "stakeholder@example.invalid",
      password: "Stakeholder!Access2026",
    });
    expect(login.status).toBe("mfa_required");
    expect(
      service.listUsers().find((user) => user.id === invitation.userId),
    ).toMatchObject({
      accessStatus: "training",
      identityType: "external_guest",
      sponsorName: "Training Sponsor",
    });
  });

  it("revokes sessions when account access expires", async () => {
    let now = new Date("2026-07-16T12:00:00.000Z");
    const { service, sqlite } = makeFixture({
      now: () => new Date(now.getTime()),
    });
    const registered = await service.register({
      email: "expiring.user@amos-ops.invalid",
      password: "Fictional!Youth2026",
      firstName: "Expiring",
      lastName: "User",
    });
    if (registered.status !== "authenticated")
      throw new Error("expected session");
    service.updateUser({
      id: registered.user.id,
      actorId: registered.user.id,
      accessExpiresAt: "2026-07-16T13:00:00.000Z",
      rationale: "Time-limited stakeholder review.",
    });
    const loginAfterProfileChange = await service.login({
      email: "expiring.user@amos-ops.invalid",
      password: "Fictional!Youth2026",
    });
    if (loginAfterProfileChange.status !== "authenticated")
      throw new Error("expected session");
    now = new Date("2026-07-16T13:00:01.000Z");
    expect(service.getSession(loginAfterProfileChange.token)).toBeNull();
    expect(
      sqlite
        .prepare(
          "SELECT revoke_reason FROM identity_sessions WHERE revoked_at IS NOT NULL ORDER BY rowid DESC LIMIT 1",
        )
        .get(),
    ).toEqual({ revoke_reason: "access_expired" });
  });
  it("guides a synthetic MFA login and issues a revocable scoped session", async () => {
    const service = makeService({ mfaPolicy: "required-all" });
    const registration = await service.register({
      email: "mfa.evaluator@amos-ops.invalid",
      password: "Fictional!Youth2026",
      firstName: "MFA",
      lastName: "Evaluator",
      ipAddress: "127.0.0.1",
      userAgent: "vitest",
    });

    expect(registration.status).toBe("mfa_required");
    if (registration.status !== "mfa_required") throw new Error("expected MFA");
    expect(registration.evaluationCode).toMatch(/^\d{6}$/);

    const authenticated = await service.verifyMfa({
      challengeId: registration.challengeId,
      code: registration.evaluationCode!,
      ipAddress: "127.0.0.1",
      userAgent: "vitest",
    });
    expect(authenticated.status).toBe("authenticated");
    expect(authenticated.mfaVerified).toBe(true);
    expect(service.getSession(authenticated.token)?.email).toBe(
      "mfa.evaluator@amos-ops.invalid",
    );
    expect(service.revokeToken(authenticated.token)).toBe(true);
    expect(service.getSession(authenticated.token)).toBeNull();
  });

  it("locks an account after repeated failed passwords", async () => {
    const service = makeService({ maximumFailedLogins: 5 });
    await service.register({
      email: "lockout.evaluator@amos-ops.invalid",
      password: "Fictional!Youth2026",
      firstName: "Lockout",
      lastName: "Evaluator",
    });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(
        service.login({
          email: "lockout.evaluator@amos-ops.invalid",
          password: "Incorrect!2026",
        }),
      ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    }
    await expect(
      service.login({
        email: "lockout.evaluator@amos-ops.invalid",
        password: "Fictional!Youth2026",
      }),
    ).rejects.toMatchObject({ code: "ACCOUNT_LOCKED" });
  });

  it("stores only a keyed hash of the bearer token", async () => {
    const { service, sqlite } = makeFixture();
    const registered = await service.register({
      email: "token.evaluator@amos-ops.invalid",
      password: "Fictional!Youth2026",
      firstName: "Token",
      lastName: "Evaluator",
    });
    if (registered.status !== "authenticated")
      throw new Error("expected session");
    const row = sqlite
      .prepare("SELECT token_hash FROM identity_sessions LIMIT 1")
      .get() as { token_hash: string };

    expect(row.token_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(row.token_hash).not.toBe(registered.token);
    expect(JSON.stringify(row)).not.toContain(registered.token);
  });

  it("expires and revokes a session at the idle boundary", async () => {
    let now = new Date("2026-07-13T12:00:00.000Z");
    const { service, sqlite } = makeFixture({
      sessionIdleMinutes: 1,
      sessionAbsoluteMinutes: 10,
      now: () => new Date(now.getTime()),
    });
    const registered = await service.register({
      email: "idle.evaluator@amos-ops.invalid",
      password: "Fictional!Youth2026",
      firstName: "Idle",
      lastName: "Evaluator",
    });
    if (registered.status !== "authenticated")
      throw new Error("expected session");
    now = new Date("2026-07-13T12:01:01.000Z");

    expect(service.getSession(registered.token)).toBeNull();
    expect(
      sqlite
        .prepare("SELECT revoke_reason FROM identity_sessions LIMIT 1")
        .get(),
    ).toEqual({ revoke_reason: "expired" });
  });

  it("expires and revokes a session at the absolute boundary", async () => {
    let now = new Date("2026-07-13T12:00:00.000Z");
    const service = makeService({
      sessionIdleMinutes: 10,
      sessionAbsoluteMinutes: 1,
      now: () => new Date(now.getTime()),
    });
    const registered = await service.register({
      email: "absolute.evaluator@amos-ops.invalid",
      password: "Fictional!Youth2026",
      firstName: "Absolute",
      lastName: "Evaluator",
    });
    if (registered.status !== "authenticated")
      throw new Error("expected session");
    now = new Date("2026-07-13T12:01:01.000Z");
    expect(service.getSession(registered.token)).toBeNull();
  });

  it("rejects a token when the environment identifier does not match", async () => {
    const { service: demoService, sqlite } = makeFixture({
      environmentId: "amos-ops-demo-a",
    });
    const registered = await demoService.register({
      email: "environment.evaluator@amos-ops.invalid",
      password: "Fictional!Youth2026",
      firstName: "Environment",
      lastName: "Evaluator",
    });
    if (registered.status !== "authenticated")
      throw new Error("expected session");
    const alternateEnvironment = buildEnvironmentConfig({
      APP_ENV: "demo",
      AMOS_ENVIRONMENT_ID: "amos-ops-demo-b",
      NODE_ENV: "production",
      AMOS_RUNTIME_MODE: "demo",
      ALLOW_SELF_REGISTRATION: "true",
      MFA_POLICY: "optional",
    });
    const alternateService = createIdentityService(sqlite, {
      environment: alternateEnvironment,
      policy: { passwordHashRounds: 4 },
    });

    expect(alternateService.getSession(registered.token)).toBeNull();
    expect(demoService.getSession(registered.token)?.email).toBe(
      "environment.evaluator@amos-ops.invalid",
    );
  });

  it("completes account recovery and revokes prior sessions", async () => {
    const service = makeService();
    const registered = await service.register({
      email: "recovery.evaluator@amos-ops.invalid",
      password: "Fictional!Youth2026",
      firstName: "Recovery",
      lastName: "Evaluator",
    });
    if (registered.status !== "authenticated")
      throw new Error("expected session");

    const requested = service.requestPasswordReset({
      email: "recovery.evaluator@amos-ops.invalid",
      ipAddress: "127.0.0.1",
    });
    expect(requested.accepted).toBe(true);
    expect(requested.evaluationToken).toBeTruthy();

    const reset = await service.resetPassword({
      token: requested.evaluationToken!,
      newPassword: "NewFictional!Youth2026",
    });
    expect(reset.sessionsRevoked).toBe(1);
    expect(service.getSession(registered.token)).toBeNull();

    const login = await service.login({
      email: "recovery.evaluator@amos-ops.invalid",
      password: "NewFictional!Youth2026",
    });
    expect(login.status).toBe("authenticated");
  });

  it("records access-review disposition and revokes access", async () => {
    const { service, sqlite } = makeFixture();
    const registered = await service.register({
      email: "review.evaluator@amos-ops.invalid",
      password: "Fictional!Youth2026",
      firstName: "Access",
      lastName: "Evaluator",
    });
    if (registered.status !== "authenticated")
      throw new Error("expected session");
    const [review] = service.listAccessReviews() as Array<{
      id: string;
      userId: string;
    }>;

    const result = service.completeAccessReview({
      reviewId: review.id,
      reviewerId: review.userId,
      decision: "revoke",
      rationale: "Synthetic access is no longer required.",
    });
    expect(result.sessionsRevoked).toBe(1);
    expect(service.getSession(registered.token)).toBeNull();
    expect(service.listAccessReviews()).toEqual([]);
    expect(
      sqlite
        .prepare(
          "SELECT status, decision FROM identity_access_reviews WHERE user_id = ?",
        )
        .all(review.userId),
    ).toEqual([{ status: "completed", decision: "revoke" }]);
    await expect(
      service.login({
        email: "review.evaluator@amos-ops.invalid",
        password: "Fictional!Youth2026",
      }),
    ).rejects.toBeInstanceOf(IdentityError);
  });

  it("rejects unknown roles and contradictory role/department assignments", async () => {
    const { service } = makeFixture();
    const registered = await service.register({
      email: "registry.evaluator@amos-ops.invalid",
      password: "Fictional!Youth2026",
      firstName: "Registry",
      lastName: "Evaluator",
    });
    if (registered.status !== "authenticated")
      throw new Error("expected session");

    expect(() =>
      service.updateUser({ id: registered.user.id, role: "unknown-role" }),
    ).toThrow(/canonical AMOS-OPS role registry/);
    expect(() =>
      service.updateUser({
        id: registered.user.id,
        role: "therapist",
        department: "GRO Residential",
      }),
    ).toThrow(/Department must be/);
  });

  it("derives the self-registration department from the canonical role", async () => {
    const service = makeService();
    await expect(
      service.register({
        email: "mismatch.evaluator@amos-ops.invalid",
        password: "Fictional!Youth2026",
        firstName: "Mismatch",
        lastName: "Evaluator",
        department: "Executive Office",
      }),
    ).rejects.toMatchObject({ code: "DEPARTMENT_ROLE_MISMATCH" });

    const registered = await service.register({
      email: "derived.evaluator@amos-ops.invalid",
      password: "Fictional!Youth2026",
      firstName: "Derived",
      lastName: "Evaluator",
    });
    if (registered.status !== "authenticated")
      throw new Error("expected session");
    expect(registered.user.role).toBe("rcs-day");
    expect(registered.user.department).toBe("GRO Residential");
  });

  it("soft-deactivates accounts while retaining security evidence", async () => {
    const { service, sqlite } = makeFixture();
    const registered = await service.register({
      email: "deactivate.evaluator@amos-ops.invalid",
      password: "Fictional!Youth2026",
      firstName: "Deactivate",
      lastName: "Evaluator",
    });
    if (registered.status !== "authenticated")
      throw new Error("expected session");

    const result = service.deleteUser(registered.user.id);
    expect(result).toMatchObject({
      success: true,
      deactivated: true,
      sessionsRevoked: 1,
    });
    expect(
      sqlite
        .prepare("SELECT is_active FROM users WHERE id = ?")
        .get(registered.user.id),
    ).toEqual({ is_active: 0 });
    expect(
      sqlite
        .prepare(
          "SELECT revoke_reason FROM identity_sessions WHERE user_id = ?",
        )
        .get(registered.user.id),
    ).toEqual({ revoke_reason: "account_deactivated" });
    expect(
      sqlite
        .prepare(
          "SELECT COUNT(*) AS count FROM identity_access_reviews WHERE user_id = ?",
        )
        .get(registered.user.id),
    ).toEqual({ count: 1 });
  });
});
