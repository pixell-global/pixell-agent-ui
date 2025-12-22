/**
 * POST /api/billing/quotas/record
 *
 * Record feature usage (increment/decrement)
 * Requires service token authentication (orchestrator only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireServiceToken } from '@/lib/auth/service-token'
import { incrementUsage, decrementActiveCount } from '@/lib/billing/quota-manager'
import { isValidFeature, VALID_FEATURES, type FeatureType } from '@/lib/billing/quota-config'

export async function POST(request: NextRequest) {
  // Authenticate with service token
  const authResult = requireServiceToken(request)
  if (authResult) return authResult

  try {
    const body = await request.json()
    const { orgId, userId, feature, action = 'increment', metadata } = body

    // Validate required fields
    if (!orgId || !userId || !feature) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          message: 'orgId, userId, and feature are required',
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

    // Validate action
    if (action !== 'increment' && action !== 'decrement') {
      return NextResponse.json(
        {
          error: 'Invalid action',
          message: 'action must be either "increment" or "decrement"',
        },
        { status: 400 }
      )
    }

    // Only monitors support decrement
    if (action === 'decrement' && feature !== 'monitors') {
      return NextResponse.json(
        {
          error: 'Invalid action',
          message: 'Only monitors feature supports decrement action',
        },
        { status: 400 }
      )
    }

    let result
    if (action === 'decrement') {
      result = await decrementActiveCount(orgId, userId, metadata)
    } else {
      result = await incrementUsage(orgId, userId, feature as FeatureType, metadata)
    }

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Usage recording failed',
          message: result.error,
          allowed: false,
        },
        { status: 403 } // Forbidden - quota exceeded
      )
    }

    return NextResponse.json({
      success: true,
      usageEventId: result.usageEventId,
      newUsage: result.newUsage,
    })
  } catch (error) {
    console.error('[Quota Record] Error:', error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json(
      {
        error: 'Usage recording failed',
        message: errorMessage,
      },
      { status: 500 }
    )
  }
}
