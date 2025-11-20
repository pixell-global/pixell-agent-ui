/**
 * POST /api/billing/subscription/create-free
 *
 * Creates a free tier subscription for the user's organization
 * Used for graceful recovery when users don't have subscriptions
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifySessionCookie } from '@pixell/auth-firebase/server'
import { getDb, organizationMembers } from '@pixell/db-mysql'
import { organizations } from '@pixell/db-mysql/schema'
import { eq, and } from 'drizzle-orm'
import { createSubscription } from '@/lib/billing/subscription-manager'

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
    const userEmail = decoded.email || ''

    const db = await getDb()

    // Get user's organization
    const orgId = await getCurrentUserOrg(userId)
    if (!orgId) {
      return NextResponse.json(
        { error: 'User not in any organization' },
        { status: 400 }
      )
    }

    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1)

    if (!org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    console.log(`[Create Free Plan] Creating free subscription for org: ${org.name} (${org.id})`)

    // Check if subscription already exists
    const { getSubscription } = await import('@/lib/billing/subscription-manager')
    const existingSubscription = await getSubscription(org.id)

    if (existingSubscription) {
      console.log(`[Create Free Plan] Subscription already exists for org ${org.id}, skipping creation`)

      // If they already have a subscription, just return success
      // This handles cases where user clicks "Choose Free" but already has a subscription
      return NextResponse.json({
        success: true,
        subscription: existingSubscription,
        message: 'Subscription already exists',
      })
    }

    // Create free tier subscription
    const subscription = await createSubscription({
      orgId: org.id,
      orgName: org.name,
      userEmail,
      tier: 'free',
    })

    console.log(`[Create Free Plan] Successfully created subscription for org: ${org.name}`)

    return NextResponse.json({
      success: true,
      subscription,
      message: 'Free plan created successfully',
    })
  } catch (error: any) {
    console.error('[Create Free Plan API] Error:', error)
    console.error('[Create Free Plan API] Error stack:', error.stack)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}
