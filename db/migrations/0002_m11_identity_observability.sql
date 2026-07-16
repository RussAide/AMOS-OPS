-- M1.1-02 / M1.1-07: versioned identity and operational-observability schema.
-- Runtime ensure functions remain idempotent compatibility guards; controlled
-- environments use this migration sequence as the authoritative schema path.

ALTER TABLE `users` ADD COLUMN `failed_login_count` INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `locked_until` TEXT;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `password_changed_at` TEXT;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `must_change_password` INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `mfa_enabled` INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `mfa_method` TEXT NOT NULL DEFAULT 'email-otp';
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `last_login_at` TEXT;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `last_access_review_at` TEXT;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `next_access_review_at` TEXT;
--> statement-breakpoint

CREATE TABLE `identity_sessions` (
	`id` TEXT PRIMARY KEY NOT NULL,
	`user_id` TEXT NOT NULL,
	`token_hash` TEXT NOT NULL UNIQUE,
	`environment_id` TEXT NOT NULL,
	`authenticated_at` TEXT NOT NULL,
	`last_seen_at` TEXT NOT NULL,
	`idle_expires_at` TEXT NOT NULL,
	`absolute_expires_at` TEXT NOT NULL,
	`revoked_at` TEXT,
	`revoke_reason` TEXT,
	`mfa_verified` INTEGER NOT NULL DEFAULT 0,
	`ip_address` TEXT,
	`user_agent` TEXT,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `idx_identity_sessions_user` ON `identity_sessions` (`user_id`, `revoked_at`);
--> statement-breakpoint
CREATE INDEX `idx_identity_sessions_expiry` ON `identity_sessions` (`idle_expires_at`, `absolute_expires_at`);
--> statement-breakpoint

CREATE TABLE `identity_login_attempts` (
	`id` TEXT PRIMARY KEY NOT NULL,
	`user_id` TEXT,
	`normalized_email` TEXT NOT NULL,
	`successful` INTEGER NOT NULL,
	`outcome` TEXT NOT NULL,
	`attempted_at` TEXT NOT NULL,
	`ip_address` TEXT,
	`user_agent` TEXT,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE INDEX `idx_identity_login_attempts_email` ON `identity_login_attempts` (`normalized_email`, `attempted_at`);
--> statement-breakpoint

CREATE TABLE `identity_mfa_challenges` (
	`id` TEXT PRIMARY KEY NOT NULL,
	`user_id` TEXT NOT NULL,
	`code_hash` TEXT NOT NULL,
	`purpose` TEXT NOT NULL,
	`created_at` TEXT NOT NULL,
	`expires_at` TEXT NOT NULL,
	`consumed_at` TEXT,
	`failed_attempts` INTEGER NOT NULL DEFAULT 0,
	`delivery_destination` TEXT NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `idx_identity_mfa_user` ON `identity_mfa_challenges` (`user_id`, `expires_at`);
--> statement-breakpoint

CREATE TABLE `identity_password_reset_tokens` (
	`id` TEXT PRIMARY KEY NOT NULL,
	`user_id` TEXT NOT NULL,
	`token_hash` TEXT NOT NULL UNIQUE,
	`created_at` TEXT NOT NULL,
	`expires_at` TEXT NOT NULL,
	`consumed_at` TEXT,
	`requested_ip` TEXT,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `idx_identity_reset_user` ON `identity_password_reset_tokens` (`user_id`, `expires_at`);
--> statement-breakpoint

CREATE TABLE `identity_access_reviews` (
	`id` TEXT PRIMARY KEY NOT NULL,
	`user_id` TEXT NOT NULL,
	`due_at` TEXT NOT NULL,
	`status` TEXT NOT NULL DEFAULT 'pending',
	`decision` TEXT,
	`reviewer_id` TEXT,
	`reviewed_at` TEXT,
	`rationale` TEXT,
	`created_at` TEXT NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
	FOREIGN KEY (`reviewer_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE INDEX `idx_identity_access_reviews_due` ON `identity_access_reviews` (`status`, `due_at`);
--> statement-breakpoint

CREATE TABLE `operational_audit_events` (
	`id` TEXT PRIMARY KEY NOT NULL,
	`event_type` TEXT NOT NULL,
	`action` TEXT NOT NULL,
	`actor` TEXT NOT NULL,
	`resource` TEXT,
	`outcome` TEXT NOT NULL,
	`correlation_id` TEXT NOT NULL,
	`trace_id` TEXT,
	`details_json` TEXT,
	`created_at` TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_operational_audit_correlation` ON `operational_audit_events` (`correlation_id`);
--> statement-breakpoint
CREATE INDEX `idx_operational_audit_created` ON `operational_audit_events` (`created_at`);
--> statement-breakpoint

CREATE TABLE `operational_alerts` (
	`id` TEXT PRIMARY KEY NOT NULL,
	`code` TEXT NOT NULL,
	`severity` TEXT NOT NULL,
	`message` TEXT NOT NULL,
	`correlation_id` TEXT,
	`details_json` TEXT,
	`status` TEXT NOT NULL DEFAULT 'open',
	`created_at` TEXT NOT NULL,
	`resolved_at` TEXT
);
--> statement-breakpoint
CREATE INDEX `idx_operational_alert_status` ON `operational_alerts` (`status`, `created_at`);
