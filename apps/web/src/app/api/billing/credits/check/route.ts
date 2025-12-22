/**
 * POST /api/billing/credits/check
 *
 * Check if organization has sufficient quota for a feature
 * Requires service token authentication (orchestrator only)
 *
 * @deprecated This endpoint uses the old tier-based API format.
 * New integrations should use /api/billing/quotas/check instead.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireServiceToken } from '@/lib/auth/service-token'
import { checkQuota, type QuotaCheckResult } from '@/lib/billing/quota-manager'
import type { FeatureType } from '@/lib/billing/quota-config'

// Valid feature types for the new billing system
const VALID_FEATURE_TYPES: FeatureType[] = ['research', 'ideation', 'auto_posting', 'monitors']

export async function POST(request: NextRequest) {
  // Authenticate with service token
  const authResult = requireServiceToken(request)
  if (authResult) return authResult

  try {
    const body = await request.json()
    const { orgId, featureType, actionTier } = body

    // Support both new (featureType) and legacy (actionTier) parameter names
    const feature = featureType || actionTier

    // Validate required fields
    if (!orgId || !feature) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          message: 'orgId and featureType are required',
        },
        { status: 400 }
      )
    }

    // Validate feature type - accept both new feature types and legacy tier names
    let mappedFeature: FeatureType
    if (VALID_FEATURE_TYPES.includes(feature as FeatureType)) {
      mappedFeature = feature as FeatureType
    } else {
      // Legacy tier names are no longer supported
      return NextResponse.json(
        {
          error: 'Invalid feature type',
          message: `featureType must be one of: ${VALID_FEATURE_TYPES.join(', ')}`,
        },
        { status: 400 }
      )
    }

    // Check quota using new system
    const result: QuotaCheckResult = await checkQuota(orgId, mappedFeature)

    return NextResponse.json({
      success: true,
      allowed: result.allowed,
      reason: result.reason,
      featureAvailable: result.featureAvailable,
      limit: result.limit,
      used: result.used,
      remaining: result.remaining,
    })
  } catch (error) {
    console.error('[Quota Check] Error:', error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json(
      {
        error: 'Quota check failed',
        message: errorMessage,
      },
      { status: 500 }
    )
  }
}
