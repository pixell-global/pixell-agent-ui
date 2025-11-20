/**
 * GET /api/billing/credits/balance?orgId=...
 *
 * Get credit balance for an organization
 * Requires service token authentication (orchestrator only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireServiceToken } from '@/lib/auth/service-token'
import { getCreditBalance, getCreditUsagePercentage } from '@/lib/billing/credit-manager'

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

    // Get credit balance
    const balance = await getCreditBalance(orgId)

    if (!balance) {
      return NextResponse.json(
        {
          error: 'Not found',
          message: 'No credit balance found for this organization',
        },
        { status: 404 }
      )
    }

    // Get usage percentage
    const usagePercentage = await getCreditUsagePercentage(orgId)

    // Calculate remaining credits
    const remaining = {
      small: balance.includedSmall - balance.usedSmall,
      medium: balance.includedMedium - balance.usedMedium,
      large: balance.includedLarge - balance.usedLarge,
      xl: balance.includedXl - balance.usedXl,
      topup: parseFloat(balance.topupCredits) - parseFloat(balance.topupCreditsUsed),
    }

    return NextResponse.json({
      success: true,
      balance,
      remaining,
      usagePercentage,
    })
  } catch (error) {
    console.error('[Credits Balance] Error:', error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json(
      {
        error: 'Failed to retrieve credit balance',
        message: errorMessage,
      },
      { status: 500 }
    )
  }
}
