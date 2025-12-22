/**
 * Credit Manager
 *
 * @deprecated This module is deprecated. Use quota-manager.ts for action-based billing.
 *
 * The billing system has migrated from tier-based credits (small/medium/large/xl)
 * to action-based quotas (research/ideation/auto_posting/monitors).
 * See quota-manager.ts and quota-config.ts for the new implementation.
 *
 * This file is kept for backwards compatibility but all functions return deprecation errors.
 */

// @deprecated - tier-based credits no longer used
type ActionTier = 'small' | 'medium' | 'large' | 'xl'

/**
 * @deprecated Use quota-manager.ts instead.
 */
export interface CreditBalance {
  orgId: string
  billingPeriodStart: Date
  billingPeriodEnd: Date
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

const DEPRECATION_ERROR = 'This function is deprecated. Use quota-manager.ts instead.'

/**
 * @deprecated Use quota-manager.ts getFeatureQuota instead
 */
export async function getCreditBalance(_orgId: string): Promise<CreditBalance | null> {
  console.warn('[credit-manager] getCreditBalance is deprecated. Use quota-manager.ts instead.')
  return null
}

/**
 * @deprecated Use quota-manager.ts initializeFeatureQuotas instead
 */
export async function initializeCreditBalance(
  _orgId: string,
  _tier: string,
  _periodStart: Date,
  _periodEnd: Date
): Promise<void> {
  console.warn('[credit-manager] initializeCreditBalance is deprecated. Use quota-manager.ts instead.')
  throw new Error(DEPRECATION_ERROR)
}

/**
 * @deprecated Use quota-manager.ts checkQuota instead
 */
export async function checkCredits(
  _orgId: string,
  _actionTier: ActionTier
): Promise<CreditCheckResult> {
  console.warn('[credit-manager] checkCredits is deprecated. Use quota-manager.ts checkQuota instead.')
  return {
    allowed: false,
    reason: DEPRECATION_ERROR,
  }
}

/**
 * @deprecated Use quota-manager.ts incrementUsage instead
 */
export async function deductCredits(
  _orgId: string,
  _userId: string,
  _actionTier: ActionTier,
  _metadata: Record<string, unknown>
): Promise<CreditDeductionResult> {
  console.warn('[credit-manager] deductCredits is deprecated. Use quota-manager.ts incrementUsage instead.')
  return {
    success: false,
    error: DEPRECATION_ERROR,
  }
}

/**
 * @deprecated Credit top-ups are no longer available
 */
export async function addTopupCredits(_orgId: string, _amount: number): Promise<void> {
  console.warn('[credit-manager] addTopupCredits is deprecated. Credit top-ups are no longer available.')
  throw new Error('Credit top-ups are no longer available. Please upgrade your subscription plan.')
}

/**
 * @deprecated Use quota-manager.ts resetMonthlyQuotas instead
 */
export async function resetCreditsForNewPeriod(
  _orgId: string,
  _tier: string,
  _periodStart: Date,
  _periodEnd: Date
): Promise<void> {
  console.warn('[credit-manager] resetCreditsForNewPeriod is deprecated. Use quota-manager.ts instead.')
  throw new Error(DEPRECATION_ERROR)
}

/**
 * @deprecated Use quota-manager.ts getQuotaStatus instead
 */
export async function getCreditUsagePercentage(_orgId: string): Promise<number> {
  console.warn('[credit-manager] getCreditUsagePercentage is deprecated. Use quota-manager.ts instead.')
  return 0
}
