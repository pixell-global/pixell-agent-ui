/**
 * Audit Queue Service
 *
 * Background service that processes billing events for LLM verification.
 * Runs periodically to audit pending claims.
 */

import { billingEventsRepository, BillingEventWithContext, AuditResult } from '@pixell/db-mysql'
import { auditBillingClaim } from './llm-auditor'

/**
 * Configuration for the audit queue
 */
export interface AuditQueueConfig {
  // How often to process the queue (ms)
  pollInterval: number
  // Max items to process per batch
  batchSize: number
  // Whether to auto-approve high-confidence claims
  autoApproveHighConfidence: boolean
  // Confidence threshold for auto-approval
  autoApproveThreshold: number
  // Whether auditing is enabled
  enabled: boolean
}

const DEFAULT_CONFIG: AuditQueueConfig = {
  pollInterval: 60000, // 1 minute
  batchSize: 10,
  autoApproveHighConfidence: true,
  autoApproveThreshold: 0.95,
  enabled: true,
}

/**
 * Audit Queue Service
 */
export class AuditQueueService {
  private config: AuditQueueConfig
  private intervalId: NodeJS.Timeout | null = null
  private isProcessing: boolean = false
  private stats = {
    processed: 0,
    approved: 0,
    flagged: 0,
    errors: 0,
    lastRun: null as Date | null,
  }

  constructor(config: Partial<AuditQueueConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Start the audit queue processor
   */
  start(): void {
    if (this.intervalId) {
      console.log('🔍 [AUDIT QUEUE] Already running')
      return
    }

    if (!this.config.enabled) {
      console.log('🔍 [AUDIT QUEUE] Disabled by configuration')
      return
    }

    console.log('🔍 [AUDIT QUEUE] Starting audit queue processor', {
      pollInterval: this.config.pollInterval,
      batchSize: this.config.batchSize,
    })

    // Run immediately on start
    this.processQueue()

    // Then run periodically
    this.intervalId = setInterval(() => {
      this.processQueue()
    }, this.config.pollInterval)
  }

  /**
   * Stop the audit queue processor
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
      console.log('🔍 [AUDIT QUEUE] Stopped')
    }
  }

  /**
   * Process pending items in the queue
   */
  async processQueue(): Promise<void> {
    if (this.isProcessing) {
      console.log('🔍 [AUDIT QUEUE] Already processing, skipping')
      return
    }

    this.isProcessing = true
    this.stats.lastRun = new Date()

    try {
      console.log('🔍 [AUDIT QUEUE] Processing queue...')

      // Get pending items
      const pendingItems = await billingEventsRepository.getPendingAuditItems(this.config.batchSize)

      if (pendingItems.length === 0) {
        console.log('🔍 [AUDIT QUEUE] No pending items')
        return
      }

      console.log(`🔍 [AUDIT QUEUE] Processing ${pendingItems.length} items`)

      // Process each item
      for (const item of pendingItems) {
        await this.processItem(item)
      }

      console.log('🔍 [AUDIT QUEUE] Batch complete', {
        processed: pendingItems.length,
        stats: this.stats,
      })
    } catch (error) {
      console.error('🔍 [AUDIT QUEUE] Error processing queue:', error)
      this.stats.errors++
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * Process a single audit item
   */
  private async processItem(item: BillingEventWithContext): Promise<void> {
    const { queueItem } = item

    if (!queueItem) {
      console.error('🔍 [AUDIT QUEUE] No queue item for event', item.id)
      return
    }

    try {
      // Mark as processing
      await billingEventsRepository.markQueueItemProcessing(queueItem.id)

      // Check for auto-approval
      if (this.shouldAutoApprove(item)) {
        console.log(`🔍 [AUDIT QUEUE] Auto-approving event ${item.id} (high confidence)`)
        await this.autoApprove(item, queueItem.id)
        return
      }

      // Run LLM audit
      console.log(`🔍 [AUDIT QUEUE] Running LLM audit for event ${item.id}`)
      const result = await this.runLLMAudit(item)

      // Complete audit
      await billingEventsRepository.completeAudit(
        item.id,
        queueItem.id,
        result,
        'llm-auditor'
      )

      // Update stats
      this.stats.processed++
      if (result.approved) {
        this.stats.approved++
      } else {
        this.stats.flagged++
      }

      console.log(`🔍 [AUDIT QUEUE] Event ${item.id} audit complete:`, {
        approved: result.approved,
        actualType: result.actualType,
        qualityScore: result.qualityScore,
        reason: result.reason,
      })
    } catch (error) {
      console.error(`🔍 [AUDIT QUEUE] Error processing event ${item.id}:`, error)

      // Mark as failed
      await billingEventsRepository.failQueueItem(
        queueItem.id,
        error instanceof Error ? error.message : 'Unknown error'
      )

      this.stats.errors++
    }
  }

  /**
   * Check if an item should be auto-approved
   */
  private shouldAutoApprove(item: BillingEventWithContext): boolean {
    if (!this.config.autoApproveHighConfidence) return false

    // Auto-approve definitive detections
    if (item.detectionSource === 'scheduled_post' || item.detectionSource === 'monitor_event') {
      return true
    }

    // Auto-approve high-confidence file_output detections
    const confidence = parseFloat(item.detectionConfidence?.toString() || '0')
    if (confidence >= this.config.autoApproveThreshold) {
      return true
    }

    return false
  }

  /**
   * Auto-approve an item without LLM verification
   */
  private async autoApprove(item: BillingEventWithContext, queueId: number): Promise<void> {
    const result: AuditResult = {
      approved: true,
      actualType: item.claimedType,
      qualityScore: 100,
      reason: 'Auto-approved: High confidence detection',
    }

    await billingEventsRepository.completeAudit(item.id, queueId, result, 'auto-approver')

    this.stats.processed++
    this.stats.approved++
  }

  /**
   * Run LLM audit on an item
   */
  private async runLLMAudit(item: BillingEventWithContext): Promise<AuditResult> {
    // Extract artifacts for audit
    const artifacts = item.outputArtifacts as Record<string, unknown>[] | null

    return await auditBillingClaim({
      claimedType: item.claimedType,
      userPrompt: item.userPrompt || '',
      agentResponseSummary: item.agentResponseSummary || '',
      outputArtifacts: artifacts || [],
      detectionSource: item.detectionSource,
    })
  }

  /**
   * Get current queue statistics
   */
  getStats(): typeof this.stats {
    return { ...this.stats }
  }

  /**
   * Manually trigger queue processing
   */
  async triggerProcessing(): Promise<void> {
    await this.processQueue()
  }
}

// Singleton instance
let auditQueueInstance: AuditQueueService | null = null

/**
 * Get or create the audit queue service
 */
export function getAuditQueue(config?: Partial<AuditQueueConfig>): AuditQueueService {
  if (!auditQueueInstance) {
    auditQueueInstance = new AuditQueueService(config)
  }
  return auditQueueInstance
}

/**
 * Start the audit queue service
 */
export function startAuditQueue(config?: Partial<AuditQueueConfig>): AuditQueueService {
  const queue = getAuditQueue(config)
  queue.start()
  return queue
}

/**
 * Stop the audit queue service
 */
export function stopAuditQueue(): void {
  if (auditQueueInstance) {
    auditQueueInstance.stop()
    auditQueueInstance = null
  }
}
