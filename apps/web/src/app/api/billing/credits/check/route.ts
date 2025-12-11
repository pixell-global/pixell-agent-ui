/**
 * POST /api/billing/credits/check
 *
 * Check if organization has sufficient credits for an action
 * Requires service token authentication (orchestrator only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireServiceToken } from '@/lib/auth/service-token'
import { checkCredits } from '@/lib/billing/credit-manager'
import { ACTION_CREDIT_COSTS } from '@/lib/billing/stripe-config'

export async function POST(request: NextRequest) {
  // Authenticate with service token
  const authResult = requireServiceToken(request)
  if (authResult) return authResult

  try {
    const body = await request.json()
    const { orgId, actionTier } = body

    // Validate required fields
    if (!orgId || !actionTier) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          message: 'orgId and actionTier are required',
        },
        { status: 400 }
      )
    }

    // Validate action tier
    if (!(actionTier in ACTION_CREDIT_COSTS)) {
      return NextResponse.json(
        {
          error: 'Invalid action tier',
          message: 'actionTier must be one of: small, medium, large, xl',
        },
        { status: 400 }
      )
    }

    // Check credits
    const result = await checkCredits(orgId, actionTier)

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    console.error('[Credits Check] Error:', error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json(
      {
        error: 'Credit check failed',
        message: errorMessage,
      },
      { status: 500 }
    )
  }
}
