/**
 * Quota Manager
 *
 * Handles feature quota tracking, validation, and enforcement.
 * Follows the same patterns as credit-manager.ts
 */

import { getDb } from '@pixell/db-mysql'
import { featureQuotas, featureUsageEvents, subscriptions } from '@pixell/db-mysql/schema'
import { eq, sql } from 'drizzle-orm'
import {
  type FeatureType,
  getQuotaConfigForTier,
  FEATURE_DESCRIPTIONS,
  calculateTierQuotaLimits,
} from './quota-config'
import type { SubscriptionTier } from './stripe-config'

// =============================================================================
// TYPES
// =============================================================================

export interface QuotaCheckResult {
  allowed: boolean
  reason?: string
  featureAvailable: boolean
  limit: number | null
  used: number
  remaining: number
}

export interface QuotaStatus {
  tier: string
  billingPeriodStart: Date
  billingPeriodEnd: Date
  features: {
    research: { available: boolean; limit: number; used: number; remaining: number }
    ideation: { available: boolean; limit: number; used: number; remaining: number }
    autoPosting: { available: boolean; limit: number; used: number; remaining: number }
    monitors: { available: boolean; limit: number; active: number; remaining: number }
  }
}

export interface IncrementResult {
  success: boolean
  error?: string
  usageEventId?: number
  newUsage?: number
}

export interface UsageMetadata {
  resourceId?: string
  agentId?: string
  extra?: Record<string, unknown>
}

// =============================================================================
// QUOTA RETRIEVAL
// =============================================================================

/**
 * Get current quota record for organization
 */
export async function getFeatureQuota(orgId: string) {
  const db = await getDb()
  const [quota] = await db.select().from(featureQuotas).where(eq(featureQuotas.orgId, orgId)).limit(1)

  return quota || null
}

/**
 * Get full quota status for dashboard display
 */
export async function getQuotaStatus(orgId: string): Promise<QuotaStatus | null> {
  const db = await getDb()

  // Get quota and subscription in parallel
  const [[quota], [subscription]] = await Promise.all([
    db.select().from(featureQuotas).where(eq(featureQuotas.orgId, orgId)).limit(1),
    db.select().from(subscriptions).where(eq(subscriptions.orgId, orgId)).limit(1),
  ])

  if (!quota) {
    return null
  }

  const tier = subscription?.planTier || 'free'

  return {
    tier,
    billingPeriodStart: quota.billingPeriodStart,
    billingPeriodEnd: quota.billingPeriodEnd,
    features: {
      research: {
        available: quota.researchAvailable,
        limit: quota.researchLimit,
        used: quota.researchUsed,
        remaining: quota.researchAvailable ? Math.max(0, quota.researchLimit - quota.researchUsed) : 0,
      },
      ideation: {
        available: quota.ideationAvailable,
        limit: quota.ideationLimit,
        used: quota.ideationUsed,
        remaining: quota.ideationAvailable ? Math.max(0, quota.ideationLimit - quota.ideationUsed) : 0,
      },
      autoPosting: {
        available: quota.autoPostingAvailable,
        limit: quota.autoPostingLimit,
        used: quota.autoPostingUsed,
        remaining: quota.autoPostingAvailable ? Math.max(0, quota.autoPostingLimit - quota.autoPostingUsed) : 0,
      },
      monitors: {
        available: quota.monitorsAvailable,
        limit: quota.monitorsLimit,
        active: quota.monitorsActive,
        remaining: quota.monitorsAvailable ? Math.max(0, quota.monitorsLimit - quota.monitorsActive) : 0,
      },
    },
  }
}

// =============================================================================
// QUOTA INITIALIZATION
// =============================================================================

/**
 * Initialize feature quotas for a new organization
 */
export async function initializeFeatureQuotas(
  orgId: string,
  tier: SubscriptionTier,
  periodStart: Date,
  periodEnd: Date
): Promise<void> {
  const db = await getDb()
  const limits = calculateTierQuotaLimits(tier)

  await db.insert(featureQuotas).values({
    orgId,
    billingPeriodStart: periodStart,
    billingPeriodEnd: periodEnd,
    ...limits,
    researchUsed: 0,
    ideationUsed: 0,
    autoPostingUsed: 0,
    monitorsActive: 0,
    lastResetAt: new Date(),
  })
}

