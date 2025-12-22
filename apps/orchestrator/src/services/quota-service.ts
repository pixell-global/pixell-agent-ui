/**
 * Quota Service
 *
 * Handles quota checking and usage recording by calling the web app's quota APIs.
 * Integrated into agent execution flow to enforce feature-based quotas.
 */

import { getAgentById, getAgentByUrl, AgentConfig, FeatureType, loadAgentsConfig } from '../utils/agents'

// Re-export FeatureType for consumers
export type { FeatureType }

// Legacy agent-to-feature mapping (fallback only - prefer featureType in agents.json)
// This map is kept for backward compatibility with hardcoded agent IDs
const LEGACY_AGENT_FEATURE_MAP: Record<string, FeatureType> = {
  'reddit-agent': 'research',
  'tik-agent': 'research',
  'vivid-commenter': 'auto_posting',
}

export interface QuotaCheckResult {
  allowed: boolean
  reason?: string
  featureAvailable: boolean
  limit: number | null
  used: number
  remaining: number
}

export interface QuotaRecordResult {
  success: boolean
  error?: string
  usageEventId?: number
  newUsage?: number
}

// Get the web app base URL (same host, port 3003)
function getWebAppBaseUrl(): string {
  return process.env.WEB_APP_URL || 'http://localhost:3003'
}

// Get service token for internal API calls
function getServiceToken(): string {
  const token = process.env.SERVICE_TOKEN_SECRET
  if (!token) {
    console.warn('⚠️ SERVICE_TOKEN_SECRET not configured - quota enforcement disabled')
  }
  return token || ''
}

/**
 * Get the feature type for an agent
 * Priority:
 * 1. Agent config's featureType (from agents.json) - preferred
 * 2. Legacy hardcoded map (for backward compatibility)
 */
export function getAgentFeatureType(agentIdOrUrl: string): FeatureType | null {
  console.log('💰 [BILLING DEBUG] getAgentFeatureType called with:', agentIdOrUrl)

  // Ensure config is loaded
  loadAgentsConfig()

  // Try to get agent config first (by ID or URL)
  const agent = getAgentById(agentIdOrUrl) || getAgentByUrl(agentIdOrUrl)

  console.log('💰 [BILLING DEBUG] Agent config lookup:', {
    agentIdOrUrl,
    found: !!agent,
    agentId: agent?.id,
    agentFeatureType: agent?.featureType,
  })

  // Priority 1: Use featureType from agent config (preferred)
  if (agent?.featureType) {
    console.log('💰 [BILLING DEBUG] ✅ Using agent.featureType from config:', agent.featureType)
    return agent.featureType
  }

  // Priority 2: Fallback to legacy map by agent ID
  if (agent && LEGACY_AGENT_FEATURE_MAP[agent.id]) {
    console.log('💰 [BILLING DEBUG] Using legacy map for agent.id:', LEGACY_AGENT_FEATURE_MAP[agent.id])
    return LEGACY_AGENT_FEATURE_MAP[agent.id]
  }

  // Priority 3: Direct lookup in legacy map (for raw agent ID strings)
  if (LEGACY_AGENT_FEATURE_MAP[agentIdOrUrl]) {
    console.log('💰 [BILLING DEBUG] Using legacy map for agentIdOrUrl:', LEGACY_AGENT_FEATURE_MAP[agentIdOrUrl])
    return LEGACY_AGENT_FEATURE_MAP[agentIdOrUrl]
  }

  console.log('💰 [BILLING DEBUG] ❌ No feature type found for:', agentIdOrUrl)
  return null
}

/**
 * Check if an organization has quota available for a feature
 */
