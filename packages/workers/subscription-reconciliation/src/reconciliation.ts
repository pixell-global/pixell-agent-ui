/**
 * Subscription Reconciliation Logic
 *
 * ARCHITECTURE NOTE FOR AI AGENTS:
 * ================================
 * Stripe is the Single Source of Truth (SSoT) for subscription data.
 * Our database is a READ-OPTIMIZED CACHE that must stay in sync with Stripe.
 *
 * Sync Mechanisms:
 * 1. PRIMARY: Webhooks (apps/web/src/app/api/webhooks/stripe/route.ts)
 *    - Real-time updates when Stripe events occur
 *    - Handles: checkout.session.completed, customer.subscription.*, invoice.*
 *
 * 2. BACKUP: This Lambda function (runs Sundays 3am UTC)
 *    - Catches missed webhook events (network failures, downtime, bugs)
 *    - Reconciles drift caused by manual Stripe dashboard changes
 *    - Ensures eventual consistency
 *
 * 3. CONFLICT RESOLUTION: Stripe ALWAYS wins
 *    - If DB says "Free" and Stripe says "Pro" → Update DB to "Pro"
 *    - Never update Stripe based on DB state (except user-initiated actions)
 *
 * Database Tables Synced:
 * - subscriptions (packages/db-mysql/schema.ts)
 * - organizations (subscription tier and status fields)
 */

import Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import type { MySql2Database } from 'drizzle-orm/mysql2';
import { subscriptions, organizations } from '@pixell/db-mysql/schema';
import type {
  ReconciliationResult,
  ReconciliationDetail,
  SubscriptionChanges,
} from './types';

/**
 * Reconcile all active organizations' subscriptions with Stripe
 */
export async function reconcileAllSubscriptions(
  db: MySql2Database<any>,
  stripe: Stripe
): Promise<ReconciliationResult> {
  console.log('[Reconciliation] Starting subscription reconciliation');

  const result: ReconciliationResult = {
    totalOrganizations: 0,
    synchronized: 0,
    errors: 0,
    skipped: 0,
    details: [],
  };

  try {
    // Get all subscriptions with organization data (including org's stripe_customer_id as fallback)
    const allSubscriptions = await db
      .select({
        id: subscriptions.id,
        orgId: subscriptions.orgId,
        stripeSubscriptionId: subscriptions.stripeSubscriptionId,
        stripeCustomerId: subscriptions.stripeCustomerId,
        planTier: subscriptions.planTier,
        status: subscriptions.status,
        // Fallback to organization's stripe_customer_id if subscription doesn't have one
        orgStripeCustomerId: organizations.stripeCustomerId,
      })
      .from(subscriptions)
      .leftJoin(organizations, eq(subscriptions.orgId, organizations.id));

    result.totalOrganizations = allSubscriptions.length;

    console.log(`[Reconciliation] Found ${allSubscriptions.length} subscriptions to check`);

    for (const dbSub of allSubscriptions) {
      try {
        // Use subscription's customer ID if available, otherwise use organization's
        const effectiveCustomerId = dbSub.stripeCustomerId || dbSub.orgStripeCustomerId;
        const enrichedSub = {
          ...dbSub,
          stripeCustomerId: effectiveCustomerId,
        };

        const detail = await reconcileSingleSubscription(db, stripe, enrichedSub);
        result.details.push(detail);

        if (detail.action === 'synced') {
          result.synchronized++;
        } else if (detail.action === 'skipped') {
          result.skipped++;
        }
      } catch (error) {
        result.errors++;
        result.details.push({
          orgId: dbSub.orgId,
          action: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        console.error(`[Reconciliation] Error reconciling org ${dbSub.orgId}:`, error);
      }
    }

    console.log('[Reconciliation] Completed:', {
      total: result.totalOrganizations,
      synchronized: result.synchronized,
      skipped: result.skipped,
      errors: result.errors,
    });

    return result;
  } catch (error) {
    console.error('[Reconciliation] Fatal error:', error);
    throw error;
  }
}

/**
 * Reconcile a single organization's subscription
 */
async function reconcileSingleSubscription(
  db: MySql2Database<any>,
  stripe: Stripe,
  dbSub: any
): Promise<ReconciliationDetail> {
  const { orgId, stripeSubscriptionId, stripeCustomerId } = dbSub;

  // Skip free tier organizations without Stripe data
  if (!stripeSubscriptionId && !stripeCustomerId) {
    return {
      orgId,
      action: 'skipped',
    };
  }

  // Fetch current state from Stripe (SSoT)
  let stripeSubscription: Stripe.Subscription | null = null;

  if (stripeSubscriptionId) {
    try {
      stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    } catch (error: any) {
      // Subscription deleted in Stripe but still in our DB
      if (error.code === 'resource_missing') {
        console.log(`[Reconciliation] Subscription ${stripeSubscriptionId} deleted in Stripe, cleaning up DB`);
        await markSubscriptionAsCanceled(db, orgId);
        return {
          orgId,
          action: 'synced',
          changes: [{ field: 'status', from: dbSub.status, to: 'canceled' }],
        };
      }
      throw error;
    }
  } else if (stripeCustomerId) {
    // No subscription ID, but has customer - check if customer has active subscription
    const subscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: 'all',
      limit: 1,
    });
    stripeSubscription = subscriptions.data[0] || null;
  }

  // No subscription found in Stripe
  if (!stripeSubscription) {
    return {
      orgId,
      action: 'skipped',
    };
  }

  // Compare DB state with Stripe state
  const changes = detectChanges(dbSub, stripeSubscription);

  if (changes.length === 0) {
    // Already in sync
    return {
      orgId,
      action: 'skipped',
    };
  }

  // Update DB to match Stripe
  console.log(`[Reconciliation] Syncing org ${orgId}:`, changes);
  await updateSubscriptionFromStripe(db, orgId, stripeSubscription);

  return {
    orgId,
    action: 'synced',
    changes,
  };
}

