/**
 * Credit Manager
 *
 * Handles credit balance tracking, deduction, and validation
 */

import { getDb } from '@pixell/db-mysql'
import { creditBalances, billableActions, organizations, subscriptions } from '@pixell/db-mysql/schema'
import { eq } from 'drizzle-orm'
import { ACTION_CREDIT_COSTS, type ActionTier, calculatePlanCredits, type SubscriptionTier } from './stripe-config'

export interface CreditBalance {
  orgId: string
  billingPeriodStart: Date
  billingPeriodEnd: Date
  includedSmall: number
  includedMedium: number
  includedLarge: number
  includedXl: number
  usedSmall: number
  usedMedium: number
  usedLarge: number
  usedXl: number
  topupCredits: string
  topupCreditsUsed: string
  autoTopupEnabled: boolean
  autoTopupThreshold: number
  autoTopupAmount: number
  lastWarning80At: Date | null
  lastWarning100At: Date | null
  lastResetAt: Date
  updatedAt: Date
}

export interface CreditCheckResult {
  allowed: boolean
  reason?: string
  remainingCredits?: {
    small: number
    medium: number
    large: number
    xl: number
    topup: number
  }
}

export interface CreditDeductionResult {
  success: boolean
  billableActionId?: number
  error?: string
  balanceAfter?: {
    small: number
    medium: number
    large: number
    xl: number
    topup: number
  }
}

/**
 * Get current credit balance for organization
 */
export async function getCreditBalance(orgId: string): Promise<CreditBalance | null> {
  const db = await getDb()
  const [balance] = await db
    .select()
    .from(creditBalances)
    .where(eq(creditBalances.orgId, orgId))
    .limit(1)

  if (!balance) {
    return null
  }

  return {
    ...balance,
    topupCredits: balance.topupCredits,
    topupCreditsUsed: balance.topupCreditsUsed,
    autoTopupEnabled: balance.autoTopupEnabled ?? false,
    lastWarning80At: balance.lastWarning80At ?? null,
    lastWarning100At: balance.lastWarning100At ?? null,
  }
}

/**
 * Initialize credit balance for a new organization
 */
export async function initializeCreditBalance(
  orgId: string,
  tier: SubscriptionTier,
  periodStart: Date,
  periodEnd: Date
): Promise<void> {
  const db = await getDb()
  const credits = calculatePlanCredits(tier)

  await db.insert(creditBalances).values({
    orgId,
    billingPeriodStart: periodStart,
    billingPeriodEnd: periodEnd,
    ...credits,
    usedSmall: 0,
    usedMedium: 0,
    usedLarge: 0,
    usedXl: 0,
    topupCredits: '0',
    topupCreditsUsed: '0',
    autoTopupEnabled: false,
    autoTopupThreshold: 50,
    autoTopupAmount: 500,
    lastResetAt: new Date(),
  })
}

/**
 * Check if organization has sufficient credits for an action
 */
export async function checkCredits(
  orgId: string,
  actionTier: ActionTier
): Promise<CreditCheckResult> {
  const balance = await getCreditBalance(orgId)

  if (!balance) {
    return {
      allowed: false,
      reason: 'No credit balance found. Please contact support.',
    }
  }

  // Check if we're in the current billing period
  const now = new Date()
  if (now < balance.billingPeriodStart || now > balance.billingPeriodEnd) {
    return {
      allowed: false,
      reason: 'Billing period mismatch. Please contact support.',
    }
  }

  // Calculate remaining tier-specific credits
  const remaining = {
    small: balance.includedSmall - balance.usedSmall,
    medium: balance.includedMedium - balance.usedMedium,
    large: balance.includedLarge - balance.usedLarge,
    xl: balance.includedXl - balance.usedXl,
    topup: parseFloat(balance.topupCredits) - parseFloat(balance.topupCreditsUsed),
  }

  // Check tier-specific credits first
  const tierKey = `${actionTier}` as 'small' | 'medium' | 'large' | 'xl'
  if (remaining[tierKey] > 0) {
    return {
      allowed: true,
      remainingCredits: remaining,
    }
  }

  // Check if we have top-up credits
  const creditCost = ACTION_CREDIT_COSTS[actionTier]
  if (remaining.topup >= creditCost) {
    return {
      allowed: true,
      remainingCredits: remaining,
    }
  }

  return {
    allowed: false,
    reason: `Insufficient credits for ${actionTier} action. Please upgrade your plan or purchase additional credits.`,
    remainingCredits: remaining,
  }
}

