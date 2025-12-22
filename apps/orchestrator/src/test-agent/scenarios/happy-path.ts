/**
 * Happy Path Test Scenarios
 *
 * Normal billing flows that should work correctly.
 */

import { Request, Response } from 'express'
import {
  initSSE,
  createSSEContext,
  sendStatus,
  sendContent,
  sendFileOutput,
  sendScheduledPost,
  sendMonitorCreated,
  sendBillingEvent,
  sendComplete,
  sendError,
  sleep,
} from '../sse-helpers'
import { sampleResearchReport, sampleContentIdeas } from '../fixtures'

/**
 * Research scenario: Generate a research report with file output
 * Expected: research quota incremented, detected via file_output
 */
async function researchReport(req: Request, res: Response): Promise<void> {
  initSSE(res)
  const ctx = createSSEContext(req, res)

  console.log('🧪 [SCENARIO] research-report started')

  // 1. Send working status
  sendStatus(ctx, 'Analyzing competitor data...')
  await sleep(100)

  // 2. Send progress updates
  sendStatus(ctx, 'Gathering market insights...')
  await sleep(100)

  // 3. Generate file output (research report)
  sendFileOutput(ctx, {
    type: 'report',
    name: 'competitor-analysis.html',
    content: sampleResearchReport,
    format: 'html',
    size: sampleResearchReport.length,
  })
  await sleep(100)

  // 4. Optionally send SDK billing event
  sendBillingEvent(ctx, {
    type: 'research',
    action: 'complete',
    tier: 'medium',
    metadata: { pages: 12, dataPoints: 45 },
  })

  // 5. Complete
  sendComplete(ctx, 'Research analysis complete. Report generated.')
  console.log('🧪 [SCENARIO] research-report completed')
}

/**
 * Research scenario: No file output, only SDK billing
 * Expected: research quota incremented via SDK billing event
 */
async function researchNoOutput(req: Request, res: Response): Promise<void> {
  initSSE(res)
  const ctx = createSSEContext(req, res)

  console.log('🧪 [SCENARIO] research-no-output started')

  sendStatus(ctx, 'Analyzing your question...')
  await sleep(100)

  // Send text response without file
  sendContent(ctx, 'Based on my analysis, the top competitors in the skincare market are:\n\n1. CeraVe - Strong dermatologist positioning\n2. The Ordinary - Price-performance leader\n3. La Roche-Posay - Medical credibility')

  // Declare billing via SDK
  sendBillingEvent(ctx, {
    type: 'research',
    action: 'complete',
    tier: 'small',
    metadata: { responseType: 'conversational' },
  })

  sendComplete(ctx)
  console.log('🧪 [SCENARIO] research-no-output completed')
}

/**
 * Ideation scenario: Generate content suggestions with file output
 * Expected: ideation quota incremented, detected via file_output
 */
async function ideationSuggestions(req: Request, res: Response): Promise<void> {
  initSSE(res)
  const ctx = createSSEContext(req, res)

  console.log('🧪 [SCENARIO] ideation-suggestions started')

  sendStatus(ctx, 'Generating content ideas...')
  await sleep(100)

  // Generate content ideas file
  sendFileOutput(ctx, {
    type: 'content-calendar',
    name: 'content-ideas.json',
    content: sampleContentIdeas,
    format: 'json',
    size: sampleContentIdeas.length,
  })

  // Note: No explicit SDK billing - should detect from file_output type
  sendComplete(ctx, '10 content ideas generated.')
  console.log('🧪 [SCENARIO] ideation-suggestions completed')
}

/**
 * Ideation scenario: Pure chat with SDK billing
 * Expected: ideation quota incremented via SDK billing event
 */
