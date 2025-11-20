import { NextRequest, NextResponse } from 'next/server'
import { verifySessionCookie } from '@pixell/auth-firebase/server'
import { getDb, organizations, organizationMembers } from '@pixell/db-mysql'
import { and, eq } from 'drizzle-orm'
import { getStripePriceId, isValidTier, type SubscriptionTier } from '@/lib/billing/stripe-config'
import { getSubscription, updateSubscription } from '@/lib/billing/subscription-manager'

// Placeholder: integrate Stripe SDK if configured via env
const getStripe = () => {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  // Lazy require to avoid bundling in Edge-unfriendly contexts
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Stripe = require('stripe')
  return new Stripe(key, { apiVersion: '2025-10-29.clover' })
}

async function getCurrentUserOrg(userId: string): Promise<string | null> {
  const db = await getDb()
  const memberships = await db
    .select({ orgId: organizationMembers.orgId, role: organizationMembers.role })
    .from(organizationMembers)
    .where(and(eq(organizationMembers.userId, userId), eq(organizationMembers.isDeleted, 0)))
    .orderBy(organizationMembers.role) // owner/admin first

  return memberships[0]?.orgId || null
}

export async function POST(request: NextRequest) {
  try {
    const cookieName = process.env.SESSION_COOKIE_NAME || 'session'
    const sessionCookie = request.cookies.get(cookieName)?.value
    if (!sessionCookie) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const decoded = await verifySessionCookie(sessionCookie)

    const { tier, isDowngrade, cancelDowngrade } = await request.json()
    if (!tier) return NextResponse.json({ error: 'Tier is required' }, { status: 400 })

    // Validate tier
    if (!isValidTier(tier)) {
      return NextResponse.json({ error: 'Invalid tier. Must be one of: free, starter, pro, max' }, { status: 400 })
    }

    // Free tier doesn't need checkout
    if (tier === 'free') {
      return NextResponse.json({ error: 'Free tier does not require checkout' }, { status: 400 })
    }

    // Get user's organization
    const orgId = await getCurrentUserOrg(decoded.sub)
    if (!orgId) return NextResponse.json({ error: 'User not in any organization' }, { status: 400 })

    const stripe = getStripe()
    if (!stripe) return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })

    const db = await getDb()

    // Check user has owner or admin role
    const member = await db
      .select({ role: organizationMembers.role })
      .from(organizationMembers)
      .where(and(eq(organizationMembers.orgId, orgId), eq(organizationMembers.userId, decoded.sub), eq(organizationMembers.isDeleted, 0)))
      .limit(1)
    const role = member[0]?.role as any
    if (!role || (role !== 'owner' && role !== 'admin')) {
      return NextResponse.json({ error: 'Only organization owners and admins can manage billing' }, { status: 403 })
    }

    const orgRows = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1)
    const org = orgRows[0]
    if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })

    // Ensure customer
    let customerId = org.stripeCustomerId as string | null
    if (!customerId) {
      const cust = await stripe.customers.create({
        name: org.name,
        email: decoded.email || undefined,
      })
      customerId = cust.id
      await db.update(organizations).set({ stripeCustomerId: customerId }).where(eq(organizations.id, orgId))
    }

    // Check if organization already has an active subscription
    const existingSubscription = await getSubscription(orgId)

    // If user already has an active Stripe subscription, handle upgrade/downgrade
    if (existingSubscription && existingSubscription.stripeSubscriptionId && existingSubscription.status === 'active') {
      console.log(`[Billing Checkout] Organization ${orgId} already has active subscription, ${cancelDowngrade ? 'canceling scheduled downgrade' : isDowngrade ? 'scheduling downgrade' : 'upgrading'} from ${existingSubscription.planTier} to ${tier}`)

      try {
        if (cancelDowngrade) {
          // Cancel scheduled downgrade
          const subscription = await stripe.subscriptions.retrieve(existingSubscription.stripeSubscriptionId)

          await stripe.subscriptions.update(existingSubscription.stripeSubscriptionId, {
            metadata: {
              ...subscription.metadata,
              scheduled_tier: '', // Clear scheduled downgrade
            },
          })

          console.log(`[Billing Checkout] Canceled scheduled downgrade for org ${orgId}`)

          return NextResponse.json({
            success: true,
            message: 'Scheduled downgrade canceled successfully',
          })
        } else if (isDowngrade) {
          // For downgrades: Schedule the change for end of period
          const subscription = await stripe.subscriptions.retrieve(existingSubscription.stripeSubscriptionId)

          const previousScheduledTier = subscription.metadata.scheduled_tier

          await stripe.subscriptions.update(existingSubscription.stripeSubscriptionId, {
            metadata: {
              ...subscription.metadata,
              scheduled_tier: tier, // Store the scheduled downgrade tier (replaces any previous)
            },
          })

          if (previousScheduledTier && previousScheduledTier !== tier) {
            console.log(`[Billing Checkout] Updated scheduled downgrade from ${previousScheduledTier} to ${tier} for org ${orgId}`)
          } else {
            console.log(`[Billing Checkout] Scheduled downgrade to ${tier} at period end for org ${orgId}`)
          }

          return NextResponse.json({
            success: true,
            message: `Downgrade to ${tier} scheduled for end of billing period`,
            downgraded: true,
          })
        } else {
          // For upgrades: Immediate update with proration
          await updateSubscription({
            orgId,
            newTier: tier as SubscriptionTier,
            prorationBehavior: 'create_prorations', // Prorate the cost difference
          })

          // Clear any scheduled downgrade when user upgrades
          const subscription = await stripe.subscriptions.retrieve(existingSubscription.stripeSubscriptionId)
          if (subscription.metadata.scheduled_tier) {
            await stripe.subscriptions.update(existingSubscription.stripeSubscriptionId, {
              metadata: {
                ...subscription.metadata,
                scheduled_tier: '', // Clear scheduled downgrade
              },
            })
            console.log(`[Billing Checkout] Cleared scheduled downgrade for org ${orgId} after upgrade to ${tier}`)
          }

          return NextResponse.json({
            success: true,
            message: 'Subscription upgraded successfully',
            upgraded: true,
          })
        }
      } catch (updateError: any) {
        console.error('[Billing Checkout] Failed to update subscription:', updateError)
        return NextResponse.json({ error: updateError?.message || 'Failed to update subscription' }, { status: 500 })
      }
    }

    // No active subscription - create checkout session for new subscription
    console.log(`[Billing Checkout] Creating new checkout session for org ${orgId}, tier: ${tier}`)

    // Get Stripe price ID for the selected tier
    const priceId = getStripePriceId(tier as SubscriptionTier)
    if (!priceId) return NextResponse.json({ error: `Stripe price ID not configured for ${tier} tier` }, { status: 500 })

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3003'}/settings/billing?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3003'}/settings/billing?canceled=true`,
      metadata: { orgId, tier },
      // Pass metadata to the subscription that will be created
      subscription_data: {
        metadata: { orgId, tier },
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    console.error('[Billing Checkout] Error:', err)
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 })
  }
}


