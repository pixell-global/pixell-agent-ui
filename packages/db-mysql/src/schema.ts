import { mysqlTable, varchar, char, text, json, timestamp, mysqlEnum, index, primaryKey, bigint, int, unique, decimal, boolean, tinyint } from 'drizzle-orm/mysql-core'

export const users = mysqlTable('users', {
  id: varchar('id', { length: 128 }).primaryKey(),
  email: varchar('email', { length: 320 }).notNull().unique(),
  displayName: varchar('display_name', { length: 120 }),
  // S3 storage base path allocated per user (org-scoped prefix)
  // e.g. orgs/<orgId>/users/<userId>
  s3StoragePath: varchar('s3_storage_path', { length: 512 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  isDeleted: int('is_deleted').default(0).notNull(),
})

export const organizations = mysqlTable('organizations', {
  id: char('id', { length: 36 }).primaryKey(),
  name: varchar('name', { length: 160 }).notNull(),
  createdBy: varchar('created_by', { length: 128 }).notNull(),

  // Stripe integration (synchronized from Stripe - see subscriptions table comments)
  stripeCustomerId: varchar('stripe_customer_id', { length: 120 }),
  subscriptionStatus: mysqlEnum('subscription_status', ['active', 'trialing', 'past_due', 'incomplete', 'canceled']).default('incomplete').notNull(), // Synced from Stripe
  subscriptionTier: mysqlEnum('subscription_tier', ['free', 'starter', 'pro', 'max']).default('free').notNull(), // Synced from Stripe
  trialEndsAt: timestamp('trial_ends_at'), // Synced from Stripe
  lastBillingWarningAt: timestamp('last_billing_warning_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  isDeleted: int('is_deleted').default(0).notNull(),
})

export const organizationMembers = mysqlTable('organization_members', {
  orgId: char('org_id', { length: 36 }).notNull(),
  userId: varchar('user_id', { length: 128 }).notNull(),
  role: mysqlEnum('role', ['owner', 'admin', 'member', 'viewer']).default('owner').notNull(),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  isDeleted: int('is_deleted').default(0).notNull(),
}, (t) => ({ pk: primaryKey({ columns: [t.orgId, t.userId] }) }))

export const orgSettings = mysqlTable('org_settings', {
  orgId: char('org_id', { length: 36 }).primaryKey(),
  brandAccessMode: mysqlEnum('brand_access_mode', ['shared', 'isolated']).default('shared').notNull(),
  requireBrandContext: int('require_brand_context').default(1).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
})

export const teams = mysqlTable('teams', {
  id: char('id', { length: 36 }).primaryKey(),
  orgId: char('org_id', { length: 36 }).notNull(),
  name: varchar('name', { length: 160 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  isDeleted: int('is_deleted').default(0).notNull(),
})

export const teamMembers = mysqlTable('team_members', {
  teamId: char('team_id', { length: 36 }).notNull(),
  userId: varchar('user_id', { length: 128 }).notNull(),
  role: mysqlEnum('role', ['lead', 'member', 'viewer']).default('member').notNull(),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  isDeleted: int('is_deleted').default(0).notNull(),
}, (t) => ({ pk: primaryKey({ columns: [t.teamId, t.userId] }) }))

export const brands = mysqlTable('brands', {
  id: char('id', { length: 36 }).primaryKey(),
  orgId: char('org_id', { length: 36 }).notNull(),
  name: varchar('name', { length: 160 }).notNull(),
  primaryTeamId: char('primary_team_id', { length: 36 }),
  metadata: json('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  isDeleted: int('is_deleted').default(0).notNull(),
}, (t) => ({
  uniqueOrgName: unique('brands_org_name_unique').on(t.orgId, t.name),
}))

export const teamBrandAccess = mysqlTable('team_brand_access', {
  teamId: char('team_id', { length: 36 }).notNull(),
  brandId: char('brand_id', { length: 36 }).notNull(),
  role: mysqlEnum('role', ['manager', 'editor', 'analyst', 'viewer']).default('viewer').notNull(),
  grantedAt: timestamp('granted_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  isDeleted: int('is_deleted').default(0).notNull(),
}, (t) => ({ pk: primaryKey({ columns: [t.teamId, t.brandId] }) }))

export const userBrandAccess = mysqlTable('user_brand_access', {
  brandId: char('brand_id', { length: 36 }).notNull(),
  userId: varchar('user_id', { length: 128 }).notNull(),
  role: mysqlEnum('role', ['manager', 'editor', 'analyst', 'viewer']).default('viewer').notNull(),
  grantedAt: timestamp('granted_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  isDeleted: int('is_deleted').default(0).notNull(),
}, (t) => ({ pk: primaryKey({ columns: [t.brandId, t.userId] }) }))

export const orgInvitations = mysqlTable('org_invitations', {
  id: char('id', { length: 36 }).primaryKey(),
  orgId: char('org_id', { length: 36 }).notNull(),
  email: varchar('email', { length: 320 }).notNull(),
  role: mysqlEnum('role', ['admin', 'member', 'viewer']).default('member').notNull(),
  token: varchar('token', { length: 255 }).notNull().unique(),
  tokenHash: varchar('token_hash', { length: 255 }).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  metadata: json('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  isDeleted: int('is_deleted').default(0).notNull(),
})

export const actionEvents = mysqlTable('action_events', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  orgId: char('org_id', { length: 36 }).notNull(),
  userId: varchar('user_id', { length: 128 }).notNull(),
  appId: varchar('app_id', { length: 80 }),
  actionKey: varchar('action_key', { length: 120 }).notNull(),
  units: int('units').default(1).notNull(),
  idempotencyKey: varchar('idempotency_key', { length: 120 }),
  metadata: json('metadata'),
  brandId: char('brand_id', { length: 36 }),
  billableActionId: bigint('billable_action_id', { mode: 'number', unsigned: true }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  idxOrgCreated: index('idx_usage_org_created').on(t.orgId, t.createdAt),
  idxBrandCreated: index('idx_usage_brand_created').on(t.brandId, t.createdAt),
}))

// =============================================================================
// BILLING TABLES
// =============================================================================
//
// IMPORTANT FOR AI AGENTS: Database Synchronization Architecture
// ================================================================
//
// The `subscriptions` and `organizations` tables contain subscription data
// that is synchronized from Stripe (Single Source of Truth).
//
// STRIPE IS THE SSoT - Our database is a read-optimized cache
//
// Synchronization Mechanisms:
// 1. PRIMARY: Webhooks (apps/web/src/app/api/webhooks/stripe/route.ts)
//    - Real-time updates when Stripe events occur
//    - Events: checkout.session.completed, customer.subscription.*, invoice.*
//
// 2. BACKUP: Lambda reconciliation (packages/workers/subscription-reconciliation/)
//    - Runs weekly (Sundays 3am UTC)
//    - Catches missed webhooks and manual Stripe changes
//    - Ensures eventual consistency
//
// NEVER update Stripe based on this database. Always:
// - Query Stripe for authoritative subscription data
// - Update this database to match Stripe (via webhooks or reconciliation)
// - On conflicts, Stripe data overwrites database data
//
// Related Documentation:
// - BILLING_SYSTEM_ARCHITECTURE.md
// - packages/workers/subscription-reconciliation/README.md
// ================================================================

export const subscriptions = mysqlTable('subscriptions', {
  id: char('id', { length: 36 }).primaryKey(),
  orgId: char('org_id', { length: 36 }).notNull(),

  // Stripe references
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 120 }).unique(),
  stripePriceId: varchar('stripe_price_id', { length: 120 }),
  stripeCustomerId: varchar('stripe_customer_id', { length: 120 }),

  // Plan information
  planTier: mysqlEnum('plan_tier', ['free', 'starter', 'pro', 'max']).default('free').notNull(),
  status: mysqlEnum('status', [
    'active',
    'trialing',
    'past_due',
    'canceled',
    'incomplete',
    'incomplete_expired',
    'unpaid'
  ]).default('incomplete').notNull(),

  // Billing period (synced from Stripe)
  currentPeriodStart: timestamp('current_period_start'),
  currentPeriodEnd: timestamp('current_period_end'),

  // Trial tracking (from Stripe)
  trialEnd: timestamp('trial_end'),

  // Cancellation
  cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false),
  canceledAt: timestamp('canceled_at'),
  endedAt: timestamp('ended_at'),

  // Metadata
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  idxOrg: index('idx_subscriptions_org').on(t.orgId),
  idxStripe: index('idx_subscriptions_stripe').on(t.stripeSubscriptionId),
  idxStatus: index('idx_subscriptions_status').on(t.status),
  idxTier: index('idx_subscriptions_tier').on(t.planTier),
}))

export const billableActions = mysqlTable('billable_actions', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  orgId: char('org_id', { length: 36 }).notNull(),
  userId: varchar('user_id', { length: 128 }).notNull(),

  // Action context
  agentId: varchar('agent_id', { length: 255 }),
  agentName: varchar('agent_name', { length: 255 }),
  actionKey: varchar('action_key', { length: 120 }),
  description: text('description'),
  metadata: json('metadata'),

  // Billing period tracking
  billingPeriodStart: timestamp('billing_period_start').notNull(),
  billingPeriodEnd: timestamp('billing_period_end').notNull(),

  // Idempotency
  idempotencyKey: varchar('idempotency_key', { length: 120 }),

  // Audit
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  idxOrgPeriod: index('idx_billable_org_period').on(t.orgId, t.billingPeriodStart, t.billingPeriodEnd),
  idxOrgCreated: index('idx_billable_org_created').on(t.orgId, t.createdAt),
  idxOrgUser: index('idx_billable_org_user').on(t.orgId, t.userId, t.createdAt),
  idxIdempotency: index('idx_billable_idempotency').on(t.idempotencyKey),
  idxUser: index('idx_billable_user').on(t.userId),
}))

export const creditBalances = mysqlTable('credit_balances', {
  orgId: char('org_id', { length: 36 }).primaryKey(),

  // Current billing period
  billingPeriodStart: timestamp('billing_period_start').notNull(),
  billingPeriodEnd: timestamp('billing_period_end').notNull(),

  // Purchased top-up credits (deprecated - kept for backwards compatibility)
  topupCredits: decimal('topup_credits', { precision: 10, scale: 2 }).default('0').notNull(),
  topupCreditsUsed: decimal('topup_credits_used', { precision: 10, scale: 2 }).default('0').notNull(),

  // Auto top-up settings (deprecated - kept for backwards compatibility)
  autoTopupEnabled: boolean('auto_topup_enabled').default(false),
  autoTopupThreshold: int('auto_topup_threshold').default(50).notNull(),
  autoTopupAmount: int('auto_topup_amount').default(500).notNull(),

  // Warning timestamps
  lastWarning80At: timestamp('last_warning_80_at'),
  lastWarning100At: timestamp('last_warning_100_at'),

  // Audit
  lastResetAt: timestamp('last_reset_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
})

export const creditPurchases = mysqlTable('credit_purchases', {
  id: char('id', { length: 36 }).primaryKey(),
  orgId: char('org_id', { length: 36 }).notNull(),

  // Stripe reference
  stripePaymentIntentId: varchar('stripe_payment_intent_id', { length: 120 }),
  stripeInvoiceId: varchar('stripe_invoice_id', { length: 120 }),

  // Purchase details
  creditsAmount: int('credits_amount').notNull(),
  amountPaid: decimal('amount_paid', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).default('usd').notNull(),

  // Purchase type
  purchaseType: mysqlEnum('purchase_type', ['manual', 'auto_topup']).notNull(),
  status: mysqlEnum('status', ['pending', 'succeeded', 'failed', 'canceled']).default('pending').notNull(),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
}, (t) => ({
  idxOrg: index('idx_credit_purchases_org').on(t.orgId),
  idxStripePI: index('idx_credit_purchases_stripe_pi').on(t.stripePaymentIntentId),
  idxStatus: index('idx_credit_purchases_status').on(t.status),
  idxCreated: index('idx_credit_purchases_created').on(t.createdAt),
}))

export const webhookEvents = mysqlTable('webhook_events', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),

  // Stripe event
  stripeEventId: varchar('stripe_event_id', { length: 120 }).unique().notNull(),
  eventType: varchar('event_type', { length: 120 }).notNull(),

  // Processing
  payload: json('payload').notNull(),
  processedAt: timestamp('processed_at'),
  status: mysqlEnum('status', ['pending', 'processed', 'failed']).default('pending').notNull(),
  error: text('error'),
  retryCount: int('retry_count').default(0).notNull(),

  // Audit
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  idxType: index('idx_webhook_events_type').on(t.eventType),
  idxStatus: index('idx_webhook_events_status').on(t.status),
  idxCreated: index('idx_webhook_events_created').on(t.createdAt),
  uniqueStripeId: unique('idx_webhook_events_stripe_id').on(t.stripeEventId),
}))

