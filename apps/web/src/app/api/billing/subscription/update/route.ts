/**
 * POST /api/billing/subscription/update
 *
 * Update subscription to a new tier
 * Requires service token authentication (orchestrator only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireServiceToken } from '@/lib/auth/service-token'
import { updateSubscription } from '@/lib/billing/subscription-manager'
import { isValidTier } from '@/lib/billing/stripe-config'

export async function POST(request: NextRequest) {
  // Authenticate with service token
  const authResult = requireServiceToken(request)
  if (authResult) return authResult

  try {
    const body = await request.json()
    const { orgId, newTier, prorationBehavior } = body

    // Validate required fields
    if (!orgId || !newTier) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          message: 'orgId and newTier are required',
        },
        { status: 400 }
      )
    }

    // Validate tier
    if (!isValidTier(newTier)) {
      return NextResponse.json(
        {
          error: 'Invalid tier',
          message: `newTier must be one of: free, starter, pro, max`,
        },
        { status: 400 }
      )
    }

    // Update subscription
    const result = await updateSubscription({
      orgId,
      newTier,
      prorationBehavior,
    })

    return NextResponse.json({
      success: true,
      subscription: result,
    })
  } catch (error) {
    console.error('[Subscription Update] Error:', error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json(
      {
        error: 'Subscription update failed',
        message: errorMessage,
      },
      { status: 500 }
    )
  }
}