// =============================================================================
// QUOTA CHECKING
// =============================================================================

/**
 * Check if organization can use a feature
 * Returns detailed info about availability and remaining quota
 */
export async function checkQuota(orgId: string, feature: FeatureType): Promise<QuotaCheckResult> {
  const quota = await getFeatureQuota(orgId)

  if (!quota) {
    return {
      allowed: false,
      reason: 'No quota record found. Please contact support.',
      featureAvailable: false,
      limit: null,
      used: 0,
      remaining: 0,
    }
  }

  // Check billing period
  const now = new Date()
  if (now < quota.billingPeriodStart || now > quota.billingPeriodEnd) {
    return {
      allowed: false,
      reason: 'Billing period mismatch. Please contact support.',
      featureAvailable: false,
      limit: null,
      used: 0,
      remaining: 0,
    }
  }

  // Get feature-specific values
  const { isAvailable, limit, used } = getFeatureValues(quota, feature)

  // Check if feature is available for this tier
  if (!isAvailable) {
    return {
      allowed: false,
      reason: `${FEATURE_DESCRIPTIONS[feature]} is not available on your current plan. Please upgrade to access this feature.`,
      featureAvailable: false,
      limit: null,
      used: 0,
      remaining: 0,
    }
  }

  const remaining = Math.max(0, limit - used)

  // Check if quota exceeded
  if (used >= limit) {
    const quotaType = feature === 'monitors' ? 'concurrent' : 'monthly'
    return {
      allowed: false,
      reason: `You have reached your ${quotaType} limit for ${FEATURE_DESCRIPTIONS[feature]}. Please upgrade your plan or wait for your next billing cycle.`,
      featureAvailable: true,
      limit,
      used,
      remaining: 0,
    }
  }

  return {
    allowed: true,
    featureAvailable: true,
    limit,
    used,
    remaining,
  }
}

/**
 * Helper to get feature-specific values from quota record
 */
function getFeatureValues(
  quota: NonNullable<Awaited<ReturnType<typeof getFeatureQuota>>>,
  feature: FeatureType
): { isAvailable: boolean; limit: number; used: number } {
  switch (feature) {
    case 'research':
      return {
        isAvailable: quota.researchAvailable,
        limit: quota.researchLimit,
        used: quota.researchUsed,
      }
    case 'ideation':
      return {
        isAvailable: quota.ideationAvailable,
        limit: quota.ideationLimit,
        used: quota.ideationUsed,
      }
    case 'auto_posting':
      return {
        isAvailable: quota.autoPostingAvailable,
        limit: quota.autoPostingLimit,
        used: quota.autoPostingUsed,
      }
    case 'monitors':
      return {
        isAvailable: quota.monitorsAvailable,
        limit: quota.monitorsLimit,
        used: quota.monitorsActive,
      }
  }
}

// =============================================================================
// USAGE TRACKING
// =============================================================================

/**
 * Increment usage for a feature
 * For monitors, use incrementActiveCount directly for clarity
 */