/**
 * Deduct credits for an action
 */
export async function deductCredits(
  orgId: string,
  userId: string,
  actionTier: ActionTier,
  metadata: {
    agentId?: string
    agentName?: string
    actionKey?: string
    description?: string
    idempotencyKey?: string
  }
): Promise<CreditDeductionResult> {
  const db = await getDb()
  const balance = await getCreditBalance(orgId)

  if (!balance) {
    return {
      success: false,
      error: 'No credit balance found',
    }
  }

  // Calculate credits to deduct
  const creditCost = ACTION_CREDIT_COSTS[actionTier]

  // Determine which credits to use (tier-specific first, then top-up)
  const remaining = {
    small: balance.includedSmall - balance.usedSmall,
    medium: balance.includedMedium - balance.usedMedium,
    large: balance.includedLarge - balance.usedLarge,
    xl: balance.includedXl - balance.usedXl,
    topup: parseFloat(balance.topupCredits) - parseFloat(balance.topupCreditsUsed),
  }

  let useTierCredits = false
  let useTopupCredits = false

  const tierKey = `${actionTier}` as 'small' | 'medium' | 'large' | 'xl'
  if (remaining[tierKey] > 0) {
    useTierCredits = true
  } else if (remaining.topup >= creditCost) {
    useTopupCredits = true
  } else {
    return {
      success: false,
      error: 'Insufficient credits',
    }
  }

  // Create billable action record
  const [billableAction] = await db
    .insert(billableActions)
    .values({
      orgId,
      userId,
      actionTier,
      creditsUsed: creditCost.toString(),
      agentId: metadata.agentId || null,
      agentName: metadata.agentName || null,
      actionKey: metadata.actionKey || null,
      description: metadata.description || null,
      metadata: metadata as any,
      billingPeriodStart: balance.billingPeriodStart,
      billingPeriodEnd: balance.billingPeriodEnd,
      idempotencyKey: metadata.idempotencyKey || null,
    })
    .$returningId()

  // Update credit balance atomically
  if (useTierCredits) {
    const updateField = `used${actionTier.charAt(0).toUpperCase()}${actionTier.slice(1)}` as
      | 'usedSmall'
      | 'usedMedium'
      | 'usedLarge'
      | 'usedXl'

    await db
      .update(creditBalances)
      .set({
        [updateField]: balance[updateField] + 1,
      })
      .where(eq(creditBalances.orgId, orgId))
  } else if (useTopupCredits) {
    const newTopupUsed = (parseFloat(balance.topupCreditsUsed) + creditCost).toFixed(2)

    await db
      .update(creditBalances)
      .set({
        topupCreditsUsed: newTopupUsed,
      })
      .where(eq(creditBalances.orgId, orgId))
  }

  // Get updated balance
  const updatedBalance = await getCreditBalance(orgId)
  const balanceAfter = updatedBalance
    ? {
        small: updatedBalance.includedSmall - updatedBalance.usedSmall,
        medium: updatedBalance.includedMedium - updatedBalance.usedMedium,
        large: updatedBalance.includedLarge - updatedBalance.usedLarge,
        xl: updatedBalance.includedXl - updatedBalance.usedXl,
        topup: parseFloat(updatedBalance.topupCredits) - parseFloat(updatedBalance.topupCreditsUsed),
      }
    : undefined

  // Check if auto top-up should trigger
  if (updatedBalance && updatedBalance.autoTopupEnabled && balanceAfter) {
    const totalRemainingCredits =
      balanceAfter.small + balanceAfter.medium + balanceAfter.large + balanceAfter.xl + balanceAfter.topup

    if (totalRemainingCredits < updatedBalance.autoTopupThreshold) {
      // Trigger auto top-up in the background (don't await to avoid blocking the deduction response)
      triggerAutoTopup(orgId, updatedBalance.autoTopupAmount).catch((error) => {
        console.error(`[Auto Top-up] Failed to trigger auto top-up for org ${orgId}:`, error)
      })
    }
  }

  return {
    success: true,
    billableActionId: billableAction.id,
    balanceAfter,
  }
}