async function ideationSdkOnly(req: Request, res: Response): Promise<void> {
  initSSE(res)
  const ctx = createSSEContext(req, res)

  console.log('🧪 [SCENARIO] ideation-sdk-only started')

  sendStatus(ctx, 'Brainstorming ideas...')
  await sleep(100)

  sendContent(ctx, `Here are 10 content ideas for your skincare brand:

1. "Morning vs Night Skincare Routine" - carousel post
2. "Ingredient Spotlight: Niacinamide" - educational reel
3. "Real Customer Transformations" - UGC compilation
4. "5 Skincare Myths Debunked" - TikTok series
5. "Behind the Scenes at Our Lab" - story highlights
6. "Seasonal Skincare Switches" - blog post
7. "Ask a Dermatologist" - live Q&A
8. "Ingredient Deep Dive: Retinol" - long-form video
9. "Customer Routine of the Week" - weekly feature
10. "Glow-Up Challenge" - campaign concept`)

  // Explicit SDK billing for conversational ideation
  sendBillingEvent(ctx, {
    type: 'ideation',
    action: 'complete',
    tier: 'small',
    metadata: { suggestionCount: 10 },
  })

  sendComplete(ctx)
  console.log('🧪 [SCENARIO] ideation-sdk-only completed')
}

/**
 * Auto-posting scenario: Schedule a post
 * Expected: auto_posting quota incremented, detected via scheduled_post event
 */
async function autoPostScheduled(req: Request, res: Response): Promise<void> {
  initSSE(res)
  const ctx = createSSEContext(req, res)

  console.log('🧪 [SCENARIO] auto-post-scheduled started')

  sendStatus(ctx, 'Preparing post for scheduling...')
  await sleep(100)

  sendStatus(ctx, 'Scheduling post to Reddit...')
  await sleep(100)

  // Send scheduled post event
  sendScheduledPost(ctx, {
    platform: 'reddit',
    content: 'Check out our new skincare routine guide! Perfect for beginners looking to build a simple but effective routine. [Link in bio]',
    scheduledTime: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
    postId: `post_${Date.now()}`,
  })

  sendComplete(ctx, 'Post scheduled successfully for 1 hour from now.')
  console.log('🧪 [SCENARIO] auto-post-scheduled completed')
}

/**
 * Monitor scenario: Create a new monitor
 * Expected: monitors quota incremented, detected via monitor_created event
 */
async function monitorCreate(req: Request, res: Response): Promise<void> {
  initSSE(res)
  const ctx = createSSEContext(req, res)

  console.log('🧪 [SCENARIO] monitor-create started')

  sendStatus(ctx, 'Setting up monitor...')
  await sleep(100)

  // Send monitor created event
  sendMonitorCreated(ctx, {
    monitorId: `monitor_${Date.now()}`,
    name: 'Skincare Brand Mentions',
    type: 'keyword',
    config: {
      keywords: ['skincare', 'beauty', 'routine'],
      platforms: ['reddit', 'twitter'],
      frequency: 'daily',
    },
  })

  sendComplete(ctx, 'Monitor created and will check daily.')
  console.log('🧪 [SCENARIO] monitor-create completed')
}

/**
 * No billing scenario: Agent completes without any billable action
 * Expected: No quota incremented
 */
async function noBilling(req: Request, res: Response): Promise<void> {
  initSSE(res)
  const ctx = createSSEContext(req, res)

  console.log('🧪 [SCENARIO] no-billing started')

  sendStatus(ctx, 'Processing...')
  await sleep(100)

  sendContent(ctx, 'I understand you want to know about skincare. Could you please clarify what specific aspect you\'d like me to help with?')

  // No file output, no scheduled post, no SDK billing
  sendComplete(ctx)
  console.log('🧪 [SCENARIO] no-billing completed')
}

/**
 * Research scenario: SDK billing only (no file output)
 * Expected: research quota incremented via SDK billing event
 */
async function researchSdkBilling(req: Request, res: Response): Promise<void> {
  initSSE(res)
  const ctx = createSSEContext(req, res)

  console.log('🧪 [SCENARIO] research-sdk-billing started')

  sendStatus(ctx, 'Analyzing data...')
  await sleep(100)

  // No file output, just SDK billing declaration
  sendBillingEvent(ctx, {
    type: 'research',
    action: 'complete',
    tier: 'small',
    metadata: { type: 'quick_analysis' },
  })

  sendContent(ctx, 'Analysis complete. Key findings: market is growing 8% annually.')

  sendComplete(ctx)
  console.log('🧪 [SCENARIO] research-sdk-billing completed')
}

/**
 * Research scenario: Small report (tier testing)
 * Expected: research quota incremented, small tier
 */