export async function incrementUsage(
  orgId: string,
  userId: string,
  feature: FeatureType,
  metadata?: UsageMetadata
): Promise<IncrementResult> {
  if (feature === 'monitors') {
    return incrementActiveCount(orgId, userId, metadata)
  }

  const db = await getDb()
  const quota = await getFeatureQuota(orgId)

  if (!quota) {
    return { success: false, error: 'No quota record found' }
  }

  // Pre-check (non-atomic, but catches obvious issues)
  const checkResult = await checkQuota(orgId, feature)
  if (!checkResult.allowed) {
    return { success: false, error: checkResult.reason }
  }

  // Determine which field to update
  const { usedField, limitField } = getFieldNames(feature)

  // Atomic increment with limit check using raw SQL
  const updateResult = await db.execute(
    sql`UPDATE feature_quotas
        SET ${sql.identifier(usedField)} = ${sql.identifier(usedField)} + 1
        WHERE org_id = ${orgId}
        AND ${sql.identifier(usedField)} < ${sql.identifier(limitField)}`
  )

  // Debug: Log the update result structure
  console.log('[incrementUsage] updateResult:', JSON.stringify(updateResult, null, 2))

  // Check if update succeeded (affectedRows > 0)
  // Drizzle returns result as an array: [ResultSetHeader, FieldPacket[]]
  const resultHeader = Array.isArray(updateResult) ? updateResult[0] : updateResult
  const affectedRows = (resultHeader as any)?.affectedRows ?? 0
  console.log('[incrementUsage] affectedRows:', affectedRows)

  if (affectedRows === 0) {
    return { success: false, error: 'Quota limit reached' }
  }

  // Get updated quota for the event record
  const updatedQuota = await getFeatureQuota(orgId)
  const { used: newUsage, limit } = getFeatureValues(updatedQuota!, feature)

  // Record usage event
  const [event] = await db
    .insert(featureUsageEvents)
    .values({
      orgId,
      userId,
      featureType: feature,
      action: 'increment',
      resourceId: metadata?.resourceId || null,
      agentId: metadata?.agentId || null,
      metadata: metadata?.extra || null,
      billingPeriodStart: quota.billingPeriodStart,
      billingPeriodEnd: quota.billingPeriodEnd,
      usageAtEvent: newUsage,
      limitAtEvent: limit,
    })
    .$returningId()

  return {
    success: true,
    usageEventId: event.id,
    newUsage,
  }
}

/**
 * Increment active count for monitors
 */
export async function incrementActiveCount(
  orgId: string,
  userId: string,
  metadata?: UsageMetadata
): Promise<IncrementResult> {
  const db = await getDb()
  const quota = await getFeatureQuota(orgId)

  if (!quota) {
    return { success: false, error: 'No quota record found' }
  }

  if (!quota.monitorsAvailable) {
    return { success: false, error: 'Monitors feature not available on your plan' }
  }

  if (quota.monitorsActive >= quota.monitorsLimit) {
    return { success: false, error: `Monitor limit reached (${quota.monitorsLimit} active monitors)` }
  }

  // Atomic increment with limit check
  const updateResult = await db.execute(
    sql`UPDATE feature_quotas
        SET monitors_active = monitors_active + 1
        WHERE org_id = ${orgId}
        AND monitors_active < monitors_limit`
  )

  const affectedRows = (updateResult as unknown as { affectedRows: number }).affectedRows || 0
  if (affectedRows === 0) {
    return { success: false, error: 'Monitor limit reached' }
  }

  const updatedQuota = await getFeatureQuota(orgId)

  // Record usage event
  const [event] = await db
    .insert(featureUsageEvents)
    .values({
      orgId,
      userId,
      featureType: 'monitors',
      action: 'increment',
      resourceId: metadata?.resourceId || null,
      agentId: metadata?.agentId || null,
      metadata: metadata?.extra || null,
      billingPeriodStart: quota.billingPeriodStart,
      billingPeriodEnd: quota.billingPeriodEnd,
      usageAtEvent: updatedQuota?.monitorsActive || quota.monitorsActive + 1,
      limitAtEvent: quota.monitorsLimit,
    })
    .$returningId()

  return {
    success: true,
    usageEventId: event.id,
    newUsage: updatedQuota?.monitorsActive,
  }
}

/**
 * Decrement active count for monitors (when a monitor is deleted/deactivated)
 */