export const invoices = mysqlTable('invoices', {
  id: char('id', { length: 36 }).primaryKey(),
  orgId: char('org_id', { length: 36 }).notNull(),

  // Stripe reference
  stripeInvoiceId: varchar('stripe_invoice_id', { length: 120 }).unique().notNull(),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 120 }),

  // Invoice details
  amountDue: decimal('amount_due', { precision: 10, scale: 2 }).notNull(),
  amountPaid: decimal('amount_paid', { precision: 10, scale: 2 }).default('0').notNull(),
  currency: varchar('currency', { length: 3 }).default('usd').notNull(),
  status: mysqlEnum('status', ['draft', 'open', 'paid', 'void', 'uncollectible']).notNull(),

  // Invoice type
  invoiceType: mysqlEnum('invoice_type', ['subscription', 'credit_purchase']).notNull(),

  // URLs
  hostedInvoiceUrl: text('hosted_invoice_url'),
  invoicePdf: text('invoice_pdf'),

  // Dates
  periodStart: timestamp('period_start'),
  periodEnd: timestamp('period_end'),
  dueDate: timestamp('due_date'),
  paidAt: timestamp('paid_at'),

  // Audit
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  idxOrg: index('idx_invoices_org').on(t.orgId),
  idxStripe: index('idx_invoices_stripe').on(t.stripeInvoiceId),
  idxStatus: index('idx_invoices_status').on(t.status),
  idxCreated: index('idx_invoices_created').on(t.createdAt),
}))

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type Subscription = typeof subscriptions.$inferSelect
export type NewSubscription = typeof subscriptions.$inferInsert

