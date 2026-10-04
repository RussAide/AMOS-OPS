CREATE TABLE `gad_logistics_workplan_items` (
  `id` text PRIMARY KEY NOT NULL,
  `request_id` text NOT NULL,
  `owner_user_id` text NOT NULL,
  `owner_role` text NOT NULL,
  `title` text NOT NULL,
  `action_type` text NOT NULL,
  `priority` text DEFAULT 'routine' NOT NULL,
  `status` text DEFAULT 'planned' NOT NULL,
  `planned_for` text NOT NULL,
  `due_at` text,
  `dependency_owner` text,
  `handoff_to` text,
  `notes` text,
  `created_by` text NOT NULL,
  `completed_at` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`request_id`) REFERENCES `gad_logistics_requests`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_gad_logistics_workplan_owner`
  ON `gad_logistics_workplan_items` (`owner_user_id`, `status`, `planned_for`);
--> statement-breakpoint
CREATE INDEX `idx_gad_logistics_workplan_request`
  ON `gad_logistics_workplan_items` (`request_id`, `status`);
--> statement-breakpoint
CREATE INDEX `idx_gad_logistics_workplan_due`
  ON `gad_logistics_workplan_items` (`status`, `due_at`);
