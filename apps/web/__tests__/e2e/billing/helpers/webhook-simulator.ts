/**
 * Stripe Webhook Event Simulator
 *
 * Provides functions for building and sending Stripe webhook events
 * to the local webhook endpoint for testing.
 *
 * For local testing, set STRIPE_SKIP_SIGNATURE_CHECK=true to bypass
 * signature verification.
 *
 * Environment Variables:
 * - STRIPE_SKIP_SIGNATURE_CHECK: Set to 'true' for local testing
 * - NEXT_PUBLIC_BASE_URL: Base URL for the app (default: http://localhost:3003)
 */

import type { APIRequestContext } from '@playwright/test'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3003'
const WEBHOOK_ENDPOINT = `${BASE_URL}/api/webhooks/stripe`

// =============================================================================
// Types for Webhook Event Building
// =============================================================================

interface WebhookEventParams {
  id?: string
  created?: number
  livemode?: boolean
}

interface CheckoutSessionData {
  id?: string
  customer?: string | null
  subscription?: string | null
  mode?: 'subscription' | 'payment' | 'setup'
  payment_status?: 'paid' | 'unpaid' | 'no_payment_required'
  status?: 'complete' | 'expired' | 'open'
  amount_subtotal?: number
  amount_total?: number
  currency?: string
  metadata?: Record<string, string>
}

interface SubscriptionData {
  id?: string
  customer?: string
  status?: 'active' | 'canceled' | 'incomplete' | 'past_due' | 'trialing' | 'unpaid'
  cancel_at_period_end?: boolean
  cancel_at?: number | null
  canceled_at?: number | null
  ended_at?: number | null
  current_period_start?: number
  current_period_end?: number
  trial_start?: number | null
  trial_end?: number | null
  metadata?: Record<string, string>
  items?: {
    object: 'list'
    data: Array<{
      id: string
      price: { id: string }
    }>
  }
}

interface InvoiceData {
  id?: string
  customer?: string
  subscription?: string | null
  billing_reason?: 'subscription_cycle' | 'subscription_create' | 'subscription_update' | 'manual'
  status?: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void'
  paid?: boolean
  amount_due?: number
  amount_paid?: number
  amount_remaining?: number
  currency?: string
  period_start?: number
  period_end?: number
  customer_email?: string | null
  metadata?: Record<string, string>
}

interface WebhookEvent {
  id: string
  object: 'event'
  api_version: string
  created: number
  data: {
    object: Record<string, unknown>
  }
  livemode: boolean
  pending_webhooks: number
  request: {
    id: string
    idempotency_key: string | null
  }
  type: string
}

// =============================================================================
// Event Builders
// =============================================================================

/**
 * Build a base webhook event
 */