export type BillableAction = typeof billableActions.$inferSelect
export type NewBillableAction = typeof billableActions.$inferInsert

export type CreditBalance = typeof creditBalances.$inferSelect
export type NewCreditBalance = typeof creditBalances.$inferInsert

export type CreditPurchase = typeof creditPurchases.$inferSelect
export type NewCreditPurchase = typeof creditPurchases.$inferInsert

export type WebhookEvent = typeof webhookEvents.$inferSelect
export type NewWebhookEvent = typeof webhookEvents.$inferInsert

export type Invoice = typeof invoices.$inferSelect
export type NewInvoice = typeof invoices.$inferInsert

// =============================================================================
// EXTERNAL ACCOUNTS OAUTH SYSTEM
// =============================================================================
//
// These tables support connecting external OAuth accounts (TikTok, Instagram, etc.)
// to enable the AI agent to perform authenticated actions on behalf of users.
//
// Security:
// - Access tokens are encrypted with AES-256-GCM before storage
// - Only Pro and Max plan users can connect external accounts
// - Actions require approval by default (configurable auto-approve per account)
// =============================================================================

// Supported OAuth providers enum
export const oauthProviderEnum = mysqlEnum('oauth_provider', [
  'tiktok',
  'instagram',
  'google',
  'reddit',
])

// Connected external accounts
export const externalAccounts = mysqlTable('external_accounts', {
  id: char('id', { length: 36 }).primaryKey(),
  orgId: char('org_id', { length: 36 }).notNull(),
  userId: varchar('user_id', { length: 128 }).notNull(),

  // Provider info
  provider: oauthProviderEnum.notNull(),
  providerAccountId: varchar('provider_account_id', { length: 255 }).notNull(),
  providerUsername: varchar('provider_username', { length: 255 }),
  displayName: varchar('display_name', { length: 255 }),
  avatarUrl: text('avatar_url'),

  // Encrypted tokens (AES-256-GCM)
  accessTokenEncrypted: text('access_token_encrypted').notNull(),
  refreshTokenEncrypted: text('refresh_token_encrypted'),
  tokenExpiresAt: timestamp('token_expires_at'),

  // Scopes granted
  scopes: json('scopes').$type<string[]>(),

  // User preferences
  isDefault: boolean('is_default').default(false),
  autoApprove: boolean('auto_approve').default(false),

  // Status
  isActive: boolean('is_active').default(true),
  lastUsedAt: timestamp('last_used_at'),
  lastErrorAt: timestamp('last_error_at'),
  lastError: text('last_error'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  uniqueProviderAccount: unique('unique_provider_account').on(t.orgId, t.provider, t.providerAccountId),
  orgProviderIdx: index('idx_external_accounts_org_provider').on(t.orgId, t.provider),
  userIdx: index('idx_external_accounts_user').on(t.userId),
}))

// Pending action status enum
export const pendingActionStatusEnum = mysqlEnum('pending_action_status', [
  'pending',
  'approved',
  'rejected',
  'executing',
  'completed',
  'partial',
  'failed',
  'expired',
])

// Pending action item status enum
export const pendingActionItemStatusEnum = mysqlEnum('pending_action_item_status', [
  'pending',
  'approved',
  'rejected',
  'executed',
  'failed',
])

// Type for pending action items JSON
export type PendingActionItemData = {
  index: number
  payload: Record<string, unknown>
  previewText: string
}

// Pending actions awaiting user approval
export const pendingActions = mysqlTable('pending_actions', {
  id: char('id', { length: 36 }).primaryKey(),
  orgId: char('org_id', { length: 36 }).notNull(),
  userId: varchar('user_id', { length: 128 }).notNull(),
  conversationId: char('conversation_id', { length: 36 }),

  // Which account to use
  externalAccountId: char('external_account_id', { length: 36 }),
  provider: oauthProviderEnum.notNull(),

  // Action details
  actionType: varchar('action_type', { length: 50 }).notNull(),
  actionDescription: text('action_description'),

  // Batch items stored as JSON
  items: json('items').$type<PendingActionItemData[]>().notNull(),
  itemCount: int('item_count').notNull(),

  // Status
  status: pendingActionStatusEnum.default('pending').notNull(),

  // Execution tracking
  itemsApproved: int('items_approved').default(0),
  itemsRejected: int('items_rejected').default(0),
  itemsExecuted: int('items_executed').default(0),
  itemsFailed: int('items_failed').default(0),

  // Timestamps
  expiresAt: timestamp('expires_at'),
  reviewedAt: timestamp('reviewed_at'),
  executionStartedAt: timestamp('execution_started_at'),
  executionCompletedAt: timestamp('execution_completed_at'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  orgStatusIdx: index('idx_pending_actions_org_status').on(t.orgId, t.status),
  conversationIdx: index('idx_pending_actions_conversation').on(t.conversationId),
  expiresIdx: index('idx_pending_actions_expires').on(t.expiresAt),
  externalAccountIdx: index('idx_pending_actions_external_account').on(t.externalAccountId),
}))

