# Final Design Decisions

**Date:** 2025-11-16
**Status:** ✅ All Decisions Finalized - Ready for Implementation

---

## Core Architecture

| Decision | Final Choice | Reasoning |
|----------|--------------|-----------|
| **Email Service** | AWS SES | Cost-effective ($0.10/1k emails); already using AWS infrastructure |
| **Monitoring** | Stripe Dashboard + Email Alerts | Simple setup; webhook_events table for debugging; no additional service needed |
| **Testing Environment** | Test mode in same Stripe account | Standard approach; simpler setup; share products/prices |
| **Reconciliation** | Weekly cron job (Sundays 3am) | Catch drift without constant overhead; good balance |
| **Usage Enforcement** | Organization-level | All members share org credit pool; B2B model |
| **Usage Tracking** | Hybrid (org enforcement + per-user analytics) | Visibility into who uses what; fair usage insights |
| **Dashboard Location** | Settings → Billing | Standard placement; accessible to all org members |
| **Free Tier Duration** | Unlimited (10/4/2/1 actions/month) | After trial/payment failure; keeps users engaged |
| **API Authorization** | Orchestrator service only (token-based) | Secure internal API; prevents abuse |
| **Limit Behavior** | Fail immediately with upgrade modal | Clear UX; no confusion; strong call-to-action |
| **UI Visibility** | Badge in navigation | Subtle; always accessible; click for details |

---

## Email Implementation (Phase 1)

### ✅ Critical Emails to Implement

1. **Payment Failed**
   - When: `invoice.payment_failed` webhook
   - Content: Amount due, 7-day grace period, update payment link
   - Template: PaymentFailedEmail
   - Priority: HIGH

2. **Trial Ending** (3 days before)
   - When: `customer.subscription.trial_will_end` webhook
   - Content: Days remaining, add payment method CTA
   - Template: TrialEndingEmail
   - Priority: HIGH

3. **Payment Receipt**
   - When: `invoice.payment_succeeded` webhook
   - Content: Amount paid, invoice PDF, next billing date
   - Template: PaymentReceiptEmail
   - Priority: MEDIUM

### ❌ Deferred to Phase 2

- Usage warning emails (80%, 100%)
- Auto top-up triggered
- Subscription upgraded/downgraded
- Trial started (welcome)
- Downgraded to free tier

*Rationale: Phase 1 focuses on revenue-critical emails; usage notifications can be in-app toasts initially*

---

## Database Implementation

### New Tables

1. **subscriptions** - Stripe subscription details
2. **billable_actions** - Clean usage tracking
3. **credit_balances** - Fast balance cache
4. **credit_purchases** - Top-up history
5. **webhook_events** - Audit log
6. **invoices** - Minimal cache (ID + URLs)

### New Database Objects

7. **user_usage_stats VIEW** - Per-user analytics (no enforcement)

### Modified Tables

8. **organizations** - Added: `subscription_tier`, `trial_ends_at`, `last_billing_warning_at`
9. **action_events** - Added: `billable_action_id` (optional link)

---

## API Security

### Service Token Authentication

- **Endpoint:** `POST /api/billing/usage/record`
- **Auth:** `Authorization: Bearer <ORCHESTRATOR_SERVICE_TOKEN>`
- **Token Generation:** `crypto.randomBytes(32).toString('base64url')`
- **Verification:** Timing-safe comparison
- **Scope:** Internal orchestrator service only

### Public Endpoints (User Auth)

All other billing endpoints require:
- Session cookie verification
- Org membership check
- Role-based access (owner/admin for sensitive operations)

---

## Email Configuration (AWS SES)

### Setup Requirements

1. Verify domain: `yourdomain.com`
2. Verify sender: `billing@yourdomain.com`
3. Request production access (move out of sandbox)
4. Create IAM user with SES permissions
5. Get access keys

### Environment Variables

```bash
AWS_SES_REGION=us-east-1
AWS_SES_FROM_EMAIL=billing@yourdomain.com
AWS_SES_FROM_NAME=Pixell Billing
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

### Email Templates

Using **@react-email/components** for:
- Type-safe templates
- React component reuse
- HTML email rendering
- Preview in development

---

## Monitoring Strategy

### Stripe Dashboard

- **Failed payments** - Email alerts enabled
- **Webhook failures** - Monitor "Recent deliveries"
- **Disputed charges** - Email notifications
- **Daily review** - Check failed events

### Database Monitoring

```sql
-- Failed webhooks (last 7 days)
SELECT COUNT(*) FROM webhook_events
WHERE status = 'failed'
  AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY);
