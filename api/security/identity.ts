import bcrypt from "bcryptjs";
import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import type Database from "better-sqlite3";
import { env, type EnvironmentConfig, type MfaPolicy } from "../lib/env";
import { operationalSqlite as applicationDatabase } from "../queries/connection";
import { ensureIdentitySchema } from "./identity-schema";
import {
  buildTotpUri,
  decryptTotpSecret,
  encryptTotpSecret,
  generateTotpSecret,
  matchTotpCounter,
} from "./totp";
import {
  ALL_ROLES,
  getRoleDef,
  type UserRole,
} from "../../src/constants/roles";

export interface IdentityPolicy {
  passwordMinimumLength: number;
  passwordHashRounds: number;
  maximumFailedLogins: number;
  lockoutMinutes: number;
  sessionIdleMinutes: number;
  sessionAbsoluteMinutes: number;
  mfaChallengeMinutes: number;
  mfaMaximumAttempts: number;
  passwordResetMinutes: number;
  administratorRecoveryMinutes: number;
  accessReviewDays: number;
  mfaPolicy: MfaPolicy;
}

export const DEFAULT_IDENTITY_POLICY: Readonly<IdentityPolicy> = Object.freeze({
  passwordMinimumLength: 12,
  passwordHashRounds: 12,
  maximumFailedLogins: 5,
  lockoutMinutes: 15,
  sessionIdleMinutes: 30,
  sessionAbsoluteMinutes: 8 * 60,
  mfaChallengeMinutes: 5,
  mfaMaximumAttempts: 5,
  passwordResetMinutes: 15,
  administratorRecoveryMinutes: 60,
  accessReviewDays: 90,
  mfaPolicy: env.mfaPolicy,
});

const PRIVILEGED_ROLES = new Set([
  "super-admin",
  "managing-director",
  "administrator",
  "hr-director",
  "hr-compliance-officer",
  "revenue-cycle-manager",
  "facilities-manager",
  "gro-administrator",
  "program-director",
  "bhc-director",
  "treatment-director",
  "clinical-director",
  "ccmg-program-director",
  "mhtcm-supervisor",
  "mhrs-supervisor",
  "clinical-supervisor",
  "chart-auditor",
]);
const CANONICAL_ROLES = new Set<string>(ALL_ROLES);
const IDENTITY_RECOVERY_ADMIN_ROLES = new Set([
  "super-admin",
  "managing-director",
  "administrator",
  "hr-director",
]);

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  role: string;
  department: string | null;
  is_active: number;
  failed_login_count: number;
  locked_until: string | null;
  must_change_password: number;
  mfa_enabled: number;
  mfa_method: string;
  mfa_totp_secret: string | null;
  mfa_totp_enrolled_at: string | null;
  mfa_totp_last_counter: number | null;
  access_status: AccessStatus;
  identity_type: IdentityType;
  training_access: number;
  sponsor_name: string | null;
  access_expires_at: string | null;
  clearance_reviewed_by: string | null;
  clearance_reviewed_at: string | null;
  clearance_evidence_reference: string | null;
}

interface SessionRow extends UserRow {
  session_id: string;
  token_hash: string;
  environment_id: string;
  authenticated_at: string;
  last_seen_at: string;
  idle_expires_at: string;
  absolute_expires_at: string;
  revoked_at: string | null;
  mfa_verified: number;
}

interface MfaChallengeRow {
  id: string;
  user_id: string;
  code_hash: string;
  expires_at: string;
  consumed_at: string | null;
  failed_attempts: number;
}

interface PasswordResetRow {
  id: string;
  user_id: string;
  expires_at: string;
  consumed_at: string | null;
  requested_ip: string | null;
}

export type AccessStatus = "training" | "cleared" | "suspended" | "deactivated";
export type IdentityType = "workforce" | "external_guest";
export type DataScope = "training" | "operational";

export interface IdentityUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  role: string;
  department: string | null;
  mfaEnabled: boolean;
  accessStatus: AccessStatus;
  identityType: IdentityType;
  trainingAccess: boolean;
  sponsorName: string | null;
  accessExpiresAt: string | null;
  dataScope: DataScope;
}

export interface IdentitySessionSummary {
  id: string;
  authenticatedAt: string;
  lastSeenAt: string;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
  revokedAt: string | null;
  revokeReason: string | null;
  mfaVerified: boolean;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface IdentitySessionSecurity {
  sessionId: string;
  authenticatedAt: string;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
  mfaVerified: boolean;
  user: IdentityUser;
}

export interface IdentityUserSummary {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  department: string | null;
  isActive: boolean;
  mfaEnabled: boolean;
  mfaMethod: string;
  mfaEnrolledAt: string | null;
  failedLoginCount: number;
  lockedUntil: string | null;
  mustChangePassword: boolean;
  pendingRecoveryExpiresAt: string | null;
  lastLoginAt: string | null;
  nextAccessReviewAt: string | null;
  createdAt: string | null;
  accessStatus: AccessStatus;
  identityType: IdentityType;
  trainingAccess: boolean;
  sponsorName: string | null;
  accessExpiresAt: string | null;
  clearanceReviewedAt: string | null;
  clearanceEvidenceReference: string | null;
}

export interface IdentityAccessReviewSummary {
  id: string;
  userId: string;
  dueAt: string;
  status: string;
  decision: string | null;
  reviewerId: string | null;
  reviewedAt: string | null;
  rationale: string | null;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  department: string | null;
  isActive: boolean;
}

export interface IdentityRequestContext {
  ipAddress?: string;
  userAgent?: string;
}

export interface LoginInput extends IdentityRequestContext {
  email: string;
  password: string;
}

export interface AuthenticatedResult {
  status: "authenticated";
  token: string;
  user: IdentityUser;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
  mfaVerified: boolean;
}

export interface MfaRequiredResult {
  status: "mfa_required";
  challengeId: string;
  deliveryMethod: "email-otp" | "totp";
  destination: string;
  expiresAt: string;
  evaluationCode?: string;
}

export type LoginResult = AuthenticatedResult | MfaRequiredResult;

export interface TotpSetup {
  secret: string;
  accountName: string;
  issuer: string;
  otpauthUri: string;
}

export interface PasswordResetResult {
  success: true;
  sessionsRevoked: number;
  totpSetup?: TotpSetup;
}

export interface AdministratorRecoveryResult {
  success: true;
  userId: string;
  email: string;
  recoveryToken: string;
  expiresAt: string;
  sessionsRevoked: number;
}

export class IdentityError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "IdentityError";
  }
}

function canonicalRole(role: string) {
  if (!CANONICAL_ROLES.has(role)) {
    throw new IdentityError(
      "ROLE_INVALID",
      `Role "${role}" is not in the canonical AMOS-OPS role registry.`,
    );
  }
  return getRoleDef(role as UserRole);
}

function nowIso(now = new Date()): string {
  return now.toISOString();
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toUser(row: UserRow): IdentityUser {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    name: `${row.first_name} ${row.last_name}`,
    role: row.role,
    department: row.department,
    mfaEnabled: Boolean(row.mfa_enabled),
    accessStatus: row.access_status,
    identityType: row.identity_type,
    trainingAccess: Boolean(row.training_access),
    sponsorName: row.sponsor_name,
    accessExpiresAt: row.access_expires_at,
    dataScope: row.access_status === "training" ? "training" : "operational",
  };
}

function accountAccessAvailable(user: UserRow, now: Date): boolean {
  if (
    user.access_status === "suspended" ||
    user.access_status === "deactivated"
  ) {
    return false;
  }
  return (
    !user.access_expires_at ||
    new Date(user.access_expires_at).getTime() > now.getTime()
  );
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "configured destination";
  const prefix = local.length <= 2 ? (local[0] ?? "*") : local.slice(0, 2);
  return `${prefix}${"*".repeat(Math.max(2, local.length - prefix.length))}@${domain}`;
}