// Individual items within a pending action (for granular review)
export const pendingActionItems = mysqlTable('pending_action_items', {
  id: char('id', { length: 36 }).primaryKey(),
  pendingActionId: char('pending_action_id', { length: 36 }).notNull(),

  // Item details
  itemIndex: int('item_index').notNull(),
  payload: json('payload').notNull(),
  previewText: text('preview_text'),

  // User can edit before approval
  isEdited: boolean('is_edited').default(false),
  editedPayload: json('edited_payload'),

  // Per-item status
  status: pendingActionItemStatusEnum.default('pending').notNull(),

  // Execution result
  executedAt: timestamp('executed_at'),
  result: json('result'),
  error: text('error'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  actionIdx: index('idx_pending_action_items_action').on(t.pendingActionId),
  statusIdx: index('idx_pending_action_items_status').on(t.pendingActionId, t.status),
}))

// Type exports for external accounts
export type ExternalAccount = typeof externalAccounts.$inferSelect
export type NewExternalAccount = typeof externalAccounts.$inferInsert

export type PendingAction = typeof pendingActions.$inferSelect
export type NewPendingAction = typeof pendingActions.$inferInsert

export type PendingActionItem = typeof pendingActionItems.$inferSelect
export type NewPendingActionItem = typeof pendingActionItems.$inferInsert

// =============================================================================
// ACTIVITIES SYSTEM (Activity Pane)
// =============================================================================
//
// These tables support async operations, scheduled tasks, and workflows
// displayed in the Activity Pane. Activities are org-scoped (not brand-scoped).
//
// Flow:
// - Core Agent creates activities via API when user requests async operations
// - Activities can be one-off tasks, scheduled (cron), or multi-step workflows
// - Users can pause, cancel, retry failed activities from the Activity Pane
// - Approval requests allow agents to request user permission before proceeding
// =============================================================================

// Activity type enum
export const activityTypeEnum = mysqlEnum('activity_type', [
  'task',       // One-off async task
  'scheduled',  // Recurring scheduled task (cron-based)
  'workflow',   // Multi-step workflow
])

// Activity status enum
export const activityStatusEnum = mysqlEnum('activity_status', [
  'pending',    // Waiting to start (or waiting for approval)
  'running',    // Currently executing
  'paused',     // Paused by user
  'completed',  // Successfully finished
  'failed',     // Failed with error
  'cancelled',  // Cancelled by user
])

// Activity step status enum
export const activityStepStatusEnum = mysqlEnum('activity_step_status', [
  'pending',
  'running',
  'completed',
  'failed',
  'skipped',
])

// Approval request type enum
export const approvalRequestTypeEnum = mysqlEnum('approval_request_type', [
  'permission',    // Request for permission/scope access
  'confirmation',  // Request for user confirmation before action
  'input',         // Request for user input/decision
])

// Approval request status enum
export const approvalRequestStatusEnum = mysqlEnum('approval_request_status', [
  'pending',
  'approved',
  'denied',
  'expired',
])

// Main activities table (org-scoped)
export const activities = mysqlTable('activities', {
  id: char('id', { length: 36 }).primaryKey(),
  orgId: char('org_id', { length: 36 }).notNull(),
  userId: varchar('user_id', { length: 128 }).notNull(),

  // Optional references
  conversationId: char('conversation_id', { length: 36 }), // Chat that spawned this activity
  agentId: varchar('agent_id', { length: 255 }),           // Which agent is executing

  // Activity identification
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  activityType: activityTypeEnum.default('task').notNull(),

  // Status tracking
  status: activityStatusEnum.default('pending').notNull(),
  progress: int('progress').default(0).notNull(),          // 0-100
  progressMessage: varchar('progress_message', { length: 500 }),

  // Scheduling (for scheduled activities)
  scheduleCron: varchar('schedule_cron', { length: 100 }),
  scheduleNextRun: timestamp('schedule_next_run'),
  scheduleLastRun: timestamp('schedule_last_run'),
  scheduleTimezone: varchar('schedule_timezone', { length: 50 }).default('UTC'),

  // Execution details
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  estimatedDurationMs: int('estimated_duration_ms'),
  actualDurationMs: int('actual_duration_ms'),

  // Result storage
  result: json('result'),
  errorMessage: text('error_message'),
  errorCode: varchar('error_code', { length: 50 }),

  // Metadata
  metadata: json('metadata'),
  tags: json('tags').$type<string[]>(),
  priority: int('priority').default(0).notNull(),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  archivedAt: timestamp('archived_at'),
}, (t) => ({
  idxOrgStatus: index('idx_activities_org_status').on(t.orgId, t.status),
  idxOrgCreated: index('idx_activities_org_created').on(t.orgId, t.createdAt),
  idxScheduleNextRun: index('idx_activities_schedule_next_run').on(t.scheduleNextRun),
  idxConversation: index('idx_activities_conversation').on(t.conversationId),
  idxUser: index('idx_activities_user').on(t.userId),
  idxArchived: index('idx_activities_archived').on(t.archivedAt),
}))

// Activity steps table (sub-tasks within an activity)
export const activitySteps = mysqlTable('activity_steps', {
  id: char('id', { length: 36 }).primaryKey(),
  activityId: char('activity_id', { length: 36 }).notNull(),

  // Step details
  stepOrder: int('step_order').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),

  // Status tracking
  status: activityStepStatusEnum.default('pending').notNull(),

  // Execution details
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),

  // Result storage
  result: json('result'),
  errorMessage: text('error_message'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  idxActivityId: index('idx_activity_steps_activity').on(t.activityId),
  idxActivityOrder: index('idx_activity_steps_order').on(t.activityId, t.stepOrder),
}))

// Activity approval requests table
export const activityApprovalRequests = mysqlTable('activity_approval_requests', {
  id: char('id', { length: 36 }).primaryKey(),
  activityId: char('activity_id', { length: 36 }).notNull(),

  // Request details
  requestType: approvalRequestTypeEnum.notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),

  // Permission scopes requested (for permission type)
  requiredScopes: json('required_scopes').$type<string[]>(),

  // Options for user to choose (for input type)
  options: json('options'),

  // Status tracking
  status: approvalRequestStatusEnum.default('pending').notNull(),

  // Response
  respondedAt: timestamp('responded_at'),
  response: json('response'),

  // Expiration
  expiresAt: timestamp('expires_at'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  idxActivityId: index('idx_approval_requests_activity').on(t.activityId),
  idxStatus: index('idx_approval_requests_status').on(t.status),
  idxExpires: index('idx_approval_requests_expires').on(t.expiresAt),
}))

