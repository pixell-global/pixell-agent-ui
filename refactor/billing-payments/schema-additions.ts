/**
 * Drizzle ORM Schema Additions for Billing System
 *
 * Add these table definitions to: packages/db-mysql/src/schema.ts
 *
 * These schemas correspond to the SQL migration in 0003_billing_system.sql
 */

import {
  mysqlTable,
  varchar,
  char,
  text,
  json,
  timestamp,
  mysqlEnum,
  index,
  bigint,
  int,
  decimal,
  boolean,
  unique
} from 'drizzle-orm/mysql-core'

// =============================================================================
// SUBSCRIPTIONS
// =============================================================================

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

// =============================================================================
// BILLABLE ACTIONS
// =============================================================================

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
  idxTier: index('idx_billable_tier').on(t.actionTier),
  idxIdempotency: index('idx_billable_idempotency').on(t.idempotencyKey),
  idxUser: index('idx_billable_user').on(t.userId),
}))

// =============================================================================
// CREDIT BALANCES
// =============================================================================

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

// =============================================================================
// CREDIT PURCHASES
// =============================================================================

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

// =============================================================================
// WEBHOOK EVENTS
// =============================================================================

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

// =============================================================================
// INVOICES
// =============================================================================

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
// UPDATED ORGANIZATIONS SCHEMA (modifications only)
// =============================================================================

/**
 * Add these fields to the existing organizations table:
 *
 * subscriptionTier: mysqlEnum('subscription_tier', ['free', 'starter', 'pro', 'max']).default('free').notNull(),
 * trialEndsAt: timestamp('trial_ends_at'),
 * lastBillingWarningAt: timestamp('last_billing_warning_at'),
 */

// =============================================================================
// UPDATED ACTION_EVENTS SCHEMA (optional modification)
// =============================================================================

/**
 * Add this field to the existing actionEvents table:
 *
 * billableActionId: bigint('billable_action_id', { mode: 'number', unsigned: true }),
 */

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
// USAGE EXAMPLE
// =============================================================================

/**
 * Example usage in your code:
 *
 * import { getDb, subscriptions, creditBalances } from '@pixell/db-mysql'
 * import { eq } from 'drizzle-orm'
 *
 * const db = await getDb()
 *
 * // Get subscription
 * const subscription = await db
 *   .select()
 *   .from(subscriptions)
 *   .where(eq(subscriptions.orgId, orgId))
 *   .limit(1)
 *
 * // Get credit balance
 * const balance = await db
 *   .select()
 *   .from(creditBalances)
 *   .where(eq(creditBalances.orgId, orgId))
 *   .limit(1)
 *
 * // Record billable action
 * await db.insert(billableActions).values({
 *   orgId,
 *   userId,
 *   actionTier: 'medium',
 *   creditsUsed: '2.5',
 *   billingPeriodStart: balance.billingPeriodStart,
 *   billingPeriodEnd: balance.billingPeriodEnd,
 * })
 */
