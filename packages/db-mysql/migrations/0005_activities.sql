-- Migration: Add activities tables for Activity Pane feature
-- Created: 2025-11-25

-- Create activities table (main org-scoped activities)
CREATE TABLE `activities` (
	`id` char(36) NOT NULL,
	`org_id` char(36) NOT NULL,
	`user_id` varchar(128) NOT NULL,
	`conversation_id` char(36),
	`agent_id` varchar(255),
	`name` varchar(255) NOT NULL,
	`description` text,
	`activity_type` enum('task','scheduled','workflow') NOT NULL DEFAULT 'task',
	`activity_status` enum('pending','running','paused','completed','failed','cancelled') NOT NULL DEFAULT 'pending',
	`progress` int NOT NULL DEFAULT 0,
	`progress_message` varchar(500),
	`schedule_cron` varchar(100),
	`schedule_next_run` timestamp,
	`schedule_last_run` timestamp,
	`schedule_timezone` varchar(50) DEFAULT 'UTC',
	`started_at` timestamp,
	`completed_at` timestamp,
	`estimated_duration_ms` int,
	`actual_duration_ms` int,
	`result` json,
	`error_message` text,
	`error_code` varchar(50),
	`metadata` json,
	`tags` json,
	`priority` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`archived_at` timestamp,
	CONSTRAINT `activities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint

-- Create activity_steps table (sub-tasks within an activity)
CREATE TABLE `activity_steps` (
	`id` char(36) NOT NULL,
	`activity_id` char(36) NOT NULL,
	`step_order` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`activity_step_status` enum('pending','running','completed','failed','skipped') NOT NULL DEFAULT 'pending',
	`started_at` timestamp,
	`completed_at` timestamp,
	`result` json,
	`error_message` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activity_steps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint

-- Create activity_approval_requests table (pending approvals for activities)
CREATE TABLE `activity_approval_requests` (
	`id` char(36) NOT NULL,
	`activity_id` char(36) NOT NULL,
	`approval_request_type` enum('permission','confirmation','input') NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`required_scopes` json,
	`options` json,
	`approval_request_status` enum('pending','approved','denied','expired') NOT NULL DEFAULT 'pending',
	`responded_at` timestamp,
	`response` json,
	`expires_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activity_approval_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint

-- Add indexes for activities table
CREATE INDEX `idx_activities_org_status` ON `activities` (`org_id`,`activity_status`);
--> statement-breakpoint
CREATE INDEX `idx_activities_org_created` ON `activities` (`org_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_activities_schedule_next_run` ON `activities` (`schedule_next_run`);
--> statement-breakpoint
CREATE INDEX `idx_activities_conversation` ON `activities` (`conversation_id`);
--> statement-breakpoint
CREATE INDEX `idx_activities_user` ON `activities` (`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_activities_archived` ON `activities` (`archived_at`);
--> statement-breakpoint

-- Add indexes for activity_steps table
CREATE INDEX `idx_activity_steps_activity` ON `activity_steps` (`activity_id`);
--> statement-breakpoint
CREATE INDEX `idx_activity_steps_order` ON `activity_steps` (`activity_id`,`step_order`);
--> statement-breakpoint

-- Add indexes for activity_approval_requests table
CREATE INDEX `idx_approval_requests_activity` ON `activity_approval_requests` (`activity_id`);
--> statement-breakpoint
CREATE INDEX `idx_approval_requests_status` ON `activity_approval_requests` (`approval_request_status`);
--> statement-breakpoint
CREATE INDEX `idx_approval_requests_expires` ON `activity_approval_requests` (`expires_at`);
