/**
 * Billing Events Repository
 *
 * Manages billing events and audit queue operations.
 */

import { eq, and, desc, lte, sql } from 'drizzle-orm'
import { getDb } from '../connection'
import {
  billingEvents,
  billingAuditQueue,
  BillingEvent,
  NewBillingEvent,
  BillingAuditQueueItem,
} from '../schema'
import { BaseRepository } from './base'

export interface BillingEventWithContext extends BillingEvent {
  queueItem?: BillingAuditQueueItem
}

export interface AuditResult {
  approved: boolean
  actualType: 'research' | 'ideation' | 'auto_posting' | 'monitors' | null
  qualityScore: number
  reason: string
}

export class BillingEventsRepository extends BaseRepository {
  /**
   * Record a new billing event and optionally queue for audit
   */
  async recordBillingEvent(
    event: Omit<NewBillingEvent, 'id' | 'createdAt' | 'updatedAt'>,
    queueForAudit: boolean = true
  ): Promise<number> {
    const db = await getDb()

    // Insert billing event
    const result = await db.insert(billingEvents).values({
      ...event,
    })

    const eventId = result[0].insertId

    // Optionally queue for audit
    if (queueForAudit) {
      await db.insert(billingAuditQueue).values({
        billingEventId: eventId,
        priority: this.calculateAuditPriority(event),
      })
    }

    return eventId
  }

  /**
   * Calculate audit priority based on claim characteristics
   * Lower number = higher priority
   */
  private calculateAuditPriority(event: Partial<NewBillingEvent>): number {
    // SDK claims need verification
    if (event.detectionSource === 'sdk') return 3

    // Low confidence detections
    if (event.detectionConfidence && parseFloat(event.detectionConfidence.toString()) < 0.9) return 2

    // Standard priority
    return 5
  }

  /**
   * Get billing event by ID
   */
  async getBillingEvent(eventId: number): Promise<BillingEvent | null> {
    const db = await getDb()
    const result = await db
      .select()
      .from(billingEvents)
      .where(eq(billingEvents.id, eventId))
      .limit(1)

    return result[0] || null
  }

  /**
   * Get billing events for an organization
   */
  async getBillingEventsByOrg(
    orgId: string,
    options: {
      limit?: number
      offset?: number
      auditStatus?: string
    } = {}
  ): Promise<BillingEvent[]> {
    const db = await getDb()
    const { limit = 50, offset = 0, auditStatus } = options

    const whereConditions = auditStatus
      ? and(
          eq(billingEvents.orgId, orgId),
          eq(billingEvents.auditStatus, auditStatus as any)
        )
      : eq(billingEvents.orgId, orgId)

    return await db
      .select()
      .from(billingEvents)
      .where(whereConditions)
      .orderBy(desc(billingEvents.createdAt))
      .limit(limit)
      .offset(offset)
  }

  /**
   * Get pending audit items from queue
   */
  async getPendingAuditItems(limit: number = 10): Promise<BillingEventWithContext[]> {
    const db = await getDb()

    const queueItems = await db
      .select()
      .from(billingAuditQueue)
      .where(
        and(
          eq(billingAuditQueue.status, 'pending'),
          lte(billingAuditQueue.attempts, billingAuditQueue.maxAttempts)
        )
      )
      .orderBy(billingAuditQueue.priority, billingAuditQueue.createdAt)
      .limit(limit)

    if (queueItems.length === 0) return []

    const eventIds = queueItems.map(q => q.billingEventId)
    const events = await db
      .select()
      .from(billingEvents)
      .where(sql`${billingEvents.id} IN (${sql.join(eventIds, sql`, `)})`)

    // Combine events with queue items
    return events.map(event => ({
      ...event,
      queueItem: queueItems.find(q => q.billingEventId === event.id),
    }))
  }

  /**
   * Mark queue item as processing
   */
  async markQueueItemProcessing(queueId: number): Promise<void> {
    const db = await getDb()
    await db
      .update(billingAuditQueue)
      .set({
        status: 'processing',
        lastAttemptAt: new Date(),
        attempts: sql`${billingAuditQueue.attempts} + 1`,
      })
      .where(eq(billingAuditQueue.id, queueId))
  }

  /**
   * Complete audit for a billing event
   */
  async completeAudit(
    eventId: number,
    queueId: number,
    result: AuditResult,
    auditor: string = 'llm-auditor'
  ): Promise<void> {
    const db = await getDb()

    // Determine audit status
    const auditStatus = result.approved ? 'approved' : 'flagged'

    // Update billing event
    await db
      .update(billingEvents)
      .set({
        auditStatus,
        auditResult: result,
        auditedAt: new Date(),
        auditedBy: auditor,
      })
      .where(eq(billingEvents.id, eventId))

    // Update queue item
    await db
      .update(billingAuditQueue)
      .set({ status: 'completed' })
      .where(eq(billingAuditQueue.id, queueId))
  }

  /**
   * Mark queue item as failed
   */
  async failQueueItem(queueId: number, errorMessage: string): Promise<void> {
    const db = await getDb()

    const item = await db
      .select()
      .from(billingAuditQueue)
      .where(eq(billingAuditQueue.id, queueId))
      .limit(1)

    if (item.length === 0) return

    const newStatus = item[0].attempts >= item[0].maxAttempts ? 'failed' : 'pending'

    await db
      .update(billingAuditQueue)
      .set({
        status: newStatus,
        errorMessage,
      })
      .where(eq(billingAuditQueue.id, queueId))
  }

  /**
   * Mark quota as incremented for a billing event
   */
  async markQuotaIncremented(eventId: number): Promise<void> {
    const db = await getDb()
    await db
      .update(billingEvents)
      .set({
        quotaIncremented: true,
        quotaIncrementAt: new Date(),
      })
      .where(eq(billingEvents.id, eventId))
  }

  /**
   * Process refund for a flagged billing event
   */
  async processRefund(eventId: number): Promise<boolean> {
    const db = await getDb()

    const event = await this.getBillingEvent(eventId)
    if (!event) return false
    if (event.auditStatus !== 'flagged') return false
    if (!event.quotaIncremented) return false

    // Update event status
    await db
      .update(billingEvents)
      .set({ auditStatus: 'refunded' })
      .where(eq(billingEvents.id, eventId))

    return true
  }

  /**
   * Get audit statistics for an organization
   */
  async getAuditStats(orgId: string): Promise<{
    total: number
    pending: number
    approved: number
    flagged: number
    refunded: number
  }> {
    const db = await getDb()

    const result = await db
      .select({
        status: billingEvents.auditStatus,
        count: sql<number>`COUNT(*)`,
      })
      .from(billingEvents)
      .where(eq(billingEvents.orgId, orgId))
      .groupBy(billingEvents.auditStatus)

    const stats = {
      total: 0,
      pending: 0,
      approved: 0,
      flagged: 0,
      refunded: 0,
    }

    for (const row of result) {
      stats[row.status as keyof typeof stats] = row.count
      stats.total += row.count
    }

    return stats
  }

  /**
   * Get recent billing events for a workflow
   */
  async getEventsByWorkflow(workflowId: string): Promise<BillingEvent[]> {
    const db = await getDb()
    return await db
      .select()
      .from(billingEvents)
      .where(eq(billingEvents.workflowId, workflowId))
      .orderBy(desc(billingEvents.createdAt))
  }
}

// Singleton instance
export const billingEventsRepository = new BillingEventsRepository()