/**
 * Add top-up credits to organization
 */
export async function addTopupCredits(orgId: string, amount: number): Promise<void> {
  const db = await getDb()
  const balance = await getCreditBalance(orgId)

  if (!balance) {
    throw new Error('No credit balance found')
  }

  const newTotal = (parseFloat(balance.topupCredits) + amount).toFixed(2)

  await db
    .update(creditBalances)
    .set({
      topupCredits: newTotal,
    })
    .where(eq(creditBalances.orgId, orgId))
}

/**
 * Trigger auto top-up purchase
 * Creates a Stripe payment intent to charge for credits
 */
async function triggerAutoTopup(orgId: string, amount: number): Promise<void> {
  console.log(`[Auto Top-up] Triggering auto top-up for org ${orgId}: ${amount} credits`)

  try {
    const db = await getDb()

    // Get organization and subscription
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1)

    if (!org) {
      throw new Error('Organization not found')
    }

    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.orgId, orgId))
      .limit(1)

    if (!sub || !sub.stripeCustomerId) {
      throw new Error('No Stripe customer found for organization')
    }

    // Import stripe here to avoid circular dependencies
    const { stripe } = await import('@/lib/billing/stripe-config')

    if (!stripe) {
      throw new Error('Stripe not configured')
    }

    // Calculate price ($0.04 per credit)
    const priceInCents = Math.round(amount * 0.04 * 100) // Convert to cents

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: priceInCents,
      currency: 'usd',
      customer: sub.stripeCustomerId,
      description: `Auto top-up: ${amount} credits`,
      metadata: {
        orgId,
        purchaseType: 'auto_topup',
        creditsAmount: amount.toString(),
      },
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never',
      },
      off_session: true, // This is for automatic charges
      confirm: true, // Immediately confirm the payment
    })

    console.log(`[Auto Top-up] Payment intent created: ${paymentIntent.id}, status: ${paymentIntent.status}`)

    // If payment succeeded, webhook will handle adding the credits
    // If payment requires action, log it (customer will need to update payment method)
    if (paymentIntent.status === 'requires_action') {
      console.error(`[Auto Top-up] Payment requires action for org ${orgId}. Customer may need to update payment method.`)
      // TODO: Send email notification to customer
    }
  } catch (error: any) {
    console.error(`[Auto Top-up] Failed to create payment intent for org ${orgId}:`, error.message)
    // TODO: Send email notification about failed auto top-up
    throw error
  }
}

/**
 * Reset credits for new billing period
 */
export async function resetCreditsForNewPeriod(
  orgId: string,
  tier: SubscriptionTier,
  periodStart: Date,
  periodEnd: Date
): Promise<void> {
  const db = await getDb()
  const credits = calculatePlanCredits(tier)

  await db
    .update(creditBalances)
    .set({
      billingPeriodStart: periodStart,
      billingPeriodEnd: periodEnd,
      ...credits,
      usedSmall: 0,
      usedMedium: 0,
      usedLarge: 0,
      usedXl: 0,
      // Keep topup credits, but reset usage
      topupCreditsUsed: '0',
      lastResetAt: new Date(),
      lastWarning80At: null,
      lastWarning100At: null,
    })
    .where(eq(creditBalances.orgId, orgId))
}

/**
 * Get credit usage percentage (0-100)
 */
export async function getCreditUsagePercentage(orgId: string): Promise<number> {
  const balance = await getCreditBalance(orgId)

  if (!balance) {
    return 0
  }

  // Calculate total included credits (converted to universal credits)
  const totalIncluded =
    balance.includedSmall * ACTION_CREDIT_COSTS.small +
    balance.includedMedium * ACTION_CREDIT_COSTS.medium +
    balance.includedLarge * ACTION_CREDIT_COSTS.large +
    balance.includedXl * ACTION_CREDIT_COSTS.xl

  // Calculate total used credits
  const totalUsed =
    balance.usedSmall * ACTION_CREDIT_COSTS.small +
    balance.usedMedium * ACTION_CREDIT_COSTS.medium +
    balance.usedLarge * ACTION_CREDIT_COSTS.large +
    balance.usedXl * ACTION_CREDIT_COSTS.xl

  if (totalIncluded === 0) {
    return 0
  }

  return Math.min(100, (totalUsed / totalIncluded) * 100)
}
