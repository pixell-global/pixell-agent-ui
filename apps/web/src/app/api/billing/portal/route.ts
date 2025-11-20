import { NextRequest, NextResponse } from 'next/server'
import { verifySessionCookie } from '@pixell/auth-firebase/server'
import { getDb, organizations, organizationMembers } from '@pixell/db-mysql'
import { and, eq } from 'drizzle-orm'
import Stripe from 'stripe'

async function getCurrentUserOrg(userId: string): Promise<string | null> {
  const db = await getDb()
  const memberships = await db
    .select({ orgId: organizationMembers.orgId, role: organizationMembers.role })
    .from(organizationMembers)
    .where(and(eq(organizationMembers.userId, userId), eq(organizationMembers.isDeleted, 0)))
    .orderBy(organizationMembers.role) // owner/admin first

  return memberships[0]?.orgId || null
}

export async function POST(request: NextRequest) {
  try {
    const cookieName = process.env.SESSION_COOKIE_NAME || 'session'
    const sessionCookie = request.cookies.get(cookieName)?.value
    if (!sessionCookie) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const decoded = await verifySessionCookie(sessionCookie)

    // Get user's organization automatically
    const orgId = await getCurrentUserOrg(decoded.sub)
    if (!orgId) return NextResponse.json({ error: 'User not in any organization' }, { status: 400 })

    const db = await getDb()
    const member = await db
      .select({ role: organizationMembers.role })
      .from(organizationMembers)
      .where(and(eq(organizationMembers.orgId, orgId), eq(organizationMembers.userId, decoded.sub), eq(organizationMembers.isDeleted, 0)))
      .limit(1)
    const role = member[0]?.role as any
    if (!role || (role !== 'owner' && role !== 'admin')) {
      return NextResponse.json({ error: 'Only organization owners and admins can manage billing' }, { status: 403 })
    }

    const key = process.env.STRIPE_SECRET_KEY
    if (!key) return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
    const stripe = new Stripe(key, { apiVersion: '2025-10-29.clover' })

    const orgRows = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1)
    const org = orgRows[0]
    if (!org?.stripeCustomerId) {
      return NextResponse.json(
        { error: 'No Stripe customer found. Please subscribe to a plan first.' },
        { status: 404 }
      )
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3003'}/settings/billing`,
    })
    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    console.error('[Billing Portal] Error:', err)
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 })
  }
}


