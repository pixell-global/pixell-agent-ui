/**
 * POST /api/billing/subscription/create
 *
 * Create a new subscription for an organization
 * Requires service token authentication (orchestrator only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireServiceToken } from '@/lib/auth/service-token'
import { createSubscription } from '@/lib/billing/subscription-manager'
import { isValidTier } from '@/lib/billing/stripe-config'

export async function POST(request: NextRequest) {
  // Authenticate with service token
  const authResult = requireServiceToken(request)
  if (authResult) return authResult

  try {
    const body = await request.json()
    const { orgId, orgName, userEmail, tier, trialDays } = body

    // Validate required fields
    if (!orgId || !orgName || !userEmail || !tier) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          message: 'orgId, orgName, userEmail, and tier are required',
        },
        { status: 400 }
      )
    }

    // Validate tier
    if (!isValidTier(tier)) {
      return NextResponse.json(
        {
          error: 'Invalid tier',
          message: `Tier must be one of: free, starter, pro, max`,
        },
        { status: 400 }
      )
    }

    // Create subscription
    const result = await createSubscription({
      orgId,
      orgName,
      userEmail,
      tier,
      trialDays,
    })

    return NextResponse.json({
      success: true,
      subscription: result,
    })
  } catch (error) {
    console.error('[Subscription Create] Error:', error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json(
      {
        error: 'Subscription creation failed',
        message: errorMessage,
      },
      { status: 500 }
    )
  }
}
