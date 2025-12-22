/**
 * Billing Protocol Types
 *
 * Types for agents to declare billable actions via the SDK.
 */

/**
 * Feature types that can be billed
 */
export type BillingFeatureType = 'research' | 'ideation' | 'auto_posting' | 'monitors'

/**
 * Billing action (start indicates intent, complete indicates work done)
 */
export type BillingAction = 'start' | 'complete'

/**
 * A billing event emitted by an agent
 */
export interface BillingEvent {
  type: BillingFeatureType
  action: BillingAction
  metadata?: BillingMetadata
}

/**
 * Metadata for billing events
 */
export interface BillingMetadata {
  // Research-specific
  pages?: number
  dataPoints?: number
  sources?: number

  // Ideation-specific
  suggestionCount?: number
  platforms?: string[]

  // Auto-posting-specific
  postCount?: number
  scheduledTime?: string

  // Monitor-specific
  monitorType?: string
  checkFrequency?: string

  // General
  description?: string
  [key: string]: unknown
}

/**
 * SSE event format for billing
 */
export interface SSEBillingEvent {
  type: 'billing_event'
  billing: BillingEvent
  timestamp?: string
}

/**
 * Create an SSE billing event
 */
export function createBillingEvent(event: BillingEvent): SSEBillingEvent {
  return {
    type: 'billing_event',
    billing: event,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Create a billing start event (indicates intent to bill)
 */
export function billingStart(
  type: BillingFeatureType,
  metadata?: BillingMetadata
): SSEBillingEvent {
  return createBillingEvent({
    type,
    action: 'start',
    metadata,
  })
}

/**
 * Create a billing complete event (indicates work done, triggers billing)
 */
export function billingComplete(
  type: BillingFeatureType,
  metadata?: BillingMetadata
): SSEBillingEvent {
  return createBillingEvent({
    type,
    action: 'complete',
    metadata,
  })
}

/**
 * Validate a billing event
 */
export function validateBillingEvent(event: BillingEvent): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!['research', 'ideation', 'auto_posting', 'monitors'].includes(event.type)) {
    errors.push(`Invalid billing type: ${event.type}`)
  }

  if (!['start', 'complete'].includes(event.action)) {
    errors.push(`Invalid billing action: ${event.action}`)
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
