/**
 * POST /api/billing/auto-topup
 *
 * Update auto top-up settings for an organization
 * Requires authenticated user with owner/admin role
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifySessionCookie } from '@pixell/auth-firebase/server'
import { getDb, organizationMembers } from '@pixell/db-mysql'
import { creditBalances, organizations } from '@pixell/db-mysql/schema'
import { eq, and } from 'drizzle-orm'

async function getCurrentUserOrg(userId: string): Promise<string | null> {
  const db = await getDb()
  const memberships = await db
    .select({ orgId: organizationMembers.orgId, role: organizationMembers.role })
    .from(organizationMembers)
    .where(and(eq(organizationMembers.userId, userId), eq(organizationMembers.isDeleted, 0)))
    .orderBy(organizationMembers.role)

  return memberships[0]?.orgId || null
}

export async function POST(request: NextRequest) {
  try {
    // Verify session
    const cookieName = process.env.SESSION_COOKIE_NAME || 'session'
    const sessionCookie = request.cookies.get(cookieName)?.value
    if (!sessionCookie) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const decoded = await verifySessionCookie(sessionCookie)
    const userId = decoded.sub

    // Parse request body
    const body = await request.json()
    const { autoTopupEnabled, autoTopupThreshold, autoTopupAmount } = body

    // Validate required fields
    if (
      typeof autoTopupEnabled !== 'boolean' ||
      typeof autoTopupThreshold !== 'number' ||
      typeof autoTopupAmount !== 'number'
    ) {
      return NextResponse.json(
        { error: 'Missing or invalid fields: autoTopupEnabled, autoTopupThreshold, autoTopupAmount' },
        { status: 400 }
      )
    }

    // Validate threshold and amount ranges
    if (autoTopupThreshold < 10 || autoTopupThreshold > 500) {
      return NextResponse.json(
        { error: 'Threshold must be between 10 and 500 credits' },
        { status: 400 }
      )
    }

    if (![100, 250, 500, 1000].includes(autoTopupAmount)) {
      return NextResponse.json(
        { error: 'Amount must be 100, 250, 500, or 1000 credits' },
        { status: 400 }
      )
    }

    const db = await getDb()

    // Get user's organization
    const orgId = await getCurrentUserOrg(userId)
    if (!orgId) {
      return NextResponse.json(
        { error: 'User not in any organization' },
        { status: 400 }
      )
    }

    // Check user has owner or admin role
    const member = await db
      .select({ role: organizationMembers.role })
      .from(organizationMembers)
      .where(and(eq(organizationMembers.orgId, orgId), eq(organizationMembers.userId, userId), eq(organizationMembers.isDeleted, 0)))
      .limit(1)
    const role = member[0]?.role as any
    if (!role || (role !== 'owner' && role !== 'admin')) {
      return NextResponse.json(
        { error: 'Only organization owners and admins can update auto top-up settings' },
        { status: 403 }
      )
    }

    // Update auto top-up settings
    await db
      .update(creditBalances)
      .set({
        autoTopupEnabled,
        autoTopupThreshold,
        autoTopupAmount,
        updatedAt: new Date(),
      })
      .where(eq(creditBalances.orgId, orgId))

    // Fetch the updated record (MySQL doesn't support .returning())
    const [updated] = await db
      .select()
      .from(creditBalances)
      .where(eq(creditBalances.orgId, orgId))
      .limit(1)

    if (!updated) {
      return NextResponse.json(
        { error: 'Failed to update auto top-up settings' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      settings: {
        autoTopupEnabled: updated.autoTopupEnabled,
        autoTopupThreshold: updated.autoTopupThreshold,
        autoTopupAmount: updated.autoTopupAmount,
      },
    })
  } catch (error) {
    console.error('[Auto Top-up API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
