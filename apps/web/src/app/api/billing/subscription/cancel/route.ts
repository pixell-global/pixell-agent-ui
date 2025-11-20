/**
 * POST /api/billing/subscription/cancel
 *
 * Cancel a subscription
 * Requires service token authentication (orchestrator only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireServiceToken } from '@/lib/auth/service-token'
import { cancelSubscription } from '@/lib/billing/subscription-manager'

export async function POST(request: NextRequest) {
  // Authenticate with service token
  const authResult = requireServiceToken(request)
  if (authResult) return authResult

  try {
    const body = await request.json()
    const { orgId, cancelAtPeriodEnd, reason } = body

    // Validate required fields
    if (!orgId) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          message: 'orgId is required',
        },
        { status: 400 }
      )
    }

    // Cancel subscription
    const result = await cancelSubscription({
      orgId,
      cancelAtPeriodEnd: cancelAtPeriodEnd ?? true, // Default to cancel at period end
      reason,
    })

    return NextResponse.json({
      success: true,
      result,
    })
  } catch (error) {
    console.error('[Subscription Cancel] Error:', error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json(
      {
        error: 'Subscription cancellation failed',
        message: errorMessage,
      },
      { status: 500 }
    )
  }
}