async function researchSmallReport(req: Request, res: Response): Promise<void> {
  initSSE(res)
  const ctx = createSSEContext(req, res)

  console.log('🧪 [SCENARIO] research-small-report started')

  sendStatus(ctx, 'Generating brief analysis...')
  await sleep(100)

  // Small file output
  sendFileOutput(ctx, {
    type: 'report',
    name: 'brief-analysis.html',
    content: '<h1>Brief Analysis</h1><p>Quick findings: Market is healthy.</p>',
    format: 'html',
    size: 70, // Small size
  })

  sendComplete(ctx, 'Brief analysis complete.')
  console.log('🧪 [SCENARIO] research-small-report completed')
}

/**
 * Ideation scenario: Content calendar file output
 * Expected: ideation quota incremented, detected via file_output
 */
async function ideationContentCalendar(req: Request, res: Response): Promise<void> {
  initSSE(res)
  const ctx = createSSEContext(req, res)

  console.log('🧪 [SCENARIO] ideation-content-calendar started')

  sendStatus(ctx, 'Creating content calendar...')
  await sleep(100)

  sendFileOutput(ctx, {
    type: 'content-calendar',
    name: 'q1-content-calendar.json',
    content: sampleContentIdeas,
    format: 'json',
    size: sampleContentIdeas.length,
  })

  sendComplete(ctx, 'Content calendar created for Q1.')
  console.log('🧪 [SCENARIO] ideation-content-calendar completed')
}

/**
 * Auto-posting scenario: Multiple platforms
 * Expected: auto_posting quota incremented, multiple platforms tracked
 */
async function autoPostMultiPlatform(req: Request, res: Response): Promise<void> {
  initSSE(res)
  const ctx = createSSEContext(req, res)

  console.log('🧪 [SCENARIO] auto-post-multi-platform started')

  sendStatus(ctx, 'Scheduling posts across platforms...')
  await sleep(100)

  // Schedule to Reddit
  sendScheduledPost(ctx, {
    platform: 'reddit',
    content: 'Check out our skincare tips! #skincare',
    scheduledTime: new Date(Date.now() + 3600000).toISOString(),
    postId: `reddit_${Date.now()}`,
  })

  // Schedule to Twitter
  sendScheduledPost(ctx, {
    platform: 'twitter',
    content: 'New blog post: 5 tips for glowing skin! Link in bio 🧴',
    scheduledTime: new Date(Date.now() + 7200000).toISOString(),
    postId: `twitter_${Date.now()}`,
  })

  sendComplete(ctx, 'Posts scheduled to Reddit and Twitter.')
  console.log('🧪 [SCENARIO] auto-post-multi-platform completed')
}

/**
 * Monitor scenario: Delete a monitor
 * Expected: No billing for deletion
 */
async function monitorDelete(req: Request, res: Response): Promise<void> {
  initSSE(res)
  const ctx = createSSEContext(req, res)

  console.log('🧪 [SCENARIO] monitor-delete started')

  sendStatus(ctx, 'Removing monitor...')
  await sleep(100)

  // Send monitor deleted event
  ctx.res.write(`data: ${JSON.stringify({
    type: 'monitor_deleted',
    monitorId: 'monitor_12345',
  })}\n\n`)

  sendComplete(ctx, 'Monitor deleted successfully.')
  console.log('🧪 [SCENARIO] monitor-delete completed')
}

/**
 * Edge case: No output at all
 * Expected: No billing
 */
async function noOutput(req: Request, res: Response): Promise<void> {
  initSSE(res)
  const ctx = createSSEContext(req, res)

  console.log('🧪 [SCENARIO] no-output started')

  sendStatus(ctx, 'Processing...')
  await sleep(100)

  // Just status updates, no actual output
  sendComplete(ctx)
  console.log('🧪 [SCENARIO] no-output completed')
}

/**
 * Edge case: Task fails but has partial output
 * Expected: Should still bill if meaningful output was generated
 */