/**
 * Detect differences between DB and Stripe data
 */
function detectChanges(dbSub: any, stripeSub: Stripe.Subscription): SubscriptionChanges[] {
  const changes: SubscriptionChanges[] = [];
  const sub = stripeSub as any;

  // Check tier
  const stripeTier = sub.metadata?.tier || 'starter';
  if (dbSub.planTier !== stripeTier) {
    changes.push({ field: 'planTier', from: dbSub.planTier, to: stripeTier });
  }

  // Check status
  if (dbSub.status !== stripeSub.status) {
    changes.push({ field: 'status', from: dbSub.status, to: stripeSub.status });
  }

  // Check subscription ID
  if (dbSub.stripeSubscriptionId !== stripeSub.id) {
    changes.push({ field: 'stripeSubscriptionId', from: dbSub.stripeSubscriptionId, to: stripeSub.id });
  }

  // Check customer ID
  const customerId = typeof stripeSub.customer === 'string' ? stripeSub.customer : stripeSub.customer.id;
  if (dbSub.stripeCustomerId !== customerId) {
    changes.push({ field: 'stripeCustomerId', from: dbSub.stripeCustomerId, to: customerId });
  }

  // Check cancel_at_period_end
  if (dbSub.cancelAtPeriodEnd !== sub.cancel_at_period_end) {
    changes.push({
      field: 'cancelAtPeriodEnd',
      from: dbSub.cancelAtPeriodEnd,
      to: sub.cancel_at_period_end,
    });
  }

  return changes;
}

/**
 * Update database subscription to match Stripe data
 */
async function updateSubscriptionFromStripe(
  db: MySql2Database<any>,
  orgId: string,
  stripeSub: Stripe.Subscription
): Promise<void> {
  const sub = stripeSub as any;
  const tier = sub.metadata?.tier || 'starter';
  const customerId = typeof stripeSub.customer === 'string' ? stripeSub.customer : stripeSub.customer.id;

  // Update subscriptions table
  await db
    .update(subscriptions)
    .set({
      planTier: tier as any,
      status: stripeSub.status as any,
      stripeSubscriptionId: stripeSub.id,
      stripePriceId: sub.items?.data?.[0]?.price?.id || null,
      stripeCustomerId: customerId,
      currentPeriodStart: new Date(sub.current_period_start * 1000),
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
      trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
      cancelAtPeriodEnd: sub.cancel_at_period_end || false,
      canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
      endedAt: sub.ended_at ? new Date(sub.ended_at * 1000) : null,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.orgId, orgId));

  // Update organizations table
  await db
    .update(organizations)
    .set({
      subscriptionTier: tier as any,
      subscriptionStatus: stripeSub.status as any,
      trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
    })
    .where(eq(organizations.id, orgId));

  console.log(`[Reconciliation] Updated org ${orgId} to tier: ${tier}, status: ${stripeSub.status}`);
}

/**
 * Mark subscription as canceled in database
 */
async function markSubscriptionAsCanceled(db: MySql2Database<any>, orgId: string): Promise<void> {
  await db
    .update(subscriptions)
    .set({
      status: 'canceled',
      endedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.orgId, orgId));

  await db
    .update(organizations)
    .set({
      subscriptionTier: 'free',
      subscriptionStatus: 'canceled',
    })
    .where(eq(organizations.id, orgId));
}
