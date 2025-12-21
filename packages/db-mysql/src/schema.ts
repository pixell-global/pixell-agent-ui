import { mysqlTable, varchar, char, text, json, timestamp, mysqlEnum, index, primaryKey, bigint, int, unique, decimal, boolean } from 'drizzle-orm/mysql-core'

export const users = mysqlTable('users', {
  id: varchar('id', { length: 128 }).primaryKey(),
  email: varchar('email', { length: 320 }).notNull().unique(),
  displayName: varchar('display_name', { length: 120 }),
  // S3 storage base path allocated per user (org-scoped prefix)
  // e.g. orgs/<orgId>/users/<userId>
  s3StoragePath: varchar('s3_storage_path', { length: 500 }),
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

  // Action classification
  actionTier: mysqlEnum('action_tier', ['small', 'medium', 'large', 'xl']).notNull(),
  creditsUsed: decimal('credits_used', { precision: 10, scale: 2 }).notNull(),

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
  idxTier: index('idx_billable_tier').on(t.actionTier),
  idxIdempotency: index('idx_billable_idempotency').on(t.idempotencyKey),
  idxUser: index('idx_billable_user').on(t.userId),
}))

export const creditBalances = mysqlTable('credit_balances', {
  orgId: char('org_id', { length: 36 }).primaryKey(),

  // Current billing period
  billingPeriodStart: timestamp('billing_period_start').notNull(),
  billingPeriodEnd: timestamp('billing_period_end').notNull(),

  // Plan-included credits (monthly allocation)
  includedSmall: int('included_small').default(0).notNull(),
  includedMedium: int('included_medium').default(0).notNull(),
  includedLarge: int('included_large').default(0).notNull(),
  includedXl: int('included_xl').default(0).notNull(),

  // Used credits this period
  usedSmall: int('used_small').default(0).notNull(),
  usedMedium: int('used_medium').default(0).notNull(),
  usedLarge: int('used_large').default(0).notNull(),
  usedXl: int('used_xl').default(0).notNull(),

  // Purchased top-up credits
  topupCredits: decimal('topup_credits', { precision: 10, scale: 2 }).default('0').notNull(),
  topupCreditsUsed: decimal('topup_credits_used', { precision: 10, scale: 2 }).default('0').notNull(),

  // Auto top-up settings
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

