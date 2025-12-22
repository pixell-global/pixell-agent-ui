-- Migration: 0010_billing_events_audit.sql
-- Description: Billing events audit table for LLM verification
-- Date: 2025-12-19
-- Dependencies: Requires orgs table

-- =============================================================================
-- 1. BILLING EVENTS AUDIT TABLE
-- =============================================================================
-- Stores billing claims for async LLM audit verification.
-- Claims are recorded immediately when detected, then audited in background.

CREATE TABLE `billing_events` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

  -- Organization and user context
  `org_id` CHAR(36) NOT NULL,
  `user_id` VARCHAR(128) NOT NULL,

  -- Workflow context
  `workflow_id` VARCHAR(128),
  `session_id` VARCHAR(128),
  `agent_id` VARCHAR(255),

  -- Billing claim details
  `claimed_type` ENUM('research', 'ideation', 'auto_posting', 'monitors') NOT NULL,
  `claimed_tier` ENUM('small', 'medium', 'large', 'xl'),
  `detection_source` ENUM('sdk', 'file_output', 'scheduled_post', 'monitor_event', 'detected') NOT NULL,
  `detection_confidence` DECIMAL(3,2) NOT NULL DEFAULT 1.00,

  -- Content for audit
  `user_prompt` TEXT,
  `agent_response_summary` TEXT,
  `output_artifacts` JSON,

  -- Audit status and results
  `audit_status` ENUM('pending', 'approved', 'flagged', 'refunded', 'skipped') NOT NULL DEFAULT 'pending',
  `audit_result` JSON,
  `audited_at` TIMESTAMP NULL,
  `audited_by` VARCHAR(128),

  -- Quota impact
  `quota_incremented` BOOLEAN NOT NULL DEFAULT FALSE,
  `quota_increment_at` TIMESTAMP NULL,

  -- Timestamps
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Foreign key (references orgs table)
  CONSTRAINT `fk_billing_events_org` FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON DELETE CASCADE
);

-- =============================================================================
-- 2. INDEXES FOR EFFICIENT QUERIES
-- =============================================================================

-- Find pending audits to process
CREATE INDEX `idx_billing_events_audit_status` ON `billing_events`(`audit_status`, `created_at`);

-- Find billing events by org and date
CREATE INDEX `idx_billing_events_org_created` ON `billing_events`(`org_id`, `created_at`);

-- Find billing events by workflow
CREATE INDEX `idx_billing_events_workflow` ON `billing_events`(`workflow_id`);

-- Find flagged events for review (composite index on status and org)
CREATE INDEX `idx_billing_events_flagged` ON `billing_events`(`audit_status`, `org_id`);

-- Find events by detection source for analytics
CREATE INDEX `idx_billing_events_source` ON `billing_events`(`detection_source`, `claimed_type`);

-- =============================================================================
-- 3. AUDIT QUEUE TABLE (for batch processing)
-- =============================================================================

CREATE TABLE `billing_audit_queue` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `billing_event_id` BIGINT UNSIGNED NOT NULL,
  `priority` TINYINT NOT NULL DEFAULT 5,
  `attempts` TINYINT NOT NULL DEFAULT 0,
  `max_attempts` TINYINT NOT NULL DEFAULT 3,
  `last_attempt_at` TIMESTAMP NULL,
  `error_message` TEXT,
  `status` ENUM('pending', 'processing', 'completed', 'failed') NOT NULL DEFAULT 'pending',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT `fk_audit_queue_event` FOREIGN KEY (`billing_event_id`) REFERENCES `billing_events`(`id`) ON DELETE CASCADE
);

-- Index for processing queue
CREATE INDEX `idx_audit_queue_pending` ON `billing_audit_queue`(`status`, `priority`, `created_at`);

-- =============================================================================
-- 4. AUDIT RULES TABLE (configurable audit criteria)
-- =============================================================================

CREATE TABLE `billing_audit_rules` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(128) NOT NULL,
  `description` TEXT,

  -- Rule criteria
  `rule_type` ENUM('tier_mismatch', 'type_mismatch', 'no_evidence', 'quality_check') NOT NULL,
  `feature_type` ENUM('research', 'ideation', 'auto_posting', 'monitors'),
  `detection_source` ENUM('sdk', 'file_output', 'scheduled_post', 'monitor_event', 'detected'),

  -- Thresholds
  `min_file_size_bytes` INT,
  `max_file_size_bytes` INT,
  `min_quality_score` DECIMAL(3,2),

  -- Action
  `auto_flag` BOOLEAN NOT NULL DEFAULT FALSE,
  `require_llm_audit` BOOLEAN NOT NULL DEFAULT TRUE,

  -- Status
  `enabled` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- =============================================================================
-- 5. SEED DEFAULT AUDIT RULES
-- =============================================================================

INSERT INTO `billing_audit_rules` (`name`, `description`, `rule_type`, `auto_flag`, `require_llm_audit`) VALUES
  ('XL Tier Verification', 'Verify all XL tier claims to prevent inflation', 'tier_mismatch', FALSE, TRUE),
  ('SDK Claims Verification', 'Verify SDK-declared billing claims', 'type_mismatch', FALSE, TRUE),
  ('No Evidence Detection', 'Flag claims with no output artifacts', 'no_evidence', TRUE, FALSE),
  ('Research Quality Check', 'Verify research outputs meet quality threshold', 'quality_check', FALSE, TRUE);

-- Tier mismatch rules
INSERT INTO `billing_audit_rules` (`name`, `description`, `rule_type`, `feature_type`, `min_file_size_bytes`, `max_file_size_bytes`, `auto_flag`) VALUES
  ('Small Tier Max Size', 'Auto-flag if claiming small tier but output > 5KB', 'tier_mismatch', NULL, NULL, 5000, FALSE),
  ('XL Tier Min Size', 'Auto-flag XL claims with < 100KB output', 'tier_mismatch', NULL, 100000, NULL, TRUE);

-- =============================================================================
-- 6. BILLING AUDIT SUMMARY VIEW (for dashboards)
-- =============================================================================

CREATE VIEW `v_billing_audit_summary` AS
SELECT
  be.org_id,
  DATE(be.created_at) as event_date,
  be.claimed_type,
  be.audit_status,
  COUNT(*) as event_count,
  SUM(CASE WHEN be.audit_status = 'flagged' THEN 1 ELSE 0 END) as flagged_count,
  SUM(CASE WHEN be.audit_status = 'refunded' THEN 1 ELSE 0 END) as refunded_count,
  AVG(be.detection_confidence) as avg_confidence
FROM `billing_events` be
GROUP BY be.org_id, DATE(be.created_at), be.claimed_type, be.audit_status;

-- =============================================================================
-- ROLLBACK SCRIPT (run manually if needed)
-- =============================================================================
-- DROP VIEW IF EXISTS `v_billing_audit_summary`;
-- DROP TABLE IF EXISTS `billing_audit_queue`;
-- DROP TABLE IF EXISTS `billing_audit_rules`;
-- DROP TABLE IF EXISTS `billing_events`;
