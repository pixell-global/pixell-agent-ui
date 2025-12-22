/**
 * Edge Case Test Scenarios
 *
 * Scenarios for testing error handling and edge conditions.
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
  sendError,
  sleep,
} from '../sse-helpers'

/**
 * Edge case: Agent times out before completing
 * Expected: No billing should be recorded
 */
async function edgeCaseTimeout(req: Request, res: Response): Promise<void> {
  initSSE(res)
  const ctx = createSSEContext(req, res)

  console.log('🧪 [SCENARIO] edge-case-timeout started')

  sendStatus(ctx, 'Starting long-running task...')
  await sleep(100)

  sendStatus(ctx, 'Still processing...')
  await sleep(100)

  // Simulate timeout by sending error instead of complete
  sendError(ctx, 'Task timed out after 30 seconds')
  console.log('🧪 [SCENARIO] edge-case-timeout completed with error')
}

/**
 * Edge case: Agent fails during execution
 * Expected: No billing should be recorded
 */
async function edgeCaseFailure(req: Request, res: Response): Promise<void> {
  initSSE(res)
  const ctx = createSSEContext(req, res)

  console.log('🧪 [SCENARIO] edge-case-failure started')

  sendStatus(ctx, 'Connecting to data source...')
  await sleep(100)

  // Simulate failure
  sendError(ctx, 'Failed to connect to external API')
  console.log('🧪 [SCENARIO] edge-case-failure completed with error')
}

/**
 * Edge case: Partial completion with some output
 * Expected: Should still bill if file output was generated
 */
async function edgeCasePartialCompletion(req: Request, res: Response): Promise<void> {
  initSSE(res)
  const ctx = createSSEContext(req, res)

  console.log('🧪 [SCENARIO] edge-case-partial-completion started')

  sendStatus(ctx, 'Generating report...')
  await sleep(100)

  // File was generated
  sendFileOutput(ctx, {
    type: 'report',
    name: 'partial-report.html',
    content: '<h1>Partial Analysis</h1><p>Some data was analyzed but the task was interrupted.</p>',
    format: 'html',
  })

  await sleep(100)

  // But then failed
  sendError(ctx, 'Connection lost during finalization')
  console.log('🧪 [SCENARIO] edge-case-partial-completion completed with error')
}

/**
 * Edge case: Very large output
 * Expected: Should bill as XL tier based on size
 */
async function edgeCaseLargeOutput(req: Request, res: Response): Promise<void> {
  initSSE(res)
  const ctx = createSSEContext(req, res)

  console.log('🧪 [SCENARIO] edge-case-large-output started')

  sendStatus(ctx, 'Generating comprehensive report...')
  await sleep(100)

  // Generate large content (simulate 50+ pages)
  const largeContent = Array(500).fill(0).map((_, i) =>
    `<section id="section-${i}">
      <h2>Section ${i + 1}: Market Analysis</h2>
      <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.</p>
      <ul>
        <li>Data point ${i * 3 + 1}: Analysis result</li>
        <li>Data point ${i * 3 + 2}: Market trend</li>
        <li>Data point ${i * 3 + 3}: Competitor insight</li>
      </ul>
    </section>`
  ).join('\n')

  sendFileOutput(ctx, {
    type: 'report',
    name: 'comprehensive-analysis.html',
    content: largeContent,
    format: 'html',
    size: largeContent.length,
  })

  sendBillingEvent(ctx, {
    type: 'research',
    action: 'complete',
    tier: 'xl',
    metadata: { pages: 50, sections: 500 },
  })

  sendComplete(ctx, 'Comprehensive analysis complete.')
  console.log('🧪 [SCENARIO] edge-case-large-output completed')
}

/**
 * Edge case: Multiple file outputs in single task
 * Expected: Should bill once, not per file
 */
async function edgeCaseMultipleFiles(req: Request, res: Response): Promise<void> {
  initSSE(res)
  const ctx = createSSEContext(req, res)

  console.log('🧪 [SCENARIO] edge-case-multiple-files started')

  sendStatus(ctx, 'Generating multi-part analysis...')
  await sleep(100)

  // Multiple file outputs
  sendFileOutput(ctx, {
    type: 'report',
    name: 'executive-summary.html',
    content: '<h1>Executive Summary</h1><p>Key findings...</p>',
    format: 'html',
  })

  sendFileOutput(ctx, {
    type: 'data',
    name: 'raw-data.csv',
    content: 'competitor,market_share,growth\nBrandA,25%,5%\nBrandB,30%,3%',
    format: 'csv',
  })

  sendFileOutput(ctx, {
    type: 'chart',
    name: 'market-chart.json',
    content: JSON.stringify({ type: 'bar', data: [25, 30, 20, 15, 10] }),
    format: 'json',
  })

  // Single billing event for all outputs
  sendBillingEvent(ctx, {
    type: 'research',
    action: 'complete',
    tier: 'large',
    metadata: { files: 3, totalPages: 15 },
  })

  sendComplete(ctx, 'Multi-part analysis complete with 3 files.')
  console.log('🧪 [SCENARIO] edge-case-multiple-files completed')
}

/**
 * Edge case: Empty file output
 * Expected: Should not bill for empty output
 */
async function edgeCaseEmptyOutput(req: Request, res: Response): Promise<void> {
  initSSE(res)
  const ctx = createSSEContext(req, res)

  console.log('🧪 [SCENARIO] edge-case-empty-output started')

  sendStatus(ctx, 'Searching for data...')
  await sleep(100)

  // Empty file output
  sendFileOutput(ctx, {
    type: 'report',
    name: 'empty-report.html',
    content: '', // Empty!
    format: 'html',
    size: 0,
  })

  sendContent(ctx, 'No relevant data found for your query.')

  // Should not bill for empty output
  sendComplete(ctx)
  console.log('🧪 [SCENARIO] edge-case-empty-output completed')
}

/**
 * Edge case: Rapid successive requests (rate limiting test)
 * Expected: Should handle without errors
 */
async function edgeCaseRapidRequests(req: Request, res: Response): Promise<void> {
  initSSE(res)
  const ctx = createSSEContext(req, res)

  console.log('🧪 [SCENARIO] edge-case-rapid-requests started')

  // Minimal processing
  sendStatus(ctx, 'Quick task...')

  sendContent(ctx, 'Quick response.')

  sendBillingEvent(ctx, {
    type: 'ideation',
    action: 'complete',
    tier: 'small',
  })

  sendComplete(ctx)
  console.log('🧪 [SCENARIO] edge-case-rapid-requests completed')
}

// Export all edge case scenarios
export const edgeCaseScenarios: Record<string, (req: Request, res: Response) => Promise<void>> = {
  'edge-case-timeout': edgeCaseTimeout,
  'edge-case-failure': edgeCaseFailure,
  'edge-case-partial-completion': edgeCasePartialCompletion,
  'edge-case-large-output': edgeCaseLargeOutput,
  'edge-case-multiple-files': edgeCaseMultipleFiles,
  'edge-case-empty-output': edgeCaseEmptyOutput,
  'edge-case-rapid-requests': edgeCaseRapidRequests,
}
