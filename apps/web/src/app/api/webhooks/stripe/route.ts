import { NextRequest, NextResponse } from 'next/server'
import { getDb, organizations } from '@pixell/db-mysql'
import { eq } from 'drizzle-orm'
import Stripe from 'stripe'

export async function POST(request: NextRequest) {
  try {
    const sig = request.headers.get('stripe-signature')
    const key = process.env.STRIPE_SECRET_KEY
    const whSecret = process.env.STRIPE_WEBHOOK_SECRET
    if (!key || !whSecret) return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })

    const stripe = new Stripe(key, { apiVersion: '2025-08-27.basil' })
    const rawBody = await request.text()
    let event
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig as any, whSecret)
    } catch (err: any) {
      return NextResponse.json({ error: `Webhook signature verification failed: ${err.message}` }, { status: 400 })
    }

    const db = await getDb()
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any
        const orgId = session.metadata?.orgId as string | undefined
        if (orgId) {
          await db.update(organizations).set({ subscriptionStatus: 'active' as any }).where(eq(organizations.id, orgId))
        }
        break
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.created':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as any
        const customerId = sub.customer as string | undefined
        if (customerId) {
          const status = (sub.status || 'incomplete') as any
          await db.update(organizations).set({ subscriptionStatus: status }).where(eq(organizations.stripeCustomerId, customerId))
        }
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 })
  }
}