export async function decrementActiveCount(
  orgId: string,
  userId: string,
  metadata?: UsageMetadata
): Promise<IncrementResult> {
  const db = await getDb()
  const quota = await getFeatureQuota(orgId)

  if (!quota) {
    return { success: false, error: 'No quota record found' }
  }

  if (quota.monitorsActive <= 0) {
    // Already at zero, don't decrement below
    return { success: true, newUsage: 0 }
  }

  // Atomic decrement (floor at 0)
  await db.execute(
    sql`UPDATE feature_quotas
        SET monitors_active = GREATEST(0, monitors_active - 1)
        WHERE org_id = ${orgId}`
  )

  const updatedQuota = await getFeatureQuota(orgId)

  // Record usage event
  const [event] = await db
    .insert(featureUsageEvents)
    .values({
      orgId,
      userId,
      featureType: 'monitors',
      action: 'decrement',
      resourceId: metadata?.resourceId || null,
      agentId: metadata?.agentId || null,
      metadata: metadata?.extra || null,
      billingPeriodStart: quota.billingPeriodStart,
      billingPeriodEnd: quota.billingPeriodEnd,
      usageAtEvent: updatedQuota?.monitorsActive || 0,
      limitAtEvent: quota.monitorsLimit,
    })
    .$returningId()

  return {
    success: true,
    usageEventId: event.id,
    newUsage: updatedQuota?.monitorsActive,
  }
}

/**
 * Helper to get field names for a feature
 */
function getFieldNames(feature: FeatureType): { usedField: string; limitField: string } {
  switch (feature) {
    case 'research':
      return { usedField: 'research_used', limitField: 'research_limit' }
    case 'ideation':
      return { usedField: 'ideation_used', limitField: 'ideation_limit' }
    case 'auto_posting':
      return { usedField: 'auto_posting_used', limitField: 'auto_posting_limit' }
    case 'monitors':
      return { usedField: 'monitors_active', limitField: 'monitors_limit' }
  }
}

// =============================================================================
// QUOTA RESET AND TIER CHANGES
// =============================================================================

/**
 * Reset monthly quotas for new billing period
 * Called from Stripe webhook on invoice.payment_succeeded
 */
export async function resetMonthlyQuotas(
  orgId: string,
  tier: SubscriptionTier,
  periodStart: Date,
  periodEnd: Date
): Promise<void> {
  const db = await getDb()
  const limits = calculateTierQuotaLimits(tier)

  await db
    .update(featureQuotas)
    .set({
      billingPeriodStart: periodStart,
      billingPeriodEnd: periodEnd,

      // Update limits based on (possibly new) tier
      ...limits,

      // Reset monthly usage counters
      researchUsed: 0,
      ideationUsed: 0,
      autoPostingUsed: 0,
      // NOTE: monitorsActive is NOT reset - it's a concurrent count

      lastResetAt: new Date(),
    })
    .where(eq(featureQuotas.orgId, orgId))
}

/**
 * Update quotas when subscription tier changes (mid-cycle upgrade/downgrade)
 * Usage is preserved, only limits and availability change
 */
export async function updateQuotasForTierChange(orgId: string, newTier: SubscriptionTier): Promise<void> {
  const db = await getDb()
  const limits = calculateTierQuotaLimits(newTier)
  const quota = await getFeatureQuota(orgId)

  if (!quota) {
    // Initialize if doesn't exist
    const now = new Date()
    const periodEnd = new Date(now)
    periodEnd.setMonth(periodEnd.getMonth() + 1)
    await initializeFeatureQuotas(orgId, newTier, now, periodEnd)
    return
  }

  // Update limits and availability, but keep current usage
  // For downgrades, users keep their usage but new limit applies
  // For monitors: if downgrading and active > new limit, they keep existing but can't add more
  await db
    .update(featureQuotas)
    .set({
      researchLimit: limits.researchLimit,
      ideationLimit: limits.ideationLimit,
      autoPostingLimit: limits.autoPostingLimit,
      monitorsLimit: limits.monitorsLimit,

      researchAvailable: limits.researchAvailable,
      ideationAvailable: limits.ideationAvailable,
      autoPostingAvailable: limits.autoPostingAvailable,
      monitorsAvailable: limits.monitorsAvailable,
    })
    .where(eq(featureQuotas.orgId, orgId))
}

/**
 * Check if feature quotas exist for an organization
 */
export async function hasFeatureQuotas(orgId: string): Promise<boolean> {
  const quota = await getFeatureQuota(orgId)
  return quota !== null
}