// Type exports for activities
export type Activity = typeof activities.$inferSelect
export type NewActivity = typeof activities.$inferInsert

export type ActivityStep = typeof activitySteps.$inferSelect
export type NewActivityStep = typeof activitySteps.$inferInsert

export type ActivityApprovalRequest = typeof activityApprovalRequests.$inferSelect
export type NewActivityApprovalRequest = typeof activityApprovalRequests.$inferInsert

// =============================================================================
// CONVERSATIONS SYSTEM (Chat History)
// =============================================================================
//
// These tables support persistent chat history with organization-wide visibility.
//
// Features:
// - Conversations are auto-saved on first message
// - AI-generated titles after 3 messages (user can rename)
// - Public to organization by default, can be made private
// - Users can hide public org conversations without deleting
// - Soft delete for owner's private conversations
// =============================================================================

// Title source enum
export const titleSourceEnum = mysqlEnum('title_source', ['auto', 'user'])

// Conversation message role enum
export const conversationMessageRoleEnum = mysqlEnum('conversation_message_role', [
  'user',
  'assistant',
  'system',
])

// Conversations table
export const conversations = mysqlTable('conversations', {
  id: char('id', { length: 36 }).primaryKey(),
  orgId: char('org_id', { length: 36 }).notNull(),
  userId: varchar('user_id', { length: 128 }).notNull(),

  // Conversation metadata
  title: varchar('title', { length: 255 }),
  titleSource: titleSourceEnum.default('auto'),

  // Visibility
  isPublic: boolean('is_public').default(true).notNull(),

  // Message stats (denormalized for list performance)
  messageCount: int('message_count').default(0).notNull(),
  lastMessageAt: timestamp('last_message_at'),
  lastMessagePreview: varchar('last_message_preview', { length: 500 }),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  deletedAt: timestamp('deleted_at'),
}, (t) => ({
  orgUserIdx: index('idx_conversations_org_user').on(t.orgId, t.userId),
  orgPublicIdx: index('idx_conversations_org_public').on(t.orgId, t.isPublic),
  lastMsgIdx: index('idx_conversations_last_msg').on(t.lastMessageAt),
  deletedIdx: index('idx_conversations_deleted').on(t.deletedAt),
}))

// Type for conversation message metadata JSON
export type ConversationMessageMetadata = {
  messageType?: 'text' | 'plan' | 'progress' | 'alert' | 'file_context' | 'code'
  fileReferences?: Array<{ id: string; name: string; path: string }>
  thinkingSteps?: Array<{ id: string; content: string; isCompleted: boolean }>
  attachments?: Array<{ id: string; name: string; path: string; mimeType?: string }>
  model?: string
}

// Conversation messages table
export const conversationMessages = mysqlTable('conversation_messages', {
  id: char('id', { length: 36 }).primaryKey(),
  conversationId: char('conversation_id', { length: 36 }).notNull(),

  // Message content
  role: conversationMessageRoleEnum.notNull(),
  content: text('content').notNull(),

  // Rich content metadata
  metadata: json('metadata').$type<ConversationMessageMetadata>(),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  conversationIdx: index('idx_conv_messages_conversation').on(t.conversationId, t.createdAt),
}))

// Hidden conversations table (user preferences for hiding org conversations)
export const hiddenConversations = mysqlTable('hidden_conversations', {
  userId: varchar('user_id', { length: 128 }).notNull(),
  conversationId: char('conversation_id', { length: 36 }).notNull(),
  hiddenAt: timestamp('hidden_at').defaultNow().notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.userId, t.conversationId] }),
  userIdx: index('idx_hidden_conversations_user').on(t.userId),
}))

// Type exports for conversations
export type Conversation = typeof conversations.$inferSelect
export type NewConversation = typeof conversations.$inferInsert

export type ConversationMessage = typeof conversationMessages.$inferSelect
export type NewConversationMessage = typeof conversationMessages.$inferInsert

export type HiddenConversation = typeof hiddenConversations.$inferSelect
export type NewHiddenConversation = typeof hiddenConversations.$inferInsert

// =============================================================================
// WAITLIST SYSTEM (Marketing)
// =============================================================================
//
// Simple email waitlist for marketing landing pages.
// Called from external marketing sites (pixellagents.com, pixell.global).
// =============================================================================

export const waitlist = mysqlTable('waitlist', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  email: varchar('email', { length: 255 }).notNull(),
  source: varchar('source', { length: 100 }),  // Origin domain (e.g., 'https://pixellagents.com')
  ipAddress: varchar('ip_address', { length: 45 }),  // IPv6 compatible
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  uniqueEmail: unique('unique_waitlist_email').on(t.email),
  idxCreatedAt: index('idx_waitlist_created_at').on(t.createdAt),
}))

export type Waitlist = typeof waitlist.$inferSelect
export type NewWaitlist = typeof waitlist.$inferInsert

// =============================================================================
// MEMORY SYSTEM
// =============================================================================
//
// Two-tier memory architecture for AI personalization:
// - Session Context: Full conversation (handled via existing chat history)
// - Persistent Memory: Distilled facts that persist across sessions
//
// Hierarchical storage:
// - Global user memories (apply to all agents when agentId is null)
// - Agent-specific memories (e.g., Reddit preferences for vivid-commenter)
//
// Memory extraction is performed via background jobs after conversations.
// =============================================================================

// Memory category enum
export const memoryCategoryEnum = mysqlEnum('memory_category', [
  'user_preference',     // Writing style, tone, format preferences
  'project_context',     // Current project details, goals
  'domain_knowledge',    // Industry-specific facts, expertise
  'conversation_goal',   // Recurring task patterns
  'entity',              // People, companies, products mentioned
])

// Memory source enum
export const memorySourceEnum = mysqlEnum('memory_source', [
  'auto_extracted',      // LLM extracted from conversation
  'user_provided',       // Explicitly stated by user
  'user_edited',         // User edited an auto-extracted memory
])