async function taskFailPartial(req: Request, res: Response): Promise<void> {
  initSSE(res)
  const ctx = createSSEContext(req, res)

  console.log('🧪 [SCENARIO] task-fail-partial started')

  sendStatus(ctx, 'Starting analysis...')
  await sleep(100)

  // Generate partial output before failure
  sendFileOutput(ctx, {
    type: 'report',
    name: 'partial-analysis.html',
    content: '<h1>Partial Analysis</h1><p>Data collected before error occurred.</p>',
    format: 'html',
    size: 70,
  })

  await sleep(100)

  // Task fails
  sendError(ctx, 'Connection lost during processing')
  console.log('🧪 [SCENARIO] task-fail-partial completed with error')
}

/**
 * Edge case: Task fails with no output
 * Expected: No billing
 */
async function taskFailNoOutput(req: Request, res: Response): Promise<void> {
  initSSE(res)
  const ctx = createSSEContext(req, res)

  console.log('🧪 [SCENARIO] task-fail-no-output started')

  sendStatus(ctx, 'Connecting to service...')
  await sleep(100)

  // Fail immediately with no output
  sendError(ctx, 'Failed to connect to external service')
  console.log('🧪 [SCENARIO] task-fail-no-output completed with error')
}

/**
 * Combined scenario: Research + Monitor creation
 * Expected: Both research and monitors quotas incremented
 */
async function researchWithMonitor(req: Request, res: Response): Promise<void> {
  initSSE(res)
  const ctx = createSSEContext(req, res)

  console.log('🧪 [SCENARIO] research-with-monitor started')

  sendStatus(ctx, 'Analyzing market and setting up monitoring...')
  await sleep(100)

  // File output for research
  sendFileOutput(ctx, {
    type: 'report',
    name: 'market-research.html',
    content: '<h1>Market Research</h1><p>Analysis of competitive landscape.</p>' + 'x'.repeat(10000),
    format: 'html',
    size: 10100,
  })

  await sleep(100)

  // Also create a monitor
  sendMonitorCreated(ctx, {
    monitorId: `monitor_${Date.now()}`,
    name: 'Competitor Activity Monitor',
    type: 'brand_mention',
    config: { brands: ['CeraVe', 'The Ordinary'] },
  })

  sendComplete(ctx, 'Research complete and monitoring active.')
  console.log('🧪 [SCENARIO] research-with-monitor completed')
}

/**
 * Combined scenario: Ideation + Auto-posting
 * Expected: Both ideation and auto_posting quotas incremented
 */
async function ideationWithPosting(req: Request, res: Response): Promise<void> {
  initSSE(res)
  const ctx = createSSEContext(req, res)

  console.log('🧪 [SCENARIO] ideation-with-posting started')

  sendStatus(ctx, 'Generating ideas and scheduling...')
  await sleep(100)

  // File output for ideation
  sendFileOutput(ctx, {
    type: 'content-ideas',
    name: 'post-ideas.json',
    content: JSON.stringify({ ideas: ['Tip 1', 'Tip 2', 'Tip 3'] }),
    format: 'json',
    size: 50,
  })

  await sleep(100)

  // Also schedule a post
  sendScheduledPost(ctx, {
    platform: 'instagram',
    content: 'Check out our latest skincare tip!',
    scheduledTime: new Date(Date.now() + 3600000).toISOString(),
    postId: `insta_${Date.now()}`,
  })

  sendComplete(ctx, 'Ideas generated and first post scheduled.')
  console.log('🧪 [SCENARIO] ideation-with-posting completed')
}

// Export all happy path scenarios
export const researchScenarios: Record<string, (req: Request, res: Response) => Promise<void>> = {
  'research-report': researchReport,
  'research-no-output': researchNoOutput,
  'research-sdk-billing': researchSdkBilling,
  'research-small-report': researchSmallReport,
  'ideation-suggestions': ideationSuggestions,
  'ideation-sdk-only': ideationSdkOnly,
  'ideation-content-calendar': ideationContentCalendar,
  'auto-post-scheduled': autoPostScheduled,
  'auto-post-multi-platform': autoPostMultiPlatform,
  'monitor-create': monitorCreate,
  'monitor-delete': monitorDelete,
  'no-billing': noBilling,
  'no-output': noOutput,
  'task-fail-partial': taskFailPartial,
  'task-fail-no-output': taskFailNoOutput,
  'research-with-monitor': researchWithMonitor,
  'ideation-with-posting': ideationWithPosting,
}
