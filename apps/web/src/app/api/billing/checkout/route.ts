import { NextRequest, NextResponse } from 'next/server'
import { verifySessionCookie } from '@pixell/auth-firebase/server'
import { getDb, organizations, organizationMembers } from '@pixell/db-mysql'
import { and, eq } from 'drizzle-orm'

// Placeholder: integrate Stripe SDK if configured via env
const getStripe = () => {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  // Lazy require to avoid bundling in Edge-unfriendly contexts
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Stripe = require('stripe')
  return new Stripe(key, { apiVersion: '2025-08-27.basil' })
}

export async function POST(request: NextRequest) {
  try {
    const cookieName = process.env.SESSION_COOKIE_NAME || 'session'
    const sessionCookie = request.cookies.get(cookieName)?.value
    if (!sessionCookie) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const decoded = await verifySessionCookie(sessionCookie)

    const { orgId } = await request.json()
    if (!orgId) return NextResponse.json({ error: 'Organization ID required' }, { status: 400 })

    const stripe = getStripe()
    if (!stripe) return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })

    const db = await getDb()
    const member = await db
      .select({ role: organizationMembers.role })
      .from(organizationMembers)
      .where(and(eq(organizationMembers.orgId, orgId), eq(organizationMembers.userId, decoded.sub), eq(organizationMembers.isDeleted, 0)))
      .limit(1)
    const role = member[0]?.role as any
    if (!role || (role !== 'owner' && role !== 'admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const orgRows = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1)
    const org = orgRows[0]
    if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })

    // Ensure customer
    let customerId = org.stripeCustomerId as string | null
    if (!customerId) {
      const cust = await stripe.customers.create({ name: org.name })
      customerId = cust.id
      await db.update(organizations).set({ stripeCustomerId: customerId }).where(eq(organizations.id, orgId))
    }

    // Create checkout session (replace price/id from env)
    const priceId = process.env.STRIPE_PRICE_ID
    if (!priceId) return NextResponse.json({ error: 'STRIPE_PRICE_ID missing' }, { status: 500 })

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3003'}/`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3003'}/billing?orgId=${orgId}`,
      metadata: { orgId },
    })

    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 })
  }
}


