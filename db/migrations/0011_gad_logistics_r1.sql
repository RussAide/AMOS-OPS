CREATE TABLE `gad_logistics_requests` (
  `id` text PRIMARY KEY NOT NULL,
  `request_number` text NOT NULL,
  `origin_division` text NOT NULL,
  `origin_department` text,
  `requester_user_id` text NOT NULL,
  `requester_role` text NOT NULL,
  `facility_id` text,
  `location` text,
  `service_type` text NOT NULL,
  `title` text NOT NULL,
  `requirement` text NOT NULL,
  `priority` text DEFAULT 'routine' NOT NULL,
  `need_by` text,
  `logistics_manager_id` text,
  `logistics_coordinator_id` text,
  `status` text DEFAULT 'submitted' NOT NULL,
  `dependency_type` text,
  `dependency_owner` text,
  `escalation_level` integer DEFAULT 0 NOT NULL,
  `linked_work_order_id` text,
  `linked_procurement_request_id` text,
  `linked_vendor_id` text,
  `linked_safety_record_id` text,
  `verification_owner_id` text,
  `verification_status` text DEFAULT 'pending' NOT NULL,
  `closure_summary` text,
  `assigned_at` text,
  `completed_at` text,
  `closed_at` text,
  `created_at` text,
  `updated_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gad_logistics_requests_request_number_unique`
  ON `gad_logistics_requests` (`request_number`);
--> statement-breakpoint
CREATE INDEX `idx_gad_logistics_requests_requester`
  ON `gad_logistics_requests` (`requester_user_id`, `created_at`);
--> statement-breakpoint
CREATE INDEX `idx_gad_logistics_requests_queue`
  ON `gad_logistics_requests` (`status`, `priority`, `need_by`);
--> statement-breakpoint
CREATE INDEX `idx_gad_logistics_requests_assignment`
  ON `gad_logistics_requests` (`logistics_manager_id`, `logistics_coordinator_id`, `status`);
--> statement-breakpoint
CREATE TABLE `gad_logistics_events` (
  `id` text PRIMARY KEY NOT NULL,
  `request_id` text NOT NULL,
  `sequence` integer NOT NULL,
  `event_type` text NOT NULL,
  `actor_user_id` text NOT NULL,
  `actor_role` text NOT NULL,
  `from_status` text,
  `to_status` text,
  `note` text,
  `evidence_reference` text,
  `occurred_at` text,
  FOREIGN KEY (`request_id`) REFERENCES `gad_logistics_requests`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_gad_logistics_events_sequence`
  ON `gad_logistics_events` (`request_id`, `sequence`);
--> statement-breakpoint
CREATE INDEX `idx_gad_logistics_events_time`
  ON `gad_logistics_events` (`request_id`, `occurred_at`);
