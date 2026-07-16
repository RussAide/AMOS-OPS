import { createHash } from "node:crypto";
import type Database from "better-sqlite3";
import type { EnvironmentConfig } from "../lib/env";

interface ReviewOwnerRow {
  id: string;
  email: string;
  role: string;
  is_active: number;
  mfa_enabled: number;
}

/**
 * Provides the isolated review workspace with its owner account. Deployment
 * decisions remain outside the application; this module only establishes
 * authenticated access to the operational experience.
 */
export function ensureReviewOwnerAccount(
  sqlite: Database.Database,
  environment: EnvironmentConfig,
): void {
  if (!environment.reviewDeployment) return;
  const email = environment.finalGateOwnerEmail!;
  const existing = sqlite
    .prepare(
      `SELECT id, email, role, is_active, mfa_enabled
         FROM users WHERE lower(email) = ?`,
    )
    .get(email) as ReviewOwnerRow | undefined;
  if (existing) {
    if (
      existing.role !== "super-admin" ||
      existing.is_active !== 1 ||
      existing.mfa_enabled !== 1
    ) {
      throw new Error(
        "DMS1_REVIEW_OWNER_ACCOUNT_CONFLICT: the configured owner account is not an active MFA-enabled super-admin.",
      );
    }
    return;
  }

  const now = new Date().toISOString();
  const ownerId = `DMS1-OWNER-${createHash("sha256")
    .update(email)
    .digest("hex")
    .slice(0, 24)}`;
  sqlite
    .prepare(
      `INSERT INTO users
         (id, email, password_hash, first_name, last_name, role, department,
          is_active, failed_login_count, password_changed_at, mfa_enabled,
          mfa_method, created_at, updated_at)
       VALUES (?, ?, ?, 'Review', 'Owner', 'super-admin', 'Executive Office',
               1, 0, ?, 1, 'review-otp', ?, ?)`,
    )
    .run(
      ownerId,
      email,
      environment.reviewOwnerPasswordHash!,
      now,
      now,
      now,
    );
}