export async function checkQuota(
  orgId: string,
  feature: FeatureType
): Promise<QuotaCheckResult> {
  const serviceToken = getServiceToken()
  if (!serviceToken) {
    // If no service token, allow by default (quota enforcement disabled)
    return {
      allowed: true,
      featureAvailable: true,
      limit: null,
      used: 0,
      remaining: Infinity,
    }
  }

  try {
    const baseUrl = getWebAppBaseUrl()
    const response = await fetch(`${baseUrl}/api/billing/quotas/check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceToken}`,
      },
      body: JSON.stringify({ orgId, feature }),
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('❌ Quota check failed:', error)
      return {
        allowed: false,
        reason: error.message || 'Quota check failed',
        featureAvailable: false,
        limit: null,
        used: 0,
        remaining: 0,
      }
    }

    return await response.json()
  } catch (error) {
    console.error('❌ Quota check error:', error)
    // On error, allow by default to prevent blocking users
    return {
      allowed: true,
      featureAvailable: true,
      limit: null,
      used: 0,
      remaining: Infinity,
    }
  }
}

/**
 * Record usage for a feature after successful execution
 */
export async function recordUsage(
  orgId: string,
  userId: string,
  feature: FeatureType,
  metadata?: {
    resourceId?: string
    agentId?: string
    extra?: Record<string, unknown>
  }
): Promise<QuotaRecordResult> {
  const serviceToken = getServiceToken()
  if (!serviceToken) {
    // If no service token, skip recording (quota enforcement disabled)
    return { success: true }
  }

  try {
    const baseUrl = getWebAppBaseUrl()
    const response = await fetch(`${baseUrl}/api/billing/quotas/record`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceToken}`,
      },
      body: JSON.stringify({
        orgId,
        userId,
        feature,
        action: 'increment',
        metadata,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('❌ Usage record failed:', error)
      return {
        success: false,
        error: error.message || 'Failed to record usage',
      }
    }

    return await response.json()
  } catch (error) {
    console.error('❌ Usage record error:', error)
    // On error, return failure but don't block
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Check quota for agent execution and return result
 * This is the main entry point for pre-execution quota checks
 */
export async function checkAgentQuota(
  orgId: string,
  agentIdOrUrl: string
): Promise<{ allowed: boolean; feature: FeatureType | null; result: QuotaCheckResult | null }> {
  const feature = getAgentFeatureType(agentIdOrUrl)

  // If agent has no feature mapping, allow without quota check
  if (!feature) {
    console.log(`📊 No quota mapping for agent ${agentIdOrUrl} - allowing without check`)
    return { allowed: true, feature: null, result: null }
  }

  console.log(`📊 Checking quota for ${feature} (agent: ${agentIdOrUrl}, org: ${orgId})`)
  const result = await checkQuota(orgId, feature)

  if (!result.allowed) {
    console.log(`❌ Quota check failed: ${result.reason}`)
  } else {
    console.log(`✅ Quota check passed: ${result.used}/${result.limit} used, ${result.remaining} remaining`)
  }

  return { allowed: result.allowed, feature, result }
}

/**
 * Record usage after successful agent execution
 * This is the main entry point for post-execution usage recording
 */
export async function recordAgentUsage(
  orgId: string,
  userId: string,
  agentIdOrUrl: string,
  metadata?: Record<string, unknown>
): Promise<QuotaRecordResult> {
  const feature = getAgentFeatureType(agentIdOrUrl)

  // If agent has no feature mapping, skip recording
  if (!feature) {
    console.log(`📊 No quota mapping for agent ${agentIdOrUrl} - skipping usage record`)
    return { success: true }
  }

  // Get agent config for metadata
  const agent = getAgentById(agentIdOrUrl) || getAgentByUrl(agentIdOrUrl)
  const agentId = agent?.id || agentIdOrUrl

  console.log(`📊 Recording usage for ${feature} (agent: ${agentId}, org: ${orgId})`)

  const result = await recordUsage(orgId, userId, feature, {
    agentId,
    extra: metadata,
  })

  if (result.success) {
    console.log(`✅ Usage recorded: ${result.newUsage} total uses`)
  } else {
    console.log(`⚠️ Usage record failed: ${result.error}`)
  }

  return result
}
