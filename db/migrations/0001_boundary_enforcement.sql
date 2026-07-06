-- D006-03: Human-in-Command Boundary Enforcement Tables
-- Adds phi_access_log, compliance_queue, and boundary_violations tables

CREATE TABLE `phi_access_log` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`user_email` text NOT NULL,
	`patient_id` text NOT NULL,
	`record_type` text NOT NULL,
	`endpoint` text NOT NULL,
	`access_purpose` text NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`accessed_at` text DEFAULT (datetime('now')) NOT NULL,
	`outcome` text DEFAULT 'allowed' NOT NULL,
	`denial_reason` text
);
--> statement-breakpoint
CREATE INDEX `idx_phi_access_user` ON `phi_access_log` (`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_phi_access_patient` ON `phi_access_log` (`patient_id`);
--> statement-breakpoint
CREATE INDEX `idx_phi_access_time` ON `phi_access_log` (`accessed_at`);
--> statement-breakpoint
CREATE TABLE `compliance_queue` (
	`id` text PRIMARY KEY NOT NULL,
	`finding_type` text NOT NULL,
	`severity` text NOT NULL,
	`description` text NOT NULL,
	`client_id` text,
	`program_id` text,
	`evidence_refs` text,
	`reported_by` text NOT NULL,
	`qa_officer_id` text,
	`status` text DEFAULT 'pending_review' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`reviewed_at` text,
	`resolution_notes` text
);
--> statement-breakpoint
CREATE INDEX `idx_compliance_status` ON `compliance_queue` (`status`);
--> statement-breakpoint
CREATE INDEX `idx_compliance_officer` ON `compliance_queue` (`qa_officer_id`);
--> statement-breakpoint
CREATE TABLE `boundary_violations` (
	`id` text PRIMARY KEY NOT NULL,
	`violation_type` text NOT NULL,
	`severity` text NOT NULL,
	`endpoint` text NOT NULL,
	`actor_id` text NOT NULL,
	`actor_email` text NOT NULL,
	`description` text NOT NULL,
	`blocked` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_boundary_violations_type` ON `boundary_violations` (`violation_type`);
--> statement-breakpoint
CREATE INDEX `idx_boundary_violations_actor` ON `boundary_violations` (`actor_id`);
--> statement-breakpoint
CREATE INDEX `idx_boundary_violations_time` ON `boundary_violations` (`created_at`);
