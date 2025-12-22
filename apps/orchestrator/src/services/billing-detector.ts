/**
 * Billing Detector Service
 *
 * Detects billable actions from agent SSE events.
 * Supports multiple detection sources:
 * 1. SDK billing events (explicit declaration)
 * 2. File output events (research/ideation based on file type)
 * 3. Scheduled post events (auto_posting)
 * 4. Monitor events (monitors)
 */

import { FeatureType } from '../utils/agents'

/**
 * Source of the billing claim
 */
export type BillingSource = 'sdk' | 'file_output' | 'scheduled_post' | 'monitor_event' | 'detected'

/**
 * A detected billing claim
 */
export interface BillingClaim {
  type: FeatureType
  source: BillingSource
  confidence: number // 0-1
  metadata: Record<string, unknown>
}

/**
 * Accumulated events from a session for billing detection
 */
export interface SessionEvents {
  fileOutputs: FileOutputEvent[]
  scheduledPosts: ScheduledPostEvent[]
  monitorEvents: MonitorEvent[]
  sdkBillingEvents: SdkBillingEvent[]
  taskCompleted: boolean
  taskFailed: boolean
}

interface FileOutputEvent {
  type: string
  name: string
  format?: string
  size?: number
  content?: string
}

interface ScheduledPostEvent {
  platform: string
  postId?: string
  scheduledTime: string
}

interface MonitorEvent {
  monitorId: string
  action: 'created' | 'deleted'
  type?: string
}

interface SdkBillingEvent {
  type: FeatureType
  action: 'start' | 'complete'
  metadata?: Record<string, unknown>
}

/**
 * Create an empty session events container
 */
export function createSessionEvents(): SessionEvents {
  return {
    fileOutputs: [],
    scheduledPosts: [],
    monitorEvents: [],
    sdkBillingEvents: [],
    taskCompleted: false,
    taskFailed: false,
  }
}

/**
 * Process an SSE event and update session events
 */
export function processSSEEvent(session: SessionEvents, event: any): void {
  console.log('💰 [BILLING DETECTOR] Processing event:', event.type || event.state || 'unknown')

  // SDK billing event
  if (event.type === 'billing_event' && event.billing) {
    console.log('💰 [BILLING DETECTOR] SDK billing event:', event.billing)
    session.sdkBillingEvents.push({
      type: event.billing.type,
      action: event.billing.action,
      metadata: event.billing.metadata,
    })
    return
  }

  // File output event
  if (event.type === 'file_output' || event.fileType || (event.name && event.content)) {
    console.log('💰 [BILLING DETECTOR] File output event:', {
      type: event.fileType || event.type,
      name: event.name,
      size: event.size || event.content?.length,
    })
    session.fileOutputs.push({
      type: event.fileType || event.type || 'unknown',
      name: event.name || 'unnamed',
      format: event.format,
      size: event.size || event.content?.length || 0,
      content: event.content,
    })
    return
  }

  // Scheduled post event
  if (event.type === 'scheduled_post') {
    console.log('💰 [BILLING DETECTOR] Scheduled post event:', event)
    session.scheduledPosts.push({
      platform: event.platform,
      postId: event.postId,
      scheduledTime: event.scheduledTime,
    })
    return
  }

  // Monitor created/deleted event
  if (event.type === 'monitor_created' || event.type === 'monitor_deleted') {
    console.log('💰 [BILLING DETECTOR] Monitor event:', event)
    session.monitorEvents.push({
      monitorId: event.monitorId,
      action: event.type === 'monitor_created' ? 'created' : 'deleted',
      type: event.monitorType,
    })
    return
  }

  // Task completion status
  if (event.state === 'completed') {
    session.taskCompleted = true
  }
  if (event.state === 'failed') {
    session.taskFailed = true
  }
}

/**
 * Detect file type category from file output
 */
function detectFileCategory(file: FileOutputEvent): 'research' | 'ideation' | null {
  const type = (file.type || '').toLowerCase()
  const name = (file.name || '').toLowerCase()
  const format = (file.format || '').toLowerCase()

  // Research indicators
  const researchPatterns = ['report', 'analysis', 'research', 'insight', 'data', 'competitor', 'market']
  if (researchPatterns.some(p => type.includes(p) || name.includes(p))) {
    return 'research'
  }

  // Ideation indicators
  const ideationPatterns = ['content', 'ideas', 'calendar', 'post', 'suggestion', 'creative', 'draft']
  if (ideationPatterns.some(p => type.includes(p) || name.includes(p))) {
    return 'ideation'
  }

  // Format-based detection
  if (format === 'csv' || format === 'xlsx') {
    return 'research' // Data files are usually research
  }

  // Default to research for HTML reports
  if (format === 'html' && file.size && file.size > 1000) {
    return 'research'
  }

  return null
}

