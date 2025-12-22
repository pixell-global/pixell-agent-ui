-- Migration: 0011_remove_tiers.sql
-- Description: Remove tier-based billing columns, migrate to action-based billing
-- Date: 2025-12-19
--
-- This migration removes the tiered billing system (small/medium/large/xl) and
-- migrates to simple action-based billing where 1 action = 1 count.
--
-- The feature_quotas table already tracks action counts (researchUsed, ideationUsed, etc.)
-- and will be the primary source for billing.

-- =============================================================================
-- 1. REMOVE TIER COLUMN FROM BILLING_EVENTS
-- =============================================================================

ALTER TABLE `billing_events` DROP COLUMN `claimed_tier`;

-- =============================================================================
-- 2. REMOVE TIER COLUMNS FROM BILLABLE_ACTIONS
-- =============================================================================
-- The billable_actions table tracked tier-based credit usage.
-- With action-based billing, we no longer need tier or credit tracking.

ALTER TABLE `billable_actions` DROP COLUMN `action_tier`;
ALTER TABLE `billable_actions` DROP COLUMN `credits_used`;

-- =============================================================================
-- 3. SIMPLIFY CREDIT_BALANCES TABLE
-- =============================================================================
-- The tier-based credit columns are no longer needed.
-- Feature quotas now track usage directly.
-- Keep the table for auto-topup settings but remove tier columns.

ALTER TABLE `credit_balances`
  DROP COLUMN `included_small`,
  DROP COLUMN `included_medium`,
  DROP COLUMN `included_large`,
  DROP COLUMN `included_xl`,
  DROP COLUMN `used_small`,
  DROP COLUMN `used_medium`,
  DROP COLUMN `used_large`,
  DROP COLUMN `used_xl`;

-- =============================================================================
-- 4. UPDATE INDEXES
-- =============================================================================
-- Drop the tier index from billable_actions

DROP INDEX `idx_billable_tier` ON `billable_actions`;

-- =============================================================================
-- ROLLBACK SCRIPT (run manually if needed)
-- =============================================================================
--
-- -- Re-add tier column to billing_events
-- ALTER TABLE `billing_events`
--   ADD COLUMN `claimed_tier` ENUM('small', 'medium', 'large', 'xl') AFTER `claimed_type`;
--
-- -- Re-add columns to billable_actions
-- ALTER TABLE `billable_actions`
--   ADD COLUMN `action_tier` ENUM('small', 'medium', 'large', 'xl') NOT NULL AFTER `user_id`,
--   ADD COLUMN `credits_used` DECIMAL(10,2) NOT NULL AFTER `action_tier`;
-- CREATE INDEX `idx_billable_tier` ON `billable_actions`(`action_tier`);
--
-- -- Re-add columns to credit_balances
-- ALTER TABLE `credit_balances`
--   ADD COLUMN `included_small` INT NOT NULL DEFAULT 0 AFTER `billing_period_end`,
--   ADD COLUMN `included_medium` INT NOT NULL DEFAULT 0 AFTER `included_small`,
--   ADD COLUMN `included_large` INT NOT NULL DEFAULT 0 AFTER `included_medium`,
--   ADD COLUMN `included_xl` INT NOT NULL DEFAULT 0 AFTER `included_large`,
--   ADD COLUMN `used_small` INT NOT NULL DEFAULT 0 AFTER `included_xl`,
--   ADD COLUMN `used_medium` INT NOT NULL DEFAULT 0 AFTER `used_small`,
--   ADD COLUMN `used_large` INT NOT NULL DEFAULT 0 AFTER `used_medium`,
--   ADD COLUMN `used_xl` INT NOT NULL DEFAULT 0 AFTER `used_large`;
