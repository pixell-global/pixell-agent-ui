# Billing & Payments Refactor

This directory contains the complete implementation plan for the Pixell Agent Framework billing and payment system.

## 📁 Files in This Directory

1. **`IMPLEMENTATION.md`** - Complete implementation guide (1000+ lines)
   - Database schema design
   - API endpoint specifications
   - Business logic implementation
   - UI component designs
   - Testing strategy
   - Week-by-week implementation checklist

2. **`0003_billing_system.sql`** - Database migration file
   - Ready-to-run SQL migration
   - Creates all billing tables
   - Modifies existing tables
   - Seeds free tier for existing orgs
   - Includes rollback script

3. **`schema-additions.ts`** - Drizzle ORM schema definitions
   - TypeScript type definitions
   - Add to `packages/db-mysql/src/schema.ts`
   - Type-safe database queries

4. **`DECISIONS.md`** - All finalized design decisions
5. **`README.md`** - This file

---

## 🎯 Quick Summary

### System Design

**Billing Model:** Hybrid (Base Subscription + Usage Credits)

**Plans:**
- Free: $0 (10 small, 4 medium, 2 large, 1 xl)
- Starter: $9.99/mo (250 small, 100 medium, 50 large, 15 xl)
- Pro: $99/mo (2,500 small, 1,000 medium, 500 large, 160 xl)
- Max: $499.99/mo (12,500 small, 5,000 medium, 2,500 large, 800 xl)

**Trial:** 7 days, no credit card required

**Credits:**
- Small = 1 credit ($0.02 dev payout)
- Medium = 2.5 credits ($0.05 dev payout)
- Large = 5 credits ($0.10 dev payout)
- XL = 15 credits ($0.30 dev payout)

**Auto Top-Up:** 500 credits = $20 (4¢/credit)

**Failed Payments:** Downgrade to free tier after 7-day grace period

---

## 🔑 Key Design Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Database | MySQL (packages/db-mysql) | Organizations already there; referential integrity |
| Action Tracking | New `billable_actions` table | Clean separation from general `actionEvents` |
| Action Tier Mapping | `actionTier` enum column | Explicit, queryable, not string parsing |
| Credit Balance | Cached `credit_balances` table | Fast dashboard reads; updated per action |
| Stripe Sync | Hybrid (cache key fields) | Balance speed vs consistency |
| Trial Tracking | Sync from Stripe webhooks | Stripe is source of truth |
| Invoice Storage | Minimal (ID + URL) | Full details via Stripe API |
| Auto Top-Up | Async after action | No latency; near real-time |
| Developer Payouts | OUT OF SCOPE | Separate PAC database; Phase 2 |

---

## 📊 Database Schema Overview

### New Tables Created

1. **`subscriptions`** - Stripe subscription details
   - Links org to Stripe subscription
   - Tracks plan tier, status, billing period
   - Synced via webhooks

2. **`billable_actions`** - Usage tracking (clean table)
   - Records each billable agent action
   - Tracks tier (small/medium/large/xl)
   - Links to billing period

3. **`credit_balances`** - Current period balance (cache)
   - Fast reads for dashboard
   - Separate counters per tier
   - Auto top-up configuration

4. **`credit_purchases`** - Top-up transaction history
   - Manual and auto purchases
   - Stripe payment tracking

5. **`webhook_events`** - Stripe webhook audit log
   - Idempotency protection
   - Debugging and monitoring

6. **`invoices`** - Invoice cache (minimal)
   - Quick invoice history
   - PDF URLs for downloads

### Modified Tables

**`organizations`** - Added fields:
- `subscription_tier` - Current plan (denormalized)
- `trial_ends_at` - Trial countdown
- `last_billing_warning_at` - Prevent email spam

**`action_events`** (optional) - Added field:
- `billable_action_id` - Links general tracking to billing

---

## 🚀 Implementation Timeline

**Estimated: 4 weeks**

### Week 1: Backend Foundation
- ✅ Database migrations
- ✅ Stripe configuration
- ✅ Core billing endpoints
- ✅ Enhanced webhook handler

