# Billing & Payments Implementation Plan

**Status:** Design Phase - Finalized
**Created:** 2025-11-16
**Updated:** 2025-11-16
**Database:** MySQL (packages/db-mysql)
**Payment Processor:** Stripe
**Email Service:** AWS SES
**Monitoring:** Stripe Dashboard + Email Alerts

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Design Decisions](#design-decisions)
3. [Database Schema](#database-schema)
4. [Stripe Configuration](#stripe-configuration)
5. [API Endpoints](#api-endpoints)
6. [Business Logic](#business-logic)
7. [UI Components](#ui-components)
8. [Migration Strategy](#migration-strategy)
9. [Testing Plan](#testing-plan)
10. [Implementation Checklist](#implementation-checklist)

---

## Executive Summary

### Subscription Model: Hybrid (Base Subscription + Usage Credits)

| Plan | Price | Trial | Small | Medium | Large | XL | Total Credits |
|------|-------|-------|-------|--------|-------|-----|---------------|
| **Free** | $0 | N/A | 10 | 4 | 2 | 1 | ~25 credits |
| **Starter** | $9.99/mo | 7 days | 250 | 100 | 50 | 15 | ~600 credits |
| **Pro** | $99/mo | 7 days | 2,500 | 1,000 | 500 | 160 | ~6,000 credits |
| **Max** | $499.99/mo | 7 days | 12,500 | 5,000 | 2,500 | 800 | ~30,000 credits |

### Credit Economics

**Credit Conversion Rates:**
- Small action = 1 credit (Dev payout: $0.02)
- Medium action = 2.5 credits (Dev payout: $0.05)
- Large action = 5 credits (Dev payout: $0.10)
- XL action = 15 credits (Dev payout: $0.30)

**Platform Economics:**
- Developer payout rate: 80% (handled in separate PAC database - OUT OF SCOPE)
- Platform margin: 20%
- Monthly credit reset on billing cycle
- Auto top-up: 500 credits = $20 (4¢/credit)

### Key Features

✅ **Phase 1 - Full Implementation:**
- Subscription checkout with 7-day trial (no card required)
- Usage tracking by action tier (small/medium/large/xl)
- Per-user usage analytics (org-level enforcement)
- Credit balance management with monthly reset
- Automatic credit top-ups
- Hard usage limits (warn at 80%, block at 100% with immediate upgrade prompt)
- Webhook handlers for all critical Stripe events
- Billing dashboard in Settings section with per-tier progress bars
- Subscription badge in navigation
- Subscription management (upgrade/downgrade/cancel)
- Invoice history
- Failed payment handling → downgrade to free tier
- Critical email notifications via AWS SES (payment failed, trial ending, receipts)
- Weekly reconciliation job (Sundays 3am)
- Orchestrator-only usage recording API (service token auth)

---

## Design Decisions

### Architecture Choices

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Database** | MySQL (packages/db-mysql) | Organizations already in MySQL; maintains referential integrity |
| **Action Tracking** | New `billable_actions` table | Clean separation from existing `actionEvents`; billing-specific structure |
| **Action Tier Mapping** | `actionTier` enum column | Explicit, queryable, better than parsing actionKey strings |
| **Credit Balance** | Cached `credit_balances` table | Fast reads for dashboard; updated on each action |
| **Stripe Data Sync** | Hybrid (cache key fields) | Store frequently-accessed fields; query API for details |
| **Trial Tracking** | Sync from Stripe via webhooks | Stripe is source of truth; avoid duplication |
| **Invoice Storage** | Minimal (ID + URL cache) | Store reference only; Stripe has full details |
| **Auto Top-Up Trigger** | Async after action recorded | No latency impact; near real-time; full control |
| **Developer Payouts** | OUT OF SCOPE | Separate PAC database; Phase 2 concern |
| **Email Service** | AWS SES | Cost-effective ($0.10/1k emails); already using AWS |
| **Monitoring** | Stripe Dashboard + Email | Simple setup; webhook_events table for debugging |
| **Reconciliation** | Weekly cron job | Sundays 3am; sync credit_balances with actual usage |
| **Usage Limits** | Org-level + per-user tracking | Enforce at org; track per-user for analytics/visibility |
| **Limit Behavior** | Fail immediately | Hard stop with upgrade modal; clear call-to-action |
| **Free Tier Duration** | Unlimited (after trial/downgrade) | 10/4/2/1 actions/month forever; no time limit |

### Data Flow

```
User Action Request
    ↓
Check Credit Balance (credit_balances table)
    ↓
Allowed? → Execute Action
    ↓
Record Usage (billable_actions table)
    ↓
Update Balance (credit_balances table)
    ↓
Check Auto Top-Up Threshold (async)
    ↓
Trigger Stripe Payment if needed
    ↓
Webhook Updates Balance
```

---

## Database Schema

### New Tables

#### 1. `subscriptions` - Stripe Subscription Details

```sql
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

  CONSTRAINT fk_subscriptions_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
  INDEX idx_subscriptions_org (org_id),
  INDEX idx_subscriptions_stripe (stripe_subscription_id),
  INDEX idx_subscriptions_status (status)
);
```

**Key Fields:**
- `plan_tier`: Current subscription tier (used for credit allocation)
- `status`: Synced from Stripe (active, trialing, etc.)
- `current_period_start/end`: For calculating billing periods
- `trial_end`: Synced from Stripe, used for trial countdown UI

---

#### 2. `billable_actions` - Usage Tracking (New, Clean Table)

```sql
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
  INDEX idx_billable_org_period (org_id, billing_period_start, billing_period_end),
  INDEX idx_billable_org_created (org_id, created_at),
  INDEX idx_billable_org_user (org_id, user_id, created_at),
  INDEX idx_billable_tier (action_tier),
  INDEX idx_billable_idempotency (idempotency_key)
);

-- Per-user usage view for analytics (not enforced, just visibility)
CREATE OR REPLACE VIEW user_usage_stats AS
SELECT
  ba.org_id,
  ba.user_id,
  ba.billing_period_start,
  ba.billing_period_end,
  SUM(CASE WHEN ba.action_tier = 'small' THEN 1 ELSE 0 END) as small_actions,
  SUM(CASE WHEN ba.action_tier = 'medium' THEN 1 ELSE 0 END) as medium_actions,
  SUM(CASE WHEN ba.action_tier = 'large' THEN 1 ELSE 0 END) as large_actions,
  SUM(CASE WHEN ba.action_tier = 'xl' THEN 1 ELSE 0 END) as xl_actions,
  SUM(ba.credits_used) as total_credits_used,
  COUNT(*) as total_actions,
  MAX(ba.created_at) as last_action_at
FROM billable_actions ba
GROUP BY ba.org_id, ba.user_id, ba.billing_period_start, ba.billing_period_end;
```

**Key Features:**
- Separate from `actionEvents` (clean billing data)
- `action_tier` enum for easy querying
- `credits_used` stores converted credit amount
- `billing_period_start/end` for monthly aggregation
- `idempotency_key` prevents duplicate billing

---

#### 3. `credit_balances` - Current Period Balance Cache

```sql
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

  -- Last usage warning timestamps
  last_warning_80_at TIMESTAMP NULL,
  last_warning_100_at TIMESTAMP NULL,

  -- Audit
  last_reset_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_credit_balances_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
);
```

**Key Features:**
- **Separate tier tracking**: Shows exact usage per tier (matches UI progress bars)
- **Fast reads**: No aggregation needed for dashboard
- **Auto top-up config**: Per-org threshold and amount settings
- **Warning timestamps**: Prevent spam notifications
- **Monthly reset**: `last_reset_at` tracks when balance was last reset

---

#### 4. `credit_purchases` - Top-Up Transaction History

```sql
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

  CONSTRAINT fk_credit_purchases_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
  INDEX idx_credit_purchases_org (org_id),
  INDEX idx_credit_purchases_stripe_pi (stripe_payment_intent_id),
  INDEX idx_credit_purchases_status (status)
);
```

---

#### 5. `webhook_events` - Stripe Webhook Audit Log

```sql
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
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_webhook_events_type (event_type),
  INDEX idx_webhook_events_status (status),
  INDEX idx_webhook_events_created (created_at)
);
```

**Key Features:**
- **Idempotency**: `stripe_event_id` unique constraint prevents duplicate processing
- **Audit trail**: Full payload stored for debugging
- **Retry tracking**: `retry_count` for failed webhooks
- **Status monitoring**: Easy to find failed events

---

#### 6. `invoices` - Invoice Cache (Minimal)

```sql
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

  CONSTRAINT fk_invoices_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
  INDEX idx_invoices_org (org_id),
  INDEX idx_invoices_stripe (stripe_invoice_id),
  INDEX idx_invoices_status (status)
);
```

**Design Philosophy:**
- **Minimal storage**: Just IDs and URLs
- **Fast queries**: For billing history page
- **Full details via API**: Query Stripe for complete invoice data

---

### Modified Existing Tables

#### Update `organizations` table

```sql
-- Already has these fields (from migration 0002):
-- stripe_customer_id VARCHAR(120)
-- subscription_status ENUM('active','trialing','past_due','incomplete','canceled')

-- ADD these fields:
ALTER TABLE organizations
  ADD COLUMN subscription_tier ENUM('free', 'starter', 'pro', 'max') NOT NULL DEFAULT 'free' AFTER subscription_status,
  ADD COLUMN trial_ends_at TIMESTAMP NULL AFTER subscription_tier,
  ADD COLUMN last_billing_warning_at TIMESTAMP NULL AFTER trial_ends_at;
```

**Why modify organizations:**
- `subscription_tier`: Quick access to current plan (denormalized from subscriptions)
- `trial_ends_at`: For trial countdown UI (synced from Stripe)
- `last_billing_warning_at`: Prevent email spam

---

#### Update `action_events` table (Optional)

```sql
-- Keep existing actionEvents for general tracking
-- Add optional reference to billable actions
ALTER TABLE action_events
  ADD COLUMN billable_action_id BIGINT UNSIGNED NULL AFTER metadata,
  ADD CONSTRAINT fk_action_events_billable FOREIGN KEY (billable_action_id)
    REFERENCES billable_actions(id) ON DELETE SET NULL;
```

**This creates a link** between general action tracking and billing, without mixing concerns.

---

## Stripe Configuration

### Products to Create in Stripe Dashboard

#### Product 1: Pixell Starter
```
Name: Pixell Starter
Description: Perfect for individuals and small teams
Pricing:
  - Price ID: price_starter (save to env)
  - Amount: $9.99 USD
  - Recurring: Monthly
  - Trial: 7 days
```

#### Product 2: Pixell Pro
```
Name: Pixell Pro
Description: For growing teams and agencies
Pricing:
  - Price ID: price_pro (save to env)
  - Amount: $99.00 USD
  - Recurring: Monthly
  - Trial: 7 days
```

#### Product 3: Pixell Max
```
Name: Pixell Max
Description: For large teams with high volume
Pricing:
  - Price ID: price_max (save to env)
  - Amount: $499.99 USD
  - Recurring: Monthly
  - Trial: 7 days
```

#### Product 4: Credit Top-Up
```
Name: Credit Top-Up (500 credits)
Description: Additional credits for your current billing period
Pricing:
  - Price ID: price_credits_500 (save to env)
  - Amount: $20.00 USD
  - Type: One-time
```

### Environment Variables

Add to `.env.local`:

```bash
# Stripe API Keys
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe Price IDs
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_MAX=price_...
STRIPE_PRICE_CREDITS_500=price_...

# Base URL for redirects
NEXT_PUBLIC_BASE_URL=http://localhost:3003

# Billing Configuration
BILLING_TRIAL_DAYS=7
BILLING_WARNING_THRESHOLD=80
BILLING_WARNING_COOLDOWN_HOURS=24

# AWS SES Configuration
AWS_SES_REGION=us-east-1
AWS_SES_FROM_EMAIL=billing@yourdomain.com
AWS_SES_FROM_NAME=Pixell Billing
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret

# Orchestrator Service Token (for internal usage recording)
ORCHESTRATOR_SERVICE_TOKEN=your-secure-random-token-here

# Reconciliation Job
ENABLE_WEEKLY_RECONCILIATION=true
RECONCILIATION_DAY=0  # 0=Sunday
RECONCILIATION_HOUR=3  # 3am
```

### Webhook Configuration

In Stripe Dashboard → Developers → Webhooks:

**Endpoint URL:** `https://yourdomain.com/api/webhooks/stripe`

**Events to listen for:**

Critical (Phase 1):
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `customer.subscription.trial_will_end`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`

Optional (Phase 2):
- `invoice.finalized`
- `invoice.upcoming`
- `customer.updated`
- `payment_method.attached`

---

## API Endpoints

### Subscription Management

#### `POST /api/billing/checkout`
Create Stripe checkout session for new subscription.

**Request:**
```typescript
{
  orgId: string
  planTier: 'starter' | 'pro' | 'max'
  successUrl?: string  // optional custom success URL
  cancelUrl?: string   // optional custom cancel URL
}
```

**Response:**
```typescript
{
  url: string  // Stripe checkout URL
  sessionId: string
}
```

**Implementation Notes:**
- Create/get Stripe customer
- Set trial period (7 days)
- Add metadata: `{ orgId, planTier }`
- Success URL: `/billing/success?session_id={CHECKOUT_SESSION_ID}`
- Cancel URL: `/billing?orgId={orgId}`

---

#### `POST /api/billing/portal`
Open Stripe Customer Portal for subscription management.

**Request:**
```typescript
{
  orgId: string
  returnUrl?: string
}
```

**Response:**
```typescript
{
  url: string  // Stripe portal URL
}
```

---

#### `POST /api/billing/subscription/cancel`
Cancel subscription (end of period or immediate).

**Request:**
```typescript
{
  orgId: string
  immediate: boolean  // true = cancel now, false = end of period
}
```

**Response:**
```typescript
{
  subscription: {
    id: string
    status: string
    cancelAtPeriodEnd: boolean
    currentPeriodEnd: string
  }
}
```

---

#### `POST /api/billing/subscription/upgrade`
Upgrade or downgrade subscription plan.

**Request:**
```typescript
{
  orgId: string
  newPlanTier: 'starter' | 'pro' | 'max'
  prorate: boolean  // default true
}
```

**Response:**
```typescript
{
  subscription: {
    id: string
    planTier: string
    status: string
    proratedAmount?: number
  }
}
```

---

#### `GET /api/billing/subscription/status`
Get current subscription details.

**Response:**
```typescript
{
  subscription: {
    id: string
    planTier: 'free' | 'starter' | 'pro' | 'max'
    status: string
    currentPeriodStart: string
    currentPeriodEnd: string
    trialEnd: string | null
    cancelAtPeriodEnd: boolean
  }
  customer: {
    stripeCustomerId: string
    email: string
  }
}
```

---

### Usage & Credits

#### `POST /api/billing/usage/record`
Record a billable action (called by orchestrator ONLY - requires service token).

**Authentication:**
```typescript
Headers: {
  'Authorization': 'Bearer <ORCHESTRATOR_SERVICE_TOKEN>'
}
```

**Request:**
```typescript
{
  orgId: string
  userId: string
  actionTier: 'small' | 'medium' | 'large' | 'xl'
  agentId?: string
  agentName?: string
  actionKey?: string
  description?: string
  metadata?: Record<string, any>
  idempotencyKey?: string
}
```

**Response:**
```typescript
{
  success: boolean
  actionId: string
  creditsUsed: number
  remainingCredits: {
    small: number
    medium: number
    large: number
    xl: number
  }
  warning?: '80percent' | '100percent' | 'buffer_exceeded'
}
```

**Error Responses:**
```typescript
// 401 Unauthorized (missing/invalid service token)
{
  error: 'Unauthorized',
  code: 'INVALID_SERVICE_TOKEN'
}

// 402 Payment Required (hard limit reached)
{
  error: 'Credit limit exceeded. Please upgrade your plan or purchase additional credits.',
  code: 'CREDITS_EXHAUSTED',
  remainingCredits: {
    small: 0,
    medium: 0,
    large: 0,
    xl: 0
  },
  upgradeUrl: '/settings/billing',
  suggestedPlan: 'pro',
  canTopUp: true,
  topUpUrl: '/settings/billing/topup'
}

// 400 Bad Request
{
  error: 'Invalid action tier',
  code: 'INVALID_ACTION_TIER'
}
```

---

#### `GET /api/billing/usage`
Get current period usage and remaining credits.

**Query Params:**
- `orgId` (required)
- `includePerUser` (optional, default false) - Include per-user breakdown

**Response:**
```typescript
{
  billingPeriod: {
    start: string
    end: string
  }
  credits: {
    small: { included: 250, used: 180, remaining: 70 },
    medium: { included: 100, used: 45, remaining: 55 },
    large: { included: 50, used: 12, remaining: 38 },
    xl: { included: 15, used: 2, remaining: 13 }
  }
  topupCredits: {
    purchased: 500,
    used: 120,
    remaining: 380
  }
  totalRemaining: 541,  // sum of all remaining credits
  warnings: {
    small: null,
    medium: '80percent',
    large: null,
    xl: null
  }
  // Optional: per-user breakdown (if includePerUser=true)
  perUserStats?: [
    {
      userId: string
      displayName: string
      small: 45
      medium: 12
      large: 3
      xl: 0
      totalCredits: 89.5
      lastActionAt: string
    }
  ]
}
```

---

#### `POST /api/billing/usage/check`
Check if an action is allowed (before execution).

**Request:**
```typescript
{
  orgId: string
  actionTier: 'small' | 'medium' | 'large' | 'xl'
}
```

**Response:**
```typescript
{
  allowed: boolean
  remainingCredits: number
  warning?: string
  message?: string
}
```

---

#### `POST /api/billing/credits/topup`
Manual credit purchase (redirects to Stripe checkout).

**Request:**
```typescript
{
  orgId: string
  creditsAmount: 500  // for now, only 500 credit packages
}
```

**Response:**
```typescript
{
  url: string  // Stripe checkout URL for one-time payment
  purchaseId: string
}
```

---

#### `POST /api/billing/credits/auto-topup`
Configure automatic top-up settings.

**Request:**
```typescript
{
  orgId: string
  enabled: boolean
  threshold?: number  // trigger when total credits < this
  amount?: number     // credits to purchase (500)
}
```

**Response:**
```typescript
{
  success: boolean
  settings: {
    enabled: boolean
    threshold: number
    amount: number
  }
}
```

---

### Invoices & History

#### `GET /api/billing/invoices`
List invoices for organization.

**Query Params:**
- `orgId` (required)
- `limit` (optional, default 10)
- `offset` (optional, default 0)

**Response:**
```typescript
{
  invoices: [
    {
      id: string
      stripeInvoiceId: string
      amountDue: number
      amountPaid: number
      status: 'paid' | 'open' | 'void'
      invoiceType: 'subscription' | 'credit_purchase'
      hostedInvoiceUrl: string
      invoicePdf: string
      periodStart: string
      periodEnd: string
      paidAt: string | null
    }
  ],
  total: number
  hasMore: boolean
}
```

---

#### `GET /api/billing/history`
Get billing history (subscriptions, credits, invoices).

**Query Params:**
- `orgId` (required)
- `startDate` (optional)
- `endDate` (optional)

**Response:**
```typescript
{
  events: [
    {
      type: 'subscription_created' | 'subscription_upgraded' | 'credit_purchase' | 'invoice_paid'
      date: string
      description: string
      amount?: number
      details: Record<string, any>
    }
  ]
}
```

---

### Webhooks

#### `POST /api/webhooks/stripe`
Stripe webhook handler (enhanced version).

**Critical Events Handled:**

1. **`checkout.session.completed`**
   - Create subscription record
   - Initialize credit balance
   - Send welcome email

2. **`customer.subscription.created`**
   - Create/update subscription record
   - Set trial period
   - Initialize credit balance

3. **`customer.subscription.updated`**
   - Update subscription status
   - Update plan tier
   - Reset credits if new billing period
   - Update trial end date

4. **`customer.subscription.deleted`**
   - Mark subscription as canceled
   - Downgrade to free tier
   - Preserve data (read-only mode)

5. **`customer.subscription.trial_will_end`**
   - Send trial ending email (3 days before)

6. **`invoice.payment_succeeded`**
   - Mark invoice as paid
   - Ensure subscription active
   - Send receipt email

7. **`invoice.payment_failed`**
   - Send payment failed email
   - Start grace period (7 days)
   - Update subscription to past_due

8. **`payment_intent.succeeded`** (for credit purchases)
   - Add credits to balance
   - Create credit_purchases record
   - Send confirmation email

9. **`payment_intent.payment_failed`**
   - Mark credit purchase as failed
   - Send failure notification

---

## Business Logic

### Core Usage Tracking Flow

```typescript
// Function: recordBillableAction
async function recordBillableAction(params: {
  orgId: string
  userId: string
  actionTier: 'small' | 'medium' | 'large' | 'xl'
  agentId?: string
  agentName?: string
  description?: string
  metadata?: any
  idempotencyKey?: string
}) {
  const db = await getDb()

  // 1. Check if action is allowed
  const balance = await getCreditBalance(params.orgId)
  const allowed = await checkUsageAllowed(balance, params.actionTier)

  if (!allowed.allowed) {
    throw new BillingError('Credit limit exceeded', 'CREDITS_EXHAUSTED')
  }

  // 2. Calculate credits used
  const creditsUsed = getCreditsForTier(params.actionTier)

  // 3. Record the action
  const action = await db.insert(billableActions).values({
    orgId: params.orgId,
    userId: params.userId,
    actionTier: params.actionTier,
    creditsUsed,
    agentId: params.agentId,
    agentName: params.agentName,
    description: params.description,
    metadata: params.metadata,
    billingPeriodStart: balance.billingPeriodStart,
    billingPeriodEnd: balance.billingPeriodEnd,
    idempotencyKey: params.idempotencyKey,
  })

  // 4. Update credit balance (atomic)
  await updateCreditBalance(params.orgId, params.actionTier, creditsUsed)

  // 5. Check warnings (async, non-blocking)
  queueWarningCheck(params.orgId, balance)

  // 6. Check auto top-up threshold (async, non-blocking)
  queueAutoTopUpCheck(params.orgId, balance)

  return {
    actionId: action.id,
    creditsUsed,
    warning: allowed.warning
  }
}
```

---

### Credit Balance Update (Atomic)

```typescript
async function updateCreditBalance(
  orgId: string,
  actionTier: 'small' | 'medium' | 'large' | 'xl',
  creditsUsed: number
) {
  const tierField = `used_${actionTier}` as const

  // Atomic increment using SQL
  await db.execute(sql`
    UPDATE credit_balances
    SET
      ${sql.identifier(tierField)} = ${sql.identifier(tierField)} + 1,
      topup_credits_used = CASE
        WHEN (included_${actionTier} - used_${actionTier}) <= 0
        THEN topup_credits_used + ${creditsUsed}
        ELSE topup_credits_used
      END,
      updated_at = NOW()
    WHERE org_id = ${orgId}
  `)
}
```

**Why this approach:**
- ✅ Atomic update (no race conditions)
- ✅ Uses plan credits first, then topup credits
- ✅ Single database query

---

### Usage Check Logic

```typescript
function checkUsageAllowed(
  balance: CreditBalance,
  actionTier: 'small' | 'medium' | 'large' | 'xl'
): { allowed: boolean, warning?: string } {
  const tierKey = actionTier as keyof typeof balance
  const included = balance[`included_${tierKey}`]
  const used = balance[`used_${tierKey}`]
  const remaining = included - used

  // Calculate percentage used
  const percentUsed = (used / included) * 100

  // Check if tier exhausted
  if (remaining <= 0) {
    // Check if we have top-up credits
    const topupRemaining = balance.topupCredits - balance.topupCreditsUsed
    const creditsNeeded = getCreditsForTier(actionTier)

    if (topupRemaining >= creditsNeeded) {
      return { allowed: true, warning: 'using_topup_credits' }
    }

    // HARD LIMIT: No buffer, fail immediately
    return { allowed: false }
  }

  // Warning at 80%
  const warningThreshold = Number(process.env.BILLING_WARNING_THRESHOLD || 80)
  if (percentUsed >= warningThreshold && percentUsed < 100) {
    return { allowed: true, warning: '80percent' }
  }

  return { allowed: true }
}
```

---

### Billing Period Reset (Webhook Handler)

```typescript
// Triggered by: customer.subscription.updated
// When: current_period_start changes
async function resetBillingPeriod(subscription: Stripe.Subscription) {
  const orgId = await getOrgIdFromStripeCustomerId(subscription.customer)
  const planTier = getPlanTierFromPriceId(subscription.items.data[0].price.id)
  const planLimits = PLAN_LIMITS[planTier]

  await db.insert(creditBalances).values({
    orgId,
    billingPeriodStart: new Date(subscription.current_period_start * 1000),
    billingPeriodEnd: new Date(subscription.current_period_end * 1000),

    // Reset to plan limits
    includedSmall: planLimits.small,
    includedMedium: planLimits.medium,
    includedLarge: planLimits.large,
    includedXl: planLimits.xl,

    // Zero out usage
    usedSmall: 0,
    usedMedium: 0,
    usedLarge: 0,
    usedXl: 0,

    // Clear one-time topups (they don't roll over)
    topupCredits: 0,
    topupCreditsUsed: 0,

    lastResetAt: new Date(),
  }).onDuplicateKeyUpdate({
    set: {
      billingPeriodStart: new Date(subscription.current_period_start * 1000),
      billingPeriodEnd: new Date(subscription.current_period_end * 1000),
      includedSmall: planLimits.small,
      includedMedium: planLimits.medium,
      includedLarge: planLimits.large,
      includedXl: planLimits.xl,
      usedSmall: 0,
      usedMedium: 0,
      usedLarge: 0,
      usedXl: 0,
      topupCredits: 0,
      topupCreditsUsed: 0,
      lastResetAt: new Date(),
    }
  })
}
```

---

### Auto Top-Up Trigger (Async)

```typescript
async function checkAndTriggerAutoTopUp(orgId: string) {
  const balance = await getCreditBalance(orgId)

  if (!balance.autoTopupEnabled) return

  // Calculate total remaining credits (converted to unified credits)
  const totalRemaining =
    (balance.includedSmall - balance.usedSmall) * 1 +
    (balance.includedMedium - balance.usedMedium) * 2.5 +
    (balance.includedLarge - balance.usedLarge) * 5 +
    (balance.includedXl - balance.usedXl) * 15 +
    (balance.topupCredits - balance.topupCreditsUsed)

  if (totalRemaining < balance.autoTopupThreshold) {
    // Trigger Stripe payment
    const org = await getOrganization(orgId)

    const paymentIntent = await stripe.paymentIntents.create({
      amount: 2000, // $20.00 for 500 credits
      currency: 'usd',
      customer: org.stripeCustomerId,
      payment_method: await getDefaultPaymentMethod(org.stripeCustomerId),
      off_session: true,
      confirm: true,
      metadata: {
        orgId,
        purchaseType: 'auto_topup',
        creditsAmount: balance.autoTopupAmount,
      }
    })

    // Create purchase record
    await db.insert(creditPurchases).values({
      id: randomUUID(),
      orgId,
      stripePaymentIntentId: paymentIntent.id,
      creditsAmount: balance.autoTopupAmount,
      amountPaid: 20.00,
      currency: 'usd',
      purchaseType: 'auto_topup',
      status: 'pending',
    })

    // Send notification
    await sendEmail({
      to: org.email,
      subject: 'Auto Top-Up Triggered',
      template: 'auto-topup-triggered',
      data: {
        creditsAmount: balance.autoTopupAmount,
        amountCharged: '$20.00',
        newBalance: totalRemaining + balance.autoTopupAmount
      }
    })
  }
}
```

---

### Failed Payment Handler

```typescript
// Webhook: invoice.payment_failed
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const orgId = await getOrgIdFromStripeCustomerId(invoice.customer)
  const org = await getOrganization(orgId)

  // Update subscription status
  await db.update(subscriptions)
    .set({ status: 'past_due' })
    .where(eq(subscriptions.orgId, orgId))

  await db.update(organizations)
    .set({
      subscriptionStatus: 'past_due',
      lastBillingWarningAt: new Date()
    })
    .where(eq(organizations.id, orgId))

  // Send warning email
  await sendEmail({
    to: org.email,
    subject: 'Payment Failed - Action Required',
    template: 'payment-failed',
    data: {
      amountDue: invoice.amount_due / 100,
      nextRetryDate: invoice.next_payment_attempt,
      updatePaymentUrl: await createBillingPortalUrl(orgId)
    }
  })

  // Start grace period countdown
  scheduleGracePeriodEnd(orgId, 7) // 7 days
}

// After 7 days grace period
async function handleGracePeriodExpired(orgId: string) {
  // Cancel subscription
  await stripe.subscriptions.cancel(subscription.stripeSubscriptionId)

  // Downgrade to free tier
  await downgradeToFreeTier(orgId)

  // Send final notice
  await sendEmail({
    to: org.email,
    subject: 'Subscription Canceled - Downgraded to Free Tier',
    template: 'downgraded-to-free',
    data: {
      freeTierLimits: PLAN_LIMITS.free,
      upgradeUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/billing`
    }
  })
}
```

---

## UI Components

### 1. Subscription Badge in Navigation

```tsx
// components/nav/SubscriptionBadge.tsx
export function SubscriptionBadge() {
  const { subscription } = useSubscription()

  const tierColors = {
    free: 'bg-gray-100 text-gray-700',
    starter: 'bg-blue-100 text-blue-700',
    pro: 'bg-purple-100 text-purple-700',
    max: 'bg-gold-100 text-gold-700',
  }

  const isTrialing = subscription.status === 'trialing'

  return (
    <Link href="/settings/billing">
      <div className={`px-2 py-1 rounded-md text-xs font-medium ${tierColors[subscription.planTier]}`}>
        {subscription.planTier.toUpperCase()}
        {isTrialing && ' (Trial)'}
      </div>
    </Link>
  )
}
```

---

### 2. Billing Dashboard (`/app/settings/billing`)

```tsx
import { ProgressBar } from '@/components/billing/ProgressBar'
import { CurrentPlanCard } from '@/components/billing/CurrentPlanCard'
import { AutoTopUpCard } from '@/components/billing/AutoTopUpCard'
import { UserUsageTable } from '@/components/billing/UserUsageTable'
import { RecentActionsTable } from '@/components/billing/RecentActionsTable'

export default function BillingDashboardPage() {
  const { subscription, loading } = useSubscription()
  const { usage } = useUsage(true) // includePerUser=true

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Billing & Usage</h1>

      {/* Current Plan */}
      <CurrentPlanCard
        tier={subscription.planTier}
        status={subscription.status}
        nextBillingDate={subscription.currentPeriodEnd}
        trialEndsAt={subscription.trialEnd}
        onManageSubscription={() => openBillingPortal()}
        onUpgrade={() => router.push('/billing')}
      />

      {/* Usage Meters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <ProgressBar
          label="Small Actions"
          used={usage.credits.small.used}
          total={usage.credits.small.included}
          color="green"
          warning={usage.warnings.small}
        />
        <ProgressBar
          label="Medium Actions"
          used={usage.credits.medium.used}
          total={usage.credits.medium.included}
          color="blue"
          warning={usage.warnings.medium}
        />
        <ProgressBar
          label="Large Actions"
          used={usage.credits.large.used}
          total={usage.credits.large.included}
          color="orange"
          warning={usage.warnings.large}
        />
        <ProgressBar
          label="XL Actions"
          used={usage.credits.xl.used}
          total={usage.credits.xl.included}
          color="red"
          warning={usage.warnings.xl}
        />
      </div>

      {/* Top-up Credits (if any) */}
      {usage.topupCredits.purchased > 0 && (
        <div className="mt-4">
          <ProgressBar
            label="Top-Up Credits"
            used={usage.topupCredits.used}
            total={usage.topupCredits.purchased}
            color="purple"
            showCredits
          />
        </div>
      )}

      {/* Auto Top-Up Settings */}
      <AutoTopUpCard
        enabled={usage.autoTopupEnabled}
        threshold={usage.autoTopupThreshold}
        amount={usage.autoTopupAmount}
        onUpdate={updateAutoTopUp}
      />

      {/* Usage Chart */}
      <UsageChart
        data={usage.dailyUsage}
        billingPeriodEnd={subscription.currentPeriodEnd}
      />

      {/* Per-User Usage (Analytics - No Enforcement) */}
      <UserUsageTable
        users={usage.perUserStats}
        billingPeriod={usage.billingPeriod}
      />

      {/* Recent Actions */}
      <RecentActionsTable
        actions={usage.recentActions}
        onViewAll={() => router.push('/settings/billing/usage')}
      />
    </div>
  )
}
```

---

### 3. Per-User Usage Table Component

```tsx
// components/billing/UserUsageTable.tsx
interface UserUsageTableProps {
  users: Array<{
    userId: string
    displayName: string
    small: number
    medium: number
    large: number
    xl: number
    totalCredits: number
    lastActionAt: string
  }>
  billingPeriod: { start: string, end: string }
}

export function UserUsageTable({ users, billingPeriod }: UserUsageTableProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6 mt-6">
      <h3 className="text-lg font-semibold mb-4">
        User Activity (Analytics Only - Not Enforced)
      </h3>
      <p className="text-sm text-gray-600 mb-4">
        This shows how credits are being used across your team.
        Limits are enforced at the organization level.
      </p>

      <table className="w-full">
        <thead>
          <tr className="text-left text-sm text-gray-500">
            <th className="pb-2">User</th>
            <th className="pb-2">Small</th>
            <th className="pb-2">Medium</th>
            <th className="pb-2">Large</th>
            <th className="pb-2">XL</th>
            <th className="pb-2">Total Credits</th>
            <th className="pb-2">Last Activity</th>
          </tr>
        </thead>
        <tbody>
          {users.map(user => (
            <tr key={user.userId} className="border-t">
              <td className="py-3 font-medium">{user.displayName}</td>
              <td className="py-3">{user.small}</td>
              <td className="py-3">{user.medium}</td>
              <td className="py-3">{user.large}</td>
              <td className="py-3">{user.xl}</td>
              <td className="py-3">{user.totalCredits.toFixed(1)}</td>
              <td className="py-3 text-sm text-gray-600">
                {formatDistanceToNow(new Date(user.lastActionAt))} ago
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

---

### 4. Progress Bar Component

```tsx
// components/billing/ProgressBar.tsx
interface ProgressBarProps {
  label: string
  used: number
  total: number
  color: 'green' | 'blue' | 'orange' | 'red' | 'purple'
  warning?: '80percent' | '100percent' | null
  showCredits?: boolean
}

export function ProgressBar({ label, used, total, color, warning, showCredits }: ProgressBarProps) {
  const percentage = Math.min((used / total) * 100, 100)
  const remaining = Math.max(total - used, 0)

  const colorClasses = {
    green: 'bg-green-500',
    blue: 'bg-blue-500',
    orange: 'bg-orange-500',
    red: 'bg-red-500',
    purple: 'bg-purple-500',
  }

  const warningColor = warning === '100percent' ? 'bg-red-500' :
                       warning === '80percent' ? 'bg-yellow-500' :
                       colorClasses[color]

  return (
    <div className="bg-white rounded-lg p-4 shadow">
      <div className="flex justify-between items-center mb-2">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="text-sm text-gray-600">
          {used} / {total} {showCredits ? 'credits' : 'actions'}
        </span>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div
          className={`h-2.5 rounded-full ${warningColor} transition-all`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="flex justify-between items-center mt-2">
        <span className="text-xs text-gray-500">
          {remaining} remaining
        </span>
        {warning && (
          <span className="text-xs font-medium text-yellow-600">
            {warning === '80percent' ? '⚠️ 80% used' : '⚠️ Limit reached'}
          </span>
        )}
      </div>
    </div>
  )
}
```

---

### 5. Current Plan Card

```tsx
// components/billing/CurrentPlanCard.tsx
interface CurrentPlanCardProps {
  tier: 'free' | 'starter' | 'pro' | 'max'
  status: string
  nextBillingDate?: string
  trialEndsAt?: string
  onManageSubscription: () => void
  onUpgrade: () => void
}

export function CurrentPlanCard({
  tier,
  status,
  nextBillingDate,
  trialEndsAt,
  onManageSubscription,
  onUpgrade
}: CurrentPlanCardProps) {
  const planNames = {
    free: 'Free',
    starter: 'Starter',
    pro: 'Pro',
    max: 'Max'
  }

  const planPrices = {
    free: '$0',
    starter: '$9.99',
    pro: '$99',
    max: '$499.99'
  }

  const isTrialing = status === 'trialing'
  const isFree = tier === 'free'

  return (
    <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-6 text-white">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-bold">{planNames[tier]} Plan</h2>
          <p className="text-3xl font-bold mt-2">
            {planPrices[tier]}
            {!isFree && <span className="text-lg font-normal">/month</span>}
          </p>

          {isTrialing && trialEndsAt && (
            <div className="mt-3 bg-white/20 rounded px-3 py-1 inline-block">
              <span className="text-sm">
                Trial ends {formatDistanceToNow(new Date(trialEndsAt))}
              </span>
            </div>
          )}

          {!isTrialing && nextBillingDate && (
            <p className="text-sm mt-2 opacity-90">
              Next billing: {format(new Date(nextBillingDate), 'MMM dd, yyyy')}
            </p>
          )}
        </div>

        <div className="flex gap-2">
          {!isFree && (
            <Button
              variant="secondary"
              onClick={onManageSubscription}
              className="bg-white text-blue-600 hover:bg-gray-100"
            >
              Manage
            </Button>
          )}
          {tier !== 'max' && (
            <Button
              variant="primary"
              onClick={onUpgrade}
              className="bg-white text-blue-600 hover:bg-gray-100"
            >
              {isFree ? 'Upgrade' : 'Change Plan'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
```

---

### 6. Auto Top-Up Card

```tsx
// components/billing/AutoTopUpCard.tsx
interface AutoTopUpCardProps {
  enabled: boolean
  threshold: number
  amount: number
  onUpdate: (settings: AutoTopUpSettings) => Promise<void>
}

export function AutoTopUpCard({ enabled, threshold, amount, onUpdate }: AutoTopUpCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [settings, setSettings] = useState({ enabled, threshold, amount })

  return (
    <div className="bg-white rounded-lg p-6 shadow mt-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Auto Top-Up</h3>
        <Button
          variant="ghost"
          onClick={() => setIsEditing(!isEditing)}
        >
          {isEditing ? 'Cancel' : 'Edit'}
        </Button>
      </div>

      {isEditing ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Switch
              checked={settings.enabled}
              onCheckedChange={(checked) =>
                setSettings(s => ({ ...s, enabled: checked }))
              }
            />
            <label>Enable automatic top-ups</label>
          </div>

          {settings.enabled && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Trigger when total credits below:
                </label>
                <Input
                  type="number"
                  value={settings.threshold}
                  onChange={(e) =>
                    setSettings(s => ({ ...s, threshold: parseInt(e.target.value) }))
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Purchase amount:
                </label>
                <Select
                  value={settings.amount.toString()}
                  onValueChange={(value) =>
                    setSettings(s => ({ ...s, amount: parseInt(value) }))
                  }
                >
                  <SelectItem value="500">500 credits ($20)</SelectItem>
                </Select>
              </div>

              <Button
                onClick={async () => {
                  await onUpdate(settings)
                  setIsEditing(false)
                }}
              >
                Save Settings
              </Button>
            </>
          )}
        </div>
      ) : (
        <div>
          {enabled ? (
            <p className="text-gray-600">
              Automatically purchase <strong>{amount} credits</strong> for <strong>$20</strong> when
              your total credits fall below <strong>{threshold}</strong>.
            </p>
          ) : (
            <p className="text-gray-500">
              Auto top-up is disabled. Enable it to automatically purchase credits when running low.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
```

---

### 7. Usage Limit Reached Modal (Immediate Upgrade Prompt)

```tsx
// components/billing/UsageLimitModal.tsx
interface UsageLimitModalProps {
  open: boolean
  onClose: () => void
  actionTier: 'small' | 'medium' | 'large' | 'xl'
  error: {
    code: 'CREDITS_EXHAUSTED'
    upgradeUrl: string
    topUpUrl: string
    suggestedPlan: string
    canTopUp: boolean
  }
}

export function UsageLimitModal({
  open,
  onClose,
  actionTier,
  error
}: UsageLimitModalProps) {
  const router = useRouter()

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <XCircle className="w-6 h-6" />
            Credit Limit Reached
          </DialogTitle>
          <DialogDescription>
            You've exhausted your {actionTier} action credits for this billing period.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">
              <strong>Action blocked:</strong> You cannot execute {actionTier} tier actions until you:
            </p>
            <ul className="mt-2 text-sm text-red-700 list-disc list-inside">
              <li>Purchase additional credits, or</li>
              <li>Upgrade to a higher plan, or</li>
              <li>Wait for your billing period to reset</li>
            </ul>
          </div>

          {error.canTopUp && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Quick Fix:</strong> Purchase 500 credits for $20 to continue immediately.
              </p>
            </div>
          )}

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <p className="text-sm text-purple-800">
              <strong>Recommended:</strong> Upgrade to {error.suggestedPlan.toUpperCase()} plan for {
                error.suggestedPlan === 'pro' ? '10x more credits' : '5x more credits'
              }.
            </p>
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          {error.canTopUp && (
            <Button
              variant="secondary"
              onClick={() => {
                router.push(error.topUpUrl)
                onClose()
              }}
            >
              Buy 500 Credits ($20)
            </Button>
          )}
          <Button
            onClick={() => {
              router.push(error.upgradeUrl)
              onClose()
            }}
            className="bg-purple-600 hover:bg-purple-700"
          >
            Upgrade to {error.suggestedPlan.toUpperCase()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Usage in action execution context
export function useActionExecution() {
  const [limitModal, setLimitModal] = useState<{
    open: boolean
    tier?: string
    error?: any
  }>({ open: false })

  const executeAction = async (tier: string, agentId: string) => {
    try {
      // ... execute action
    } catch (error: any) {
      if (error.code === 'CREDITS_EXHAUSTED') {
        setLimitModal({
          open: true,
          tier,
          error: error
        })
        return
      }
      throw error
    }
  }

  return {
    executeAction,
    limitModal,
    closeLimitModal: () => setLimitModal({ open: false })
  }
}
```

---

### 8. 80% Warning Toast (Non-Blocking)

```tsx
// utils/billing-warnings.ts
import { toast } from '@/components/ui/use-toast'

export function show80PercentWarning(actionTier: string) {
  toast({
    title: '⚠️ Usage Warning',
    description: `You've used 80% of your ${actionTier} actions this month. Consider upgrading to avoid interruptions.`,
    action: {
      label: 'View Usage',
      onClick: () => router.push('/settings/billing')
    },
    duration: 10000,
  })
}
```

---

## Migration Strategy

### Phase 1: Database Setup

1. **Run new migrations:**
   ```bash
   # Create migration file
   cd packages/db-mysql/migrations
   touch 0003_billing_system.sql
   ```

2. **Apply schema changes:**
   - Create new tables: `subscriptions`, `billable_actions`, `credit_balances`, `credit_purchases`, `webhook_events`, `invoices`
   - Modify `organizations` table: add `subscription_tier`, `trial_ends_at`
   - Optionally link `action_events` to `billable_actions`

3. **Seed free tier:**
   ```sql
   -- Set all existing orgs to free tier
   UPDATE organizations
   SET subscription_tier = 'free', subscription_status = 'active'
   WHERE subscription_tier IS NULL;

   -- Initialize credit balances for existing orgs
   INSERT INTO credit_balances (org_id, billing_period_start, billing_period_end,
     included_small, included_medium, included_large, included_xl)
   SELECT
     id,
     NOW(),
     DATE_ADD(NOW(), INTERVAL 1 MONTH),
     10, 4, 2, 1
   FROM organizations
   WHERE id NOT IN (SELECT org_id FROM credit_balances);
   ```

---

### Phase 2: Stripe Setup

1. **Create products in Stripe Dashboard**
2. **Configure webhook endpoint**
3. **Test webhook locally:**
   ```bash
   stripe listen --forward-to localhost:3003/api/webhooks/stripe
   ```
4. **Add environment variables**

---

### Phase 3: Code Implementation

**Week 1: Backend Foundation**
- ✅ Database schema migrations
- ✅ Stripe configuration
- ✅ Core billing endpoints (`/api/billing/*`)
- ✅ Enhanced webhook handler
- ✅ Usage tracking logic

**Week 2: Usage & Credits**
- ✅ Usage recording endpoint
- ✅ Credit balance management
- ✅ Auto top-up logic
- ✅ Soft limit warnings
- ✅ Email notifications

**Week 3: Frontend**
- ✅ Billing dashboard
- ✅ Progress bars per tier
- ✅ Auto top-up configuration
- ✅ Usage history
- ✅ Plan upgrade flow

**Week 4: Polish & Testing**
- ✅ Error handling
- ✅ Edge case testing
- ✅ Webhook retry logic
- ✅ Email templates
- ✅ Documentation

---

## Testing Plan

### Local Testing with Stripe CLI

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local
stripe listen --forward-to localhost:3003/api/webhooks/stripe

# Trigger events
stripe trigger checkout.session.completed
stripe trigger customer.subscription.created
stripe trigger invoice.payment_succeeded
stripe trigger invoice.payment_failed
```

---

### Test Scenarios

#### 1. New Subscription Flow
```
✅ Create checkout session
✅ Complete checkout with trial
✅ Webhook creates subscription
✅ Credit balance initialized
✅ Welcome email sent
✅ Dashboard shows trial countdown
```

#### 2. Usage Tracking
```
✅ Record small action → balance updated
✅ Record medium action → balance updated
✅ Hit 80% threshold → warning shown
✅ Hit 100% → soft limit warning
✅ Exceed buffer → action blocked
```

#### 3. Auto Top-Up
```
✅ Configure auto top-up settings
✅ Use credits below threshold
✅ Auto top-up triggered
✅ Payment succeeds → credits added
✅ Email confirmation sent
```

#### 4. Payment Failure
```
✅ Trial ends, no payment method
✅ Payment fails → webhook fired
✅ Grace period starts (7 days)
✅ Warning emails sent
✅ Grace period ends → downgrade to free
```

#### 5. Subscription Upgrade
```
✅ Upgrade from Starter to Pro
✅ Proration calculated
✅ Credit balance updated
✅ Invoice created
✅ Confirmation email
```

---

### Stripe Test Cards

```
Success: 4242 4242 4242 4242
Decline: 4000 0000 0000 0002
Insufficient funds: 4000 0000 0000 9995
Requires 3DS: 4000 0025 0000 3155
```

---

## Implementation Checklist

### Database (Week 1)
- [ ] Create migration file `0003_billing_system.sql`
- [ ] Define `subscriptions` table
- [ ] Define `billable_actions` table
- [ ] Define `credit_balances` table
- [ ] Define `credit_purchases` table
- [ ] Define `webhook_events` table
- [ ] Define `invoices` table
- [ ] Modify `organizations` table
- [ ] Add foreign key constraints
- [ ] Add indexes for performance
- [ ] Update Drizzle schema.ts
- [ ] Run migration on local database
- [ ] Seed free tier for existing orgs

### Stripe Configuration (Week 1)
- [ ] Create Stripe account (if needed)
- [ ] Create "Pixell Starter" product ($9.99/mo, 7-day trial)
- [ ] Create "Pixell Pro" product ($99/mo, 7-day trial)
- [ ] Create "Pixell Max" product ($499.99/mo, 7-day trial)
- [ ] Create "Credit Top-Up" product ($20 one-time)
- [ ] Note all price IDs
- [ ] Configure webhook endpoint URL
- [ ] Select webhook events to listen for
- [ ] Get webhook signing secret
- [ ] Add environment variables to `.env.local`

### Backend API - Subscriptions (Week 1-2)
- [ ] Enhance `POST /api/billing/checkout`
  - [ ] Support all plan tiers (starter/pro/max)
  - [ ] Add 7-day trial configuration
  - [ ] Add success/cancel URLs
  - [ ] Add metadata (orgId, planTier)
- [ ] Update `POST /api/billing/portal`
  - [ ] Verify stripe customer exists
  - [ ] Return portal URL
- [ ] Create `POST /api/billing/subscription/cancel`
  - [ ] Support immediate vs end-of-period
  - [ ] Update database status
  - [ ] Send confirmation email
- [ ] Create `POST /api/billing/subscription/upgrade`
  - [ ] Handle plan changes
  - [ ] Calculate proration
  - [ ] Update credit balance
- [ ] Create `GET /api/billing/subscription/status`
  - [ ] Return full subscription details
  - [ ] Include trial information

### Backend API - Usage & Credits (Week 2)
- [ ] Create `POST /api/billing/usage/record`
  - [ ] Validate action tier
  - [ ] Check credit balance
  - [ ] Record billable action
  - [ ] Update credit balance (atomic)
  - [ ] Queue warning check
  - [ ] Queue auto top-up check
  - [ ] Return remaining credits
- [ ] Create `GET /api/billing/usage`
  - [ ] Get current period usage
  - [ ] Calculate remaining credits
  - [ ] Include warnings
  - [ ] Include top-up credits
- [ ] Create `POST /api/billing/usage/check`
  - [ ] Pre-flight check before action
  - [ ] Return allowed/blocked status
- [ ] Create `POST /api/billing/credits/topup`
  - [ ] Create Stripe checkout for credits
  - [ ] Create purchase record
  - [ ] Return checkout URL
- [ ] Create `POST /api/billing/credits/auto-topup`
  - [ ] Update auto top-up settings
  - [ ] Validate threshold/amount
  - [ ] Return updated settings

### Backend API - Invoices (Week 2)
- [ ] Create `GET /api/billing/invoices`
  - [ ] List invoices for org
  - [ ] Support pagination
  - [ ] Include URLs
- [ ] Create `GET /api/billing/history`
  - [ ] Billing event timeline
  - [ ] Include subscriptions, credits, invoices

### Webhook Handler (Week 2)
- [ ] Enhance `POST /api/webhooks/stripe`
  - [ ] Verify webhook signature
  - [ ] Store event in webhook_events table
  - [ ] Check for duplicate events (idempotency)
  - [ ] Handle `checkout.session.completed`
    - [ ] Create subscription record
    - [ ] Initialize credit balance
    - [ ] Send welcome email
  - [ ] Handle `customer.subscription.created`
    - [ ] Create/update subscription
    - [ ] Set trial dates
  - [ ] Handle `customer.subscription.updated`
    - [ ] Update subscription status
    - [ ] Check for new billing period → reset credits
    - [ ] Update plan tier
  - [ ] Handle `customer.subscription.deleted`
    - [ ] Mark subscription canceled
    - [ ] Downgrade to free tier
  - [ ] Handle `customer.subscription.trial_will_end`
    - [ ] Send trial ending email
  - [ ] Handle `invoice.payment_succeeded`
    - [ ] Mark invoice paid
    - [ ] Update subscription status
    - [ ] Send receipt
  - [ ] Handle `invoice.payment_failed`
    - [ ] Send payment failed email
    - [ ] Start grace period
  - [ ] Handle `payment_intent.succeeded`
    - [ ] Add credits to balance
    - [ ] Update purchase record
    - [ ] Send confirmation
  - [ ] Handle `payment_intent.payment_failed`
    - [ ] Mark purchase failed
    - [ ] Notify user
  - [ ] Mark event as processed
  - [ ] Error handling & retry logic

### Business Logic (Week 2)
- [ ] Implement `checkUsageAllowed()`
  - [ ] Check tier limits
  - [ ] Check top-up credits
  - [ ] Calculate warnings (80%, 100%)
  - [ ] Apply soft limit buffer
- [ ] Implement `recordBillableAction()`
  - [ ] Pre-flight check
  - [ ] Insert billable_actions record
  - [ ] Update credit_balances (atomic)
  - [ ] Queue async checks
- [ ] Implement `updateCreditBalance()` (atomic SQL)
  - [ ] Increment used counter
  - [ ] Deduct from plan credits first
  - [ ] Then deduct from top-up credits
- [ ] Implement `resetBillingPeriod()`
  - [ ] Get plan limits
  - [ ] Reset usage to 0
  - [ ] Clear top-up credits
  - [ ] Update period dates
- [ ] Implement `checkAndTriggerAutoTopUp()`
  - [ ] Calculate total remaining
  - [ ] Compare to threshold
  - [ ] Create Stripe payment
  - [ ] Create purchase record
  - [ ] Send notification
- [ ] Implement `handlePaymentFailed()`
  - [ ] Update subscription status
  - [ ] Send warning email
  - [ ] Schedule grace period end
- [ ] Implement `downgradeToFreeTier()`
  - [ ] Update subscription tier
  - [ ] Reset to free limits
  - [ ] Send notification

### Frontend - Billing Dashboard (Week 3)
- [ ] Create `/app/billing/dashboard/page.tsx`
- [ ] Create `useSubscription()` hook
  - [ ] Fetch subscription status
  - [ ] Handle loading/error states
- [ ] Create `useUsage()` hook
  - [ ] Fetch current usage
  - [ ] Real-time updates (optional)
- [ ] Create `<CurrentPlanCard>` component
  - [ ] Display plan tier & price
  - [ ] Show trial countdown
  - [ ] Next billing date
  - [ ] Manage/Upgrade buttons
- [ ] Create `<ProgressBar>` component
  - [ ] Visual progress bar
  - [ ] Used / Total display
  - [ ] Warning indicators
  - [ ] Color coding by tier
- [ ] Create `<AutoTopUpCard>` component
  - [ ] Enable/disable toggle
  - [ ] Threshold input
  - [ ] Amount selector
  - [ ] Save settings
- [ ] Create `<UsageChart>` component (optional)
  - [ ] Daily usage over time
  - [ ] Billing period indicator
- [ ] Create `<RecentActionsTable>` component
  - [ ] Recent billable actions
  - [ ] Agent name, tier, credits used
  - [ ] Timestamp

### Frontend - Plan Selection (Week 3)
- [ ] Update `/app/billing/page.tsx`
  - [ ] Show all 4 tiers (Free, Starter, Pro, Max)
  - [ ] Display credit allocations per tier
  - [ ] Highlight current plan
  - [ ] Show trial information
  - [ ] Checkout button per plan

### Frontend - Modals & Warnings (Week 3)
- [ ] Create `<UsageWarningModal>` component
  - [ ] 80% warning
  - [ ] 100% warning
  - [ ] Exhausted error
  - [ ] Buy credits / Upgrade buttons
- [ ] Create `<TrialEndingBanner>` component
  - [ ] Countdown timer
  - [ ] Add payment method CTA
- [ ] Create toast notifications
  - [ ] Usage warnings
  - [ ] Auto top-up triggered
  - [ ] Payment failed

### Frontend - Invoice History (Week 3)
- [ ] Create `/app/billing/invoices/page.tsx`
- [ ] Create `<InvoicesList>` component
  - [ ] List all invoices
  - [ ] Download PDF button
  - [ ] View hosted invoice
  - [ ] Filter by status

### Email Templates (Week 4)
- [ ] Welcome email (trial started)
- [ ] Trial ending email (3 days before)
- [ ] Trial ended email (downgraded to free)
- [ ] Usage warning (80%)
- [ ] Usage limit reached (100%)
- [ ] Auto top-up triggered
- [ ] Payment succeeded (receipt)
- [ ] Payment failed (retry info)
- [ ] Downgraded to free tier
- [ ] Subscription canceled

### Testing (Week 4)
- [ ] Set up Stripe CLI locally
- [ ] Test checkout flow (all plans)
- [ ] Test trial period
- [ ] Test usage recording
- [ ] Test 80% warning
- [ ] Test 100% soft limit
- [ ] Test buffer exceeded block
- [ ] Test auto top-up trigger
- [ ] Test manual credit purchase
- [ ] Test subscription upgrade
- [ ] Test subscription cancel
- [ ] Test payment failure flow
- [ ] Test grace period
- [ ] Test downgrade to free
- [ ] Test webhook idempotency
- [ ] Test webhook retry logic
- [ ] Load test (concurrent usage recording)

### Documentation (Week 4)
- [ ] Update README with billing setup
- [ ] Document environment variables
- [ ] Create Stripe setup guide
- [ ] API endpoint documentation
- [ ] Database schema documentation
- [ ] Webhook event reference
- [ ] Testing guide
- [ ] Troubleshooting guide

### Deployment Prep
- [ ] Add Stripe keys to production env
- [ ] Configure production webhook endpoint
- [ ] Test webhook signature verification
- [ ] Set up monitoring/alerts
- [ ] Create runbook for common issues
- [ ] Plan database migration strategy
- [ ] Backup existing data
- [ ] Test rollback plan

---

## Constants & Configuration

```typescript
// constants/billing.ts

export const PLAN_LIMITS = {
  free: {
    small: 10,
    medium: 4,
    large: 2,
    xl: 1,
    price: 0,
  },
  starter: {
    small: 250,
    medium: 100,
    large: 50,
    xl: 15,
    price: 9.99,
  },
  pro: {
    small: 2500,
    medium: 1000,
    large: 500,
    xl: 160,
    price: 99.00,
  },
  max: {
    small: 12500,
    medium: 5000,
    large: 2500,
    xl: 800,
    price: 499.99,
  },
} as const

export const CREDIT_RATES = {
  small: 1,
  medium: 2.5,
  large: 5,
  xl: 15,
} as const

export const DEVELOPER_PAYOUTS = {
  small: 0.02,
  medium: 0.05,
  large: 0.10,
  xl: 0.30,
} as const

export const BILLING_CONFIG = {
  trialDays: 7,
  softLimitBuffer: 10,
  warningCooldownHours: 24,
  gracePeriodDays: 7,
  autoTopupCredits: 500,
  autoTopupPrice: 20.00,
} as const

export function getCreditsForTier(tier: 'small' | 'medium' | 'large' | 'xl'): number {
  return CREDIT_RATES[tier]
}

export function getPlanLimits(planTier: 'free' | 'starter' | 'pro' | 'max') {
  return PLAN_LIMITS[planTier]
}
```

---

## Security Considerations

### 1. Webhook Signature Verification
Always verify Stripe webhook signatures to prevent spoofed requests:

```typescript
const sig = request.headers.get('stripe-signature')
const event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
```

### 2. Idempotency
- Use `idempotency_key` for billable actions
- Check `stripe_event_id` uniqueness for webhooks
- Atomic database operations for balance updates

### 3. Rate Limiting
- Limit billing API calls per org
- Prevent abuse of usage recording endpoint

### 4. Data Privacy
- Don't expose Stripe customer IDs in frontend
- Sanitize error messages (no internal details)
- Log billing events for audit

---

## Performance Optimizations

### 1. Credit Balance Caching
- Use `credit_balances` table for fast reads
- Update incrementally (don't recalculate from history)

### 2. Database Indexes
- Index on `(org_id, billing_period_start, billing_period_end)`
- Index on `(org_id, created_at)` for usage history
- Index on `stripe_event_id` for webhook deduplication

### 3. Async Processing
- Queue auto top-up checks (don't block action recording)
- Queue warning notifications
- Background job for periodic reconciliation

---

## Monitoring & Alerts

### Key Metrics to Track

1. **Billing Health**
   - Active subscriptions by tier
   - Trial conversion rate
   - Churn rate
   - MRR (Monthly Recurring Revenue)

2. **Usage Metrics**
   - Actions per tier per day
   - Organizations hitting limits
   - Auto top-ups triggered
   - Failed payments

3. **System Health**
   - Webhook processing time
   - Failed webhooks (retry queue)
   - Credit balance drift (cache vs actual)

### Alerts

```
🚨 HIGH: Payment failure rate > 5%
⚠️ MEDIUM: Webhook processing latency > 5s
ℹ️ LOW: Trial conversion rate < 10%
```

---

## Future Enhancements (Phase 2)

- [ ] Annual billing (discounted)
- [ ] Custom enterprise plans
- [ ] Usage analytics dashboard
- [ ] Spending forecasting
- [ ] Budget alerts
- [ ] Team member usage breakdown
- [ ] Invoice customization
- [ ] Multi-currency support
- [ ] Coupon/promo code system
- [ ] Referral program
- [ ] Developer marketplace integration

---

## Support & Troubleshooting

### Common Issues

**Issue: Webhook not firing locally**
```bash
# Use Stripe CLI
stripe listen --forward-to localhost:3003/api/webhooks/stripe
```

**Issue: Credit balance out of sync**
```sql
-- Reconciliation query
SELECT
  cb.org_id,
  cb.used_small,
  COUNT(ba.id) as actual_used_small
FROM credit_balances cb
LEFT JOIN billable_actions ba ON ba.org_id = cb.org_id
  AND ba.action_tier = 'small'
  AND ba.created_at BETWEEN cb.billing_period_start AND cb.billing_period_end
GROUP BY cb.org_id
HAVING cb.used_small != COUNT(ba.id)
```

**Issue: Trial not converting to paid**
- Check webhook fired: `customer.subscription.trial_will_end`
- Check payment method attached
- Check Stripe subscription status

---

## Conclusion

This implementation provides a complete billing and payment system with:

✅ Hybrid subscription model (base + usage)
✅ Multi-tier plans with credit allocations
✅ Usage tracking by action tier
✅ Automatic top-ups
✅ Soft usage limits
✅ Comprehensive webhook handling
✅ User-friendly billing dashboard
✅ Failed payment recovery

**Estimated Timeline:** 4 weeks for full Phase 1 implementation

**Next Steps:**
1. Review and approve this design
2. Run database migrations
3. Configure Stripe products
4. Begin backend implementation
5. Build frontend components
6. Test end-to-end flows
7. Deploy to production

---

**Document Version:** 1.0
**Last Updated:** 2025-11-16
**Status:** Ready for Implementation

---

## AWS SES Email Configuration

### Setup AWS SES

1. **Create AWS Account** (or use existing)

2. **Verify Domain or Email**
   ```bash
   # In AWS SES Console → Verified identities
   # Add and verify: billing@yourdomain.com
   # Or verify entire domain: yourdomain.com
   ```

3. **Move Out of Sandbox Mode**
   ```
   AWS SES starts in sandbox mode (limited to verified emails)
   Request production access: AWS SES → Account dashboard → Request production access
   ```

4. **Create IAM User for SES**
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Effect": "Allow",
       "Action": [
         "ses:SendEmail",
         "ses:SendRawEmail"
       ],
       "Resource": "*"
     }]
   }
   ```

5. **Get Credentials**
   - Create access key for IAM user
   - Add to `.env.local`:
     - `AWS_ACCESS_KEY_ID`
     - `AWS_SECRET_ACCESS_KEY`
     - `AWS_SES_REGION`

### Email Templates (Phase 1 - Critical Only)

#### 1. Payment Failed Email

```typescript
// emails/payment-failed.tsx
import { Html, Head, Body, Container, Section, Text, Button } from '@react-email/components'

export function PaymentFailedEmail({ 
  organizationName, 
  amountDue, 
  updatePaymentUrl 
}: {
  organizationName: string
  amountDue: number
  updatePaymentUrl: string
}) {
  return (
    <Html>
      <Head />
      <Body style={main}>
        <Container style={container}>
          <Text style={heading}>Payment Failed</Text>
          <Text style={paragraph}>
            Hello {organizationName},
          </Text>
          <Text style={paragraph}>
            We were unable to process your payment of ${amountDue.toFixed(2)} for your Pixell subscription.
          </Text>
          <Text style={paragraph}>
            Your subscription will remain active for the next 7 days while we attempt to retry the payment.
            To avoid service interruption, please update your payment method.
          </Text>
          <Section style={buttonContainer}>
            <Button style={button} href={updatePaymentUrl}>
              Update Payment Method
            </Button>
          </Section>
          <Text style={footer}>
            If you have questions, reply to this email.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

const main = { backgroundColor: '#f6f9fc', fontFamily: 'sans-serif' }
const container = { margin: '0 auto', padding: '20px 0 48px', maxWidth: '560px' }
const heading = { fontSize: '24px', fontWeight: 'bold', color: '#dc2626' }
const paragraph = { fontSize: '16px', lineHeight: '26px', color: '#374151' }
const buttonContainer = { padding: '27px 0 27px' }
const button = {
  backgroundColor: '#5046e5',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '16px',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'block',
  padding: '12px 24px',
}
const footer = { fontSize: '14px', color: '#6b7280' }
```

#### 2. Trial Ending Email

```typescript
// emails/trial-ending.tsx
export function TrialEndingEmail({ 
  organizationName, 
  daysRemaining, 
  planTier,
  addPaymentUrl 
}: {
  organizationName: string
  daysRemaining: number
  planTier: string
  addPaymentUrl: string
}) {
  return (
    <Html>
      <Head />
      <Body style={main}>
        <Container style={container}>
          <Text style={heading}>Your Trial Ends in {daysRemaining} Days</Text>
          <Text style={paragraph}>
            Hello {organizationName},
          </Text>
          <Text style={paragraph}>
            Your 7-day trial of the Pixell {planTier} plan will end in {daysRemaining} days.
          </Text>
          <Text style={paragraph}>
            To continue using Pixell without interruption, please add a payment method now.
            You won't be charged until your trial ends.
          </Text>
          <Section style={buttonContainer}>
            <Button style={button} href={addPaymentUrl}>
              Add Payment Method
            </Button>
          </Section>
          <Text style={paragraph}>
            After your trial ends without a payment method, you'll be downgraded to the free tier with limited actions.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
```

#### 3. Payment Successful (Receipt) Email

```typescript
// emails/payment-receipt.tsx
export function PaymentReceiptEmail({ 
  organizationName, 
  amountPaid,
  planTier,
  invoiceUrl,
  pdfUrl,
  nextBillingDate
}: {
  organizationName: string
  amountPaid: number
  planTier: string
  invoiceUrl: string
  pdfUrl: string
  nextBillingDate: string
}) {
  return (
    <Html>
      <Head />
      <Body style={main}>
        <Container style={container}>
          <Text style={heading}>Payment Received - ${amountPaid.toFixed(2)}</Text>
          <Text style={paragraph}>
            Hello {organizationName},
          </Text>
          <Text style={paragraph}>
            Thank you for your payment of ${amountPaid.toFixed(2)} for your Pixell {planTier} subscription.
          </Text>
          <Section style={detailsBox}>
            <Text style={detailRow}>
              <strong>Amount Paid:</strong> ${amountPaid.toFixed(2)}
            </Text>
            <Text style={detailRow}>
              <strong>Plan:</strong> {planTier.toUpperCase()}
            </Text>
            <Text style={detailRow}>
              <strong>Next Billing Date:</strong> {new Date(nextBillingDate).toLocaleDateString()}
            </Text>
          </Section>
          <Section style={buttonContainer}>
            <Button style={button} href={invoiceUrl}>
              View Invoice
            </Button>
            <Button style={buttonSecondary} href={pdfUrl}>
              Download PDF
            </Button>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
```

### Email Sending Utility

```typescript
// lib/email/send-email.ts
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'
import { render } from '@react-email/render'

const sesClient = new SESClient({
  region: process.env.AWS_SES_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

export async function sendEmail({
  to,
  subject,
  template,
  data,
}: {
  to: string
  subject: string
  template: React.ComponentType<any>
  data: any
}) {
  const html = render(React.createElement(template, data))

  const command = new SendEmailCommand({
    Source: `${process.env.AWS_SES_FROM_NAME} <${process.env.AWS_SES_FROM_EMAIL}>`,
    Destination: {
      ToAddresses: [to],
    },
    Message: {
      Subject: {
        Data: subject,
        Charset: 'UTF-8',
      },
      Body: {
        Html: {
          Data: html,
          Charset: 'UTF-8',
        },
      },
    },
  })

  try {
    const response = await sesClient.send(command)
    console.log('Email sent:', response.MessageId)
    return { success: true, messageId: response.MessageId }
  } catch (error) {
    console.error('Email send failed:', error)
    throw error
  }
}

// Usage example
await sendEmail({
  to: org.email,
  subject: 'Payment Failed - Action Required',
  template: PaymentFailedEmail,
  data: {
    organizationName: org.name,
    amountDue: invoice.amount_due / 100,
    updatePaymentUrl: await createBillingPortalUrl(orgId),
  },
})
```

---

## Weekly Reconciliation Job

### Cron Job Implementation

```typescript
// jobs/weekly-reconciliation.ts
import { getDb, creditBalances, billableActions } from '@pixell/db-mysql'
import { eq, and, between } from 'drizzle-orm'

export async function weeklyReconciliation() {
  console.log('Starting weekly credit balance reconciliation...')
  
  const db = await getDb()
  const balances = await db.select().from(creditBalances)
  
  let fixedCount = 0
  let errorCount = 0

  for (const balance of balances) {
    try {
      // Get actual usage from billable_actions
      const actions = await db
        .select()
        .from(billableActions)
        .where(
          and(
            eq(billableActions.orgId, balance.orgId),
            between(
              billableActions.createdAt,
              balance.billingPeriodStart,
              balance.billingPeriodEnd
            )
          )
        )

      // Calculate actual usage
      const actualUsage = {
        small: actions.filter(a => a.actionTier === 'small').length,
        medium: actions.filter(a => a.actionTier === 'medium').length,
        large: actions.filter(a => a.actionTier === 'large').length,
        xl: actions.filter(a => a.actionTier === 'xl').length,
      }

      // Check for drift
      const hasDrift =
        balance.usedSmall !== actualUsage.small ||
        balance.usedMedium !== actualUsage.medium ||
        balance.usedLarge !== actualUsage.large ||
        balance.usedXl !== actualUsage.xl

      if (hasDrift) {
        // Fix the drift
        await db.update(creditBalances)
          .set({
            usedSmall: actualUsage.small,
            usedMedium: actualUsage.medium,
            usedLarge: actualUsage.large,
            usedXl: actualUsage.xl,
          })
          .where(eq(creditBalances.orgId, balance.orgId))

        console.log(`Fixed drift for org ${balance.orgId}:`, {
          before: {
            small: balance.usedSmall,
            medium: balance.usedMedium,
            large: balance.usedLarge,
            xl: balance.usedXl,
          },
          after: actualUsage,
        })

        fixedCount++

        // Send alert email to admin
        await sendEmail({
          to: process.env.ADMIN_EMAIL!,
          subject: 'Credit Balance Drift Detected',
          template: DriftAlertEmail,
          data: {
            orgId: balance.orgId,
            before: balance,
            after: actualUsage,
          },
        })
      }
    } catch (error) {
      console.error(`Reconciliation failed for org ${balance.orgId}:`, error)
      errorCount++
    }
  }

  console.log('Reconciliation complete:', {
    total: balances.length,
    fixed: fixedCount,
    errors: errorCount,
  })

  return { total: balances.length, fixed: fixedCount, errors: errorCount }
}
```

### Schedule with Cron (Node.js)

```typescript
// server/cron.ts
import cron from 'node-cron'
import { weeklyReconciliation } from './jobs/weekly-reconciliation'

// Run every Sunday at 3am
const RECONCILIATION_SCHEDULE = '0 3 * * 0' // cron format: min hour day month weekday

export function startCronJobs() {
  if (process.env.ENABLE_WEEKLY_RECONCILIATION !== 'true') {
    console.log('Weekly reconciliation disabled')
    return
  }

  console.log('Scheduling weekly reconciliation for Sundays at 3am')

  cron.schedule(RECONCILIATION_SCHEDULE, async () => {
    try {
      const result = await weeklyReconciliation()
      console.log('Weekly reconciliation completed:', result)
    } catch (error) {
      console.error('Weekly reconciliation failed:', error)
      
      // Alert admin
      await sendEmail({
        to: process.env.ADMIN_EMAIL!,
        subject: 'Reconciliation Job Failed',
        template: JobFailureEmail,
        data: { error: error.message },
      })
    }
  })
}

// Call in your server startup
// startCronJobs()
```

---

## Service Token Authentication

### Generate Service Token

```typescript
// scripts/generate-service-token.ts
import crypto from 'crypto'

const token = crypto.randomBytes(32).toString('base64url')
console.log('ORCHESTRATOR_SERVICE_TOKEN=', token)

// Add to .env.local
```

### Middleware for Service Token Verification

```typescript
// middleware/verify-service-token.ts
import { NextRequest, NextResponse } from 'next/server'

export async function verifyServiceToken(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'MISSING_TOKEN' },
      { status: 401 }
    )
  }

  const token = authHeader.substring(7) // Remove 'Bearer '
  const expectedToken = process.env.ORCHESTRATOR_SERVICE_TOKEN

  if (!expectedToken) {
    console.error('ORCHESTRATOR_SERVICE_TOKEN not configured')
    return NextResponse.json(
      { error: 'Server misconfiguration', code: 'NO_TOKEN_CONFIGURED' },
      { status: 500 }
    )
  }

  // Timing-safe comparison to prevent timing attacks
  const tokensMatch = crypto.timingSafeEqual(
    Buffer.from(token),
    Buffer.from(expectedToken)
  )

  if (!tokensMatch) {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'INVALID_SERVICE_TOKEN' },
      { status: 401 }
    )
  }

  return null // Success - continue
}

// Usage in API route
export async function POST(request: NextRequest) {
  const authError = await verifyServiceToken(request)
  if (authError) return authError

  // Continue with usage recording...
}
```

---

## Monitoring Setup

### Stripe Dashboard Configuration

1. **Enable Email Alerts**
   - Go to: Stripe Dashboard → Settings → Notifications
   - Enable alerts for:
     - Failed payments
     - Disputed charges
     - Webhook endpoint failures

2. **Webhook Monitoring**
   - Monitor: Developers → Webhooks → [Your endpoint]
   - Check "Recent deliveries" for failures
   - Set up email alerts for repeated failures

3. **Custom Dashboard Views**
   - Create saved view: Failed payments (last 7 days)
   - Create saved view: Webhooks with errors
   - Review weekly

### Database Query for Failed Webhooks

```sql
-- Check failed webhook events
SELECT
  id,
  stripe_event_id,
  event_type,
  status,
  error,
  retry_count,
  created_at
FROM webhook_events
WHERE status = 'failed'
  AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
ORDER BY created_at DESC;
```

### Simple Alert Script

```typescript
// scripts/check-webhook-health.ts
import { getDb, webhookEvents } from '@pixell/db-mysql'
import { eq, gte } from 'drizzle-orm'

async function checkWebhookHealth() {
  const db = await getDb()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const failedEvents = await db
    .select()
    .from(webhookEvents)
    .where(
      and(
        eq(webhookEvents.status, 'failed'),
        gte(webhookEvents.createdAt, sevenDaysAgo)
      )
    )

  if (failedEvents.length > 5) {
    // Send alert
    await sendEmail({
      to: process.env.ADMIN_EMAIL!,
      subject: `⚠️ ${failedEvents.length} Failed Webhooks in Last 7 Days`,
      template: WebhookAlertEmail,
      data: {
        count: failedEvents.length,
        events: failedEvents.slice(0, 10), // First 10
      },
    })
  }

  return { failed: failedEvents.length }
}

// Run daily via cron
cron.schedule('0 9 * * *', checkWebhookHealth) // 9am daily
```

---

**Document Updated:** 2025-11-16
**All Decisions Finalized**
**Ready for Implementation**

