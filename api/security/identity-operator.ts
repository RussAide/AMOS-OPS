import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type Database from "better-sqlite3";
import { env, type EnvironmentConfig } from "../lib/env";

const MAX_SKEW_MS = 5 * 60 * 1000;

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function bodyDigest(body: string): string {
  return createHash("sha256").update(body).digest("hex");
}

export function operatorSignature(input: {
  secret: string; timestamp: string; operationId: string;
  method: string; path: string; body: string;
}): string {
  const canonical = ["v1", input.timestamp, input.operationId,
    input.method.toUpperCase(), input.path, bodyDigest(input.body)].join("\n");
  return createHmac("sha256", input.secret).update(canonical).digest("hex");
}

export function verifyOperatorRequest(input: {
  secret: string; timestamp: string; operationId: string; signature: string;
  method: string; path: string; body: string; now?: Date;
}): boolean {
  const parsed = Date.parse(input.timestamp);
  if (!Number.isFinite(parsed) || Math.abs((input.now ?? new Date()).getTime() - parsed) > MAX_SKEW_MS) return false;
  return safeEqual(operatorSignature(input), input.signature);
}

export function createIdentityOperator(
  sqlite: Database.Database,
  environment: EnvironmentConfig = env,
  now: () => Date = () => new Date(),
) {
  const account = () => sqlite.prepare(
    `SELECT id, role, is_active AS active, access_status AS accessStatus,
            identity_type AS identityType, locked_until AS lockedUntil,
            mfa_enabled AS mfaEnabled, mfa_method AS mfaMethod,
            credential_version AS credentialVersion,
            authenticator_version AS authenticatorVersion
       FROM users WHERE lower(email) = lower(?)`,
  ).get(environment.initialAdminEmail) as Record<string, unknown> | undefined;

  const diagnose = () => {
    const user = account();
    if (!user) return { exists: false, environmentId: environment.environmentId };
    const sessions = sqlite.prepare(
      `SELECT COUNT(*) AS count FROM identity_sessions WHERE user_id = ?
        AND revoked_at IS NULL AND idle_expires_at > ? AND absolute_expires_at > ?`,
    ).get(user.id, now().toISOString(), now().toISOString()) as { count: number };
    return {
      exists: true,
      environmentId: environment.environmentId,
      accountId: user.id,
      role: user.role,
      active: user.active === 1,
      accessStatus: user.accessStatus,
      identityType: user.identityType,
      locked: Boolean(user.lockedUntil && Date.parse(String(user.lockedUntil)) > now().getTime()),
      mfaEnabled: user.mfaEnabled === 1,
      mfaMethod: user.mfaMethod,
      credentialVersion: user.credentialVersion,
      authenticatorVersion: user.authenticatorVersion,
      activeSessions: sessions.count,
      keyFingerprint: createHash("sha256").update("AMOS-OPS identity key binding v1\0").update(environment.appSecret || environment.jwtSecret || environment.environmentId).digest("hex"),
    };
  };

  const activateRecovery = (input: { operationId: string; tokenHash: string; expiresAt: string }) => {
    const existing = sqlite.prepare("SELECT outcome FROM identity_operator_operations WHERE id = ?").get(input.operationId);
    if (existing) return { status: "already_activated" as const };
    const user = account();
    if (!user || user.active !== 1 || user.role !== "super-admin" || user.accessStatus !== "cleared" || user.identityType !== "workforce") throw new Error("RECOVERY_TARGET_INVALID");
    const expiry = Date.parse(input.expiresAt);
    const instant = now();
    if (!/^[a-f0-9]{64}$/.test(input.tokenHash) || !Number.isFinite(expiry) || expiry <= instant.getTime() || expiry > instant.getTime() + 60 * 60 * 1000) throw new Error("RECOVERY_REQUEST_INVALID");
    sqlite.transaction(() => {
      sqlite.prepare("UPDATE identity_password_reset_tokens SET consumed_at = ? WHERE user_id = ? AND consumed_at IS NULL").run(instant.toISOString(), user.id);
      sqlite.prepare(`INSERT INTO identity_password_reset_tokens (id,user_id,token_hash,created_at,expires_at,requested_ip) VALUES (?,?,?,?,?,'controlled-operator-recovery')`).run(randomUUID(), user.id, input.tokenHash, instant.toISOString(), input.expiresAt);
      sqlite.prepare(`INSERT INTO identity_operator_operations (id,operation_type,target_user_id,outcome,requested_at,completed_at,details) VALUES (?,'activate-administrator-recovery',?,'activated',?,?,?)`).run(input.operationId, user.id, instant.toISOString(), instant.toISOString(), JSON.stringify({ expiresAt: input.expiresAt }));
    })();
    return { status: "activated" as const, expiresAt: input.expiresAt };
  };
  return { diagnose, activateRecovery };
}
