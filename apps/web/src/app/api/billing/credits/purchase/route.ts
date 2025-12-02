/**
 * POST /api/billing/credits/purchase
 *
 * Purchase additional credits (top-up)
 * Requires service token authentication (orchestrator only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireServiceToken } from '@/lib/auth/service-token'
import { stripe, CREDIT_TOPUP } from '@/lib/billing/stripe-config'
import { getDb } from '@pixell/db-mysql'
import { creditPurchases, organizations } from '@pixell/db-mysql/schema'
import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
  // Authenticate with service token
  const authResult = requireServiceToken(request)
  if (authResult) return authResult

  try {
    const body = await request.json()
    const { orgId, amount, paymentMethodId } = body

    // Validate required fields
    if (!orgId || !amount) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          message: 'orgId and amount are required',
        },
        { status: 400 }
      )
    }

    // Validate amount is positive
    if (amount <= 0) {
      return NextResponse.json(
        {
          error: 'Invalid amount',
          message: 'Amount must be greater than 0',
        },
        { status: 400 }
      )
    }

    const db = await getDb()

    // Get organization
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1)

    if (!org) {
      return NextResponse.json(
        {
          error: 'Organization not found',
          message: `No organization found with ID: ${orgId}`,
        },
        { status: 404 }
      )
    }

    // Ensure organization has a Stripe customer
    const customerId = org.stripeCustomerId

    if (!customerId) {
      return NextResponse.json(
        {
          error: 'No Stripe customer',
          message: 'Organization does not have a Stripe customer. Please create a subscription first.',
        },
        { status: 400 }
      )
    }

    // Calculate price
    const priceInCents = Math.round((amount * CREDIT_TOPUP.pricePerCredit) * 100)

    // Create purchase record
    const purchaseId = uuidv4()

    await db.insert(creditPurchases).values({
      id: purchaseId,
      orgId,
      stripePaymentIntentId: null, // Will be updated after payment intent creation
      stripeInvoiceId: null,
      creditsAmount: amount,
      amountPaid: (amount * CREDIT_TOPUP.pricePerCredit).toFixed(2),
      currency: 'usd',
      purchaseType: 'manual',
      status: 'pending',
    })

    // Create Stripe payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: priceInCents,
      currency: 'usd',
      customer: customerId,
      payment_method: paymentMethodId,
      confirm: !!paymentMethodId, // Auto-confirm if payment method provided
      metadata: {
        orgId,
        purchaseId,
        creditsAmount: amount.toString(),
      },
      description: `Purchase of ${amount} credits`,
    })

    // Update purchase with payment intent ID
    await db
      .update(creditPurchases)
      .set({
        stripePaymentIntentId: paymentIntent.id,
      })
      .where(eq(creditPurchases.id, purchaseId))

    return NextResponse.json({
      success: true,
      purchase: {
        id: purchaseId,
        amount,
        price: amount * CREDIT_TOPUP.pricePerCredit,
        status: paymentIntent.status,
      },
      paymentIntent: {
        id: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        status: paymentIntent.status,
      },
    })
  } catch (error) {
    console.error('[Credits Purchase] Error:', error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json(
      {
        error: 'Credit purchase failed',
        message: errorMessage,
      },
      { status: 500 }
    )
  }
}