// Type for memory metadata JSON
export type MemoryMetadata = {
  originalText?: string          // The text that triggered extraction
  extractionPrompt?: string      // Which prompt extracted this
  relatedMemoryIds?: string[]    // Links to related memories
  tags?: string[]                // Additional categorization
  messageId?: string             // The specific message it came from
}

// Main memories table
export const memories = mysqlTable('memories', {
  id: char('id', { length: 36 }).primaryKey(),
  orgId: char('org_id', { length: 36 }).notNull(),
  userId: varchar('user_id', { length: 128 }).notNull(),

  // Scope: null = global (applies to all agents), specific agentId = agent-specific
  agentId: varchar('agent_id', { length: 255 }),

  // Memory content
  category: memoryCategoryEnum.notNull(),
  key: varchar('key', { length: 255 }).notNull(),        // Short identifier (e.g., "writing_style")
  value: text('value').notNull(),                         // The actual memory content
  confidence: decimal('confidence', { precision: 3, scale: 2 }).default('1.00').notNull(), // 0.00-1.00

  // Source tracking
  source: memorySourceEnum.default('auto_extracted').notNull(),
  sourceConversationId: char('source_conversation_id', { length: 36 }),

  // Metadata
  metadata: json('metadata').$type<MemoryMetadata>(),

  // Usage tracking
  usageCount: int('usage_count').default(0).notNull(),
  lastUsedAt: timestamp('last_used_at'),

  // Status
  isActive: boolean('is_active').default(true).notNull(),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  orgUserIdx: index('idx_memories_org_user').on(t.orgId, t.userId),
  orgUserAgentIdx: index('idx_memories_org_user_agent').on(t.orgId, t.userId, t.agentId),
  categoryIdx: index('idx_memories_category').on(t.category),
  keyIdx: index('idx_memories_key').on(t.key),
  activeIdx: index('idx_memories_active').on(t.isActive),
  uniqueMemory: unique('unique_memory').on(t.orgId, t.userId, t.agentId, t.key),
}))

// Memory extraction job status enum
export const memoryExtractionStatusEnum = mysqlEnum('memory_extraction_status', [
  'pending',
  'processing',
  'completed',
  'failed',
])

// Memory extraction jobs table (background processing)
export const memoryExtractionJobs = mysqlTable('memory_extraction_jobs', {
  id: char('id', { length: 36 }).primaryKey(),
  orgId: char('org_id', { length: 36 }).notNull(),
  userId: varchar('user_id', { length: 128 }).notNull(),
  conversationId: char('conversation_id', { length: 36 }).notNull(),

  // Job status
  status: memoryExtractionStatusEnum.default('pending').notNull(),

  // Results
  memoriesExtracted: int('memories_extracted').default(0).notNull(),
  memoriesUpdated: int('memories_updated').default(0).notNull(),

  // Error tracking
  error: text('error'),
  retryCount: int('retry_count').default(0).notNull(),

  // Processing metadata
  processedAt: timestamp('processed_at'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  statusIdx: index('idx_extraction_jobs_status').on(t.status),
  conversationIdx: index('idx_extraction_jobs_conversation').on(t.conversationId),
  createdIdx: index('idx_extraction_jobs_created').on(t.createdAt),
  orgUserIdx: index('idx_extraction_jobs_org_user').on(t.orgId, t.userId),
}))

// User memory settings table
export const userMemorySettings = mysqlTable('user_memory_settings', {
  userId: varchar('user_id', { length: 128 }).primaryKey(),

  // Feature toggles
  memoryEnabled: boolean('memory_enabled').default(true).notNull(),
  autoExtractionEnabled: boolean('auto_extraction_enabled').default(true).notNull(),

  // Privacy settings
  incognitoMode: boolean('incognito_mode').default(false).notNull(), // Temporary disable

  // Extraction preferences - which categories to extract
  extractionCategories: json('extraction_categories').$type<string[]>(),

  // Timestamps
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
})

// Type exports for memory system
export type Memory = typeof memories.$inferSelect
export type NewMemory = typeof memories.$inferInsert

export type MemoryExtractionJob = typeof memoryExtractionJobs.$inferSelect
export type NewMemoryExtractionJob = typeof memoryExtractionJobs.$inferInsert

export type UserMemorySettings = typeof userMemorySettings.$inferSelect
export type NewUserMemorySettings = typeof userMemorySettings.$inferInsert

// =============================================================================
// SCHEDULED TASKS SYSTEM
// =============================================================================
//
// Enables users to create scheduled/recurring agent tasks.
// Agents can propose schedules via emit_schedule_proposal().
// Scheduler runs in Orchestrator using node-cron.
//
// Tier limits:
// - Free: 1 schedule
// - Pro: 3 schedules
// - Max: 10 schedules
// =============================================================================

// Schedule enum values (for reference)
// Schedule type: 'cron' | 'interval' | 'one_time'
// Schedule status: 'pending_approval' | 'active' | 'paused' | 'completed' | 'disabled' | 'failed' | 'expired'
// Interval unit: 'minutes' | 'hours' | 'days' | 'weeks'
// Execution status: 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'skipped' | 'retrying'

// Type for retry configuration JSON
export type ScheduleRetryConfig = {
  maxRetries: number           // Max retry attempts (default: 3)
  retryDelayMs: number         // Initial delay between retries (default: 60000)
  backoffMultiplier: number    // Exponential backoff multiplier (default: 2)
  maxRetryDelayMs: number      // Maximum delay cap (default: 3600000 = 1 hour)
}

// Type for notification settings JSON
export type ScheduleNotificationSettings = {
  onSuccess: boolean           // Notify on successful execution
  onFailure: boolean           // Notify on failed execution
  onPause: boolean             // Notify when paused (e.g., too many failures)
  channels: ('in_app' | 'email')[]  // Notification channels
}

// Type for context snapshot JSON
export type ScheduleContextSnapshot = {
  files?: Array<{
    id: string
    name: string
    path: string
    mimeType?: string
    size?: number
  }>
  variables?: Record<string, string>
  createdAt: string
}

// Type for execution plan JSON (stores concrete parameters for scheduled execution)
export type ScheduleExecutionPlan = {
  taskType: 'research' | 'ideation' | 'monitoring' | 'custom'
  version: number
  parameters: {
    // Research-specific
    subreddits?: string[]
    keywords?: string[]
    timeRange?: 'day' | 'week' | 'month' | 'year' | 'all'
    minUpvotes?: number
    // Generic parameters
    query?: string
    filters?: Record<string, unknown>
    outputFormat?: string
    agentConfig?: Record<string, unknown>
  }
  expectedOutputs?: Array<{
    type: string
    name: string
    description?: string
  }>
  createdFromPlanMode: boolean
  planModeAnswers?: Record<string, unknown>
}

