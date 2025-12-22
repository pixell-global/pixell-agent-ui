/**
 * Fraud Attempt Test Scenarios
 *
 * Scenarios that attempt to manipulate billing.
 * These should be flagged by the LLM auditor.
 */

import { Request, Response } from 'express'
import {
  initSSE,
  createSSEContext,
  sendStatus,
  sendContent,
  sendFileOutput,
  sendBillingEvent,
  sendComplete,
  sleep,
} from '../sse-helpers'

/**
 * Fraud scenario: Claim XL tier for tiny output
 * Expected: Should be flagged by auditor for tier mismatch
 */
async function fraudInflatedTier(req: Request, res: Response): Promise<void> {
  initSSE(res)
  const ctx = createSSEContext(req, res)

  console.log('🧪 [SCENARIO] fraud-inflated-tier started')

  sendStatus(ctx, 'Generating report...')
  await sleep(100)

  // Tiny output
  sendFileOutput(ctx, {
    type: 'report',
    name: 'tiny-report.txt',
    content: 'Just a few words here.',
    format: 'txt',
    size: 20,
  })

  // But claims XL tier!
  sendBillingEvent(ctx, {
    type: 'research',
    action: 'complete',
    tier: 'xl', // Fraudulent: claiming XL for tiny output
    metadata: { pages: 50 }, // Lying about pages
  })

  sendComplete(ctx, 'Report complete.')
  console.log('🧪 [SCENARIO] fraud-inflated-tier completed')
}

/**
 * Fraud scenario: Claim wrong action type
 * Expected: Should be flagged by auditor for type mismatch
 */
async function fraudWrongType(req: Request, res: Response): Promise<void> {
  initSSE(res)
  const ctx = createSSEContext(req, res)

  console.log('🧪 [SCENARIO] fraud-wrong-type started')

  sendStatus(ctx, 'Generating ideas...')
  await sleep(100)

  // Clearly ideation content
  sendContent(ctx, `Here are some post ideas:
1. Morning routine tips
2. Product reviews
3. Before/after transformations`)

  // But claims research billing!
  sendBillingEvent(ctx, {
    type: 'research', // Fraudulent: this is ideation, not research
    action: 'complete',
    tier: 'medium',
    metadata: { type: 'market_analysis' }, // Lying about content type
  })

  sendComplete(ctx)
  console.log('🧪 [SCENARIO] fraud-wrong-type completed')
}

/**
 * Fraud scenario: Multiple billing events for single task
 * Expected: Should detect and flag double billing attempt
 */
async function fraudDoubleBilling(req: Request, res: Response): Promise<void> {
  initSSE(res)
  const ctx = createSSEContext(req, res)

  console.log('🧪 [SCENARIO] fraud-double-billing started')

  sendStatus(ctx, 'Working...')
  await sleep(100)

  sendContent(ctx, 'Here is your analysis.')

  // First billing event
  sendBillingEvent(ctx, {
    type: 'research',
    action: 'complete',
    tier: 'medium',
  })

  await sleep(50)

  // Second billing event for same task!
  sendBillingEvent(ctx, {
    type: 'research',
    action: 'complete',
    tier: 'medium',
  })

  sendComplete(ctx)
  console.log('🧪 [SCENARIO] fraud-double-billing completed')
}

/**
 * Fraud scenario: Claim billing without any output
 * Expected: Should be flagged - no evidence of work
 */
async function fraudNoEvidence(req: Request, res: Response): Promise<void> {
  initSSE(res)
  const ctx = createSSEContext(req, res)

  console.log('🧪 [SCENARIO] fraud-no-evidence started')

  sendStatus(ctx, 'Processing...')
  await sleep(100)

  // No content, no file output, but claims billing
  sendBillingEvent(ctx, {
    type: 'research',
    action: 'complete',
    tier: 'large',
    metadata: { pages: 20 },
  })

  sendComplete(ctx)
  console.log('🧪 [SCENARIO] fraud-no-evidence completed')
}

/**
 * Fraud scenario: Auto-posting claim without actual post
 * Expected: Should be flagged - no scheduled_post event
 */
async function fraudFakeAutoPost(req: Request, res: Response): Promise<void> {
  initSSE(res)
  const ctx = createSSEContext(req, res)

  console.log('🧪 [SCENARIO] fraud-fake-auto-post started')

  sendStatus(ctx, 'Scheduling posts...')
  await sleep(100)

  sendContent(ctx, 'I would schedule posts for you but the feature is under maintenance.')

  // Claims auto_posting without actually scheduling
  sendBillingEvent(ctx, {
    type: 'auto_posting',
    action: 'complete',
    tier: 'medium',
    metadata: { posts: 5 },
  })

  sendComplete(ctx)
  console.log('🧪 [SCENARIO] fraud-fake-auto-post completed')
}

// Export all fraud scenarios
export const fraudScenarios: Record<string, (req: Request, res: Response) => Promise<void>> = {
  'fraud-inflated-tier': fraudInflatedTier,
  'fraud-wrong-type': fraudWrongType,
  'fraud-double-billing': fraudDoubleBilling,
  'fraud-no-evidence': fraudNoEvidence,
  'fraud-fake-auto-post': fraudFakeAutoPost,
}
