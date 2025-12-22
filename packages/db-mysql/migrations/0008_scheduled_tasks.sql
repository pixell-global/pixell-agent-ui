-- Scheduled Tasks Migration
-- Recurring agent tasks with tier-based limits and execution tracking

-- Schedule type enum (cron, interval, one_time)
-- Schedule status enum (pending_approval, active, paused, completed, disabled, failed, expired)
-- Execution status enum (pending, running, succeeded, failed, cancelled, skipped, retrying)

-- Main schedules table
CREATE TABLE IF NOT EXISTS `schedules` (
  `id` char(36) NOT NULL,
  `org_id` char(36) NOT NULL,
  `user_id` varchar(128) NOT NULL,

  -- Agent configuration
  `agent_id` varchar(255) NOT NULL,
  `agent_name` varchar(255) DEFAULT NULL,

  -- Schedule identification
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `prompt` text NOT NULL,

  -- Schedule type and configuration
  `schedule_type` enum('cron','interval','one_time') NOT NULL,
  `cron_expression` varchar(100) DEFAULT NULL,
  `interval_value` int DEFAULT NULL,
  `interval_unit` enum('minutes','hours','days','weeks') DEFAULT NULL,
  `one_time_at` timestamp NULL DEFAULT NULL,
  `timezone` varchar(50) NOT NULL DEFAULT 'UTC',

  -- Status tracking
  `status` enum('pending_approval','active','paused','completed','disabled','failed','expired') NOT NULL DEFAULT 'pending_approval',

  -- Run tracking
  `next_run_at` timestamp NULL DEFAULT NULL,
  `last_run_at` timestamp NULL DEFAULT NULL,
  `run_count` int NOT NULL DEFAULT '0',
  `success_count` int NOT NULL DEFAULT '0',
  `failure_count` int NOT NULL DEFAULT '0',
  `consecutive_failures` int NOT NULL DEFAULT '0',

  -- Retry configuration (JSON)
  `retry_config` json DEFAULT NULL,

  -- Notification settings (JSON)
  `notification_settings` json DEFAULT NULL,

  -- Context snapshot for files (JSON)
  `context_snapshot` json DEFAULT NULL,

  -- Dedicated conversation thread for this schedule
  `thread_id` char(36) DEFAULT NULL,

  -- Proposal tracking
  `proposal_id` char(36) DEFAULT NULL,
  `from_proposal` tinyint(1) NOT NULL DEFAULT '0',

  -- Validity
  `valid_from` timestamp NULL DEFAULT NULL,
  `valid_until` timestamp NULL DEFAULT NULL,

  -- Timestamps
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `paused_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,

  PRIMARY KEY (`id`),
  KEY `idx_schedules_org_status` (`org_id`,`status`),
  KEY `idx_schedules_org_user` (`org_id`,`user_id`),
  KEY `idx_schedules_agent` (`agent_id`),
  KEY `idx_schedules_next_run` (`next_run_at`),
  KEY `idx_schedules_status` (`status`),
  KEY `idx_schedules_thread` (`thread_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Schedule executions table (individual run history)
CREATE TABLE IF NOT EXISTS `schedule_executions` (
  `id` char(36) NOT NULL,
  `schedule_id` char(36) NOT NULL,
  `org_id` char(36) NOT NULL,

  -- Execution tracking
  `execution_number` int NOT NULL,
  `status` enum('pending','running','succeeded','failed','cancelled','skipped','retrying') NOT NULL DEFAULT 'pending',

  -- Activity reference (creates an activity for each execution)
  `activity_id` char(36) DEFAULT NULL,

  -- Conversation thread (uses schedule's dedicated thread)
  `thread_id` char(36) DEFAULT NULL,

  -- Timing
  `scheduled_at` timestamp NOT NULL,
  `started_at` timestamp NULL DEFAULT NULL,
  `completed_at` timestamp NULL DEFAULT NULL,
  `duration_ms` int DEFAULT NULL,

  -- Retry tracking
  `retry_attempt` int NOT NULL DEFAULT '0',
  `max_retries` int NOT NULL DEFAULT '3',
  `next_retry_at` timestamp NULL DEFAULT NULL,

  -- Result storage
  `result_summary` text DEFAULT NULL,
  `result_outputs` json DEFAULT NULL,

  -- Error tracking
  `error_code` varchar(50) DEFAULT NULL,
  `error_message` text DEFAULT NULL,
  `error_retryable` tinyint(1) DEFAULT NULL,

  -- Timestamps
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  KEY `idx_executions_schedule` (`schedule_id`),
  KEY `idx_executions_org` (`org_id`),
  KEY `idx_executions_status` (`status`),
  KEY `idx_executions_scheduled_at` (`scheduled_at`),
  KEY `idx_executions_activity` (`activity_id`),
  KEY `idx_executions_schedule_status` (`schedule_id`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