// Type for execution result outputs JSON
export type ExecutionResultOutput = {
  type: string    // e.g., 'file', 'text', 'chart'
  path: string    // Storage path or reference
  name: string    // Display name
}

// Main schedules table
export const schedules = mysqlTable('schedules', {
  id: char('id', { length: 36 }).primaryKey(),
  orgId: char('org_id', { length: 36 }).notNull(),
  userId: varchar('user_id', { length: 128 }).notNull(),

  // Agent configuration
  agentId: varchar('agent_id', { length: 255 }).notNull(),
  agentName: varchar('agent_name', { length: 255 }),

  // Schedule identification
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  prompt: text('prompt').notNull(),

  // Schedule type and configuration
  scheduleType: mysqlEnum('schedule_type', ['cron', 'interval', 'one_time']).notNull(),
  cronExpression: varchar('cron_expression', { length: 100 }),
  intervalValue: int('interval_value'),
  intervalUnit: mysqlEnum('interval_unit', ['minutes', 'hours', 'days', 'weeks']),
  oneTimeAt: timestamp('one_time_at'),
  timezone: varchar('timezone', { length: 50 }).default('UTC').notNull(),

  // Status tracking
  status: mysqlEnum('status', ['pending_approval', 'active', 'paused', 'completed', 'disabled', 'failed', 'expired']).default('pending_approval').notNull(),

  // Run tracking
  nextRunAt: timestamp('next_run_at'),
  lastRunAt: timestamp('last_run_at'),
  runCount: int('run_count').default(0).notNull(),
  successCount: int('success_count').default(0).notNull(),
  failureCount: int('failure_count').default(0).notNull(),
  consecutiveFailures: int('consecutive_failures').default(0).notNull(),

  // Retry configuration
  retryConfig: json('retry_config').$type<ScheduleRetryConfig>(),

  // Notification settings
  notificationSettings: json('notification_settings').$type<ScheduleNotificationSettings>(),

  // Context snapshot for files
  contextSnapshot: json('context_snapshot').$type<ScheduleContextSnapshot>(),

  // Execution plan (concrete parameters for scheduled execution from plan mode)
  executionPlan: json('execution_plan').$type<ScheduleExecutionPlan>(),

  // Dedicated conversation thread for this schedule
  threadId: char('thread_id', { length: 36 }),

  // Proposal tracking
  proposalId: char('proposal_id', { length: 36 }),
  fromProposal: boolean('from_proposal').default(false).notNull(),

  // Validity period
  validFrom: timestamp('valid_from'),
  validUntil: timestamp('valid_until'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  pausedAt: timestamp('paused_at'),
  deletedAt: timestamp('deleted_at'),
}, (t) => ({
  idxOrgStatus: index('idx_schedules_org_status').on(t.orgId, t.status),
  idxOrgUser: index('idx_schedules_org_user').on(t.orgId, t.userId),
  idxAgent: index('idx_schedules_agent').on(t.agentId),
  idxNextRun: index('idx_schedules_next_run').on(t.nextRunAt),
  idxStatus: index('idx_schedules_status').on(t.status),
  idxThread: index('idx_schedules_thread').on(t.threadId),
}))

// Schedule executions table (individual run history)
export const scheduleExecutions = mysqlTable('schedule_executions', {
  id: char('id', { length: 36 }).primaryKey(),
  scheduleId: char('schedule_id', { length: 36 }).notNull(),
  orgId: char('org_id', { length: 36 }).notNull(),

  // Execution tracking
  executionNumber: int('execution_number').notNull(),
  status: mysqlEnum('status', ['pending', 'running', 'succeeded', 'failed', 'cancelled', 'skipped', 'retrying']).default('pending').notNull(),

  // Activity reference (creates an activity for each execution)
  activityId: char('activity_id', { length: 36 }),

  // Conversation thread (uses schedule's dedicated thread)
  threadId: char('thread_id', { length: 36 }),

  // Timing
  scheduledAt: timestamp('scheduled_at').notNull(),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  durationMs: int('duration_ms'),

  // Retry tracking
  retryAttempt: int('retry_attempt').default(0).notNull(),
  maxRetries: int('max_retries').default(3).notNull(),
  nextRetryAt: timestamp('next_retry_at'),

  // Result storage
  resultSummary: text('result_summary'),
  resultOutputs: json('result_outputs').$type<ExecutionResultOutput[]>(),

  // Error tracking
  errorCode: varchar('error_code', { length: 50 }),
  errorMessage: text('error_message'),
  errorRetryable: boolean('error_retryable'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  idxSchedule: index('idx_executions_schedule').on(t.scheduleId),
  idxOrg: index('idx_executions_org').on(t.orgId),
  idxStatus: index('idx_executions_status').on(t.status),
  idxScheduledAt: index('idx_executions_scheduled_at').on(t.scheduledAt),
  idxActivity: index('idx_executions_activity').on(t.activityId),
  idxScheduleStatus: index('idx_executions_schedule_status').on(t.scheduleId, t.status),
}))

// Type exports for scheduled tasks
export type Schedule = typeof schedules.$inferSelect
export type NewSchedule = typeof schedules.$inferInsert

export type ScheduleExecution = typeof scheduleExecutions.$inferSelect
export type NewScheduleExecution = typeof scheduleExecutions.$inferInsert

// =============================================================================
// FEATURE QUOTAS SYSTEM
// =============================================================================
//
// Feature-based usage quotas for tracking and enforcing limits on:
// - Research tasks (monthly usage)
// - Ideation sessions (monthly usage)
// - Auto-posting actions (monthly usage)
// - Active monitors (concurrent count, not reset monthly)
//
// Tier limits:
// | Plan    | Research | Ideation | Auto-posting | Monitors |
// |---------|----------|----------|--------------|----------|
// | Free    | 2        | 10       | N/A          | N/A      |
// | Starter | 10       | 30       | N/A          | N/A      |
// | Pro     | 60       | 300      | 30           | 3        |
// | Max     | 300      | 3000     | 300          | 20       |
//
// N/A = Feature not available (blocked)
// =============================================================================

// Feature type enum for usage events
export const featureTypeEnum = mysqlEnum('feature_type', [
  'research',
  'ideation',
  'auto_posting',
  'monitors',
])

// Feature usage action enum (column name 'action' mapped via schema)
export const featureUsageActionValues = ['increment', 'decrement'] as const

// Feature quotas table (per-org quota tracking)
export const featureQuotas = mysqlTable('feature_quotas', {
  orgId: char('org_id', { length: 36 }).primaryKey(),

  // Current billing period (synced from subscriptions)
  billingPeriodStart: timestamp('billing_period_start').notNull(),
  billingPeriodEnd: timestamp('billing_period_end').notNull(),

  // Monthly usage quotas - limits (set based on tier)
  researchLimit: int('research_limit').default(0).notNull(),
  ideationLimit: int('ideation_limit').default(0).notNull(),
  autoPostingLimit: int('auto_posting_limit').default(0).notNull(),
  monitorsLimit: int('monitors_limit').default(0).notNull(),

  // Monthly usage counters (reset each billing cycle)
  researchUsed: int('research_used').default(0).notNull(),
  ideationUsed: int('ideation_used').default(0).notNull(),
  autoPostingUsed: int('auto_posting_used').default(0).notNull(),

  // Active count (NOT reset - represents current concurrent usage)
  monitorsActive: int('monitors_active').default(0).notNull(),

  // Feature availability flags (false = N/A/blocked for this tier)
  researchAvailable: boolean('research_available').default(false).notNull(),
  ideationAvailable: boolean('ideation_available').default(false).notNull(),
  autoPostingAvailable: boolean('auto_posting_available').default(false).notNull(),
  monitorsAvailable: boolean('monitors_available').default(false).notNull(),

  // Audit
  lastResetAt: timestamp('last_reset_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
})

// Feature usage events table (audit trail)
export const featureUsageEvents = mysqlTable('feature_usage_events', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  orgId: char('org_id', { length: 36 }).notNull(),
  userId: varchar('user_id', { length: 128 }).notNull(),

  // Feature info
  featureType: featureTypeEnum.notNull(),
  action: mysqlEnum('action', featureUsageActionValues).notNull(), // decrement only for monitors

  // Context
  resourceId: varchar('resource_id', { length: 255 }), // e.g., monitor ID, research task ID
  agentId: varchar('agent_id', { length: 255 }),
  metadata: json('metadata'),

  // Billing period at time of event
  billingPeriodStart: timestamp('billing_period_start').notNull(),
  billingPeriodEnd: timestamp('billing_period_end').notNull(),

  // Snapshot of usage at time of event
  usageAtEvent: int('usage_at_event').notNull(),
  limitAtEvent: int('limit_at_event').notNull(),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  idxOrgFeature: index('idx_feature_usage_org_feature').on(t.orgId, t.featureType, t.createdAt),
  idxOrgPeriod: index('idx_feature_usage_org_period').on(t.orgId, t.billingPeriodStart),
  idxUser: index('idx_feature_usage_user').on(t.userId),
  idxResource: index('idx_feature_usage_resource').on(t.resourceId),
}))

