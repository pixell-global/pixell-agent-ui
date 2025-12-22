/**
 * GET /api/billing/credits/balance?orgId=...
 *
 * Get quota status for an organization
 * Requires service token authentication (orchestrator only)
 *
 * @deprecated This endpoint uses the old credit-based API format.
 * New integrations should use /api/billing/quotas/status instead.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireServiceToken } from '@/lib/auth/service-token'
import { getQuotaStatus } from '@/lib/billing/quota-manager'

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

    // Get quota status (new system)
    const quotaStatus = await getQuotaStatus(orgId)

    if (!quotaStatus) {
      return NextResponse.json(
        {
          error: 'Not found',
          message: 'No quota record found for this organization',
        },
        { status: 404 }
      )
    }

    // Return in a format compatible with quota-based billing
    return NextResponse.json({
      success: true,
      tier: quotaStatus.tier,
      billingPeriodStart: quotaStatus.billingPeriodStart,
      billingPeriodEnd: quotaStatus.billingPeriodEnd,
      quotas: quotaStatus.features,
    })
  } catch (error) {
    console.error('[Quota Status] Error:', error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json(
      {
        error: 'Failed to retrieve quota status',
        message: errorMessage,
      },
      { status: 500 }
    )
  }
}