function safeCompare(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function validatePassword(
  password: string,
  minimumLength = DEFAULT_IDENTITY_POLICY.passwordMinimumLength,
): string[] {
  const issues: string[] = [];
  if (password.length < minimumLength) {
    issues.push(`Password must contain at least ${minimumLength} characters.`);
  }
  if (!/[a-z]/.test(password))
    issues.push("Password must include a lowercase letter.");
  if (!/[A-Z]/.test(password))
    issues.push("Password must include an uppercase letter.");
  if (!/\d/.test(password)) issues.push("Password must include a number.");
  if (!/[^A-Za-z0-9]/.test(password)) {
    issues.push("Password must include a special character.");
  }
  const common = password.toLowerCase();
  if (
    ["password", "password123", "admin123", "amos-ops", "changeme"].some(
      (value) => common.includes(value),
    )
  ) {
    issues.push("Password contains a prohibited common phrase.");
  }
  return issues;
}

export function requiresMfa(
  role: string,
  accountMfaEnabled: boolean,
  policy: MfaPolicy,
): boolean {
  if (accountMfaEnabled || policy === "required-all") return true;
  return policy === "required-privileged" && PRIVILEGED_ROLES.has(role);
}

export interface IdentityServiceOptions {
  environment?: EnvironmentConfig;
  policy?: Partial<IdentityPolicy>;
  now?: () => Date;
}

export function createIdentityService(
  sqlite: Database.Database,
  options: IdentityServiceOptions = {},
) {
  ensureIdentitySchema(sqlite);
  const environment = options.environment ?? env;
  const policy: IdentityPolicy = {
    ...DEFAULT_IDENTITY_POLICY,
    mfaPolicy: environment.mfaPolicy,
    ...options.policy,
  };
  const clock = options.now ?? (() => new Date());
  const hashKey =
    environment.appSecret || environment.jwtSecret || environment.environmentId;

  const keyFingerprint = createHash("sha256")
    .update("AMOS-OPS identity key binding v1\u0000")
    .update(hashKey)
    .digest("hex");
  const keyBinding = sqlite
    .prepare(
      `SELECT key_fingerprint AS keyFingerprint
         FROM identity_runtime_key_bindings
        WHERE environment_id = ?`,
    )
    .get(environment.environmentId) as { keyFingerprint: string } | undefined;
  if (keyBinding && keyBinding.keyFingerprint !== keyFingerprint) {
    throw new Error(
      "IDENTITY_KEY_MISMATCH: the persistent identity database is bound to a different APP_SECRET. Restore the prior Production secret before starting AMOS-OPS.",
    );
  }
  const keyVerifiedAt = nowIso(clock());
  if (keyBinding) {
    sqlite
      .prepare(
        `UPDATE identity_runtime_key_bindings
            SET verified_at = ?
          WHERE environment_id = ?`,
      )
      .run(keyVerifiedAt, environment.environmentId);
  } else {
    sqlite
      .prepare(
        `INSERT INTO identity_runtime_key_bindings
           (environment_id, key_fingerprint, created_at, verified_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(
        environment.environmentId,
        keyFingerprint,
        keyVerifiedAt,
        keyVerifiedAt,
      );
  }

  const hashOpaqueValue = (value: string): string =>
    createHmac("sha256", hashKey).update(value).digest("hex");

  const getUserByEmail = (email: string): UserRow | undefined =>
    sqlite
      .prepare(
        `SELECT id, email, password_hash, first_name, last_name, role, department,
                is_active, failed_login_count, locked_until, must_change_password,
                mfa_enabled, mfa_method, mfa_totp_secret,
                mfa_totp_enrolled_at, mfa_totp_last_counter,
                access_status, identity_type,
                training_access, sponsor_name, access_expires_at,
                clearance_reviewed_by, clearance_reviewed_at,
                clearance_evidence_reference
           FROM users WHERE lower(email) = ?`,
      )
      .get(normalizeEmail(email)) as UserRow | undefined;

  const getUserById = (id: string): UserRow | undefined =>
    sqlite
      .prepare(
        `SELECT id, email, password_hash, first_name, last_name, role, department,
                is_active, failed_login_count, locked_until, must_change_password,
                mfa_enabled, mfa_method, mfa_totp_secret,
                mfa_totp_enrolled_at, mfa_totp_last_counter,
                access_status, identity_type,
                training_access, sponsor_name, access_expires_at,
                clearance_reviewed_by, clearance_reviewed_at,
                clearance_evidence_reference
           FROM users WHERE id = ?`,
      )
      .get(id) as UserRow | undefined;

  const requireRecoveryAdministrator = (actorId: string): UserRow => {
    const actor = getUserById(actorId);
    if (
      !actor ||
      !actor.is_active ||
      !accountAccessAvailable(actor, clock()) ||
      actor.access_status !== "cleared" ||
      actor.identity_type !== "workforce" ||
      !IDENTITY_RECOVERY_ADMIN_ROLES.has(actor.role)
    ) {
      throw new IdentityError(
        "RECOVERY_ADMIN_REQUIRED",
        "An active AMOS-OPS administrator is required for account recovery.",
      );
    }
    return actor;
  };

  const recordSecurityEvent = (input: {
    userId: string;
    actorId?: string | null;
    eventType: string;
    rationale: string;
    occurredAt?: Date;
  }): void => {
    sqlite
      .prepare(
        `INSERT INTO identity_security_events
           (id, user_id, actor_id, event_type, rationale, occurred_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        randomUUID(),
        input.userId,
        input.actorId ?? null,
        input.eventType,
        input.rationale.trim(),
        nowIso(input.occurredAt ?? clock()),
      );
  };

  const bootstrapInitialAdministrator = (): void => {
    if (!environment.initialAdminEmail) return;

    const existing = getUserByEmail(environment.initialAdminEmail);
    const administratorCount = (
      sqlite
        .prepare(
          "SELECT COUNT(*) AS count FROM users WHERE role = 'super-admin'",
        )
        .get() as {
        count: number;
      }
    ).count;
    if (existing) {
      if (
        existing.role !== "super-admin" ||
        existing.is_active !== 1 ||
        existing.access_status !== "cleared" ||
        existing.identity_type !== "workforce"
      ) {
        throw new Error(
          "INITIAL_ADMIN_ACCOUNT_CONFLICT: the configured account is not an active, cleared workforce super-admin.",
        );
      }
      const configuredInvitation = sqlite
        .prepare(
          `SELECT id
             FROM identity_password_reset_tokens
            WHERE user_id = ? AND token_hash = ?
            LIMIT 1`,
        )
        .get(existing.id, environment.initialAdminInvitationTokenHash);
      if (!configuredInvitation) {
        const now = nowIso(clock());
        sqlite.transaction(() => {
          sqlite
            .prepare(
              `UPDATE identity_password_reset_tokens
                  SET consumed_at = ?
                WHERE user_id = ?
                  AND consumed_at IS NULL
                  AND requested_ip IN (
                    'controlled-initial-admin-bootstrap',
                    'controlled-initial-admin-recovery'
                  )`,
            )
            .run(now, existing.id);
          sqlite
            .prepare(
              `INSERT INTO identity_password_reset_tokens
                 (id, user_id, token_hash, created_at, expires_at, requested_ip)
               VALUES (?, ?, ?, ?, ?, 'controlled-initial-admin-recovery')`,
            )
            .run(
              randomUUID(),
              existing.id,
              environment.initialAdminInvitationTokenHash,
              now,
              environment.initialAdminInvitationExpiresAt,
            );
        })();
      }
      return;
    }
    if (administratorCount !== 0) {
      throw new Error(
        "INITIAL_ADMIN_BOOTSTRAP_REFUSED: a different super-administrator already exists.",
      );
    }

    const now = clock();
    const userId = `AMOS-INITIAL-ADMIN-${createHash("sha256")
      .update(environment.initialAdminEmail)
      .digest("hex")
      .slice(0, 24)}`;
    const unusablePasswordHash = bcrypt.hashSync(
      randomBytes(48).toString("base64url"),
      policy.passwordHashRounds,
    );
    const nextReviewAt = nowIso(addDays(now, policy.accessReviewDays));
    const clearanceReference = "AMOS-INITIAL-ADMIN-BOOTSTRAP";
    sqlite.transaction(() => {
      sqlite
        .prepare(
          `INSERT INTO users
             (id, email, password_hash, first_name, last_name, role, department,
              is_active, must_change_password, mfa_enabled, mfa_method,
              access_status, identity_type, training_access,
              next_access_review_at, clearance_reviewed_by,
              clearance_reviewed_at, clearance_evidence_reference,
              created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'super-admin', 'Executive Office',
                   1, 1, 1, 'totp', 'cleared', 'workforce', 1,
                   ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          userId,
          environment.initialAdminEmail,
          unusablePasswordHash,
          environment.initialAdminFirstName,
          environment.initialAdminLastName,
          nextReviewAt,
          userId,
          nowIso(now),
          clearanceReference,
          nowIso(now),
          nowIso(now),
        );
      sqlite
        .prepare(
          `INSERT INTO identity_password_reset_tokens
             (id, user_id, token_hash, created_at, expires_at, requested_ip)
           VALUES (?, ?, ?, ?, ?, 'controlled-initial-admin-bootstrap')`,
        )
        .run(
          randomUUID(),
          userId,
          environment.initialAdminInvitationTokenHash,
          nowIso(now),
          environment.initialAdminInvitationExpiresAt,
        );
      sqlite
        .prepare(
          `INSERT INTO identity_access_reviews
             (id, user_id, due_at, status, created_at)
           VALUES (?, ?, ?, 'pending', ?)`,
        )
        .run(randomUUID(), userId, nextReviewAt, nowIso(now));
      sqlite
        .prepare(
          `INSERT INTO identity_access_profile_events
             (id, user_id, actor_id, previous_status, new_status,
              previous_identity_type, new_identity_type, evidence_reference,
              rationale, occurred_at)
           VALUES (?, ?, NULL, NULL, 'cleared', NULL, 'workforce', ?, ?, ?)`,
        )
        .run(
          randomUUID(),
          userId,
          clearanceReference,
          "User-authorized controlled initial production administrator bootstrap.",
          nowIso(now),
        );
    })();
  };

  bootstrapInitialAdministrator();

  const recordAttempt = (
    email: string,
    successful: boolean,
    outcome: string,
    context: IdentityRequestContext,
    userId?: string,
  ): void => {
    sqlite
      .prepare(
        `INSERT INTO identity_login_attempts
           (id, user_id, normalized_email, successful, outcome, attempted_at, ip_address, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        randomUUID(),
        userId ?? null,
        normalizeEmail(email),
        successful ? 1 : 0,
        outcome,
        nowIso(clock()),
        context.ipAddress ?? null,
        context.userAgent ?? null,
      );
  };

  const issueSession = (
    user: UserRow,
    context: IdentityRequestContext,
    mfaVerified: boolean,
  ): AuthenticatedResult => {
    const now = clock();
    const token = randomBytes(32).toString("base64url");
    const idleExpiresAt = nowIso(addMinutes(now, policy.sessionIdleMinutes));
    const absoluteExpiresAt = nowIso(
      addMinutes(now, policy.sessionAbsoluteMinutes),
    );
    sqlite
      .prepare(
        `INSERT INTO identity_sessions
           (id, user_id, token_hash, environment_id, authenticated_at, last_seen_at,
            idle_expires_at, absolute_expires_at, mfa_verified, ip_address, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        randomUUID(),
        user.id,
        hashOpaqueValue(token),
        environment.environmentId,
        nowIso(now),
        nowIso(now),
        idleExpiresAt,
        absoluteExpiresAt,
        mfaVerified ? 1 : 0,
        context.ipAddress ?? null,
        context.userAgent ?? null,
      );
    sqlite
      .prepare(
        `UPDATE users
            SET failed_login_count = 0, locked_until = NULL, last_login_at = ?, updated_at = ?
          WHERE id = ?`,
      )
      .run(nowIso(now), nowIso(now), user.id);
    return {
      status: "authenticated",
      token,
      user: toUser(user),
      idleExpiresAt,
      absoluteExpiresAt,
      mfaVerified,
    };
  };

  const issueMfaChallenge = (user: UserRow): MfaRequiredResult => {
    const now = clock();
    const challengeId = randomUUID();
    const usesTotp =
      user.mfa_method === "totp" && Boolean(user.mfa_totp_secret);
    if (environment.isProduction && !usesTotp) {
      throw new IdentityError(
        "MFA_ENROLLMENT_REQUIRED",
        "Authenticator enrollment is required. Ask an AMOS-OPS administrator to issue a secure account-recovery link.",
      );
    }
    const reviewOwner =
      !usesTotp &&
      environment.reviewDeployment &&
      environment.finalGateOwnerEmail === normalizeEmail(user.email);
    const code = usesTotp
      ? null
      : reviewOwner
        ? environment.reviewOwnerMfaCode!
        : randomInt(0, 1_000_000).toString().padStart(6, "0");
    const expiresAt = nowIso(addMinutes(now, policy.mfaChallengeMinutes));
    const destination = usesTotp
      ? "your authenticator app"
      : maskEmail(user.email);
    sqlite
      .prepare(
        `UPDATE identity_mfa_challenges
            SET consumed_at = ?
          WHERE user_id = ? AND consumed_at IS NULL`,
      )
      .run(nowIso(now), user.id);
    sqlite
      .prepare(
        `INSERT INTO identity_mfa_challenges
           (id, user_id, code_hash, purpose, created_at, expires_at, delivery_destination)
         VALUES (?, ?, ?, 'login', ?, ?, ?)`,
      )
      .run(
        challengeId,
        user.id,
        usesTotp
          ? hashOpaqueValue(`${challengeId}:totp`)
          : hashOpaqueValue(`${challengeId}:${code}`),
        nowIso(now),
        expiresAt,
        destination,
      );
    return {
      status: "mfa_required",
      challengeId,
      deliveryMethod: usesTotp ? "totp" : "email-otp",
      destination,
      expiresAt,
      ...(code && environment.isDemo && environment.evaluationMode
        ? { evaluationCode: code }
        : {}),
    };
  };

  const login = async (input: LoginInput): Promise<LoginResult> => {
    const email = normalizeEmail(input.email);
    const user = getUserByEmail(email);
    const now = clock();
    if (!user || !user.is_active || !accountAccessAvailable(user, now)) {
      recordAttempt(email, false, "invalid_credentials", input, user?.id);
      throw new IdentityError(
        "INVALID_CREDENTIALS",
        "Invalid email or password.",
      );
    }
    if (
      user.locked_until &&
      new Date(user.locked_until).getTime() > now.getTime()
    ) {
      recordAttempt(email, false, "account_locked", input, user.id);
      throw new IdentityError(
        "ACCOUNT_LOCKED",
        "This account is temporarily locked. Use account recovery or try again later.",
      );
    }

    const validPassword = await bcrypt.compare(
      input.password,
      user.password_hash,
    );
    if (!validPassword) {
      const failedCount = (user.failed_login_count ?? 0) + 1;
      const lockedUntil =
        failedCount >= policy.maximumFailedLogins
          ? nowIso(addMinutes(now, policy.lockoutMinutes))
          : null;
      sqlite
        .prepare(
          "UPDATE users SET failed_login_count = ?, locked_until = ?, updated_at = ? WHERE id = ?",
        )
        .run(failedCount, lockedUntil, nowIso(now), user.id);
      recordAttempt(
        email,
        false,
        lockedUntil ? "locked_after_failures" : "invalid_credentials",
        input,
        user.id,
      );
      throw new IdentityError(
        "INVALID_CREDENTIALS",
        "Invalid email or password.",
      );
    }

    if (user.must_change_password) {
      recordAttempt(email, false, "password_change_required", input, user.id);
      throw new IdentityError(
        "PASSWORD_CHANGE_REQUIRED",
        "A password change is required. Use account recovery to set a new password.",
      );
    }

    recordAttempt(email, true, "password_verified", input, user.id);
    if (requiresMfa(user.role, user.mfa_enabled === 1, policy.mfaPolicy)) {
      return issueMfaChallenge(user);
    }
    return issueSession(user, input, false);
  };

  const verifyMfa = async (
    input: {
      challengeId: string;
      code: string;
    } & IdentityRequestContext,
  ): Promise<AuthenticatedResult> => {
    const challenge = sqlite
      .prepare(
        `SELECT id, user_id, code_hash, expires_at, consumed_at, failed_attempts
           FROM identity_mfa_challenges WHERE id = ?`,
      )
      .get(input.challengeId) as MfaChallengeRow | undefined;
    const now = clock();
    if (
      !challenge ||
      challenge.consumed_at ||
      new Date(challenge.expires_at).getTime() <= now.getTime() ||
      challenge.failed_attempts >= policy.mfaMaximumAttempts
    ) {
      throw new IdentityError(
        "MFA_CHALLENGE_INVALID",
        "The verification challenge is invalid or expired.",
      );
    }
    const user = getUserById(challenge.user_id);
    if (!user || !user.is_active || !accountAccessAvailable(user, now)) {
      throw new IdentityError(
        "ACCOUNT_UNAVAILABLE",
        "The account is unavailable.",
      );
    }
    let acceptedTotpCounter: number | null = null;
    let codeValid = false;
    if (user.mfa_method === "totp" && user.mfa_totp_secret) {
      try {
        const secret = decryptTotpSecret(user.mfa_totp_secret, hashKey);
        acceptedTotpCounter = matchTotpCounter(
          secret,
          input.code.trim(),
          now,
          user.mfa_totp_last_counter,
        );
        codeValid = acceptedTotpCounter !== null;
      } catch {
        throw new IdentityError(
          "MFA_CONFIGURATION_INVALID",
          "Authenticator configuration is unavailable.",
        );
      }
    } else {
      const suppliedHash = hashOpaqueValue(
        `${challenge.id}:${input.code.trim()}`,
      );
      codeValid = safeCompare(challenge.code_hash, suppliedHash);
    }
    if (!codeValid) {
      sqlite
        .prepare(
          "UPDATE identity_mfa_challenges SET failed_attempts = failed_attempts + 1 WHERE id = ?",
        )
        .run(challenge.id);
      throw new IdentityError(
        "MFA_CODE_INVALID",
        "The verification code is invalid.",
      );
    }
    sqlite.transaction(() => {
      sqlite
        .prepare(
          "UPDATE identity_mfa_challenges SET consumed_at = ? WHERE id = ?",
        )
        .run(nowIso(now), challenge.id);
      if (acceptedTotpCounter !== null) {
        sqlite
          .prepare(
            `UPDATE users
                SET mfa_totp_last_counter = ?,
                    mfa_totp_enrolled_at = COALESCE(mfa_totp_enrolled_at, ?),
                    updated_at = ?
              WHERE id = ?`,
          )
          .run(acceptedTotpCounter, nowIso(now), nowIso(now), user.id);
      }
    })();
    recordAttempt(user.email, true, "mfa_verified", input, user.id);
    return issueSession(user, input, true);
  };

  const getSession = (
    token: string,
    refreshIdle = true,
  ): IdentityUser | null => {
    if (!token) return null;
    const row = sqlite
      .prepare(
        `SELECT s.id AS session_id, s.token_hash, s.environment_id,
                s.authenticated_at, s.last_seen_at, s.idle_expires_at,
                s.absolute_expires_at, s.revoked_at, s.mfa_verified,
                u.id, u.email, u.password_hash, u.first_name, u.last_name,
                u.role, u.department, u.is_active, u.failed_login_count,
                u.locked_until, u.must_change_password, u.mfa_enabled, u.mfa_method,
                u.mfa_totp_secret, u.mfa_totp_enrolled_at, u.mfa_totp_last_counter,
                u.access_status, u.identity_type, u.training_access, u.sponsor_name,
                u.access_expires_at, u.clearance_reviewed_by, u.clearance_reviewed_at,
                u.clearance_evidence_reference
           FROM identity_sessions s
           JOIN users u ON u.id = s.user_id
          WHERE s.token_hash = ? AND s.environment_id = ?`,
      )
      .get(hashOpaqueValue(token), environment.environmentId) as
      SessionRow | undefined;
    if (!row || row.revoked_at || !row.is_active) return null;
    const now = clock();
    if (!accountAccessAvailable(row, now)) {
      const reason =
        row.access_expires_at &&
        new Date(row.access_expires_at).getTime() <= now.getTime()
          ? "access_expired"
          : `access_${row.access_status}`;
      sqlite
        .prepare(
          "UPDATE identity_sessions SET revoked_at = ?, revoke_reason = ? WHERE user_id = ? AND revoked_at IS NULL",
        )
        .run(nowIso(now), reason, row.id);
      return null;
    }
    if (
      new Date(row.idle_expires_at).getTime() <= now.getTime() ||
      new Date(row.absolute_expires_at).getTime() <= now.getTime()
    ) {
      sqlite
        .prepare(
          "UPDATE identity_sessions SET revoked_at = ?, revoke_reason = 'expired' WHERE id = ?",
        )
        .run(nowIso(now), row.session_id);
      return null;
    }
    if (refreshIdle) {
      const nextIdle = addMinutes(now, policy.sessionIdleMinutes);
      const absoluteExpiry = new Date(row.absolute_expires_at);
      const boundedIdle = nextIdle < absoluteExpiry ? nextIdle : absoluteExpiry;
      sqlite
        .prepare(
          "UPDATE identity_sessions SET last_seen_at = ?, idle_expires_at = ? WHERE id = ?",
        )
        .run(nowIso(now), nowIso(boundedIdle), row.session_id);
    }
    return toUser(row);
  };

  const getSessionSecurity = (
    token: string,
  ): IdentitySessionSecurity | null => {
    const user = getSession(token, false);
    if (!user) return null;
    const row = sqlite
      .prepare(
        `SELECT id AS sessionId, authenticated_at AS authenticatedAt,
                idle_expires_at AS idleExpiresAt,
                absolute_expires_at AS absoluteExpiresAt,
                mfa_verified AS mfaVerified
           FROM identity_sessions
          WHERE token_hash = ? AND environment_id = ? AND revoked_at IS NULL`,
      )
      .get(hashOpaqueValue(token), environment.environmentId) as
      | {
          sessionId: string;
          authenticatedAt: string;
          idleExpiresAt: string;
          absoluteExpiresAt: string;
          mfaVerified: number;
        }
      | undefined;
    return row
      ? {
          ...row,
          mfaVerified: Boolean(row.mfaVerified),
          user,
        }
      : null;
  };

  const revokeToken = (token: string, reason = "logout"): boolean => {
    const result = sqlite
      .prepare(
        `UPDATE identity_sessions
            SET revoked_at = ?, revoke_reason = ?
          WHERE token_hash = ? AND environment_id = ? AND revoked_at IS NULL`,
      )
      .run(
        nowIso(clock()),
        reason,
        hashOpaqueValue(token),
        environment.environmentId,
      );
    return result.changes > 0;
  };

  const revokeAllSessions = (userId: string, reason: string): number => {
    const result = sqlite
      .prepare(
        `UPDATE identity_sessions
            SET revoked_at = ?, revoke_reason = ?
          WHERE user_id = ? AND revoked_at IS NULL`,
      )
      .run(nowIso(clock()), reason, userId);
    return result.changes;
  };

  const register = async (
    input: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      department?: string;
    } & IdentityRequestContext,
  ): Promise<LoginResult> => {
    if (!environment.allowSelfRegistration) {
      throw new IdentityError(
        "REGISTRATION_DISABLED",
        "Self-registration is disabled for this environment.",
      );
    }
    const issues = validatePassword(
      input.password,
      policy.passwordMinimumLength,
    );
    if (issues.length) {
      throw new IdentityError("PASSWORD_POLICY", issues.join(" "));
    }
    const email = normalizeEmail(input.email);
    if (getUserByEmail(email)) {
      throw new IdentityError(
        "ACCOUNT_EXISTS",
        "An account already exists for this email.",
      );
    }
    const now = clock();
    const userId = randomUUID();
    const role = "rcs-day";
    const roleDefinition = canonicalRole(role);
    if (
      input.department !== undefined &&
      input.department.trim() !== roleDefinition.department
    ) {
      throw new IdentityError(
        "DEPARTMENT_ROLE_MISMATCH",
        `Department must be "${roleDefinition.department}" for role "${role}".`,
      );
    }
    const passwordHash = await bcrypt.hash(
      input.password,
      policy.passwordHashRounds,
    );
    const nextReviewAt = nowIso(addDays(now, policy.accessReviewDays));
    sqlite.transaction(() => {
      sqlite
        .prepare(
          `INSERT INTO users
             (id, email, password_hash, first_name, last_name, role, department,
              is_active, failed_login_count, password_changed_at, mfa_enabled,
              access_status, identity_type, training_access,
              next_access_review_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, ?, 0, 'training', 'workforce', 1, ?, ?, ?)`,
        )
        .run(
          userId,
          email,
          passwordHash,
          input.firstName.trim(),
          input.lastName.trim(),
          role,
          roleDefinition.department,
          nowIso(now),
          nextReviewAt,
          nowIso(now),
          nowIso(now),
        );
      sqlite
        .prepare(
          `INSERT INTO identity_access_reviews
             (id, user_id, due_at, status, created_at)
           VALUES (?, ?, ?, 'pending', ?)`,
        )
        .run(randomUUID(), userId, nextReviewAt, nowIso(now));
    })();
    const user = getUserById(userId);
    if (!user)
      throw new IdentityError(
        "ACCOUNT_CREATE_FAILED",
        "Account creation failed.",
      );
    recordAttempt(email, true, "registered", input, userId);
    if (requiresMfa(user.role, false, policy.mfaPolicy)) {
      return issueMfaChallenge(user);
    }
    return issueSession(user, input, false);
  };

  const requestPasswordReset = (input: {
    email: string;
    ipAddress?: string;
  }): { accepted: true; evaluationToken?: string } => {
    // Production recovery is administrator-mediated until a verified delivery
    // provider is configured. A public request must never invalidate a valid
    // administrator-issued invitation or recovery link.
    if (!environment.isDemo || !environment.evaluationMode) {
      return { accepted: true };
    }
    const user = getUserByEmail(input.email);
    if (!user || !user.is_active) return { accepted: true };
    const now = clock();
    const token = randomBytes(32).toString("base64url");
    sqlite
      .prepare(
        `UPDATE identity_password_reset_tokens
            SET consumed_at = ?
          WHERE user_id = ? AND consumed_at IS NULL`,
      )
      .run(nowIso(now), user.id);
    sqlite
      .prepare(
        `INSERT INTO identity_password_reset_tokens
           (id, user_id, token_hash, created_at, expires_at, requested_ip)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        randomUUID(),
        user.id,
        hashOpaqueValue(token),
        nowIso(now),
        nowIso(addMinutes(now, policy.passwordResetMinutes)),
        input.ipAddress ?? null,
      );
    return {
      accepted: true,
      ...(environment.isDemo && environment.evaluationMode
        ? { evaluationToken: token }
        : {}),
    };
  };

  const resetPassword = async (input: {
    token: string;
    newPassword: string;
  }): Promise<PasswordResetResult> => {
    const issues = validatePassword(
      input.newPassword,
      policy.passwordMinimumLength,
    );
    if (issues.length) {
      throw new IdentityError("PASSWORD_POLICY", issues.join(" "));
    }
    const row = sqlite
      .prepare(
        `SELECT id, user_id, expires_at, consumed_at, requested_ip
           FROM identity_password_reset_tokens WHERE token_hash = ?`,
      )
      .get(hashOpaqueValue(input.token)) as PasswordResetRow | undefined;
    const now = clock();
    if (
      !row ||
      row.consumed_at ||
      new Date(row.expires_at).getTime() <= now.getTime()
    ) {
      throw new IdentityError(
        "RESET_TOKEN_INVALID",
        "The password recovery token is invalid or expired.",
      );
    }
    const user = getUserById(row.user_id);
    if (!user || !user.is_active || !accountAccessAvailable(user, now)) {
      throw new IdentityError(
        "ACCOUNT_UNAVAILABLE",
        "The account is unavailable.",
      );
    }
    const issuer = "AMOS-OPS";
    const rotatesTotp = new Set([
      "controlled-initial-admin-bootstrap",
      "controlled-initial-admin-recovery",
      "admin-invitation",
      "admin-account-recovery",
    ]).has(row.requested_ip ?? "");
    const totpSecret =
      user.mfa_method === "totp" && (rotatesTotp || !user.mfa_totp_secret)
        ? generateTotpSecret()
        : null;
    const encryptedTotpSecret = totpSecret
      ? encryptTotpSecret(totpSecret, hashKey)
      : null;
    const passwordHash = await bcrypt.hash(
      input.newPassword,
      policy.passwordHashRounds,
    );
    let revoked = 0;
    sqlite.transaction(() => {
      sqlite
        .prepare(
          `UPDATE users
              SET password_hash = ?, password_changed_at = ?, must_change_password = 0,
                  failed_login_count = 0, locked_until = NULL,
                  mfa_totp_secret = COALESCE(?, mfa_totp_secret),
                  mfa_totp_last_counter = CASE WHEN ? IS NULL
                    THEN mfa_totp_last_counter ELSE NULL END,
                  mfa_totp_enrolled_at = CASE WHEN ? IS NULL
                    THEN mfa_totp_enrolled_at ELSE NULL END,
                  updated_at = ?
            WHERE id = ?`,
        )
        .run(
          passwordHash,
          nowIso(now),
          encryptedTotpSecret,
          encryptedTotpSecret,
          encryptedTotpSecret,
          nowIso(now),
          row.user_id,
        );
      sqlite
        .prepare(
          `UPDATE identity_password_reset_tokens
              SET consumed_at = ?
            WHERE user_id = ? AND consumed_at IS NULL`,
        )
        .run(nowIso(now), row.user_id);
      sqlite
        .prepare(
          `UPDATE identity_mfa_challenges
              SET consumed_at = ?
            WHERE user_id = ? AND consumed_at IS NULL`,
        )
        .run(nowIso(now), row.user_id);
      revoked = revokeAllSessions(row.user_id, "password_reset");
      recordSecurityEvent({
        userId: row.user_id,
        eventType: "password_reset_completed",
        rationale: `Password reset completed through ${row.requested_ip ?? "self-service"}.`,
        occurredAt: now,
      });
    })();
    return {
      success: true,
      sessionsRevoked: revoked,
      ...(totpSecret
        ? {
            totpSetup: {
              secret: totpSecret,
              accountName: user.email,
              issuer,
              otpauthUri: buildTotpUri(totpSecret, user.email, issuer),
            },
          }
        : {}),
    };
  };

  const changePassword = async (input: {
    userId: string;
    currentPassword: string;
    newPassword: string;
  }): Promise<{ success: true; sessionsRevoked: number }> => {
    const user = getUserById(input.userId);
    if (
      !user ||
      !(await bcrypt.compare(input.currentPassword, user.password_hash))
    ) {
      throw new IdentityError(
        "INVALID_CREDENTIALS",
        "The current password is invalid.",
      );
    }
    const issues = validatePassword(
      input.newPassword,
      policy.passwordMinimumLength,
    );
    if (issues.length) {
      throw new IdentityError("PASSWORD_POLICY", issues.join(" "));
    }
    const now = clock();
    const passwordHash = await bcrypt.hash(
      input.newPassword,
      policy.passwordHashRounds,
    );
    sqlite
      .prepare(
        `UPDATE users
            SET password_hash = ?, password_changed_at = ?, must_change_password = 0,
                updated_at = ? WHERE id = ?`,
      )
      .run(passwordHash, nowIso(now), nowIso(now), user.id);
    return {
      success: true,
      sessionsRevoked: revokeAllSessions(user.id, "password_changed"),
    };
  };

  const setMfa = (userId: string, enabled: boolean): { enabled: boolean } => {
    const user = getUserById(userId);
    if (!user)
      throw new IdentityError(
        "ACCOUNT_UNAVAILABLE",
        "The account is unavailable.",
      );
    if (!enabled && requiresMfa(user.role, false, policy.mfaPolicy)) {
      throw new IdentityError(
        "MFA_REQUIRED",
        "MFA is required by policy for this account and cannot be disabled.",
      );
    }
    if (enabled && environment.isProduction && !user.mfa_totp_secret) {
      throw new IdentityError(
        "MFA_ENROLLMENT_REQUIRED",
        "Use secure account recovery to enroll an authenticator before enabling MFA.",
      );
    }
    sqlite
      .prepare(
        `UPDATE users
            SET mfa_enabled = ?,
                mfa_method = CASE
                  WHEN ? = 1 AND mfa_totp_secret IS NOT NULL THEN 'totp'
                  ELSE 'email-otp'
                END,
                updated_at = ?
          WHERE id = ?`,
      )
      .run(enabled ? 1 : 0, enabled ? 1 : 0, nowIso(clock()), userId);
    return { enabled };
  };

  const listSessions = (userId: string): IdentitySessionSummary[] =>
    (
      sqlite
        .prepare(
          `SELECT id, authenticated_at AS authenticatedAt, last_seen_at AS lastSeenAt,
                idle_expires_at AS idleExpiresAt, absolute_expires_at AS absoluteExpiresAt,
                revoked_at AS revokedAt, revoke_reason AS revokeReason,
                mfa_verified AS mfaVerified, ip_address AS ipAddress,
                user_agent AS userAgent
           FROM identity_sessions WHERE user_id = ? ORDER BY authenticated_at DESC`,
        )
        .all(userId) as Array<
        Omit<IdentitySessionSummary, "mfaVerified"> & { mfaVerified: number }
      >
    ).map((session) => ({
      ...session,
      mfaVerified: Boolean(session.mfaVerified),
    }));

  const listUsers = (): IdentityUserSummary[] =>
    (
      sqlite
        .prepare(
          `SELECT u.id, u.email, u.first_name AS firstName, u.last_name AS lastName,
                role, department, is_active AS isActive,
                mfa_enabled AS mfaEnabled, mfa_method AS mfaMethod,
                mfa_totp_enrolled_at AS mfaEnrolledAt,
                failed_login_count AS failedLoginCount,
                CASE WHEN locked_until > ? THEN locked_until ELSE NULL END AS lockedUntil,
                must_change_password AS mustChangePassword,
                (SELECT MAX(r.expires_at)
                   FROM identity_password_reset_tokens r
                  WHERE r.user_id = u.id
                    AND r.consumed_at IS NULL
                    AND r.expires_at > ?) AS pendingRecoveryExpiresAt,
                last_login_at AS lastLoginAt,
                next_access_review_at AS nextAccessReviewAt,
                created_at AS createdAt, access_status AS accessStatus,
                identity_type AS identityType, training_access AS trainingAccess,
                sponsor_name AS sponsorName, access_expires_at AS accessExpiresAt,
                clearance_reviewed_at AS clearanceReviewedAt,
                clearance_evidence_reference AS clearanceEvidenceReference
           FROM users u ORDER BY created_at DESC`,
        )
        .all(nowIso(clock()), nowIso(clock())) as Array<
        Omit<
          IdentityUserSummary,
          "isActive" | "mfaEnabled" | "mustChangePassword" | "trainingAccess"
        > & {
          isActive: number;
          mfaEnabled: number;
          mustChangePassword: number;
          trainingAccess: number;
        }
      >
    ).map((user) => ({
      ...user,
      isActive: Boolean(user.isActive),
      mfaEnabled: Boolean(user.mfaEnabled),
      mustChangePassword: Boolean(user.mustChangePassword),
      trainingAccess: Boolean(user.trainingAccess),
    }));

  const createTrainingAccount = async (input: {
    actorId: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    identityType: IdentityType;
    sponsorName: string;
    accessExpiresAt?: string | null;
    rationale: string;
  }): Promise<{
    success: true;
    userId: string;
    invitationToken: string;
    expiresAt: string;
  }> => {
    const email = normalizeEmail(input.email);
    if (getUserByEmail(email)) {
      throw new IdentityError(
        "ACCOUNT_EXISTS",
        "An account already exists for this email.",
      );
    }
    if (!input.sponsorName.trim()) {
      throw new IdentityError(
        "SPONSOR_REQUIRED",
        "A sponsor is required for Training access.",
      );
    }
    const roleDefinition = canonicalRole(input.role);
    const now = clock();
    if (
      input.accessExpiresAt &&
      new Date(input.accessExpiresAt).getTime() <= now.getTime()
    ) {
      throw new IdentityError(
        "ACCESS_EXPIRY_INVALID",
        "Training access expiry must be in the future.",
      );
    }
    const userId = randomUUID();
    const invitationToken = randomBytes(32).toString("base64url");
    const expiresAt = nowIso(addDays(now, 7));
    const unusablePasswordHash = await bcrypt.hash(
      randomBytes(32).toString("base64url"),
      policy.passwordHashRounds,
    );
    const nextReviewAt = nowIso(addDays(now, policy.accessReviewDays));
    sqlite.transaction(() => {
      sqlite
        .prepare(
          `INSERT INTO users
           (id, email, password_hash, first_name, last_name, role, department,
            is_active, must_change_password, mfa_enabled, mfa_method, access_status,
            identity_type, training_access, sponsor_name, access_expires_at,
            next_access_review_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, 1, 'totp', 'training', ?, 1, ?, ?, ?, ?, ?)`,
        )
        .run(
          userId,
          email,
          unusablePasswordHash,
          input.firstName.trim(),
          input.lastName.trim(),
          input.role,
          roleDefinition.department,
          input.identityType,
          input.sponsorName.trim(),
          input.accessExpiresAt ?? null,
          nextReviewAt,
          nowIso(now),
          nowIso(now),
        );
      sqlite
        .prepare(
          `INSERT INTO identity_password_reset_tokens
           (id, user_id, token_hash, created_at, expires_at, requested_ip)
         VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(
          randomUUID(),
          userId,
          hashOpaqueValue(invitationToken),
          nowIso(now),
          expiresAt,
          "admin-invitation",
        );
      sqlite
        .prepare(
          `INSERT INTO identity_access_reviews (id, user_id, due_at, status, created_at)
         VALUES (?, ?, ?, 'pending', ?)`,
        )
        .run(randomUUID(), userId, nextReviewAt, nowIso(now));
      sqlite
        .prepare(
          `INSERT INTO identity_access_profile_events
           (id, user_id, actor_id, previous_status, new_status,
            previous_identity_type, new_identity_type, rationale, occurred_at)
         VALUES (?, ?, ?, NULL, 'training', NULL, ?, ?, ?)`,
        )
        .run(
          randomUUID(),
          userId,
          input.actorId,
          input.identityType,
          input.rationale.trim(),
          nowIso(now),
        );
    })();
    return { success: true, userId, invitationToken, expiresAt };
  };

  const issueAccountRecovery = (input: {
    actorId: string;
    userId: string;
    rationale: string;
  }): AdministratorRecoveryResult => {
    requireRecoveryAdministrator(input.actorId);
    const user = getUserById(input.userId);
    const now = clock();
    if (!user || !user.is_active || !accountAccessAvailable(user, now)) {
      throw new IdentityError(
        "ACCOUNT_UNAVAILABLE",
        "The account must be active and available before access can be recovered.",
      );
    }
    if (!input.rationale.trim()) {
      throw new IdentityError(
        "RECOVERY_RATIONALE_REQUIRED",
        "A rationale is required for administrator account recovery.",
      );
    }

    const recoveryToken = randomBytes(32).toString("base64url");
    const expiresAt = nowIso(
      addMinutes(now, policy.administratorRecoveryMinutes),
    );
    let sessionsRevoked = 0;
    sqlite.transaction(() => {
      sqlite
        .prepare(
          `UPDATE identity_password_reset_tokens
              SET consumed_at = ?
            WHERE user_id = ? AND consumed_at IS NULL`,
        )
        .run(nowIso(now), user.id);
      sqlite
        .prepare(
          `UPDATE identity_mfa_challenges
              SET consumed_at = ?
            WHERE user_id = ? AND consumed_at IS NULL`,
        )
        .run(nowIso(now), user.id);
      sqlite
        .prepare(
          `UPDATE users
              SET failed_login_count = 0,
                  locked_until = NULL,
                  must_change_password = 1,
                  mfa_enabled = 1,
                  mfa_method = 'totp',
                  mfa_totp_secret = NULL,
                  mfa_totp_enrolled_at = NULL,
                  mfa_totp_last_counter = NULL,
                  updated_at = ?
            WHERE id = ?`,
        )
        .run(nowIso(now), user.id);
      sqlite
        .prepare(
          `INSERT INTO identity_password_reset_tokens
             (id, user_id, token_hash, created_at, expires_at, requested_ip)
           VALUES (?, ?, ?, ?, ?, 'admin-account-recovery')`,
        )
        .run(
          randomUUID(),
          user.id,
          hashOpaqueValue(recoveryToken),
          nowIso(now),
          expiresAt,
        );
      sessionsRevoked = revokeAllSessions(
        user.id,
        "administrator_account_recovery",
      );
      recordSecurityEvent({
        userId: user.id,
        actorId: input.actorId,
        eventType: "administrator_account_recovery_issued",
        rationale: input.rationale,
        occurredAt: now,
      });
    })();
    return {
      success: true,
      userId: user.id,
      email: user.email,
      recoveryToken,
      expiresAt,
      sessionsRevoked,
    };
  };

  const unlockAccount = (input: {
    actorId: string;
    userId: string;
    rationale: string;
  }): { success: true; wasLocked: boolean } => {
    requireRecoveryAdministrator(input.actorId);
    const user = getUserById(input.userId);
    const now = clock();
    if (!user || !user.is_active || !accountAccessAvailable(user, now)) {
      throw new IdentityError(
        "ACCOUNT_UNAVAILABLE",
        "The account must be active and available before it can be unlocked.",
      );
    }
    if (!input.rationale.trim()) {
      throw new IdentityError(
        "RECOVERY_RATIONALE_REQUIRED",
        "A rationale is required for administrator account unlock.",
      );
    }
    const wasLocked =
      user.failed_login_count > 0 ||
      Boolean(
        user.locked_until &&
        new Date(user.locked_until).getTime() > now.getTime(),
      );
    sqlite.transaction(() => {
      sqlite
        .prepare(
          `UPDATE users
              SET failed_login_count = 0, locked_until = NULL, updated_at = ?
            WHERE id = ?`,
        )
        .run(nowIso(now), user.id);
      recordSecurityEvent({
        userId: user.id,
        actorId: input.actorId,
        eventType: "administrator_account_unlocked",
        rationale: input.rationale,
        occurredAt: now,
      });
    })();
    return { success: true, wasLocked };
  };

  const updateUser = (input: {
    id: string;
    actorId?: string;
    role?: string;
    department?: string;
    isActive?: boolean;
    accessStatus?: AccessStatus;
    identityType?: IdentityType;
    trainingAccess?: boolean;
    sponsorName?: string | null;
    accessExpiresAt?: string | null;
    evidenceReference?: string;
    rationale?: string;
  }): { success: true; sessionsRevoked: number } => {
    const user = getUserById(input.id);
    if (!user)
      throw new IdentityError(
        "ACCOUNT_UNAVAILABLE",
        "The account is unavailable.",
      );
    const now = clock();
    const targetStatus = input.accessStatus ?? user.access_status;
    const targetIdentityType = input.identityType ?? user.identity_type;
    if (targetStatus === "cleared" && targetIdentityType === "external_guest") {
      throw new IdentityError(
        "ACCESS_PROFILE_INVALID",
        "External stakeholder accounts must remain in the Training workspace.",
      );
    }
    if (
      input.accessStatus === "cleared" &&
      user.access_status !== "cleared" &&
      !input.evidenceReference?.trim()
    ) {
      throw new IdentityError(
        "CLEARANCE_EVIDENCE_REQUIRED",
        "A clearance evidence reference is required before Operational access is granted.",
      );
    }
    const profileChanged =
      input.accessStatus !== undefined ||
      input.identityType !== undefined ||
      input.trainingAccess !== undefined ||
      input.sponsorName !== undefined ||
      input.accessExpiresAt !== undefined;
    if (profileChanged && !input.rationale?.trim()) {
      throw new IdentityError(
        "ACCESS_RATIONALE_REQUIRED",
        "A rationale is required for access profile changes.",
      );
    }
    const targetRole = input.role ?? user.role;
    const roleDefinition =
      input.role !== undefined || input.department !== undefined
        ? canonicalRole(targetRole)
        : null;
    if (
      input.department !== undefined &&
      input.department.trim() !== roleDefinition?.department
    ) {
      throw new IdentityError(
        "DEPARTMENT_ROLE_MISMATCH",
        `Department must be "${roleDefinition?.department ?? "the canonical department"}" for role "${targetRole}".`,
      );
    }
    const fields: string[] = [];
    const values: Array<string | number | null> = [];
    if (input.role !== undefined) {
      fields.push("role = ?");
      values.push(targetRole);
      fields.push("department = ?");
      values.push(roleDefinition?.department ?? null);
    }
    if (input.department !== undefined && input.role === undefined) {
      fields.push("department = ?");
      values.push(roleDefinition?.department ?? null);
    }
    if (input.isActive !== undefined) {
      fields.push("is_active = ?");
      values.push(input.isActive ? 1 : 0);
    }
    if (input.accessStatus !== undefined) {
      fields.push("access_status = ?");
      values.push(input.accessStatus);
      if (input.accessStatus === "deactivated") {
        fields.push("is_active = 0");
      }
      if (
        input.accessStatus === "cleared" &&
        user.access_status !== "cleared"
      ) {
        fields.push(
          "clearance_reviewed_by = ?",
          "clearance_reviewed_at = ?",
          "clearance_evidence_reference = ?",
        );
        values.push(
          input.actorId ?? input.id,
          nowIso(now),
          input.evidenceReference?.trim() ?? null,
        );
      }
    }
    if (input.identityType !== undefined) {
      fields.push("identity_type = ?");
      values.push(input.identityType);
    }
    if (input.trainingAccess !== undefined) {
      fields.push("training_access = ?");
      values.push(input.trainingAccess ? 1 : 0);
    }
    if (input.sponsorName !== undefined) {
      fields.push("sponsor_name = ?");
      values.push(input.sponsorName?.trim() || null);
    }
    if (input.accessExpiresAt !== undefined) {
      fields.push("access_expires_at = ?");
      values.push(input.accessExpiresAt);
    }
    fields.push("updated_at = ?");
    values.push(nowIso(now), input.id);
    sqlite.transaction(() => {
      sqlite
        .prepare(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`)
        .run(...values);
      if (profileChanged) {
        sqlite
          .prepare(
            `INSERT INTO identity_access_profile_events
             (id, user_id, actor_id, previous_status, new_status,
              previous_identity_type, new_identity_type, evidence_reference,
              rationale, occurred_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            randomUUID(),
            input.id,
            input.actorId ?? input.id,
            user.access_status,
            targetStatus,
            user.identity_type,
            targetIdentityType,
            input.evidenceReference?.trim() || null,
            input.rationale!.trim(),
            nowIso(now),
          );
      }
    })();

    let sessionsRevoked = 0;
    if (
      input.isActive === false ||
      input.role !== undefined ||
      profileChanged
    ) {
      sessionsRevoked = revokeAllSessions(
        input.id,
        input.isActive === false
          ? "account_disabled"
          : profileChanged
            ? "access_profile_changed"
            : "role_changed",
      );
    }
    if (input.role !== undefined || input.department !== undefined) {
      const pending = sqlite
        .prepare(
          "SELECT id FROM identity_access_reviews WHERE user_id = ? AND status = 'pending' LIMIT 1",
        )
        .get(input.id);
      if (!pending) {
        sqlite
          .prepare(
            `INSERT INTO identity_access_reviews
               (id, user_id, due_at, status, created_at)
             VALUES (?, ?, ?, 'pending', ?)`,
          )
          .run(randomUUID(), input.id, nowIso(now), nowIso(now));
      }
    }
    return { success: true, sessionsRevoked };
  };

  const deleteUser = (
    userId: string,
  ): { success: true; deactivated: true; sessionsRevoked: number } => {
    const user = getUserById(userId);
    if (!user) return { success: true, deactivated: true, sessionsRevoked: 0 };
    const now = nowIso(clock());
    sqlite
      .prepare("UPDATE users SET is_active = 0, updated_at = ? WHERE id = ?")
      .run(now, userId);
    const sessionsRevoked = revokeAllSessions(userId, "account_deactivated");
    return { success: true, deactivated: true, sessionsRevoked };
  };

  const listAccessReviews = (): IdentityAccessReviewSummary[] =>
    (
      sqlite
        .prepare(
          `SELECT ar.id, ar.user_id AS userId, ar.due_at AS dueAt,
                ar.status, ar.decision, ar.reviewer_id AS reviewerId,
                ar.reviewed_at AS reviewedAt, ar.rationale,
                u.email, u.first_name AS firstName, u.last_name AS lastName,
                u.role, u.department, u.is_active AS isActive
           FROM identity_access_reviews ar
           JOIN users u ON u.id = ar.user_id
          WHERE ar.status = 'pending'
          ORDER BY ar.due_at ASC`,
        )
        .all() as Array<
        Omit<IdentityAccessReviewSummary, "isActive"> & { isActive: number }
      >
    ).map((review) => ({
      ...review,
      isActive: Boolean(review.isActive),
    }));

  const completeAccessReview = (input: {
    reviewId: string;
    reviewerId: string;
    decision: "retain" | "modify" | "revoke";
    rationale: string;
  }): { success: true; sessionsRevoked: number } => {
    const review = sqlite
      .prepare(
        "SELECT id, user_id FROM identity_access_reviews WHERE id = ? AND status = 'pending'",
      )
      .get(input.reviewId) as { id: string; user_id: string } | undefined;
    if (!review) {
      throw new IdentityError(
        "ACCESS_REVIEW_INVALID",
        "The access review is unavailable.",
      );
    }
    const now = clock();
    const nextReviewAt = nowIso(addDays(now, policy.accessReviewDays));
    let revoked = 0;
    sqlite.transaction(() => {
      sqlite
        .prepare(
          `UPDATE identity_access_reviews
              SET status = 'completed', decision = ?, reviewer_id = ?,
                  reviewed_at = ?, rationale = ? WHERE id = ?`,
        )
        .run(
          input.decision,
          input.reviewerId,
          nowIso(now),
          input.rationale.trim(),
          review.id,
        );
      sqlite
        .prepare(
          `UPDATE users SET last_access_review_at = ?, next_access_review_at = ?,
                            is_active = CASE WHEN ? = 'revoke' THEN 0 ELSE is_active END,
                            updated_at = ? WHERE id = ?`,
        )
        .run(
          nowIso(now),
          input.decision === "revoke" ? null : nextReviewAt,
          input.decision,
          nowIso(now),
          review.user_id,
        );
      if (input.decision !== "revoke") {
        sqlite
          .prepare(
            `INSERT INTO identity_access_reviews
               (id, user_id, due_at, status, created_at)
             VALUES (?, ?, ?, 'pending', ?)`,
          )
          .run(randomUUID(), review.user_id, nextReviewAt, nowIso(now));
      }
      if (input.decision === "revoke") {
        revoked = revokeAllSessions(review.user_id, "access_review_revoked");
      }
    })();
    return { success: true, sessionsRevoked: revoked };
  };

  return {
    policy: Object.freeze({ ...policy }),
    register,
    login,
    verifyMfa,
    getSession,
    getSessionSecurity,
    revokeToken,
    revokeAllSessions,
    requestPasswordReset,
    resetPassword,
    changePassword,
    setMfa,
    listSessions,
    listUsers,
    createTrainingAccount,
    issueAccountRecovery,
    unlockAccount,
    updateUser,
    deleteUser,
    listAccessReviews,
    completeAccessReview,
  };
}

export const identityService = createIdentityService(applicationDatabase);

export function bearerTokenFromRequest(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length).trim();
  return token || null;
}

const EVALUATION_SESSION_TOKEN = "amos-evaluation-session";

export function resolveEvaluationIdentity(
  request: Request,
  environment: EnvironmentConfig = env,
): IdentityUser | null {
  if (!environment.isDemo || !environment.evaluationMode) return null;
  if (bearerTokenFromRequest(request) !== EVALUATION_SESSION_TOKEN) return null;
  const role = request.headers.get("x-amos-evaluation-role")?.trim();
  if (!role || !CANONICAL_ROLES.has(role)) return null;
  const definition = getRoleDef(role as UserRole);
  return Object.freeze({
    id: `SYNTH-EVALUATION-${role.toUpperCase()}`,
    email: `${role}@evaluation.amos-ops.invalid`,
    firstName: "Synthetic",
    lastName: definition.label,
    name: `Synthetic ${definition.label}`,
    role,
    department: definition.department,
    mfaEnabled: false,
    accessStatus: "training",
    identityType: "external_guest",
    trainingAccess: true,
    sponsorName: "AMOS evaluation",
    accessExpiresAt: null,
    dataScope: "training",
  });
}

export function resolveRequestedDataScope(
  user: IdentityUser,
  request: Request,
): DataScope | null {
  const requested = request.headers
    .get("x-amos-workspace")
    ?.trim()
    .toLowerCase();
  if (user.accessStatus === "training") {
    return requested && requested !== "training" ? null : "training";
  }
  if (user.accessStatus !== "cleared") return null;
  if (requested === "training") return user.trainingAccess ? "training" : null;
  if (requested && requested !== "operational") return null;
  return "operational";
}

export function resolveIdentityUser(request: Request): IdentityUser | null {
  const evaluationIdentity = resolveEvaluationIdentity(request);
  if (evaluationIdentity) return evaluationIdentity;
  const token = bearerTokenFromRequest(request);
  return token ? identityService.getSession(token) : null;
}
