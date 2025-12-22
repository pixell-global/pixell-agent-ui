/**
 * POST /api/billing/credits/deduct
 *
 * Increment usage for a completed action
 * Requires service token authentication (orchestrator only)
 *
 * @deprecated This endpoint uses the old tier-based API format.
 * New integrations should use /api/billing/quotas/increment instead.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireServiceToken } from '@/lib/auth/service-token'
import { incrementUsage } from '@/lib/billing/quota-manager'
import type { FeatureType } from '@/lib/billing/quota-config'

// Valid feature types for the new billing system
const VALID_FEATURE_TYPES: FeatureType[] = ['research', 'ideation', 'auto_posting', 'monitors']

export async function POST(request: NextRequest) {
  // Authenticate with service token
  const authResult = requireServiceToken(request)
  if (authResult) return authResult

  try {
    const body = await request.json()
    const { orgId, userId, featureType, actionTier, metadata } = body

    // Support both new (featureType) and legacy (actionTier) parameter names
    const feature = featureType || actionTier

    // Validate required fields
    if (!orgId || !userId || !feature) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          message: 'orgId, userId, and featureType are required',
        },
        { status: 400 }
      )
    }

    // Validate feature type
    if (!VALID_FEATURE_TYPES.includes(feature as FeatureType)) {
      return NextResponse.json(
        {
          error: 'Invalid feature type',
          message: `featureType must be one of: ${VALID_FEATURE_TYPES.join(', ')}`,
        },
        { status: 400 }
      )
    }

    // Increment usage using new quota system
    const result = await incrementUsage(orgId, userId, feature as FeatureType, {
      agentId: metadata?.agentId,
      resourceId: metadata?.resourceId,
      extra: metadata,
    })

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Usage increment failed',
          message: result.error || 'Quota limit reached',
        },
        { status: 402 } // Payment Required
      )
    }

    return NextResponse.json({
      success: true,
      usageEventId: result.usageEventId,
      newUsage: result.newUsage,
    })
  } catch (error) {
    console.error('[Usage Increment] Error:', error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json(
      {
        error: 'Usage increment failed',
        message: errorMessage,
      },
      { status: 500 }
    )
  }
}
