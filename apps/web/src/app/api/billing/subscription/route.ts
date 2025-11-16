/**
 * GET /api/billing/subscription?orgId=...
 *
 * Get subscription details for an organization
 * Requires service token authentication (orchestrator only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireServiceToken } from '@/lib/auth/service-token'
import { getSubscription } from '@/lib/billing/subscription-manager'
import { getCreditBalance } from '@/lib/billing/credit-manager'

export async function GET(request: NextRequest) {
  // Authenticate with service token
  const authResult = requireServiceToken(request)
  if (authResult) return authResult

  try {
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('orgId')

    if (!orgId) {
      return NextResponse.json(
        {
          error: 'Missing required parameter',
          message: 'orgId is required',
        },
        { status: 400 }
      )
    }

    // Get subscription
    const subscription = await getSubscription(orgId)

    if (!subscription) {
      return NextResponse.json(
        {
          error: 'Not found',
          message: 'No subscription found for this organization',
        },
        { status: 404 }
      )
    }

    // Get credit balance
    const creditBalance = await getCreditBalance(orgId)

    return NextResponse.json({
      success: true,
      subscription,
      creditBalance,
    })
  } catch (error) {
    console.error('[Subscription Get] Error:', error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json(
      {
        error: 'Failed to retrieve subscription',
        message: errorMessage,
      },
      { status: 500 }
    )
  }
}
