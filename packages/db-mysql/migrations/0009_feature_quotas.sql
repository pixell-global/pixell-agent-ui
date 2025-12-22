-- Migration: 0009_feature_quotas.sql
-- Description: Feature-based usage quotas system
-- Date: 2025-12-17
-- Dependencies: Requires organizations, subscriptions, users tables

-- =============================================================================
-- 1. FEATURE QUOTAS TABLE
-- =============================================================================

CREATE TABLE `feature_quotas` (
  `org_id` CHAR(36) PRIMARY KEY,

  -- Current billing period (synced from subscriptions)
  `billing_period_start` TIMESTAMP NOT NULL,
  `billing_period_end` TIMESTAMP NOT NULL,

  -- Monthly usage quotas - limits (set based on tier)
  `research_limit` INT NOT NULL DEFAULT 0,
  `ideation_limit` INT NOT NULL DEFAULT 0,
  `auto_posting_limit` INT NOT NULL DEFAULT 0,
  `monitors_limit` INT NOT NULL DEFAULT 0,

  -- Monthly usage counters (reset each billing cycle)
  `research_used` INT NOT NULL DEFAULT 0,
  `ideation_used` INT NOT NULL DEFAULT 0,
  `auto_posting_used` INT NOT NULL DEFAULT 0,

  -- Active count (NOT reset - represents current concurrent usage)
  `monitors_active` INT NOT NULL DEFAULT 0,

  -- Feature availability flags (false = N/A/blocked for this tier)
  `research_available` BOOLEAN NOT NULL DEFAULT FALSE,
  `ideation_available` BOOLEAN NOT NULL DEFAULT FALSE,
  `auto_posting_available` BOOLEAN NOT NULL DEFAULT FALSE,
  `monitors_available` BOOLEAN NOT NULL DEFAULT FALSE,

  -- Audit
  `last_reset_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT `fk_feature_quotas_org` FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE
);

-- =============================================================================
-- 2. FEATURE USAGE EVENTS TABLE (Audit Trail)
-- =============================================================================

CREATE TABLE `feature_usage_events` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `org_id` CHAR(36) NOT NULL,
  `user_id` VARCHAR(128) NOT NULL,

  -- Feature info
  `feature_type` ENUM('research', 'ideation', 'auto_posting', 'monitors') NOT NULL,
  `action` ENUM('increment', 'decrement') NOT NULL,

  -- Context
  `resource_id` VARCHAR(255),
  `agent_id` VARCHAR(255),
  `metadata` JSON,

  -- Billing period at time of event
  `billing_period_start` TIMESTAMP NOT NULL,
  `billing_period_end` TIMESTAMP NOT NULL,

  -- Snapshot of usage at time of event
  `usage_at_event` INT NOT NULL,
  `limit_at_event` INT NOT NULL,

  -- Timestamps
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT `fk_feature_usage_org` FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE
);

-- Indexes for feature_usage_events
CREATE INDEX `idx_feature_usage_org_feature` ON `feature_usage_events`(`org_id`, `feature_type`, `created_at`);
CREATE INDEX `idx_feature_usage_org_period` ON `feature_usage_events`(`org_id`, `billing_period_start`);
CREATE INDEX `idx_feature_usage_user` ON `feature_usage_events`(`user_id`);
CREATE INDEX `idx_feature_usage_resource` ON `feature_usage_events`(`resource_id`);

-- =============================================================================
-- 3. SEED EXISTING ORGANIZATIONS WITH THEIR TIER LIMITS
-- =============================================================================

-- Insert feature quotas for all existing organizations based on their subscription tier
-- Tier limits:
-- | Plan    | Research | Ideation | Auto-posting | Monitors |
-- |---------|----------|----------|--------------|----------|
-- | Free    | 2        | 10       | N/A          | N/A      |
-- | Starter | 10       | 30       | N/A          | N/A      |
-- | Pro     | 60       | 300      | 30           | 3        |
-- | Max     | 300      | 3000     | 300          | 20       |

INSERT INTO `feature_quotas` (
  `org_id`,
  `billing_period_start`,
  `billing_period_end`,
  `research_limit`,
  `ideation_limit`,
  `auto_posting_limit`,
  `monitors_limit`,
  `research_used`,
  `ideation_used`,
  `auto_posting_used`,
  `monitors_active`,
  `research_available`,
  `ideation_available`,
  `auto_posting_available`,
  `monitors_available`,
  `last_reset_at`
)
SELECT
  o.id,
  COALESCE(s.current_period_start, NOW()),
  COALESCE(s.current_period_end, DATE_ADD(NOW(), INTERVAL 1 MONTH)),
  -- Research limits by tier
  CASE COALESCE(s.plan_tier, 'free')
    WHEN 'free' THEN 2
    WHEN 'starter' THEN 10
    WHEN 'pro' THEN 60
    WHEN 'max' THEN 300
    ELSE 2
  END,
  -- Ideation limits by tier
  CASE COALESCE(s.plan_tier, 'free')
    WHEN 'free' THEN 10
    WHEN 'starter' THEN 30
    WHEN 'pro' THEN 300
    WHEN 'max' THEN 3000
    ELSE 10
  END,
  -- Auto-posting limits by tier (N/A for free/starter = 0)
  CASE COALESCE(s.plan_tier, 'free')
    WHEN 'pro' THEN 30
    WHEN 'max' THEN 300
    ELSE 0
  END,
  -- Monitors limits by tier (N/A for free/starter = 0)
  CASE COALESCE(s.plan_tier, 'free')
    WHEN 'pro' THEN 3
    WHEN 'max' THEN 20
    ELSE 0
  END,
  -- Usage counters start at 0
  0, 0, 0, 0,
  -- Research available (all tiers)
  TRUE,
  -- Ideation available (all tiers)
  TRUE,
  -- Auto-posting available (pro/max only)
  CASE WHEN COALESCE(s.plan_tier, 'free') IN ('pro', 'max') THEN TRUE ELSE FALSE END,
  -- Monitors available (pro/max only)
  CASE WHEN COALESCE(s.plan_tier, 'free') IN ('pro', 'max') THEN TRUE ELSE FALSE END,
  NOW()
FROM `organizations` o
LEFT JOIN `subscriptions` s ON o.id = s.org_id
WHERE o.id NOT IN (SELECT org_id FROM `feature_quotas`);

-- =============================================================================
-- VERIFICATION QUERIES (for manual verification after running)
-- =============================================================================
-- SELECT COUNT(*) as quota_count FROM feature_quotas;
-- SELECT
--   CASE WHEN s.plan_tier IS NULL THEN 'free' ELSE s.plan_tier END as tier,
--   COUNT(*) as org_count,
--   AVG(f.research_limit) as avg_research_limit,
--   AVG(f.ideation_limit) as avg_ideation_limit
-- FROM feature_quotas f
-- LEFT JOIN subscriptions s ON f.org_id = s.org_id
-- GROUP BY CASE WHEN s.plan_tier IS NULL THEN 'free' ELSE s.plan_tier END;

-- =============================================================================
-- ROLLBACK SCRIPT (run manually if needed)
-- =============================================================================
-- DROP TABLE IF EXISTS `feature_usage_events`;
-- DROP TABLE IF EXISTS `feature_quotas`;