// Type exports for feature quotas
export type FeatureQuota = typeof featureQuotas.$inferSelect
export type NewFeatureQuota = typeof featureQuotas.$inferInsert

export type FeatureUsageEvent = typeof featureUsageEvents.$inferSelect
export type NewFeatureUsageEvent = typeof featureUsageEvents.$inferInsert

// =============================================================================
// BILLING EVENTS AUDIT TABLES
// =============================================================================

// Detection source enum
export const detectionSourceEnum = mysqlEnum('detection_source', [
  'sdk',
  'file_output',
  'scheduled_post',
  'monitor_event',
  'detected',
])

// Audit status enum
export const auditStatusEnum = mysqlEnum('audit_status', [
  'pending',
  'approved',
  'flagged',
  'refunded',
  'skipped',
])

// Billing events table (for LLM audit)
export const billingEvents = mysqlTable('billing_events', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),

  // Organization and user context
  orgId: char('org_id', { length: 36 }).notNull(),
  userId: varchar('user_id', { length: 128 }).notNull(),

  // Workflow context
  workflowId: varchar('workflow_id', { length: 128 }),
  sessionId: varchar('session_id', { length: 128 }),
  agentId: varchar('agent_id', { length: 255 }),

  // Billing claim details
  claimedType: featureTypeEnum.notNull(),
  detectionSource: detectionSourceEnum.notNull(),
  detectionConfidence: decimal('detection_confidence', { precision: 3, scale: 2 }).default('1.00').notNull(),

  // Content for audit
  userPrompt: text('user_prompt'),
  agentResponseSummary: text('agent_response_summary'),
  outputArtifacts: json('output_artifacts'),

  // Audit status and results
  auditStatus: auditStatusEnum.default('pending').notNull(),
  auditResult: json('audit_result'),
  auditedAt: timestamp('audited_at'),
  auditedBy: varchar('audited_by', { length: 128 }),

  // Quota impact
  quotaIncremented: boolean('quota_incremented').default(false).notNull(),
  quotaIncrementAt: timestamp('quota_increment_at'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  idxAuditStatus: index('idx_billing_events_audit_status').on(t.auditStatus, t.createdAt),
  idxOrgCreated: index('idx_billing_events_org_created').on(t.orgId, t.createdAt),
  idxWorkflow: index('idx_billing_events_workflow').on(t.workflowId),
  idxSource: index('idx_billing_events_source').on(t.detectionSource, t.claimedType),
}))

// Audit queue status enum
export const auditQueueStatusEnum = mysqlEnum('status', ['pending', 'processing', 'completed', 'failed'])

// Billing audit queue table
export const billingAuditQueue = mysqlTable('billing_audit_queue', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  billingEventId: bigint('billing_event_id', { mode: 'number', unsigned: true }).notNull(),
  priority: tinyint('priority').default(5).notNull(),
  attempts: tinyint('attempts').default(0).notNull(),
  maxAttempts: tinyint('max_attempts').default(3).notNull(),
  lastAttemptAt: timestamp('last_attempt_at'),
  errorMessage: text('error_message'),
  status: auditQueueStatusEnum.default('pending').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  idxPending: index('idx_audit_queue_pending').on(t.status, t.priority, t.createdAt),
}))

// Type exports for billing events
export type BillingEvent = typeof billingEvents.$inferSelect
export type NewBillingEvent = typeof billingEvents.$inferInsert

export type BillingAuditQueueItem = typeof billingAuditQueue.$inferSelect
export type NewBillingAuditQueueItem = typeof billingAuditQueue.$inferInsert

