/**
 * Feature Quota Configuration
 *
 * Defines per-tier limits for feature-based quotas.
 * N/A features have `available: false` - completely blocked.
 * Features with limits have `available: true` with specific `limit` value.
 *
 * Tier limits:
 * | Plan    | Research | Ideation | Auto-posting | Monitors |
 * |---------|----------|----------|--------------|----------|
 * | Free    | 2        | 10       | N/A          | N/A      |
 * | Starter | 10       | 30       | N/A          | N/A      |
 * | Pro     | 60       | 300      | 30           | 3        |
 * | Max     | 300      | 3000     | 300          | 20       |
 */

export type FeatureType = 'research' | 'ideation' | 'auto_posting' | 'monitors'

export interface FeatureLimits {
  available: boolean
  limit: number // Only relevant when available is true
}

export interface TierFeatureQuotas {
  research: FeatureLimits
  ideation: FeatureLimits
  autoPosting: FeatureLimits
  monitors: FeatureLimits
}

/**
 * Feature quota configuration by tier
 */
export const FEATURE_QUOTAS: Record<string, TierFeatureQuotas> = {
  free: {
    research: { available: true, limit: 2 },
    ideation: { available: true, limit: 10 },
    autoPosting: { available: false, limit: 0 }, // N/A
    monitors: { available: false, limit: 0 }, // N/A
  },
  starter: {
    research: { available: true, limit: 10 },
    ideation: { available: true, limit: 30 },
    autoPosting: { available: false, limit: 0 }, // N/A
    monitors: { available: false, limit: 0 }, // N/A
  },
  pro: {
    research: { available: true, limit: 60 },
    ideation: { available: true, limit: 300 },
    autoPosting: { available: true, limit: 30 },
    monitors: { available: true, limit: 3 }, // Concurrent active count
  },
  max: {
    research: { available: true, limit: 300 },
    ideation: { available: true, limit: 3000 },
    autoPosting: { available: true, limit: 300 },
    monitors: { available: true, limit: 20 }, // Concurrent active count
  },
} as const

/**
 * Feature type descriptions for user-facing messages
 */
export const FEATURE_DESCRIPTIONS: Record<FeatureType, string> = {
  research: 'Research tasks',
  ideation: 'Ideation sessions',
  auto_posting: 'Auto-posting actions',
  monitors: 'Active monitors',
}

/**
 * Valid feature types for validation
 */
export const VALID_FEATURES: FeatureType[] = ['research', 'ideation', 'auto_posting', 'monitors']

/**
 * Get quota config for a tier
 */
export function getQuotaConfigForTier(tier: string): TierFeatureQuotas {
  return FEATURE_QUOTAS[tier] || FEATURE_QUOTAS.free
}

/**
 * Check if a feature is available for a tier
 */
export function isFeatureAvailable(tier: string, feature: FeatureType): boolean {
  const config = getQuotaConfigForTier(tier)
  const featureKey = featureToConfigKey(feature)
  return config[featureKey].available
}

/**
 * Get feature limit for a tier
 * Returns null if feature is not available (N/A)
 */
export function getFeatureLimit(tier: string, feature: FeatureType): number | null {
  const config = getQuotaConfigForTier(tier)
  const featureKey = featureToConfigKey(feature)
  const featureConfig = config[featureKey]
  return featureConfig.available ? featureConfig.limit : null
}

/**
 * Convert feature type (db format) to config key (camelCase)
 */
export function featureToConfigKey(feature: FeatureType): keyof TierFeatureQuotas {
  switch (feature) {
    case 'research':
      return 'research'
    case 'ideation':
      return 'ideation'
    case 'auto_posting':
      return 'autoPosting'
    case 'monitors':
      return 'monitors'
  }
}

/**
 * Convert feature type to database column suffix (PascalCase)
 * e.g., 'research' -> 'Research', 'auto_posting' -> 'AutoPosting'
 */
export function featureToDbSuffix(feature: FeatureType): string {
  switch (feature) {
    case 'research':
      return 'Research'
    case 'ideation':
      return 'Ideation'
    case 'auto_posting':
      return 'AutoPosting'
    case 'monitors':
      return 'Monitors'
  }
}

/**
 * Validate if a string is a valid feature type
 */
export function isValidFeature(feature: string): feature is FeatureType {
  return VALID_FEATURES.includes(feature as FeatureType)
}

/**
 * Calculate all quota limits for a tier (used when initializing/resetting)
 */
export function calculateTierQuotaLimits(tier: string): {
  researchLimit: number
  ideationLimit: number
  autoPostingLimit: number
  monitorsLimit: number
  researchAvailable: boolean
  ideationAvailable: boolean
  autoPostingAvailable: boolean
  monitorsAvailable: boolean
} {
  const config = getQuotaConfigForTier(tier)
  return {
    researchLimit: config.research.limit,
    ideationLimit: config.ideation.limit,
    autoPostingLimit: config.autoPosting.limit,
    monitorsLimit: config.monitors.limit,
    researchAvailable: config.research.available,
    ideationAvailable: config.ideation.available,
    autoPostingAvailable: config.autoPosting.available,
    monitorsAvailable: config.monitors.available,
  }
}
