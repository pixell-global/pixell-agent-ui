/**
 * POST /api/billing/credits/deduct
 *
 * Deduct credits for a completed action
 * Requires service token authentication (orchestrator only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireServiceToken } from '@/lib/auth/service-token'
import { deductCredits } from '@/lib/billing/credit-manager'
import { ACTION_CREDIT_COSTS } from '@/lib/billing/stripe-config'

export async function POST(request: NextRequest) {
  // Authenticate with service token
  const authResult = requireServiceToken(request)
  if (authResult) return authResult

  try {
    const body = await request.json()
    const { orgId, userId, actionTier, metadata } = body

    // Validate required fields
    if (!orgId || !userId || !actionTier) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          message: 'orgId, userId, and actionTier are required',
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

    // Deduct credits
    const result = await deductCredits(orgId, userId, actionTier, metadata || {})

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Credit deduction failed',
          message: result.error || 'Insufficient credits',
        },
        { status: 402 } // Payment Required
      )
    }

    return NextResponse.json({
      success: true,
      billableActionId: result.billableActionId,
      balanceAfter: result.balanceAfter,
    })
  } catch (error) {
    console.error('[Credits Deduct] Error:', error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json(
      {
        error: 'Credit deduction failed',
        message: errorMessage,
      },
      { status: 500 }
    )
  }
}