```

### Automated Health Checks

- **Daily cron** (9am): Check failed webhooks → email if > 5
- **Weekly reconciliation** (Sundays 3am): Sync credit balances
- **Email alerts**: Admin notified of issues

*No external monitoring service needed (Sentry deferred to Phase 2)*

---

## Reconciliation Job

### Schedule

- **Frequency:** Weekly
- **Day:** Sunday
- **Time:** 3am (low traffic)
- **Enable:** `ENABLE_WEEKLY_RECONCILIATION=true`

### Process

1. Fetch all credit_balances records
2. For each org:
   - Query billable_actions (actual usage)
   - Compare with cached balances
   - Fix drift if detected
   - Email admin if drift found
3. Log results

### Drift Detection

```typescript
const hasDrift =
  balance.usedSmall !== actualUsage.small ||
  balance.usedMedium !== actualUsage.medium ||
  balance.usedLarge !== actualUsage.large ||
  balance.usedXl !== actualUsage.xl
```

---

## UI/UX Patterns

### Navigation Badge

```
┌─────────────────────────────┐
│  Logo   Dashboard   [PRO]   │  ← Small badge, clickable
└─────────────────────────────┘
```

- **Location:** Top navigation bar
- **Display:** Plan tier (FREE/STARTER/PRO/MAX)
- **Trial:** Show "(Trial)" suffix
- **Link:** `/settings/billing`
- **Colors:** Tier-specific (gray/blue/purple/gold)

### Billing Dashboard

**Location:** `/settings/billing`

**Sections:**
1. Current Plan Card (top)
2. Usage Progress Bars (4 tiers)
3. Top-Up Credits Bar (if purchased)
4. Auto Top-Up Settings
5. Per-User Usage Table (analytics)
6. Recent Actions List

### Usage Limit Modal

**Trigger:** API returns `402 Payment Required` with `CREDITS_EXHAUSTED`

**Behavior:**
- Immediate modal display
- Blocks action execution
- Shows 3 options:
  1. Buy credits ($20 for 500)
  2. Upgrade plan (suggested tier)
  3. Cancel (user waits for reset)

**No queueing** - Clear, immediate decision required

### 80% Warning Toast

**Trigger:** API response includes `warning: '80percent'`

**Behavior:**
- Non-blocking toast notification
- 10-second duration
- "View Usage" action button
- Once per tier per session (cooldown)

---

## Implementation Phases

### Phase 1: Full Billing (Weeks 1-4)

✅ All core features:
- Database schema
- Stripe integration
- Usage tracking
- Credit management
- Auto top-ups
- Hard limits
- Billing dashboard
- Critical emails (3 templates)
- Weekly reconciliation
- Service token auth

### Phase 2: Enhancements (Future)

Deferred features:
- Additional email templates (7 more)
- Sentry error tracking
- Advanced analytics dashboard
- Usage forecasting
- Budget alerts
- Spending trends
- Team member quotas (hard limits)
- Custom enterprise plans

---

## Environment Variables Checklist

### Stripe (Required)

- [ ] `STRIPE_SECRET_KEY`
- [ ] `STRIPE_PUBLISHABLE_KEY`
- [ ] `STRIPE_WEBHOOK_SECRET`
- [ ] `STRIPE_PRICE_STARTER`
- [ ] `STRIPE_PRICE_PRO`
- [ ] `STRIPE_PRICE_MAX`
- [ ] `STRIPE_PRICE_CREDITS_500`

### AWS SES (Required)

- [ ] `AWS_SES_REGION`
- [ ] `AWS_SES_FROM_EMAIL`
- [ ] `AWS_SES_FROM_NAME`
- [ ] `AWS_ACCESS_KEY_ID`
- [ ] `AWS_SECRET_ACCESS_KEY`

### Orchestrator (Required)

- [ ] `ORCHESTRATOR_SERVICE_TOKEN`

### Billing Config (Required)

- [ ] `NEXT_PUBLIC_BASE_URL`
- [ ] `BILLING_TRIAL_DAYS=7`
- [ ] `BILLING_WARNING_THRESHOLD=80`
- [ ] `BILLING_WARNING_COOLDOWN_HOURS=24`

### Reconciliation (Optional)

- [ ] `ENABLE_WEEKLY_RECONCILIATION=true`
- [ ] `RECONCILIATION_DAY=0`
- [ ] `RECONCILIATION_HOUR=3`

### Admin (Optional)

- [ ] `ADMIN_EMAIL` (for alerts)

---

## Testing Strategy

### Local Development

1. **Stripe CLI:**
   ```bash
   stripe listen --forward-to localhost:3003/api/webhooks/stripe
   ```

2. **Test Cards:**
   - Success: `4242 4242 4242 4242`
   - Decline: `4000 0000 0000 0002`

3. **Webhook Triggers:**
   ```bash
   stripe trigger checkout.session.completed
   stripe trigger customer.subscription.updated
   stripe trigger invoice.payment_failed
   ```

### Test Scenarios (Week 4)

- [ ] Create subscription (all 3 tiers)
- [ ] Record usage (all 4 tiers)
- [ ] Hit 80% warning
- [ ] Hit 100% limit
- [ ] Trigger auto top-up
- [ ] Manual credit purchase
- [ ] Upgrade plan
- [ ] Downgrade plan
- [ ] Cancel subscription
- [ ] Payment failure → grace period → downgrade
- [ ] Trial ending emails
- [ ] Weekly reconciliation job
- [ ] Service token authentication
- [ ] Per-user analytics query

---

## Launch Readiness Checklist

### Pre-Launch

- [ ] All database tables created
- [ ] Drizzle schema updated
- [ ] Stripe products configured
- [ ] Webhook endpoint deployed
- [ ] Environment variables set
- [ ] AWS SES verified
- [ ] Critical emails tested
- [ ] Service token generated
- [ ] Reconciliation job scheduled

### Launch Day

- [ ] Enable webhook endpoint in Stripe
- [ ] Monitor webhook_events table
- [ ] Test end-to-end checkout
- [ ] Verify emails sending
- [ ] Check auto top-up trigger

### Post-Launch (Week 1)

- [ ] Monitor failed webhooks
- [ ] Check reconciliation job results
- [ ] Review per-user analytics
- [ ] Gather user feedback
- [ ] Optimize slow queries

---

## Success Metrics

### Revenue Metrics

- Trial conversion rate (target: >10%)
- Churn rate (target: <5%/month)
- Average plan tier distribution
- Auto top-up adoption rate

### Technical Metrics

- Webhook processing latency (target: <2s)
- Failed webhook rate (target: <1%)
- Credit balance drift incidents (target: 0/week)
- API usage recording success rate (target: >99.9%)

### User Experience

- Time to first upgrade (days)
- Usage warnings shown (per user/month)
- Hard limit blocks (per org/month)
- Support tickets related to billing

---

## Risk Mitigation

### Identified Risks

1. **Credit balance drift**
   - Mitigation: Weekly reconciliation job
   - Detection: Automated alerts

2. **Webhook failures**
   - Mitigation: Stripe retry logic
   - Detection: Daily health check
   - Recovery: Manual replay via dashboard

3. **Race conditions in balance updates**
   - Mitigation: Atomic SQL updates
   - Testing: Concurrent load testing

4. **Email delivery failures**
   - Mitigation: AWS SES monitoring
   - Fallback: Stripe dashboard notifications

5. **Service token compromise**
   - Mitigation: Rotate token regularly
   - Detection: Rate limiting
   - Recovery: Generate new token

---

## Next Steps

1. **✅ Design finalized** - All decisions documented
2. **➡️ Review implementation plan** - Read IMPLEMENTATION.md
3. **➡️ Set up development environment** - Install dependencies
4. **➡️ Run database migration** - Apply schema changes
5. **➡️ Configure Stripe** - Create products
6. **➡️ Start Week 1** - Backend foundation

---

**All decisions finalized and documented.**
**Ready to proceed with implementation.**

**Estimated Timeline:** 4 weeks
**Next Action:** Begin Week 1 - Database & Stripe setup
