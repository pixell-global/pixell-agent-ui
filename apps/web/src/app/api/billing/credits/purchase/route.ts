/**
 * POST /api/billing/credits/purchase
 *
 * @deprecated Credit top-ups are no longer available.
 * The billing system has migrated from tier-based credits to action-based quotas.
 * Users should upgrade their subscription plan to get more quota.
 */

import { NextRequest, NextResponse } from 'next/server'

export async function POST(_request: NextRequest) {
  return NextResponse.json(
    {
      error: 'Feature deprecated',
      message: 'Credit top-ups are no longer available. The billing system has migrated to action-based quotas. Please upgrade your subscription plan for more quota.',
      deprecatedAt: '2025-12-19',
      migration: 'action_based_billing_v2',
    },
    { status: 410 } // 410 Gone
  )
}
