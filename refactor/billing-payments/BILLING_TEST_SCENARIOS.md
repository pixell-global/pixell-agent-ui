# 🧪 Billing System Test Scenarios

Comprehensive test scenarios for manual and automated browser testing of the billing system.

**Version:** 1.0
**Last Updated:** 2025-01-16
**Test Environment:** Development (vivid_dev database)

---

## Table of Contents

1. [Free Tier User Journey](#1-free-tier-user-journey)
2. [Credit Usage and Deduction](#2-credit-usage-and-deduction)
3. [Subscription Upgrade Flow](#3-subscription-upgrade-flow)
4. [Insufficient Credits Error](#4-insufficient-credits-error)
5. [Payment Failure Handling](#5-payment-failure-handling)
6. [Auto Top-up Configuration](#6-auto-top-up-configuration)
7. [Subscription Downgrade with Active Usage](#7-subscription-downgrade-with-active-usage)
8. [Concurrent Credit Deduction](#8-concurrent-credit-deduction)
9. [Webhook Processing](#9-webhook-processing)
10. [Trial Expiration](#10-trial-expiration)

---

## 1. Free Tier User Journey

### Scenario: New User Signup and Free Tier Verification

**Success Case:**
- User successfully creates account
- Automatically assigned to free tier
- Credit balance shows: 10 small, 4 medium, 2 large, 1 XL
- Billing page displays "Free" tier badge
- "Upgrade Plan" button is visible

**Fail Case:**
- User not assigned to any tier (null/undefined)
- Credit balance shows 0 for all tiers
- Database subscription record not created
- Billing page shows error: "Unable to load subscription"
- API returns 404 or 500 error

**Step-by-Step Test Instructions:**

```
SETUP:
1. Ensure database is accessible (vivid_dev)
2. Have test email ready: test+[timestamp]@example.com
3. Clear browser cache and cookies

TEST STEPS:
1. Navigate to signup page: http://localhost:3003/signup
   ✓ Expected: Signup form displays

2. Enter test email and password
   Email: test+20250116_001@example.com
   Password: TestPassword123!
   ✓ Expected: Form accepts input, no validation errors

3. Click "Sign Up" button
   ✓ Expected:
   - Loading spinner appears
   - Redirect to onboarding or dashboard
   - No error messages

4. Navigate to Settings → Billing: http://localhost:3003/settings/billing
   ✓ Expected: Billing page loads within 2 seconds

5. Verify tier badge shows "Free"
   Location: Top of subscription card
   ✓ Success: Badge displays "Free" with gray/default styling
   ✗ Fail: Badge shows undefined, null, or wrong tier

6. Verify credit allocation
   ✓ Success:
   - Small: 10/10 (0 used)
   - Medium: 4/4 (0 used)
   - Large: 2/2 (0 used)
   - XL: 1/1 (0 used)
   - Usage: 0%
   ✗ Fail: Any credit shows 0 included or negative numbers

7. Check database record (optional verification)
   Query: SELECT * FROM subscriptions WHERE org_id = '[org-id]';
   ✓ Success: Record exists with plan_tier = 'free', status = 'active'
   ✗ Fail: No record found or wrong values

8. Verify "Upgrade Plan" button exists
   ✓ Success: Button visible and clickable
   ✗ Fail: Button missing or disabled

CLEANUP:
- Delete test user from database if needed
- Note organization ID for future tests
```

---

## 2. Credit Usage and Deduction

### Scenario: Perform Actions and Verify Credit Deduction

**Success Case:**
- Action executes successfully
- Credits deducted immediately (1 small credit = 1 action)
- Credit balance updates in real-time
- Usage percentage increases proportionally
- Billable action recorded in database

**Fail Case:**
- Action fails but credits still deducted (lost credits)
- Credits not deducted (free actions - revenue loss)
- Negative credit balance
- Race condition: credits deducted twice for one action
- Database transaction fails mid-deduction

**Step-by-Step Test Instructions:**

```
SETUP:
1. Log in as free tier user with full credits (10/4/2/1)
2. Navigate to main dashboard/action page
3. Open browser DevTools → Network tab
4. Open second browser tab to Settings → Billing

TEST STEPS:

Part A: Single Small Action
1. In dashboard tab, trigger a "small" action
   Example: "Generate a simple text summary"
   ✓ Expected: Action starts processing

2. Monitor Network tab for API call
   Endpoint: POST /api/billing/credits/deduct
   ✓ Success: Status 200, response includes:
   {
     "success": true,
     "billableActionId": 123,
     "balanceAfter": {
       "small": 9,
       "medium": 4,
       "large": 2,
       "xl": 1,
       "topup": 0
     }
   }
   ✗ Fail: Status 402, 500, or response.success = false

3. Wait for action to complete
   ✓ Expected: Action completes with results

4. Switch to Billing tab and verify credits
   ✓ Success: Small credits show 9/10 (1 used)
   ✗ Fail: Still shows 10/10 or shows 8/10

5. Check usage percentage
   ✓ Success: Shows ~10% (1/10 small credits used)
   ✗ Fail: Shows 0% or incorrect percentage

Part B: Multiple Actions (5 small actions)
6. Return to dashboard and trigger 5 more small actions in sequence
   Wait for each to complete before starting next

7. After each action, note credit balance:
   Action 1: 9/10 → 8/10
   Action 2: 8/10 → 7/10
   Action 3: 7/10 → 6/10
   Action 4: 6/10 → 5/10
   Action 5: 5/10 → 4/10
   ✓ Success: Each action deducts exactly 1 credit
   ✗ Fail: Credits skip numbers or deduct wrong amount

8. Verify database records
   Query: SELECT COUNT(*) FROM billable_actions
          WHERE org_id = '[org-id]' AND action_tier = 'small';
   ✓ Success: Returns 6 (1 from Part A + 5 from Part B)
   ✗ Fail: Returns different count (indicates lost/duplicate records)

Part C: Different Action Tiers
9. Trigger a "medium" action (costs 2.5 credits)
   ✓ Success:
   - Medium credits: 4/4 → 3/4 (deducted 1, not 2.5)
   - Small credits unchanged: 4/10
   ✗ Fail: Wrong tier deducted or incorrect amount

10. Trigger a "large" action (costs 5 credits)
    ✓ Success: Large credits: 2/2 → 1/2
    ✗ Fail: Credits not deducted or wrong tier affected

11. Trigger an "xl" action (costs 15 credits)
    ✓ Success: XL credits: 1/1 → 0/1
    ✗ Fail: Action blocked or wrong deduction

EDGE CASES:

12. Trigger action when exactly 1 small credit remains
    Current: 1/10 small credits
    ✓ Success: Action completes, credits go to 0/10
    ✗ Fail: Action blocked with "insufficient credits"

13. Trigger action when 0 credits remain
    Current: 0/10 small credits
    ✓ Success: Action blocked, error message shown
    ✗ Fail: Action proceeds (free action - bug!)

14. Verify final state
    Query: SELECT * FROM credit_balances WHERE org_id = '[org-id]';
    ✓ Success:
    - used_small = 6
    - used_medium = 1
    - used_large = 1
    - used_xl = 1
    ✗ Fail: Numbers don't match test actions

CLEANUP:
- Document final credit balance for next test
- Screenshot billing page showing usage
```

---

## 3. Subscription Upgrade Flow

### Scenario: Upgrade from Free to Starter Plan

**Success Case:**
- Upgrade modal displays with plan comparison
- Stripe checkout loads with correct price ($9.99/month)
- Payment processes successfully
- Subscription tier updates to "Starter"
- Credits increase to 50/20/10/5
- Trial starts (7 days)
- User receives confirmation email

**Fail Case:**
- Payment fails (card declined)
- Stripe checkout doesn't load
- Payment succeeds but subscription not updated (partial state)
- Credits don't increase
- User charged but still on free tier
- Database transaction rollback failure

**Step-by-Step Test Instructions:**

```
SETUP:
1. Log in as free tier user
2. Have Stripe test cards ready:
   Success: 4242 4242 4242 4242
   Decline: 4000 0000 0000 0002
3. Open browser DevTools → Network tab
4. Clear any existing subscriptions for this org

TEST STEPS:

Part A: Initiate Upgrade
1. Navigate to Settings → Billing
   ✓ Expected: Current tier shows "Free"

2. Click "Upgrade Plan" button
   ✓ Success: Upgrade modal opens with plan comparison
   ✗ Fail: Nothing happens or error modal appears

3. Verify plan cards display in modal
   ✓ Success: See 4 plans: Free, Starter ($9.99), Pro ($99), Max ($499.99)
   ✗ Fail: Missing plans or wrong prices

4. Click "Select" on Starter plan card
   ✓ Success: Stripe checkout loads with:
   - Amount: $9.99/month
   - Trial: 7 days free
   - Next charge date: [7 days from today]
   ✗ Fail: Wrong amount, no trial, or checkout doesn't load

Part B: Payment Processing (Success Path)
5. Enter payment details in Stripe checkout:
   Card: 4242 4242 4242 4242
   Expiry: 12/34
   CVC: 123
   ZIP: 12345
   ✓ Expected: Form accepts input

6. Click "Subscribe" button
   ✓ Success:
   - Loading spinner appears
   - Network request to /api/billing/subscription/create
   - Status: 200
   - Response contains: { success: true, subscription: {...} }
   ✗ Fail:
   - Request fails (4xx or 5xx)
   - Response: { error: "..." }

7. Wait for redirect back to billing page
   Timeout: 10 seconds max
   ✓ Success: Redirects to /settings/billing with success toast
   ✗ Fail: Stuck on checkout or error page

8. Verify subscription tier updated
   ✓ Success:
   - Tier badge shows "Starter" (blue background)
   - Status badge shows "Trialing" or "Active"
   ✗ Fail: Still shows "Free" or "Incomplete"

9. Verify credit allocation updated
   ✓ Success:
   - Small: 50/50
   - Medium: 20/20
   - Large: 10/10
   - XL: 5/5
   ✗ Fail: Credits unchanged or partially updated

10. Check trial indicator
    ✓ Success: Blue banner shows "Trial ends on [date 7 days from now]"
    ✗ Fail: No trial indicator or wrong date

11. Verify database state
    Query: SELECT * FROM subscriptions WHERE org_id = '[org-id]';
    ✓ Success:
    - plan_tier = 'starter'
    - status = 'trialing' or 'active'
    - stripe_subscription_id NOT NULL
    - trial_end = [7 days from now]
    ✗ Fail: Any field incorrect or NULL

12. Check credit_balances table
    Query: SELECT * FROM credit_balances WHERE org_id = '[org-id]';
    ✓ Success:
    - included_small = 50
    - used_small = 0 (reset)
    - billing_period_start = [today]
    - billing_period_end = [30 days from today]
    ✗ Fail: Values not updated

Part C: Payment Processing (Failure Path)
13. Repeat steps 1-4 to open upgrade modal again
    (If already upgraded, use different test user)

14. Enter declining card in Stripe checkout:
    Card: 4000 0000 0000 0002
    Expiry: 12/34
    CVC: 123
    ZIP: 12345

15. Click "Subscribe" button
    ✓ Success (failure handled correctly):
    - Error message: "Your card was declined"
    - Stays on checkout page
    - Subscription NOT created
    - User remains on free tier
    ✗ Fail (improper error handling):
    - No error message shown
    - User charged but subscription not created
    - Partial state in database

16. Return to billing page
    ✓ Success: Still shows "Free" tier, no charges
    ✗ Fail: Shows "Starter" but no Stripe subscription

Part D: Confirmation Email
17. Check email inbox for confirmation
    Email subject: "Welcome to Starter Plan" or similar
    ✓ Success:
    - Email arrives within 5 minutes
    - Contains: plan details, billing date, invoice link
    ✗ Fail: No email or wrong template

Part E: Stripe Dashboard Verification
18. Log into Stripe Dashboard (test mode)
    https://dashboard.stripe.com/test/customers

19. Search for customer by email
    ✓ Success: Customer exists with active subscription
    ✗ Fail: No customer found

20. Verify subscription details in Stripe:
    - Status: trialing or active
    - Price: $9.99/month
    - Trial end: 7 days from creation
    ✓ Success: All details match
    ✗ Fail: Mismatch or subscription missing

EDGE CASES:

21. Attempt to upgrade again (duplicate subscription)
    Click "Upgrade Plan" button
    ✓ Success: Modal shows "You already have an active subscription"
    ✗ Fail: Allows creating duplicate subscription

22. Cancel and retry upgrade
    Cancel the test subscription, then upgrade again
    ✓ Success: New subscription created successfully
    ✗ Fail: Error or stuck in previous subscription state

CLEANUP:
- Cancel test subscription in Stripe Dashboard
- Delete test subscription from database
- Reset credit balance to free tier
```

---

## 4. Insufficient Credits Error

### Scenario: Attempt Action with Zero Credits

**Success Case:**
- Action is blocked before execution
- Error modal appears: "Insufficient credits"
- Upgrade CTA is prominent
- No credits deducted
- No partial action execution

**Fail Case:**
- Action executes for free (revenue loss)
- Action starts then fails mid-execution (bad UX)
- Credits go negative
- Error message unclear or missing
- User stuck in error state (can't recover)

**Step-by-Step Test Instructions:**

```
SETUP:
1. Log in as free tier user
2. Use all credits (10 small, 4 medium, 2 large, 1 xl)
3. Verify credit balance shows 0/10, 0/4, 0/2, 0/1
4. Open browser DevTools → Network and Console tabs

TEST STEPS:

Part A: Trigger Action with Zero Credits
1. Navigate to dashboard/action page

2. Verify credit balance is truly zero
   Check: Settings → Billing shows 0 remaining for all tiers
   ✓ Expected: All tier credits at 0

3. Attempt to trigger a "small" action
   Example: "Generate a summary"
   ✓ Success (proper blocking):
   - API call to /api/billing/credits/check returns:
     {
       "success": true,
       "allowed": false,
       "reason": "Insufficient credits for small action..."
     }
   - Action does NOT start
   - Error modal appears immediately
   ✗ Fail (improper handling):
   - API returns "allowed": true
   - Action starts processing
   - Error occurs mid-execution

4. Verify error modal content
   ✓ Success:
   - Title: "Insufficient Credits" or "Out of Credits"
   - Message: "You've used all your small action credits. Upgrade or purchase more to continue."
   - Primary button: "Upgrade Plan" (prominent, colored)
   - Secondary button: "Purchase Credits" or "Cancel"
   ✗ Fail:
   - Generic error message
   - No upgrade CTA
   - Modal doesn't appear

5. Check Network tab
   ✓ Success: No call to /api/billing/credits/deduct
   ✗ Fail: Deduct API called (indicates action attempted)

6. Check Console tab
   ✓ Success: No JavaScript errors
   ✗ Fail: Console errors or warnings

Part B: Verify No State Change
7. Check credit balance again
   ✓ Success: Still shows 0/10 (not negative)
   ✗ Fail: Shows -1/10 or other negative value

8. Check database
   Query: SELECT * FROM credit_balances WHERE org_id = '[org-id]';
   ✓ Success: used_small = 10 (not 11)
   ✗ Fail: used_small > included_small

Part C: Upgrade CTA Flow
9. Click "Upgrade Plan" button in error modal
   ✓ Success:
   - Modal closes
   - Upgrade modal opens with plan selection
   - OR redirects to /settings/billing#plans
   ✗ Fail:
   - Nothing happens
   - Modal remains stuck
   - Wrong page loads

10. Close upgrade modal (don't complete upgrade)
    Click "Cancel" or X button
    ✓ Success: Returns to dashboard, error cleared
    ✗ Fail: Stuck in modal or error persists

Part D: Alternative Error Paths
11. Try a "medium" action with 0 medium credits
    ✓ Success: Same blocking behavior, different tier mentioned
    ✗ Fail: Different error handling or allows action

12. Try an "xl" action with 0 xl credits
    ✓ Success: Blocked with appropriate message
    ✗ Fail: Uses topup credits or proceeds anyway

Part E: Recovery Path
13. Purchase 500 top-up credits (use test flow or manually add to DB)

14. Try the small action again
    ✓ Success:
    - Action proceeds using topup credits
    - Topup balance: 500 → 499
    - Tier credits still 0/10
    ✗ Fail:
    - Still blocked despite having topup credits
    - Topup credits not deducted

EDGE CASES:

15. Concurrent requests (race condition test)
    - Have exactly 1 small credit
    - In two browser tabs, trigger small action simultaneously
    ✓ Success:
    - One action succeeds (credit deducted)
    - Other action blocked with insufficient credits
    - Final credit: 0/10 (not negative)
    ✗ Fail:
    - Both actions succeed (double-spend)
    - Credits go negative: -1/10

16. Network error during check
    - Block /api/billing/credits/check in DevTools
    - Try to trigger action
    ✓ Success: Shows "Unable to verify credits, please try again"
    ✗ Fail: Action proceeds without check

17. API timeout
    - Simulate slow response (DevTools → Network throttling: Slow 3G)
    - Try to trigger action
    ✓ Success:
    - Shows loading state
    - Times out gracefully with retry option
    ✗ Fail: Infinite loading or action fails silently

CLEANUP:
- Add credits back for next test
- Clear any error state
- Verify database consistency
```

---

## 5. Payment Failure Handling

### Scenario: Upgrade Attempt with Declined Card

**Success Case:**
- Payment fails with clear error message
- User remains on free tier (no partial upgrade)
- No Stripe subscription created
- No database changes committed
- User can retry with different card
- No charges to customer

**Fail Case:**
- Payment fails but subscription created (customer not charged but has subscription)
- Database updated but Stripe subscription not created (data inconsistency)
- Unclear error message
- User stuck in "incomplete" state
- Multiple failed attempts lock account

**Step-by-Step Test Instructions:**

```
SETUP:
1. Log in as free tier user with 0 subscriptions
2. Stripe test cards ready:
   Declined: 4000 0000 0000 0002
   Insufficient funds: 4000 0000 0000 9995
   Expired: 4000 0000 0000 0069
3. Open DevTools → Network tab
4. Have database query tool ready

TEST STEPS:

Part A: Generic Card Decline
1. Navigate to Settings → Billing

2. Click "Upgrade Plan" → Select "Starter"

3. In Stripe checkout, enter declining card:
   Card: 4000 0000 0000 0002
   Expiry: 12/34
   CVC: 123
   Name: Test Decline

4. Click "Subscribe"
   ✓ Success (proper error handling):
   - Request to /api/billing/subscription/create
   - Response: Status 400 or 402
   - Body: {
       "error": "Payment failed",
       "message": "Your card was declined. Please try a different card."
     }
   - Error shown in Stripe checkout
   - User remains on checkout page
   ✗ Fail:
   - Status 200 with partial success
   - Redirect happens despite failure
   - No error message shown

5. Verify user state unchanged
   Navigate back to Settings → Billing
   ✓ Success:
   - Tier: "Free"
   - Status: "Active" (not "Incomplete")
   - Credits: 10/4/2/1 (free tier amounts)
   ✗ Fail:
   - Tier shows "Starter" or "Incomplete"
   - Credits partially updated

6. Check database - subscriptions table
   Query: SELECT * FROM subscriptions WHERE org_id = '[org-id]';
   ✓ Success:
   - No new record created, OR
   - Record exists with status = 'incomplete' AND stripe_subscription_id IS NULL
   ✗ Fail:
   - Record created with status = 'active'
   - stripe_subscription_id has value but payment failed

7. Check database - credit_balances table
   Query: SELECT * FROM credit_balances WHERE org_id = '[org-id]';
   ✓ Success:
   - included_small = 10 (not 50)
   - billing_period unchanged
   ✗ Fail:
   - Credits updated to Starter amounts despite payment failure

8. Verify Stripe Dashboard
   Log into Stripe → Customers
   ✓ Success:
   - Customer record may exist
   - No active subscription
   - No successful payment intents
   ✗ Fail:
   - Subscription shows as active
   - Payment intent succeeded

Part B: Retry with Valid Card
9. Click "Upgrade Plan" again

10. Select "Starter" plan

11. Enter valid card:
    Card: 4242 4242 4242 4242
    Expiry: 12/34
    CVC: 123

12. Click "Subscribe"
    ✓ Success:
    - Payment succeeds
    - Subscription created
    - Tier updated to "Starter"
    - Credits updated to 50/20/10/5
    ✗ Fail:
    - Previous failed attempt blocks retry
    - Error about existing subscription

13. Verify database cleaned up previous failure
    Query: SELECT COUNT(*) FROM subscriptions
           WHERE org_id = '[org-id]' AND status = 'incomplete';
    ✓ Success: Returns 0 (old incomplete record removed or updated)
    ✗ Fail: Returns 1+ (orphaned incomplete subscriptions)

Part C: Insufficient Funds Error
14. With new test user, attempt upgrade with:
    Card: 4000 0000 0000 9995 (insufficient funds)

15. Submit payment
    ✓ Success:
    - Error: "Your card has insufficient funds"
    - User can retry
    ✗ Fail:
    - Generic error or no specific message

Part D: Expired Card Error
16. Attempt upgrade with:
    Card: 4000 0000 0000 0069
    Expiry: 12/20 (past date)

17. Submit payment
    ✓ Success:
    - Error: "Your card has expired"
    - Clear instruction to use different card
    ✗ Fail:
    - Unclear error message

Part E: 3D Secure Required (if applicable)
18. Use card requiring authentication:
    Card: 4000 0025 0000 3155

19. Complete 3D Secure flow
    ✓ Success:
    - Modal opens for authentication
    - After auth, payment proceeds
    ✗ Fail:
    - 3D Secure fails
    - Payment incomplete

Part F: Network Failure During Payment
20. Open DevTools → Network tab

21. Start upgrade with valid card 4242...

22. As soon as "Subscribe" is clicked, go offline:
    DevTools → Network → Offline checkbox

23. Wait 10 seconds
    ✓ Success:
    - Timeout error: "Network error, please try again"
    - No subscription created
    - State remains "free"
    ✗ Fail:
    - Infinite loading
    - Partial subscription created

24. Go back online and check state
    ✓ Success: Still free tier, can retry
    ✗ Fail: Stuck in incomplete state

EDGE CASES:

25. Multiple rapid retry attempts
    - Fail payment 5 times in a row
    ✓ Success:
    - Each attempt handled independently
    - No account lockout
    - Can eventually succeed
    ✗ Fail:
    - Account locked after N attempts
    - Duplicate subscriptions created

26. Payment succeeds but webhook fails
    - This requires mocking webhook failure
    ✓ Success:
    - Subscription still created
    - Webhook retry mechanism handles it
    - Status eventually consistent
    ✗ Fail:
    - Subscription orphaned in Stripe
    - Customer charged but no access

27. Webhook arrives before API response
    - Requires timing manipulation
    ✓ Success:
    - Idempotent handling
    - Correct final state
    ✗ Fail:
    - Race condition causes duplicate records

CLEANUP:
- Cancel any test subscriptions in Stripe
- Delete incomplete subscription records
- Reset test user to free tier
- Document which error scenarios passed/failed
```

---

## 6. Auto Top-up Configuration

### Scenario: Enable and Trigger Auto Top-up

**Success Case:**
- User enables auto top-up with threshold and amount
- Settings saved successfully
- When credits drop below threshold, auto top-up triggers
- Payment processes automatically
- Credits added without user intervention
- User receives email notification
- Billing works seamlessly

**Fail Case:**
- Auto top-up enabled but never triggers
- Triggers too early (above threshold)
- Payment fails but user isn't notified
- Credits added but payment not processed (revenue loss)
- Infinite loop of auto top-ups
- Settings not saved

**Step-by-Step Test Instructions:**

```
SETUP:
1. Log in as Starter tier user (paid subscription)
2. Have valid payment method on file
3. Start with credits: 50 small, 20 medium, 10 large, 5 xl
4. Open DevTools → Network tab
5. Have email client ready

TEST STEPS:

Part A: Enable Auto Top-up
1. Navigate to Settings → Billing

2. Scroll to "Auto Top-up Settings" section
   ✓ Expected: Section visible with toggle/checkbox

3. Click "Enable Auto Top-up" toggle
   ✓ Success: Toggle switches to ON state (green/blue)
   ✗ Fail: Toggle doesn't change or reverts

4. Configure threshold and amount:
   Threshold: 10 credits
   Amount: 100 credits
   ✓ Expected: Dropdowns/inputs accept values

5. Click "Save Settings"
   ✓ Success:
   - Network request: PATCH /api/billing/credits/auto-topup
   - Response: { success: true }
   - Success toast: "Auto top-up enabled"
   ✗ Fail:
   - Request fails (4xx/5xx)
   - No confirmation message

6. Refresh page and verify settings persisted
   ✓ Success:
   - Toggle still ON
   - Threshold: 10
   - Amount: 100
   ✗ Fail:
   - Settings reset to defaults

7. Verify database
   Query: SELECT auto_topup_enabled, auto_topup_threshold, auto_topup_amount
          FROM credit_balances WHERE org_id = '[org-id]';
   ✓ Success:
   - auto_topup_enabled = 1 (true)
   - auto_topup_threshold = 10
   - auto_topup_amount = 100
   ✗ Fail: Any field incorrect

Part B: Trigger Auto Top-up
8. Calculate credits needed to trigger
   Current: 50 small credits
   Trigger at: 10 credits
   Need to use: 50 - 10 = 40 small credits

9. Use 40 small actions to reach 10/50 credits
   Monitor credit balance after each action
   ✓ Expected: Credits decrease: 50 → 49 → 48 → ... → 10

10. Trigger one more small action (brings to 9 credits)
    ✓ Success (auto top-up triggers):
    - Action completes using tier credit (10 → 9)
    - Immediately after, auto top-up initiates
    - Network request: POST /api/billing/credits/purchase
      Body: {
        "orgId": "[org-id]",
        "amount": 100,
        "trigger": "auto_topup"
      }
    - Response: { success: true, transactionId: "..." }
    - Top-up credits: 0 → 100
    ✗ Fail (auto top-up doesn't trigger):
    - Credits drop to 9/50
    - No purchase API call
    - Top-up credits remain 0

11. Verify credit balance after trigger
    ✓ Success:
    - Tier credits: 9/50 (not reset)
    - Top-up credits: 100/100
    - Total available: 9 tier + 100 topup = 109 credits
    ✗ Fail:
    - Top-up not added
    - Tier credits reset unexpectedly

12. Check Stripe Dashboard for payment
    Stripe → Payments → Recent
    ✓ Success:
    - Payment intent created
    - Amount: $4.00 (100 credits × $0.04)
    - Status: Succeeded
    - Metadata: { trigger: "auto_topup", orgId: "..." }
    ✗ Fail:
    - No payment found
    - Payment failed
    - Wrong amount

13. Verify database records
    Query: SELECT * FROM credit_purchases
           WHERE org_id = '[org-id]' AND purchase_type = 'auto_topup'
           ORDER BY created_at DESC LIMIT 1;
    ✓ Success:
    - credits_amount = 100
    - amount_paid = 4.00
    - status = 'succeeded'
    - stripe_payment_intent_id NOT NULL
    ✗ Fail:
    - No record found
    - Status = 'pending' or 'failed'

14. Check email notification
    Subject: "Credits Automatically Added"
    ✓ Success:
    - Email received within 5 minutes
    - Body contains:
      * Amount added: 100 credits
      * Amount charged: $4.00
      * New balance
      * Link to manage auto top-up
    ✗ Fail:
    - No email received
    - Wrong information

Part C: Verify Auto Top-up Doesn't Re-trigger
15. Use 5 more small credits (balance: 4 tier + 100 topup)
    ✓ Success: No auto top-up (still above threshold of 10 total)
    ✗ Fail: Auto top-up triggers again incorrectly

16. Use credits until only topup remains (0 tier + 100 topup)
    ✓ Success: No auto top-up (total > threshold)
    ✗ Fail: Auto top-up triggers

17. Use topup credits down to 9 (0 tier + 9 topup)
    Total = 9 credits (below threshold of 10)
    ✓ Success: Auto top-up triggers again, adds 100
    ✗ Fail: Doesn't trigger despite being below threshold

Part D: Disable Auto Top-up
18. Navigate to Settings → Billing → Auto Top-up

19. Toggle "Enable Auto Top-up" to OFF

20. Click "Save"
    ✓ Success:
    - Toggle OFF
    - Success message
    - Database: auto_topup_enabled = 0
    ✗ Fail:
    - Setting doesn't save
    - Toggle reverts

21. Use credits below threshold (e.g., to 5 total)
    ✓ Success: No auto top-up triggers
    ✗ Fail: Auto top-up still triggers despite being disabled

Part E: Payment Failure During Auto Top-up
22. Re-enable auto top-up

23. In Stripe Dashboard, delete payment method

24. Use credits to trigger auto top-up (below threshold)
    ✓ Success (proper failure handling):
    - Auto top-up attempts
    - Payment fails
    - User receives email: "Auto top-up failed"
    - Credits NOT added
    - User can manually add payment method
    ✗ Fail:
    - Silent failure (no notification)
    - Credits added without payment
    - Auto top-up keeps retrying infinitely

25. Add payment method back

26. Verify auto top-up works again
    ✓ Success: Next trigger processes payment successfully
    ✗ Fail: Auto top-up permanently broken

EDGE CASES:

27. Set threshold higher than included credits
    Threshold: 100, Amount: 500
    Included small: 50
    ✓ Success:
    - Warning shown: "Threshold exceeds included credits"
    - Auto top-up triggers immediately upon credit use
    ✗ Fail:
    - Accepts invalid config
    - Infinite loop

28. Set amount to 0 or negative
    Amount: 0
    ✓ Success: Validation error, not allowed
    ✗ Fail: Accepts 0, causes issues

29. Concurrent triggers (race condition)
    - Use credits to exactly threshold in two tabs simultaneously
    ✓ Success:
    - Only one auto top-up processes
    - No duplicate charges
    ✗ Fail:
    - Two auto top-ups trigger
    - Double charge

30. Webhook delay
    - Auto top-up payment succeeds in Stripe
    - Webhook delayed by 5 minutes
    ✓ Success:
    - Credits eventually added
    - Status reconciled
    ✗ Fail:
    - Credits never added despite payment

CLEANUP:
- Disable auto top-up
- Reset credits to known state
- Cancel test payment methods
- Document any failures
```

---

## 7. Subscription Downgrade with Active Usage

### Scenario: Downgrade from Pro to Starter with High Usage

**Success Case:**
- User on Pro tier (500 small credits/month) has used 400
- Downgrades to Starter tier (50 small credits/month)
- Warning shown about usage exceeding new limit
- Downgrade scheduled for end of billing period
- At period end, tier changes and credits reset to 50
- Pro-rated refund issued (if applicable)

**Fail Case:**
- Immediate downgrade causes negative credits
- User loses access mid-billing period
- No warning about usage
- Credits reset immediately (user loses paid credits)
- Refund not processed
- Stuck in "downgrading" state

**Step-by-Step Test Instructions:**

```
SETUP:
1. Log in as Pro tier user
2. Current credits: 100/500 small (400 used)
3. Billing period: 15 days remaining
4. Open DevTools → Network tab

TEST STEPS:

Part A: Initiate Downgrade
1. Navigate to Settings → Billing
   ✓ Expected:
   - Tier: "Pro" ($99/month)
   - Credits: 100/500 small
   - Period: 15 days remaining

2. Click "Change Plan" button
   ✓ Success: Plan selection modal opens
   ✗ Fail: Nothing happens or error

3. Select "Starter" plan ($9.99/month)
   ✓ Expected: Starter plan card highlights

4. Click "Downgrade to Starter"
   ✓ Success: Confirmation modal appears
   ✗ Fail: Immediate downgrade without confirmation

5. Verify warning in confirmation modal
   ✓ Success: Modal shows:
   "Warning: You've used 400 of 500 Pro credits this month.
    Starter tier includes only 50 credits per month.

    Your downgrade will take effect on [period end date].
    You'll keep Pro benefits until then.

    A pro-rated refund of $XX.XX will be applied to your next invoice."
   ✗ Fail:
   - No warning about usage
   - No mention of when downgrade takes effect
   - No refund information

6. Click "Confirm Downgrade"
   ✓ Success:
   - Network request: POST /api/billing/subscription/update
     Body: { orgId: "...", newTier: "starter", when: "end_of_period" }
   - Response: { success: true, effectiveDate: "..." }
   - Success toast: "You'll be downgraded to Starter on [date]"
   ✗ Fail:
   - Immediate downgrade
   - Error response
   - No feedback

Part B: Verify Pending Downgrade State
7. Check billing page after confirmation
   ✓ Success:
   - Current tier badge: "Pro" (still active)
   - Warning banner: "Your plan will change to Starter on [date]"
   - Credits: Still 100/500 (unchanged)
   - "Cancel Downgrade" button visible
   ✗ Fail:
   - Already showing "Starter"
   - Credits reset immediately
   - No indication of pending change

8. Verify database state
   Query: SELECT * FROM subscriptions WHERE org_id = '[org-id]';
   ✓ Success:
   - plan_tier = 'pro' (current tier)
   - cancel_at_period_end = true (scheduled change)
   - metadata or notes field indicates downgrade to 'starter'
   ✗ Fail:
   - plan_tier already 'starter'
   - No indication of scheduled change

9. Check Stripe Dashboard
   Stripe → Subscriptions → [subscription]
   ✓ Success:
   - Status: Active
   - Current plan: Pro ($99)
   - Scheduled change on [period end]: Starter ($9.99)
   ✗ Fail:
   - No scheduled change
   - Already downgraded

Part C: Use Credits During Pending Period
10. Perform 50 more small actions
    Credits: 100 → 50 (450 total used)
    ✓ Success:
    - Actions proceed normally
    - Credits deduct as expected
    - Still on Pro tier
    ✗ Fail:
    - Actions blocked
    - Wrong tier applied

11. Verify continued Pro access
    ✓ Success: All Pro features available
    ✗ Fail: Features restricted to Starter

Part D: Cancel Downgrade (optional path)
12. Click "Cancel Downgrade" button
    ✓ Success:
    - Confirmation modal
    - Warning banner disappears
    - Remains on Pro tier
    - Scheduled change cancelled in Stripe
    ✗ Fail:
    - Can't cancel
    - Downgrade still proceeds

Part E: Downgrade Takes Effect (end of billing period)
13. Mock/wait for period end date
    Option A: Change system date to period end + 1 day
    Option B: Actually wait (not practical for testing)
    Option C: Manually trigger via webhook simulation

14. Simulate period end webhook
    POST /api/webhooks/stripe
    Event: customer.subscription.updated
    Body: {
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "[subscription_id]",
          status: "active",
          items: [{
            price: { id: "[starter_price_id]" }
          }],
          current_period_start: [new period start],
          current_period_end: [new period end],
          metadata: { orgId: "...", tier: "starter" }
        }
      }
    }

15. Refresh billing page
    ✓ Success:
    - Tier badge: "Starter"
    - Credits: 50/50 small (reset for new period)
    - New billing period dates
    - Warning banner gone
    ✗ Fail:
    - Still showing "Pro"
    - Credits not reset
    - Old period dates

16. Verify database updated
    Query: SELECT * FROM subscriptions WHERE org_id = '[org-id]';
    ✓ Success:
    - plan_tier = 'starter'
    - cancel_at_period_end = false
    - current_period_start = [new date]
    ✗ Fail:
    - plan_tier still 'pro'
    - Dates not updated

    Query: SELECT * FROM credit_balances WHERE org_id = '[org-id]';
    ✓ Success:
    - included_small = 50
    - used_small = 0 (reset)
    - billing_period_start = [new period]
    ✗ Fail:
    - Old credit amounts
    - Usage not reset

17. Check Stripe Dashboard
    ✓ Success:
    - Subscription price: $9.99/month (Starter)
    - No pending changes
    - Next invoice: $9.99
    ✗ Fail:
    - Still shows $99/month

Part F: Verify Pro-rated Refund
18. Check Stripe invoice
    Stripe → Invoices → [latest]
    ✓ Success:
    - Line item: Pro tier (prorated): -$XX.XX
    - Line item: Starter tier: $9.99
    - Total: $9.99 - $XX.XX = $Y.YY
    ✗ Fail:
    - No proration
    - Charged full $99

19. Verify refund credit applied
    ✓ Success: Account balance shows credit or refund issued
    ✗ Fail: Customer charged full amount for both tiers

Part G: Post-Downgrade Usage
20. Attempt to use 51st small credit (exceeds Starter limit)
    ✓ Success:
    - Blocked with "Insufficient credits"
    - Upgrade prompt shown
    ✗ Fail:
    - Action proceeds (free usage)

EDGE CASES:

21. Downgrade with 0 usage
    - Pro tier, 0/500 credits used
    - Downgrade to Starter
    ✓ Success:
    - No warning about exceeding limits
    - Smooth transition
    ✗ Fail:
    - Error or warning shown incorrectly

22. Downgrade then upgrade before period end
    - Schedule downgrade to Starter
    - Change mind and upgrade back to Pro
    ✓ Success:
    - Upgrade processed
    - Downgrade cancelled
    - Remains on Pro
    ✗ Fail:
    - Both changes apply (data corruption)
    - Stuck in pending state

23. Downgrade with active top-up credits
    - Pro tier with 500 top-up credits
    - Downgrade to Starter
    ✓ Success:
    - Top-up credits preserved
    - Can use after downgrade
    ✗ Fail:
    - Top-up credits lost

24. Payment failure during downgrade period
    - Scheduled downgrade to Starter
    - Payment method fails before period end
    ✓ Success:
    - Subscription paused or cancelled
    - Downgrade still applies
    - User notified
    ✗ Fail:
    - Stuck in Pro tier without payment

CLEANUP:
- Cancel test subscription
- Reset to known tier
- Clear pending changes
- Document refund amounts
```

---

## 8. Concurrent Credit Deduction

### Scenario: Multiple Simultaneous Actions

**Success Case:**
- Two actions triggered simultaneously
- Only available credits are deducted
- One succeeds, one fails with insufficient credits
- No race condition or double-deduction
- Database maintains consistency
- Final balance is mathematically correct

**Fail Case:**
- Both actions succeed despite insufficient credits
- Credits go negative
- One action deducts credits from the other
- Database deadlock or timeout
- Inconsistent state between tables

**Step-by-Step Test Instructions:**

```
SETUP:
1. Log in as free tier user
2. Reset credits to exactly 1 small credit (1/10)
3. Open browser in TWO separate tabs/windows
4. Both tabs navigate to dashboard
5. Open DevTools → Network in both tabs

TEST STEPS:

Part A: Simultaneous Trigger
1. In both tabs, prepare to trigger a small action
   Tab 1: Ready to click "Generate summary"
   Tab 2: Ready to click "Generate summary"
   ✓ Expected: Both tabs ready

2. Click both actions as simultaneously as possible
   Technique: Use two hands or click within 100ms
   ✓ Expected: Both actions start processing

3. Monitor Network tabs in both
   Tab 1: POST /api/billing/credits/check
   Tab 2: POST /api/billing/credits/check
   ✓ Success (proper race condition handling):
   - One tab: { allowed: true } → proceeds to deduct
   - Other tab: { allowed: false } → blocked
   ✗ Fail:
   - Both tabs: { allowed: true }
   - Both proceed to deduct

4. Check credit balance immediately
   Navigate to Settings → Billing
   ✓ Success: Credits show 0/10 (not negative)
   ✗ Fail: Credits show -1/10 or still 1/10

5. Verify database state
   Query: SELECT * FROM credit_balances WHERE org_id = '[org-id]';
   ✓ Success: used_small = 1
   ✗ Fail: used_small = 0 or 2

6. Check billable_actions table
   Query: SELECT COUNT(*) FROM billable_actions
          WHERE org_id = '[org-id]'
          AND created_at > NOW() - INTERVAL 1 MINUTE;
   ✓ Success: Returns 1 (only one action recorded)
   ✗ Fail: Returns 0 or 2

Part B: Verify Error Handling
7. Check the tab that was blocked
   ✓ Success:
   - Error modal: "Insufficient credits"
   - Action did not complete
   - No results shown
   ✗ Fail:
   - Action completed
   - Results displayed

8. Check the tab that succeeded
   ✓ Success:
   - Action completed normally
   - Results displayed
   - No error
   ✗ Fail:
   - Action failed
   - Error shown

Part C: Three-Way Race Condition
9. Reset credits to 2 small credits (2/10)

10. Open THREE tabs

11. Trigger small action in all three simultaneously
    ✓ Success:
    - 2 actions succeed (2 credits available)
    - 1 action blocked
    - Final balance: 0/10
    ✗ Fail:
    - All 3 succeed (balance: -1/10)
    - Only 1 succeeds (1 credit unused)
    - Random failures

Part D: Different Action Tiers (Cross-tier Race)
12. Set credits to: 1 small, 1 medium, 1 large, 1 xl

13. Open FOUR tabs, each triggering different tier:
    Tab 1: Small action
    Tab 2: Medium action
    Tab 3: Large action
    Tab 4: XL action

14. Trigger all four simultaneously
    ✓ Success:
    - All 4 succeed (different credit pools)
    - Small: 1 → 0
    - Medium: 1 → 0
    - Large: 1 → 0
    - XL: 1 → 0
    ✗ Fail:
    - Any cross-contamination
    - Credits deducted from wrong tier

Part E: Database Lock Testing
15. Set credits to 10 small

16. Script/tool to send 100 concurrent requests
    Endpoint: POST /api/billing/credits/deduct
    Payload: { orgId: "...", userId: "...", actionTier: "small" }

17. Execute concurrent requests
    ✓ Success:
    - Exactly 10 succeed (10 credits available)
    - 90 fail with insufficient credits
    - No database errors
    - Final balance: 0/10
    ✗ Fail:
    - More than 10 succeed (negative credits)
    - Database deadlock errors
    - Timeouts

18. Check database transaction logs (if available)
    ✓ Success: No deadlocks, rollbacks successful
    ✗ Fail: Deadlock errors or lock timeouts

Part F: Webhook + API Race
19. Setup: 9/10 small credits used

20. Trigger small action via UI
    Simultaneously: Trigger webhook that adds credits

21. Verify final state
    ✓ Success:
    - Action completes with old credit count OR
    - Action uses new credit count
    - State consistent (no partial updates)
    ✗ Fail:
    - Credits counted twice
    - Inconsistent state

EDGE CASES:

22. Network delay variation
    - Trigger actions with different network speeds
    - Tab 1: Normal connection
    - Tab 2: Slow 3G (throttled in DevTools)
    ✓ Success:
    - First to complete deducts credit
    - Slower request blocked
    ✗ Fail:
    - Race condition based on request timing

23. API retry mechanism
    - Trigger action
    - API times out
    - Client retries automatically
    ✓ Success:
    - Idempotency key prevents double-deduction
    - Credit only deducted once
    ✗ Fail:
    - Retry deducts credit again

CLEANUP:
- Reset credits to full amount
- Clear any stuck transactions
- Verify database consistency
- Document race condition behavior
```

---

## 9. Webhook Processing

### Scenario: Stripe Webhook Event Handling

**Success Case:**
- Webhook received with valid signature
- Event logged in webhook_events table
- Subscription/payment status updated
- Database changes committed atomically
- Idempotent (duplicate webhooks ignored)
- User state reflects changes immediately

**Fail Case:**
- Invalid signature allows spoofed webhooks
- Event processed multiple times (not idempotent)
- Database update fails mid-process
- Webhook logged but no action taken
- User charged but subscription not activated

**Step-by-Step Test Instructions:**

```
SETUP:
1. Access to Stripe Dashboard (test mode)
2. Access to application server logs
3. Access to database query tool
4. Webhook endpoint: POST http://localhost:3003/api/webhooks/stripe
5. Stripe CLI installed (optional, for webhook testing)

TEST STEPS:

Part A: Subscription Created Webhook
1. Create subscription via Stripe Dashboard
   Stripe → Customers → Create → Add subscription
   Customer email: webhook-test@example.com
   Plan: Starter ($9.99)

2. Stripe automatically sends webhook
   Event type: customer.subscription.created

3. Check application logs
   ✓ Success:
   - Log: "[Stripe Webhook] Received event: customer.subscription.created (evt_xxx)"
   - Log: "[Stripe Webhook] Updated subscription for org xxx, status: active"
   ✗ Fail:
   - No webhook received
   - Error in logs

4. Verify webhook_events table
   Query: SELECT * FROM webhook_events
          WHERE event_type = 'customer.subscription.created'
          ORDER BY created_at DESC LIMIT 1;
   ✓ Success:
   - stripe_event_id = evt_xxx
   - processed = 1
   - processed_at NOT NULL
   - error IS NULL
   ✗ Fail:
   - No record found
   - processed = 0
   - error has value

5. Verify subscriptions table updated
   Query: SELECT * FROM subscriptions WHERE stripe_subscription_id = 'sub_xxx';
   ✓ Success:
   - Record exists
   - status = 'active' or 'trialing'
   - plan_tier matches Stripe
   ✗ Fail:
   - No record
   - Wrong status

6. Verify organizations table updated
   Query: SELECT subscription_status FROM organizations WHERE id = '[org-id]';
   ✓ Success: subscription_status = 'active'
   ✗ Fail: Still 'incomplete' or NULL

Part B: Payment Succeeded Webhook
7. In Stripe Dashboard, trigger payment
   Invoices → [invoice] → Pay

8. Webhook sent: invoice.payment_succeeded

9. Check logs
   ✓ Success: "[Stripe Webhook] Invoice paid for subscription sub_xxx"
   ✗ Fail: No log entry

10. If subscription was past_due, verify status updated
    Query: SELECT status FROM subscriptions WHERE stripe_subscription_id = 'sub_xxx';
    ✓ Success: status changed to 'active'
    ✗ Fail: Still 'past_due'

Part C: Payment Failed Webhook
11. In Stripe, simulate failed payment
    Use declining test card: 4000 0000 0000 0002

12. Webhook sent: invoice.payment_failed

13. Verify subscription status
    ✓ Success:
    - status = 'past_due'
    - User receives email notification
    ✗ Fail:
    - Status unchanged
    - No notification

Part D: Subscription Updated Webhook
14. In Stripe, change subscription plan
    Starter → Pro

15. Webhook sent: customer.subscription.updated

16. Verify database reflects change
    Query: SELECT plan_tier FROM subscriptions WHERE stripe_subscription_id = 'sub_xxx';
    ✓ Success: plan_tier = 'pro'
    ✗ Fail: Still 'starter'

17. Verify credit_balances updated
    Query: SELECT included_small FROM credit_balances WHERE org_id = '[org-id]';
    ✓ Success: included_small = 500 (Pro tier amount)
    ✗ Fail: Still 50 (Starter amount)

Part E: Idempotency Testing
18. Get webhook event ID from Stripe
    Stripe → Developers → Webhooks → Recent events
    Event ID: evt_xxx

19. Manually replay webhook via Stripe CLI:
    stripe events resend evt_xxx

20. Check webhook_events table
    Query: SELECT COUNT(*) FROM webhook_events WHERE stripe_event_id = 'evt_xxx';
    ✓ Success: Returns 1 (duplicate not logged)
    ✗ Fail: Returns 2+ (duplicate processed)

21. Verify subscription not double-updated
    ✓ Success: No changes to subscription
    ✗ Fail: Subscription modified by duplicate

Part F: Invalid Signature Rejection
22. Craft fake webhook request
    Use curl or Postman:
    POST http://localhost:3003/api/webhooks/stripe
    Headers:
      stripe-signature: fake_signature_12345
    Body: {
      "type": "customer.subscription.created",
      "data": { ... }
    }

23. Submit request
    ✓ Success:
    - Response: 400 Bad Request
    - Body: { error: "Invalid signature" }
    - Webhook NOT processed
    - No database changes
    ✗ Fail:
    - Request accepted
    - Webhook processed
    - Database updated from fake webhook

Part G: Missing Signature Rejection
24. Send webhook without signature header
    POST http://localhost:3003/api/webhooks/stripe
    Headers: (no stripe-signature)
    Body: { ... }

25. Verify rejection
    ✓ Success: 400 error, "Missing signature"
    ✗ Fail: Accepted without signature

Part H: Webhook Processing Failure
26. Manually create corrupt webhook scenario:
    - Webhook references non-existent organization
    - Event has org_id: 'invalid-org-123'

27. Send webhook (via Stripe CLI or manual trigger)

28. Check webhook_events table
    Query: SELECT * FROM webhook_events WHERE stripe_event_id = 'evt_xxx';
    ✓ Success:
    - processed = 1
    - error = "Organization not found" or similar
    - processed_at NOT NULL
    ✗ Fail:
    - processed = 0
    - System crashed
    - No error logged

Part I: Webhook Retry Mechanism
29. Simulate temporary database failure
    (Stop database, send webhook, restart database)

30. Verify Stripe retries webhook
    Stripe automatically retries failed webhooks

31. Check that eventual success is logged
    ✓ Success:
    - First attempt: Failed (in Stripe dashboard)
    - Retry attempt: Succeeded
    - Database eventually consistent
    ✗ Fail:
    - Never succeeds
    - Webhook endpoint marked as failed

Part J: Webhook Order (Out of Order Arrival)
32. Create subscription in Stripe
    Events generated:
    1. customer.subscription.created
    2. invoice.created
    3. payment_intent.created
    4. payment_intent.succeeded
    5. invoice.payment_succeeded

33. Due to network, webhooks arrive out of order:
    Actual arrival: 5, 3, 1, 4, 2

34. Verify system handles gracefully
    ✓ Success:
    - All webhooks processed
    - Final state consistent
    - No errors due to ordering
    ✗ Fail:
    - Earlier webhooks fail due to missing data
    - Inconsistent state

EDGE CASES:

35. Webhook for deleted organization
    ✓ Success: Logged with error, no crash
    ✗ Fail: System error or crash

36. Malformed webhook body
    ✓ Success: 400 error, rejected gracefully
    ✗ Fail: Server crash

37. Extremely delayed webhook (arrives days later)
    ✓ Success:
    - Processed if still valid
    - Idempotency prevents issues
    ✗ Fail:
    - Overwrites current state
    - Data corruption

38. Webhook during database maintenance
    ✓ Success: Returns 503, Stripe retries later
    ✗ Fail: Data loss or corruption

CLEANUP:
- Delete test subscriptions from Stripe
- Clear webhook_events test data
- Reset test organizations
- Document webhook processing times
```

---

## 10. Trial Expiration

### Scenario: 7-Day Trial Ending and Conversion

**Success Case:**
- Trial ends exactly 7 days after start
- User receives reminder email 3 days before
- On expiration, payment method charged
- Subscription converts to active
- User maintains access without interruption
- Trial-to-paid conversion tracked

**Fail Case:**
- Trial never ends (free access indefinitely)
- Charged immediately instead of after 7 days
- Payment fails, user loses access mid-use
- No reminder email sent
- Subscription cancelled instead of activated
- Access lost despite successful payment

**Step-by-Step Test Instructions:**

```
SETUP:
1. New test user with no subscription
2. Valid payment method ready
3. Ability to mock/advance system date
4. Access to email testing
5. Stripe Dashboard access

TEST STEPS:

Part A: Start Trial
1. Sign up for Starter plan with trial
   Use card: 4242 4242 4242 4242

2. Verify trial details
   Settings → Billing
   ✓ Success:
   - Status badge: "Trialing"
   - Banner: "Trial ends on [date 7 days from now]"
   - Credits: 50/20/10/5 (Starter amounts)
   ✗ Fail:
   - Status: "Active" (no trial)
   - Wrong trial end date
   - Free tier credits

3. Check database
   Query: SELECT trial_end, status FROM subscriptions WHERE org_id = '[org-id]';
   ✓ Success:
   - trial_end = [7 days from now]
   - status = 'trialing'
   ✗ Fail:
   - trial_end IS NULL
   - status = 'active'

4. Verify Stripe subscription
   Stripe → Subscriptions → [subscription]
   ✓ Success:
   - Status: Trialing
   - Trial ends: [date]
   - Next payment: [7 days from now]
   ✗ Fail:
   - Status: Active
   - Charged immediately

Part B: During Trial Period (Day 1-3)
5. Use credits normally
   Perform 10 small actions
   ✓ Success:
   - Actions complete
   - Credits deduct: 50 → 40
   - Status still "Trialing"
   ✗ Fail:
   - Actions blocked
   - Trial ended early

6. Verify no charges
   Stripe → Payments
   ✓ Success: $0 charged so far
   ✗ Fail: Charged $9.99

Part C: Trial Ending Soon (Day 4-5)
7. Mock system date to 3 days before trial end
   OR wait 4 days (not practical)

8. Check for reminder email
   Subject: "Your trial ends in 3 days"
   ✓ Success:
   - Email received
   - Contains: trial end date, upgrade/cancel options
   - Link to manage subscription
   ✗ Fail:
   - No email received
   - Wrong information

9. Verify webhook triggered
   Event: customer.subscription.trial_will_end
   Query: SELECT * FROM webhook_events
          WHERE event_type = 'customer.subscription.trial_will_end';
   ✓ Success: Event logged and processed
   ✗ Fail: No webhook received

Part D: Trial Expiration (Day 7)
10. Mock system date to trial end date
    OR wait 7 days

11. Stripe automatically processes payment

12. Check for webhook
    Event: invoice.payment_succeeded
    ✓ Success: Webhook received and processed
    ✗ Fail: No webhook

13. Verify subscription status updated
    Query: SELECT status, trial_end FROM subscriptions WHERE org_id = '[org-id]';
    ✓ Success:
    - status = 'active'
    - trial_end = [original date, now in past]
    ✗ Fail:
    - status still 'trialing'
    - trial_end updated to future date

14. Check billing page
    ✓ Success:
    - Status badge: "Active"
    - No trial banner
    - Next billing: [30 days from now]
    ✗ Fail:
    - Still shows "Trialing"
    - Trial banner persists

15. Verify payment in Stripe
    Stripe → Payments
    ✓ Success:
    - Payment: $9.99
    - Status: Succeeded
    - Description: "Subscription creation"
    ✗ Fail:
    - No payment
    - Payment failed

16. Check user access
    Trigger action
    ✓ Success:
    - Action completes normally
    - No interruption
    ✗ Fail:
    - Action blocked
    - Access lost

17. Verify confirmation email
    Subject: "Payment received - Subscription active"
    ✓ Success:
    - Email received
    - Invoice attached/linked
    - Next billing date shown
    ✗ Fail:
    - No email
    - Wrong information

Part E: Failed Payment at Trial End
18. Create new trial subscription

19. Before trial ends, remove payment method in Stripe

20. Wait for trial to end

21. Verify failed payment handling
    ✓ Success:
    - Status: 'past_due'
    - Email: "Payment failed - Please update payment method"
    - Grace period applied (if configured)
    - User can still access for X days
    ✗ Fail:
    - Subscription immediately cancelled
    - Access lost instantly
    - No notification

22. Check Stripe invoice
    ✓ Success:
    - Status: Payment failed
    - Retry scheduled
    ✗ Fail:
    - No invoice created

23. Add valid payment method

24. Verify retry succeeds
    ✓ Success:
    - Payment processed on retry
    - Status: 'active'
    - Access maintained
    ✗ Fail:
    - Subscription cancelled
    - Must create new subscription

Part F: Cancel During Trial
25. Create new trial subscription

26. On day 3, cancel subscription
    Click "Cancel Subscription"

27. Verify cancellation behavior
    ✓ Success:
    - Trial continues until day 7
    - No charge at trial end
    - Status changes to 'canceled' on day 7
    - User has access until end of trial
    ✗ Fail:
    - Access lost immediately
    - Charged despite cancellation

28. At trial end, verify cleanup
    ✓ Success:
    - Status: 'canceled'
    - No payment attempted
    - Downgraded to free tier
    ✗ Fail:
    - Still shows as trialing
    - Payment attempted

EDGE CASES:

29. Change plan during trial
    - Start trial on Starter
    - Upgrade to Pro on day 3
    ✓ Success:
    - New trial starts for Pro
    - OR Pro trial extends to day 7
    - Credits updated to Pro amounts
    ✗ Fail:
    - Trial ends immediately
    - Charged for both plans

30. Trial with auto top-up enabled
    - Enable auto top-up during trial
    - Use credits below threshold
    ✓ Success:
    - Auto top-up works during trial
    - Separate charge for credits
    ✗ Fail:
    - Auto top-up blocked
    - Credits not added

31. Timezone handling
    - User in UTC+12
    - Server in UTC-8
    ✓ Success:
    - Trial ends at same absolute time
    - Display adjusted for timezone
    ✗ Fail:
    - Trial ends at wrong time
    - Confusion about exact end

32. Leap year trial (Feb 29)
    ✓ Success: Handles date arithmetic correctly
    ✗ Fail: Date calculation error

CLEANUP:
- Cancel test subscriptions
- Refund any test charges
- Delete trial webhooks from test data
- Reset system date if mocked
- Document conversion rate
```

---

## Testing Tools & Resources

### Stripe Test Cards

```
Success: 4242 4242 4242 4242
Decline: 4000 0000 0000 0002
Insufficient funds: 4000 0000 0000 9995
Expired: 4000 0000 0000 0069
3D Secure required: 4000 0025 0000 3155
Processing error: 4000 0000 0000 0119
```

### Database Query Templates

```sql
-- Check subscription
SELECT * FROM subscriptions WHERE org_id = '[org-id]';

-- Check credits
SELECT * FROM credit_balances WHERE org_id = '[org-id]';

-- Check usage
SELECT * FROM billable_actions
WHERE org_id = '[org-id]'
ORDER BY created_at DESC LIMIT 10;

-- Check webhooks
SELECT * FROM webhook_events
WHERE stripe_event_id = '[event-id]';

-- Check purchases
SELECT * FROM credit_purchases
WHERE org_id = '[org-id]'
ORDER BY created_at DESC;
```

### API Testing with cURL

```bash
# Check credits
curl -X POST http://localhost:3003/api/billing/credits/check \
  -H "Authorization: Bearer <SERVICE_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"orgId":"org-123","actionTier":"small"}'

# Get subscription
curl -X GET "http://localhost:3003/api/billing/subscription?orgId=org-123" \
  -H "Authorization: Bearer <SERVICE_TOKEN>"

# Simulate webhook
curl -X POST http://localhost:3003/api/webhooks/stripe \
  -H "stripe-signature: <computed-signature>" \
  -H "Content-Type: application/json" \
  -d @webhook-payload.json
```

### Stripe CLI Commands

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local
stripe listen --forward-to localhost:3003/api/webhooks/stripe

# Trigger test webhooks
stripe trigger customer.subscription.created
stripe trigger invoice.payment_succeeded
stripe trigger payment_intent.succeeded

# Resend specific event
stripe events resend evt_xxx
```

---

## Test Reporting Template

```
Test Session Report
Date: [YYYY-MM-DD]
Tester: [Name]
Environment: Development / Staging / Production
Browser: Chrome 120 / Safari 17 / Firefox 121

Scenarios Tested:
✅ [1] Free Tier User Journey - PASSED
✅ [2] Credit Usage and Deduction - PASSED
❌ [3] Subscription Upgrade Flow - FAILED
   - Issue: Stripe checkout doesn't load on Safari
   - Steps to reproduce: [detailed steps]
   - Expected: Checkout modal appears
   - Actual: Blank screen
⏸️  [4] Insufficient Credits Error - BLOCKED
   - Blocker: Need test user with 0 credits

Critical Issues Found: 1
Medium Issues Found: 0
Low Issues Found: 0

Notes:
- All tests performed in test mode
- Database: vivid_dev
- All test data cleaned up
```

---

## Appendix: Common Issues & Solutions

### Issue: Webhook not received
**Solution:**
- Check Stripe webhook endpoint URL is correct
- Verify webhook secret in environment variables
- Use Stripe CLI to forward webhooks locally
- Check server firewall/CORS settings

### Issue: Credits go negative
**Solution:**
- Check database transaction isolation level
- Implement optimistic locking
- Add database constraint: `CHECK (used_small <= included_small + topup_credits)`

### Issue: Duplicate subscriptions created
**Solution:**
- Implement idempotency keys
- Check for existing subscription before creating
- Use database unique constraint on org_id

### Issue: Payment succeeds but subscription not activated
**Solution:**
- Check webhook processing logs
- Verify webhook events table has processed=true
- Manually trigger webhook processing
- Check for database transaction rollbacks

---

**End of Test Scenarios Document**

*Last Updated: 2025-01-16*
*Version: 1.0*
*Maintained by: Engineering Team*
