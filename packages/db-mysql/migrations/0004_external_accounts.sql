-- Migration: 0004_external_accounts.sql
-- Description: External OAuth accounts and pending actions for authenticated agent operations
-- Date: 2025-11-25
-- Dependencies: Requires organizations, users tables from previous migrations

-- =============================================================================
-- 1. EXTERNAL ACCOUNTS TABLE
-- =============================================================================
-- Stores connected OAuth accounts (TikTok, Instagram, etc.) with encrypted tokens
-- Only Pro/Max plan users can connect external accounts

CREATE TABLE external_accounts (
  id CHAR(36) PRIMARY KEY,
  org_id CHAR(36) NOT NULL,
  user_id VARCHAR(128) NOT NULL,

  -- Provider info
  provider ENUM('tiktok', 'instagram', 'google', 'reddit') NOT NULL,
  provider_account_id VARCHAR(255) NOT NULL,
  provider_username VARCHAR(255),
  display_name VARCHAR(255),
  avatar_url TEXT,

  -- Encrypted tokens (AES-256-GCM)
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMP NULL,

  -- Scopes granted
  scopes JSON,

  -- User preferences
  is_default BOOLEAN DEFAULT FALSE,
  auto_approve BOOLEAN DEFAULT FALSE,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  last_used_at TIMESTAMP NULL,
  last_error_at TIMESTAMP NULL,
  last_error TEXT,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_external_accounts_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_external_accounts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT unique_provider_account UNIQUE (org_id, provider, provider_account_id)
);

CREATE INDEX idx_external_accounts_org_provider ON external_accounts(org_id, provider);
CREATE INDEX idx_external_accounts_user ON external_accounts(user_id);

-- =============================================================================
-- 2. PENDING ACTIONS TABLE
-- =============================================================================
-- Stores batch actions awaiting user approval before execution

CREATE TABLE pending_actions (
  id CHAR(36) PRIMARY KEY,
  org_id CHAR(36) NOT NULL,
  user_id VARCHAR(128) NOT NULL,
  conversation_id CHAR(36),

  -- Which account to use
  external_account_id CHAR(36),
  provider ENUM('tiktok', 'instagram', 'google', 'reddit') NOT NULL,

  -- Action details
  action_type VARCHAR(50) NOT NULL,
  action_description TEXT,

  -- Batch items stored as JSON
  items JSON NOT NULL,
  item_count INT NOT NULL,

  -- Status
  status ENUM('pending', 'approved', 'rejected', 'executing', 'completed', 'partial', 'failed', 'expired') NOT NULL DEFAULT 'pending',

  -- Execution tracking
  items_approved INT DEFAULT 0,
  items_rejected INT DEFAULT 0,
  items_executed INT DEFAULT 0,
  items_failed INT DEFAULT 0,

  -- Timestamps
  expires_at TIMESTAMP NULL,
  reviewed_at TIMESTAMP NULL,
  execution_started_at TIMESTAMP NULL,
  execution_completed_at TIMESTAMP NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_pending_actions_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_pending_actions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_pending_actions_external_account FOREIGN KEY (external_account_id) REFERENCES external_accounts(id) ON DELETE SET NULL
);

CREATE INDEX idx_pending_actions_org_status ON pending_actions(org_id, status);
CREATE INDEX idx_pending_actions_conversation ON pending_actions(conversation_id);
CREATE INDEX idx_pending_actions_expires ON pending_actions(expires_at);
CREATE INDEX idx_pending_actions_external_account ON pending_actions(external_account_id);

-- =============================================================================
-- 3. PENDING ACTION ITEMS TABLE
-- =============================================================================
-- Individual items within a pending action for granular review and editing

CREATE TABLE pending_action_items (
  id CHAR(36) PRIMARY KEY,
  pending_action_id CHAR(36) NOT NULL,

  -- Item details
  item_index INT NOT NULL,
  payload JSON NOT NULL,
  preview_text TEXT,

  -- User can edit before approval
  is_edited BOOLEAN DEFAULT FALSE,
  edited_payload JSON,

  -- Per-item status
  status ENUM('pending', 'approved', 'rejected', 'executed', 'failed') NOT NULL DEFAULT 'pending',

  -- Execution result
  executed_at TIMESTAMP NULL,
  result JSON,
  error TEXT,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_pending_action_items_action FOREIGN KEY (pending_action_id) REFERENCES pending_actions(id) ON DELETE CASCADE
);

CREATE INDEX idx_pending_action_items_action ON pending_action_items(pending_action_id);
CREATE INDEX idx_pending_action_items_status ON pending_action_items(pending_action_id, status);

-- =============================================================================
-- VERIFICATION QUERIES (Run these to verify migration)
-- =============================================================================

-- Check external_accounts table created
-- SHOW CREATE TABLE external_accounts;

-- Check pending_actions table created
-- SHOW CREATE TABLE pending_actions;

-- Check pending_action_items table created
-- SHOW CREATE TABLE pending_action_items;

-- =============================================================================
-- ROLLBACK SCRIPT (USE WITH CAUTION)
-- =============================================================================

-- To rollback this migration, run these commands in reverse order:
/*
DROP TABLE pending_action_items;
DROP TABLE pending_actions;
DROP TABLE external_accounts;
*/

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
