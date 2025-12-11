-- Migration: 0003_billing_system.sql
-- Description: Complete billing and payment system for Pixell Agent Framework
-- Date: 2025-11-16
-- Dependencies: Requires organizations, users tables from previous migrations

-- =============================================================================
-- 1. SUBSCRIPTIONS TABLE
-- =============================================================================
CREATE TABLE subscriptions (
  id CHAR(36) PRIMARY KEY,
  org_id CHAR(36) NOT NULL,

  -- Stripe references
  stripe_subscription_id VARCHAR(120) UNIQUE,
  stripe_price_id VARCHAR(120),
  stripe_customer_id VARCHAR(120),

  -- Plan information
  plan_tier ENUM('free', 'starter', 'pro', 'max') NOT NULL DEFAULT 'free',
  status ENUM('active', 'trialing', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid') NOT NULL DEFAULT 'incomplete',

  -- Billing period (synced from Stripe)
  current_period_start TIMESTAMP NULL,
  current_period_end TIMESTAMP NULL,

  -- Trial tracking (from Stripe)
  trial_end TIMESTAMP NULL,

  -- Cancellation
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  canceled_at TIMESTAMP NULL,
  ended_at TIMESTAMP NULL,

  -- Metadata
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_subscriptions_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX idx_subscriptions_org ON subscriptions(org_id);
CREATE INDEX idx_subscriptions_stripe ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_tier ON subscriptions(plan_tier);

-- =============================================================================
-- 2. BILLABLE ACTIONS TABLE (New, clean usage tracking)
-- =============================================================================
CREATE TABLE billable_actions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  org_id CHAR(36) NOT NULL,
  user_id VARCHAR(128) NOT NULL,

  -- Action classification
  action_tier ENUM('small', 'medium', 'large', 'xl') NOT NULL,
  credits_used DECIMAL(10, 2) NOT NULL,

  -- Action context
  agent_id VARCHAR(255),
  agent_name VARCHAR(255),
  action_key VARCHAR(120),
  description TEXT,
  metadata JSON,

  -- Billing period tracking
  billing_period_start TIMESTAMP NOT NULL,
  billing_period_end TIMESTAMP NOT NULL,

  -- Idempotency
  idempotency_key VARCHAR(120),

  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_billable_actions_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_billable_actions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_billable_org_period ON billable_actions(org_id, billing_period_start, billing_period_end);
CREATE INDEX idx_billable_org_created ON billable_actions(org_id, created_at);
CREATE INDEX idx_billable_tier ON billable_actions(action_tier);
CREATE INDEX idx_billable_idempotency ON billable_actions(idempotency_key);
CREATE INDEX idx_billable_user ON billable_actions(user_id);

-- =============================================================================
-- 3. CREDIT BALANCES TABLE (Cache for fast reads)
-- =============================================================================
CREATE TABLE credit_balances (
  org_id CHAR(36) PRIMARY KEY,

  -- Current billing period
  billing_period_start TIMESTAMP NOT NULL,
  billing_period_end TIMESTAMP NOT NULL,

  -- Plan-included credits (monthly allocation)
  included_small INT NOT NULL DEFAULT 0,
  included_medium INT NOT NULL DEFAULT 0,
  included_large INT NOT NULL DEFAULT 0,
  included_xl INT NOT NULL DEFAULT 0,

  -- Used credits this period
  used_small INT NOT NULL DEFAULT 0,
  used_medium INT NOT NULL DEFAULT 0,
  used_large INT NOT NULL DEFAULT 0,
  used_xl INT NOT NULL DEFAULT 0,

  -- Purchased top-up credits (one-time, expires end of period)
  topup_credits DECIMAL(10, 2) NOT NULL DEFAULT 0,
  topup_credits_used DECIMAL(10, 2) NOT NULL DEFAULT 0,

  -- Auto top-up settings
  auto_topup_enabled BOOLEAN DEFAULT FALSE,
  auto_topup_threshold INT NOT NULL DEFAULT 50,
  auto_topup_amount INT NOT NULL DEFAULT 500,

  -- Last usage warning timestamps (prevent spam)
  last_warning_80_at TIMESTAMP NULL,
  last_warning_100_at TIMESTAMP NULL,

  -- Audit
  last_reset_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_credit_balances_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- =============================================================================
-- 4. CREDIT PURCHASES TABLE (Top-up transaction history)
-- =============================================================================
CREATE TABLE credit_purchases (
  id CHAR(36) PRIMARY KEY,
  org_id CHAR(36) NOT NULL,

  -- Stripe reference
  stripe_payment_intent_id VARCHAR(120),
  stripe_invoice_id VARCHAR(120),

  -- Purchase details
  credits_amount INT NOT NULL,
  amount_paid DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'usd',

  -- Purchase type
  purchase_type ENUM('manual', 'auto_topup') NOT NULL,
  status ENUM('pending', 'succeeded', 'failed', 'canceled') NOT NULL DEFAULT 'pending',

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,

  CONSTRAINT fk_credit_purchases_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX idx_credit_purchases_org ON credit_purchases(org_id);
CREATE INDEX idx_credit_purchases_stripe_pi ON credit_purchases(stripe_payment_intent_id);
CREATE INDEX idx_credit_purchases_status ON credit_purchases(status);
CREATE INDEX idx_credit_purchases_created ON credit_purchases(created_at);

-- =============================================================================
-- 5. WEBHOOK EVENTS TABLE (Stripe webhook audit log)
-- =============================================================================
CREATE TABLE webhook_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

  -- Stripe event
  stripe_event_id VARCHAR(120) UNIQUE NOT NULL,
  event_type VARCHAR(120) NOT NULL,

  -- Processing
  payload JSON NOT NULL,
  processed_at TIMESTAMP NULL,
  status ENUM('pending', 'processed', 'failed') NOT NULL DEFAULT 'pending',
  error TEXT,
  retry_count INT NOT NULL DEFAULT 0,

  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_webhook_events_type ON webhook_events(event_type);
CREATE INDEX idx_webhook_events_status ON webhook_events(status);
CREATE INDEX idx_webhook_events_created ON webhook_events(created_at);
CREATE UNIQUE INDEX idx_webhook_events_stripe_id ON webhook_events(stripe_event_id);

-- =============================================================================
-- 6. INVOICES TABLE (Minimal cache)
-- =============================================================================
CREATE TABLE invoices (
  id CHAR(36) PRIMARY KEY,
  org_id CHAR(36) NOT NULL,

  -- Stripe reference
  stripe_invoice_id VARCHAR(120) UNIQUE NOT NULL,
  stripe_subscription_id VARCHAR(120),

  -- Invoice details (minimal cache)
  amount_due DECIMAL(10, 2) NOT NULL,
  amount_paid DECIMAL(10, 2) NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'usd',
  status ENUM('draft', 'open', 'paid', 'void', 'uncollectible') NOT NULL,

  -- Invoice type
  invoice_type ENUM('subscription', 'credit_purchase') NOT NULL,

  -- URLs (for user access)
  hosted_invoice_url TEXT,
  invoice_pdf TEXT,

  -- Dates
  period_start TIMESTAMP NULL,
  period_end TIMESTAMP NULL,
  due_date TIMESTAMP NULL,
  paid_at TIMESTAMP NULL,

  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_invoices_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX idx_invoices_org ON invoices(org_id);
CREATE INDEX idx_invoices_stripe ON invoices(stripe_invoice_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_created ON invoices(created_at);

-- =============================================================================
-- 7. MODIFY ORGANIZATIONS TABLE
-- =============================================================================

-- Add subscription tier tracking
ALTER TABLE organizations
  ADD COLUMN subscription_tier ENUM('free', 'starter', 'pro', 'max') NOT NULL DEFAULT 'free' AFTER subscription_status;

-- Add trial end tracking (synced from Stripe)
ALTER TABLE organizations
  ADD COLUMN trial_ends_at TIMESTAMP NULL AFTER subscription_tier;

-- Add billing warning tracking
ALTER TABLE organizations
  ADD COLUMN last_billing_warning_at TIMESTAMP NULL AFTER trial_ends_at;

-- =============================================================================
-- 8. OPTIONALLY LINK ACTION_EVENTS TO BILLABLE_ACTIONS
-- =============================================================================

-- This creates a reference from general action tracking to billing-specific records
-- Comment out if you don't want to maintain this relationship
ALTER TABLE action_events
  ADD COLUMN billable_action_id BIGINT UNSIGNED NULL AFTER metadata;

ALTER TABLE action_events
  ADD CONSTRAINT fk_action_events_billable
    FOREIGN KEY (billable_action_id)
    REFERENCES billable_actions(id)
    ON DELETE SET NULL;

CREATE INDEX idx_action_events_billable ON action_events(billable_action_id);

-- =============================================================================
-- 9. SEED FREE TIER FOR EXISTING ORGANIZATIONS
-- =============================================================================

-- Set all existing organizations to free tier with active status
UPDATE organizations
SET
  subscription_tier = 'free',
  subscription_status = 'active'
WHERE subscription_tier IS NULL OR subscription_tier = '';

-- Initialize subscriptions for existing organizations
INSERT INTO subscriptions (id, org_id, plan_tier, status, created_at)
SELECT
  UUID(),
  id,
  'free',
  'active',
  NOW()
FROM organizations
WHERE id NOT IN (SELECT org_id FROM subscriptions);

-- Initialize credit balances for existing organizations (free tier limits)
INSERT INTO credit_balances (
  org_id,
  billing_period_start,
  billing_period_end,
  included_small,
  included_medium,
  included_large,
  included_xl,
  used_small,
  used_medium,
  used_large,
  used_xl,
  last_reset_at
)
SELECT
  id,
  NOW(),
  DATE_ADD(NOW(), INTERVAL 1 MONTH),
  10,  -- Free tier: 10 small actions
  4,   -- Free tier: 4 medium actions
  2,   -- Free tier: 2 large actions
  1,   -- Free tier: 1 xl action
  0,   -- Start with 0 usage
  0,
  0,
  0,
  NOW()
FROM organizations
WHERE id NOT IN (SELECT org_id FROM credit_balances);

-- =============================================================================
-- 10. VERIFICATION QUERIES (Run these to verify migration)
-- =============================================================================

-- Check subscriptions created
-- SELECT COUNT(*) as subscription_count FROM subscriptions;

-- Check credit balances initialized
-- SELECT COUNT(*) as balance_count FROM credit_balances;

-- Check free tier organizations
-- SELECT COUNT(*) as free_tier_orgs FROM organizations WHERE subscription_tier = 'free';

-- View sample credit balance
-- SELECT * FROM credit_balances LIMIT 1;

-- =============================================================================
-- ROLLBACK SCRIPT (USE WITH CAUTION)
-- =============================================================================

-- To rollback this migration, run these commands in reverse order:
/*
ALTER TABLE action_events DROP FOREIGN KEY fk_action_events_billable;
ALTER TABLE action_events DROP COLUMN billable_action_id;

ALTER TABLE organizations DROP COLUMN last_billing_warning_at;
ALTER TABLE organizations DROP COLUMN trial_ends_at;
ALTER TABLE organizations DROP COLUMN subscription_tier;

DROP TABLE invoices;
DROP TABLE webhook_events;
DROP TABLE credit_purchases;
DROP TABLE credit_balances;
DROP TABLE billable_actions;
DROP TABLE subscriptions;
*/

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
