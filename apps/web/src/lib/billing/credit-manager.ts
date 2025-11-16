/**
 * Credit Manager
 *
 * Handles credit balance tracking, deduction, and validation
 */

import { db } from '@pixell/db-mysql'
import { creditBalances, billableActions } from '@pixell/db-mysql/schema'
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
 * Reset credits for new billing period
 */
export async function resetCreditsForNewPeriod(
  orgId: string,
  tier: SubscriptionTier,
  periodStart: Date,
  periodEnd: Date
): Promise<void> {
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