function buildBaseEvent(
  type: string,
  data: Record<string, unknown>,
  params: WebhookEventParams = {}
): WebhookEvent {
  return {
    id: params.id || `evt_test_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    object: 'event',
    api_version: '2024-12-18.acacia',
    created: params.created || Math.floor(Date.now() / 1000),
    data: {
      object: data,
    },
    livemode: params.livemode ?? false,
    pending_webhooks: 1,
    request: {
      id: `req_test_${Date.now()}`,
      idempotency_key: null,
    },
    type,
  }
}

/**
 * Build checkout.session.completed event
 */
export function buildCheckoutCompletedEvent(
  session: CheckoutSessionData,
  params: WebhookEventParams = {}
): WebhookEvent {
  const sessionData: Record<string, unknown> = {
    id: session.id || `cs_test_${Date.now()}`,
    object: 'checkout.session',
    amount_subtotal: session.amount_subtotal ?? 999,
    amount_total: session.amount_total ?? 999,
    currency: session.currency || 'usd',
    customer: session.customer || null,
    mode: session.mode || 'subscription',
    payment_status: session.payment_status || 'paid',
    status: session.status || 'complete',
    subscription: session.subscription || null,
    metadata: session.metadata || {},
  }

  return buildBaseEvent('checkout.session.completed', sessionData, params)
}

/**
 * Build customer.subscription.created event
 */
export function buildSubscriptionCreatedEvent(
  subscription: SubscriptionData,
  params: WebhookEventParams = {}
): WebhookEvent {
  const subData = buildSubscriptionObject(subscription)
  return buildBaseEvent('customer.subscription.created', subData, params)
}

/**
 * Build customer.subscription.updated event
 */
export function buildSubscriptionUpdatedEvent(
  subscription: SubscriptionData,
  params: WebhookEventParams = {}
): WebhookEvent {
  const subData = buildSubscriptionObject(subscription)
  return buildBaseEvent('customer.subscription.updated', subData, params)
}

/**
 * Build customer.subscription.deleted event
 */
export function buildSubscriptionDeletedEvent(
  subscription: SubscriptionData,
  params: WebhookEventParams = {}
): WebhookEvent {
  const subData = buildSubscriptionObject({
    ...subscription,
    status: 'canceled',
    canceled_at: subscription.canceled_at || Math.floor(Date.now() / 1000),
    ended_at: subscription.ended_at || Math.floor(Date.now() / 1000),
  })
  return buildBaseEvent('customer.subscription.deleted', subData, params)
}

/**
 * Build invoice.payment_succeeded event
 */
export function buildInvoicePaymentSucceededEvent(
  invoice: InvoiceData,
  params: WebhookEventParams = {}
): WebhookEvent {
  const invoiceData: Record<string, unknown> = {
    id: invoice.id || `in_test_${Date.now()}`,
    object: 'invoice',
    amount_due: invoice.amount_due ?? 999,
    amount_paid: invoice.amount_paid ?? 999,
    amount_remaining: invoice.amount_remaining ?? 0,
    billing_reason: invoice.billing_reason || 'subscription_cycle',
    currency: invoice.currency || 'usd',
    customer: invoice.customer || '',
    customer_email: invoice.customer_email || null,
    paid: invoice.paid ?? true,
    status: invoice.status || 'paid',
    subscription: invoice.subscription || null,
    period_start: invoice.period_start || Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60,
    period_end: invoice.period_end || Math.floor(Date.now() / 1000),
    metadata: invoice.metadata || {},
    lines: { object: 'list', data: [], has_more: false, url: '' },
  }

  return buildBaseEvent('invoice.payment_succeeded', invoiceData, params)
}

/**
 * Build invoice.payment_failed event
 */
export function buildInvoicePaymentFailedEvent(
  invoice: InvoiceData,
  params: WebhookEventParams = {}
): WebhookEvent {
  const invoiceData: Record<string, unknown> = {
    id: invoice.id || `in_test_${Date.now()}`,
    object: 'invoice',
    amount_due: invoice.amount_due ?? 999,
    amount_paid: invoice.amount_paid ?? 0,
    amount_remaining: invoice.amount_remaining ?? 999,
    billing_reason: invoice.billing_reason || 'subscription_cycle',
    currency: invoice.currency || 'usd',
    customer: invoice.customer || '',
    paid: false,
    status: invoice.status || 'open',
    subscription: invoice.subscription || null,
    metadata: invoice.metadata || {},
    lines: { object: 'list', data: [], has_more: false, url: '' },
  }

  return buildBaseEvent('invoice.payment_failed', invoiceData, params)
}

/**
 * Build customer.subscription.trial_will_end event
 */
export function buildTrialWillEndEvent(
  subscription: SubscriptionData,
  params: WebhookEventParams = {}
): WebhookEvent {
  const subData = buildSubscriptionObject(subscription)
  return buildBaseEvent('customer.subscription.trial_will_end', subData, params)
}

/**
 * Helper to build a subscription object
 */
function buildSubscriptionObject(subscription: SubscriptionData): Record<string, unknown> {
  const now = Math.floor(Date.now() / 1000)
  const periodEnd = now + 30 * 24 * 60 * 60 // 30 days from now

  return {
    id: subscription.id || `sub_test_${Date.now()}`,
    object: 'subscription',
    cancel_at: subscription.cancel_at ?? null,
    cancel_at_period_end: subscription.cancel_at_period_end ?? false,
    canceled_at: subscription.canceled_at ?? null,
    current_period_end: subscription.current_period_end ?? periodEnd,
    current_period_start: subscription.current_period_start ?? now,
    customer: subscription.customer || '',
    ended_at: subscription.ended_at ?? null,
    items: subscription.items || {
      object: 'list',
      data: [],
      has_more: false,
      url: '',
    },
    metadata: subscription.metadata || {},
    status: subscription.status || 'active',
    trial_end: subscription.trial_end ?? null,
    trial_start: subscription.trial_start ?? null,
  }
}

// =============================================================================
// Event Senders
// =============================================================================

/**
 * Send a webhook event to the local endpoint
 */
export async function sendWebhookEvent(
  request: APIRequestContext,
  event: WebhookEvent,
  webhookUrl?: string
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const url = webhookUrl || WEBHOOK_ENDPOINT

  const response = await request.post(url, {
    data: event,
    headers: {
      'Content-Type': 'application/json',
      // For local testing, we send a dummy signature
      // Set STRIPE_SKIP_SIGNATURE_CHECK=true in the app to bypass validation
      'stripe-signature': `t=${Date.now()},v1=test_signature_for_local_testing`,
    },
  })

  let body: unknown
  try {
    body = await response.json()
  } catch {
    body = await response.text()
  }

  return {
    ok: response.ok(),
    status: response.status(),
    body,
  }
}

/**
 * Send a subscription created webhook
 */
export async function simulateSubscriptionCreated(
  request: APIRequestContext,
  subscriptionData: SubscriptionData
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const event = buildSubscriptionCreatedEvent(subscriptionData)
  return sendWebhookEvent(request, event)
}

/**
 * Send a subscription updated webhook
 */
export async function simulateSubscriptionUpdated(
  request: APIRequestContext,
  subscriptionData: SubscriptionData
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const event = buildSubscriptionUpdatedEvent(subscriptionData)
  return sendWebhookEvent(request, event)
}

/**
 * Send a subscription deleted webhook
 */
export async function simulateSubscriptionDeleted(
  request: APIRequestContext,
  subscriptionData: SubscriptionData
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const event = buildSubscriptionDeletedEvent(subscriptionData)
  return sendWebhookEvent(request, event)
}

/**
 * Send an invoice payment succeeded webhook (triggers quota reset)
 */
export async function simulateInvoicePaymentSucceeded(
  request: APIRequestContext,
  invoiceData: InvoiceData
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const event = buildInvoicePaymentSucceededEvent(invoiceData)
  return sendWebhookEvent(request, event)
}

/**
 * Send checkout completed webhook
 */
export async function simulateCheckoutCompleted(
  request: APIRequestContext,
  sessionData: CheckoutSessionData
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const event = buildCheckoutCompletedEvent(sessionData)
  return sendWebhookEvent(request, event)
}
