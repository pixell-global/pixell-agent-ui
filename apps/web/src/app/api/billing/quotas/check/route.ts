/**
 * POST /api/billing/quotas/check
 *
 * Pre-check if a feature can be used
 * Requires service token authentication (orchestrator only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireServiceToken } from '@/lib/auth/service-token'
import { checkQuota } from '@/lib/billing/quota-manager'
import { isValidFeature, VALID_FEATURES, type FeatureType } from '@/lib/billing/quota-config'

export async function POST(request: NextRequest) {
  // Authenticate with service token
  const authResult = requireServiceToken(request)
  if (authResult) return authResult

  try {
    const body = await request.json()
    const { orgId, feature } = body

    // Validate required fields
    if (!orgId || !feature) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          message: 'orgId and feature are required',
        },
        { status: 400 }
      )
    }

    // Validate feature type
    if (!isValidFeature(feature)) {
      return NextResponse.json(
        {
          error: 'Invalid feature',
          message: `feature must be one of: ${VALID_FEATURES.join(', ')}`,
        },
        { status: 400 }
      )
    }

    // Check quota
    const result = await checkQuota(orgId, feature as FeatureType)

    return NextResponse.json({
      success: true,
      ...result,
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