### Week 2: Usage & Credits
- ✅ Usage recording
- ✅ Credit balance management
- ✅ Auto top-up logic
- ✅ Soft limits & warnings

### Week 3: Frontend
- ✅ Billing dashboard
- ✅ Progress bars per tier
- ✅ Plan selection
- ✅ Usage history

### Week 4: Polish & Testing
- ✅ Error handling
- ✅ Email templates
- ✅ End-to-end testing
- ✅ Documentation

---

## 📝 Next Steps

### 1. Review & Approve Design
- [ ] Review `IMPLEMENTATION.md`
- [ ] Approve database schema
- [ ] Approve API design
- [ ] Approve UI mockups

### 2. Database Setup
```bash
# Run migration
cd packages/db-mysql/migrations
# Copy 0003_billing_system.sql from refactor/billing-payments/
# Run migration on your MySQL database

# Update schema.ts
# Add table definitions from schema-additions.ts
```

### 3. Stripe Configuration
- [ ] Create Stripe account (or use existing)
- [ ] Create 4 products (Starter, Pro, Max, Credits)
- [ ] Configure webhook endpoint
- [ ] Add environment variables

### 4. Start Implementation
Follow the detailed checklist in `IMPLEMENTATION.md` section "Implementation Checklist"

---

## 🔧 Environment Variables Required

Add to `.env.local`:

```bash
# Stripe API Keys
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe Price IDs (from Stripe Dashboard)
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_MAX=price_...
STRIPE_PRICE_CREDITS_500=price_...

# Base URL
NEXT_PUBLIC_BASE_URL=http://localhost:3003

# Billing Config
BILLING_TRIAL_DAYS=7
BILLING_SOFT_LIMIT_BUFFER=10
BILLING_WARNING_COOLDOWN_HOURS=24
```

---

## 🧪 Testing Locally

### Setup Stripe CLI

```bash
# Install
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local
stripe listen --forward-to localhost:3003/api/webhooks/stripe
```

### Test Cards

```
Success:            4242 4242 4242 4242
Decline:            4000 0000 0000 0002
Insufficient funds: 4000 0000 0000 9995
Requires 3DS:       4000 0025 0000 3155
```

### Trigger Webhook Events

```bash
stripe trigger checkout.session.completed
stripe trigger customer.subscription.created
stripe trigger invoice.payment_succeeded
stripe trigger invoice.payment_failed
```

---

## 📚 Additional Resources

- [Stripe Subscriptions Documentation](https://stripe.com/docs/billing/subscriptions/overview)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Stripe Testing Guide](https://stripe.com/docs/testing)
- [Drizzle ORM Documentation](https://orm.drizzle.team/docs/overview)

---

## 🐛 Troubleshooting

### Issue: Migration fails on existing tables

**Solution:** Check if columns already exist from previous attempts:
```sql
SHOW COLUMNS FROM organizations LIKE 'subscription_tier';
```

If exists, comment out that ALTER TABLE statement in migration.

### Issue: Webhook signature verification fails

**Solution:**
1. Check `STRIPE_WEBHOOK_SECRET` is correct
2. Ensure raw body is passed to `stripe.webhooks.constructEvent()`
3. Use Stripe CLI for local testing

### Issue: Credit balance out of sync

**Solution:** Run reconciliation query (see `IMPLEMENTATION.md` "Support & Troubleshooting")

---

## 📞 Support

For questions or issues during implementation:

1. Check `IMPLEMENTATION.md` for detailed guides
2. Review Stripe documentation
3. Check webhook_events table for processing errors
4. Use Stripe Dashboard → Developers → Events for debugging

---

## ✅ Pre-Implementation Checklist

Before starting implementation:

- [ ] Read `IMPLEMENTATION.md` completely
- [ ] Understand database schema changes
- [ ] Have Stripe account ready
- [ ] MySQL database accessible
- [ ] Development environment set up
- [ ] Team approval on design decisions
- [ ] Timeline approved (4 weeks)
- [ ] Resources allocated

---

**Document Version:** 2.0 (Finalized)
**Created:** 2025-11-16
**Updated:** 2025-11-16
**Status:** ✅ Ready for Implementation
**Next Action:** Run database migration
