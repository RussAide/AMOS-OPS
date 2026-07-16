import type Database from "better-sqlite3";

interface ColumnInfo {
  name: string;
}

const USER_IDENTITY_COLUMNS = [
  ["failed_login_count", "INTEGER NOT NULL DEFAULT 0"],
  ["locked_until", "TEXT"],
  ["password_changed_at", "TEXT"],
  ["must_change_password", "INTEGER NOT NULL DEFAULT 0"],
  ["mfa_enabled", "INTEGER NOT NULL DEFAULT 0"],
  ["mfa_method", "TEXT NOT NULL DEFAULT 'email-otp'"],
  ["last_login_at", "TEXT"],
  ["last_access_review_at", "TEXT"],
  ["next_access_review_at", "TEXT"],
  ["access_status", "TEXT NOT NULL DEFAULT 'cleared'"],
  ["identity_type", "TEXT NOT NULL DEFAULT 'workforce'"],
  ["training_access", "INTEGER NOT NULL DEFAULT 0"],
  ["sponsor_name", "TEXT"],
  ["access_expires_at", "TEXT"],
  ["clearance_reviewed_by", "TEXT"],
  ["clearance_reviewed_at", "TEXT"],
  ["clearance_evidence_reference", "TEXT"],
] as const;

function ensureUserColumns(sqlite: Database.Database): void {
  const columns = sqlite
    .prepare("PRAGMA table_info(users)")
    .all() as ColumnInfo[];
  const names = new Set(columns.map((column) => column.name));
  for (const [name, definition] of USER_IDENTITY_COLUMNS) {
    if (!names.has(name)) {
      try {
        sqlite.exec(`ALTER TABLE users ADD COLUMN ${name} ${definition}`);
      } catch (error) {
        // Multiple application workers can initialize the same new database at
        // once. If another worker added this exact column after our PRAGMA read,
        // the intended end state already exists; every other failure remains
        // visible instead of being silently ignored.
        if (!String(error).toLowerCase().includes("duplicate column name")) {
          throw error;
        }
      }
    }
  }
}

/**
 * Additive prototype identity schema. It is safe to call repeatedly and never
 * deletes or rewrites application records.
 */
export function ensureIdentitySchema(sqlite: Database.Database): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'rcs-day',
      department TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT,
      updated_at TEXT
    );
  `);
  ensureUserColumns(sqlite);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS identity_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      environment_id TEXT NOT NULL,
      authenticated_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      idle_expires_at TEXT NOT NULL,
      absolute_expires_at TEXT NOT NULL,
      revoked_at TEXT,
      revoke_reason TEXT,
      mfa_verified INTEGER NOT NULL DEFAULT 0,
      ip_address TEXT,
      user_agent TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_identity_sessions_user
      ON identity_sessions(user_id, revoked_at);
    CREATE INDEX IF NOT EXISTS idx_identity_sessions_expiry
      ON identity_sessions(idle_expires_at, absolute_expires_at);

    CREATE TABLE IF NOT EXISTS identity_login_attempts (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      normalized_email TEXT NOT NULL,
      successful INTEGER NOT NULL,
      outcome TEXT NOT NULL,
      attempted_at TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_identity_login_attempts_email
      ON identity_login_attempts(normalized_email, attempted_at);

    CREATE TABLE IF NOT EXISTS identity_mfa_challenges (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      purpose TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      consumed_at TEXT,
      failed_attempts INTEGER NOT NULL DEFAULT 0,
      delivery_destination TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_identity_mfa_user
      ON identity_mfa_challenges(user_id, expires_at);

    CREATE TABLE IF NOT EXISTS identity_password_reset_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      consumed_at TEXT,
      requested_ip TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_identity_reset_user
      ON identity_password_reset_tokens(user_id, expires_at);

    CREATE TABLE IF NOT EXISTS identity_access_reviews (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      due_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      decision TEXT,
      reviewer_id TEXT,
      reviewed_at TEXT,
      rationale TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_identity_access_reviews_due
      ON identity_access_reviews(status, due_at);

    CREATE TABLE IF NOT EXISTS identity_access_profile_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      actor_id TEXT,
      previous_status TEXT,
      new_status TEXT NOT NULL,
      previous_identity_type TEXT,
      new_identity_type TEXT NOT NULL,
      evidence_reference TEXT,
      rationale TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_identity_access_profile_events_user
      ON identity_access_profile_events(user_id, occurred_at);
  `);
}