/**
 * Detect billing claims from accumulated session events
 */
export function detectBillingClaims(session: SessionEvents): BillingClaim[] {
  const claims: BillingClaim[] = []

  console.log('💰 [BILLING DETECTOR] Detecting claims from session:', {
    fileOutputs: session.fileOutputs.length,
    scheduledPosts: session.scheduledPosts.length,
    monitorEvents: session.monitorEvents.length,
    sdkBillingEvents: session.sdkBillingEvents.length,
    taskCompleted: session.taskCompleted,
    taskFailed: session.taskFailed,
  })

  // Don't bill for failed tasks (unless file was already generated)
  if (session.taskFailed && session.fileOutputs.length === 0) {
    console.log('💰 [BILLING DETECTOR] Task failed with no output - no billing')
    return claims
  }

  // Priority 1: SDK billing events (explicit declaration)
  const completedSdkEvents = session.sdkBillingEvents.filter(e => e.action === 'complete')
  if (completedSdkEvents.length > 0) {
    // Use only the first completed billing event (prevent double billing)
    const sdkEvent = completedSdkEvents[0]
    console.log('💰 [BILLING DETECTOR] Using SDK billing event:', sdkEvent)
    claims.push({
      type: sdkEvent.type,
      source: 'sdk',
      confidence: 1.0,
      metadata: {
        ...sdkEvent.metadata,
        sdkDeclared: true,
      },
    })
    return claims // SDK is authoritative, don't detect from outputs
  }

  // Priority 2: File outputs
  if (session.fileOutputs.length > 0) {
    const totalSize = session.fileOutputs.reduce((sum, f) => sum + (f.size || 0), 0)

    // Skip empty outputs
    if (totalSize === 0) {
      console.log('💰 [BILLING DETECTOR] Empty file outputs - no billing')
    } else {
      // Detect category from first file with identifiable type
      let detectedType: 'research' | 'ideation' | null = null
      for (const file of session.fileOutputs) {
        detectedType = detectFileCategory(file)
        if (detectedType) break
      }

      if (detectedType) {
        console.log('💰 [BILLING DETECTOR] Detected from file output:', { detectedType, totalSize })
        claims.push({
          type: detectedType,
          source: 'file_output',
          confidence: 0.9,
          metadata: {
            fileCount: session.fileOutputs.length,
            totalSize,
            files: session.fileOutputs.map(f => ({ name: f.name, type: f.type, size: f.size })),
          },
        })
      }
    }
  }

  // Priority 3: Scheduled posts (definitive)
  if (session.scheduledPosts.length > 0) {
    console.log('💰 [BILLING DETECTOR] Detected auto_posting from scheduled posts:', session.scheduledPosts.length)
    claims.push({
      type: 'auto_posting',
      source: 'scheduled_post',
      confidence: 1.0,
      metadata: {
        postCount: session.scheduledPosts.length,
        platforms: Array.from(new Set(session.scheduledPosts.map(p => p.platform))),
        posts: session.scheduledPosts,
      },
    })
  }

  // Priority 4: Monitor events (definitive)
  const monitorCreations = session.monitorEvents.filter(e => e.action === 'created')
  if (monitorCreations.length > 0) {
    console.log('💰 [BILLING DETECTOR] Detected monitors from monitor_created events:', monitorCreations.length)
    claims.push({
      type: 'monitors',
      source: 'monitor_event',
      confidence: 1.0,
      metadata: {
        monitorCount: monitorCreations.length,
        monitors: monitorCreations,
      },
    })
  }

  console.log('💰 [BILLING DETECTOR] Total claims detected:', claims.length)
  return claims
}

/**
 * Get the primary billing claim (if any)
 * Returns the highest-priority claim
 */
export function getPrimaryBillingClaim(session: SessionEvents): BillingClaim | null {
  const claims = detectBillingClaims(session)

  if (claims.length === 0) {
    return null
  }

  // Sort by confidence (highest first)
  claims.sort((a, b) => b.confidence - a.confidence)

  return claims[0]
}
