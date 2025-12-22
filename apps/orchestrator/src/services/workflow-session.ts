/**
 * WorkflowSessionStore - Centralized workflow state management.
 *
 * This is the SINGLE SOURCE OF TRUTH for all multi-phase agent workflows.
 * Agents are stateless - they emit events with workflowId, and this store tracks everything.
 *
 * Key principles:
 * - workflowId is the root correlation ID that ties everything together
 * - All events include workflowId
 * - Message IDs are tracked so content never gets lost
 * - Phase state machine ensures explicit transitions
 *
 * Storage:
 * - Default: In-memory (for development)
 * - Production: Redis (optional, pass redisUrl to constructor)
 */

import {
  WorkflowExecution,
  WorkflowPhase,
  WorkflowPhaseData,
  PhaseTransition,
  WorkflowEvent,
  createWorkflowExecution,
} from '@pixell/protocols'

export interface WorkflowSessionStoreOptions {
  redisUrl?: string
  ttlSeconds?: number // Default: 24 hours
}

export class WorkflowSessionStore {
  private memory: Map<string, WorkflowExecution> = new Map()
  private redis?: any // Redis client - lazy imported
  private ttlSeconds: number

  constructor(options: WorkflowSessionStoreOptions = {}) {
    this.ttlSeconds = options.ttlSeconds ?? 86400 // 24 hours

    if (options.redisUrl) {
      // Lazy load Redis to avoid dependency issues
      this.initRedis(options.redisUrl)
    }
  }

  private async initRedis(redisUrl: string): Promise<void> {
    try {
      const { Redis } = await import('ioredis')
      this.redis = new Redis(redisUrl)
      console.log('📦 WorkflowSessionStore: Redis connected')
    } catch (error) {
      console.warn('📦 WorkflowSessionStore: Redis not available, using in-memory storage')
      this.redis = undefined
    }
  }

  /**
   * Create a new workflow execution.
   * Called when a user message is sent to an agent.
   */
  async createWorkflow(params: {
    sessionId: string
    agentId: string
    agentUrl?: string
    initialMessageId: string
    responseMessageId: string
  }): Promise<WorkflowExecution> {
    const workflow = createWorkflowExecution(params)

    await this.store(workflow)

    console.log(`📋 Workflow created: ${workflow.workflowId} (session: ${params.sessionId}, agent: ${params.agentId})`)

    return workflow
  }

  /**
   * Store a workflow execution.
   */
  async store(workflow: WorkflowExecution): Promise<void> {
    workflow.updatedAt = new Date().toISOString()

    if (this.redis) {
      await this.redis.set(
        `workflow:${workflow.workflowId}`,
        JSON.stringify(workflow),
        'EX',
        this.ttlSeconds
      )
    } else {
      this.memory.set(workflow.workflowId, workflow)
    }
  }

  /**
   * Get a workflow by ID.
   */
  async get(workflowId: string): Promise<WorkflowExecution | null> {
    if (this.redis) {
      const data = await this.redis.get(`workflow:${workflowId}`)
      return data ? JSON.parse(data) : null
    }
    return this.memory.get(workflowId) || null
  }

  /**
   * Get a workflow by session ID.
   * Useful when you have sessionId but not workflowId.
   */
  async getBySessionId(sessionId: string): Promise<WorkflowExecution | null> {
    if (this.redis) {
      // For Redis, we'd need a secondary index - for now, scan (not ideal for prod)
      const keys = await this.redis.keys('workflow:*')
      for (const key of keys) {
        const data = await this.redis.get(key)
        if (data) {
          const workflow = JSON.parse(data) as WorkflowExecution
          if (workflow.sessionId === sessionId) {
            return workflow
          }
        }
      }
      return null
    }

    // In-memory lookup
    for (const workflow of this.memory.values()) {
      if (workflow.sessionId === sessionId) {
        return workflow
      }
    }
    return null
  }

  /**
   * Update workflow phase.
   * Records transition in history.
   */
  async updatePhase(
    workflowId: string,
    phase: WorkflowPhase,
    data?: Partial<WorkflowPhaseData>,
    reason?: string
  ): Promise<WorkflowExecution | null> {
    const workflow = await this.get(workflowId)
    if (!workflow) {
      console.warn(`⚠️ Workflow not found: ${workflowId}`)
      return null
    }

    const previousPhase = workflow.phase
    const now = new Date().toISOString()

    // Record transition
    const transition: PhaseTransition = {
      phase,
      timestamp: now,
      previousPhase,
      reason,
    }

    workflow.phase = phase
    workflow.phaseHistory.push(transition)
    workflow.updatedAt = now

    // Update phase data if provided
    if (data) {
      workflow.phaseData = { ...workflow.phaseData, ...data }
    }

    // Update activity status based on phase
    if (phase === 'executing') {
      workflow.activityStatus = 'running'
    } else if (phase === 'completed') {
      workflow.activityStatus = 'completed'
      workflow.completedAt = now
    } else if (phase === 'error') {
      workflow.activityStatus = 'error'
    }

    await this.store(workflow)

    console.log(`📋 Workflow phase: ${workflow.workflowId} | ${previousPhase} → ${phase}`)

    return workflow
  }

  /**
   * Update workflow progress.
   * For activity pane integration.
   */
  async updateProgress(
    workflowId: string,
    progress: { current?: number; total?: number; message?: string; percentage?: number }
  ): Promise<WorkflowExecution | null> {
    const workflow = await this.get(workflowId)
    if (!workflow) return null

    workflow.progress = { ...workflow.progress, ...progress }
    workflow.updatedAt = new Date().toISOString()

    await this.store(workflow)

    return workflow
  }

  /**
   * Add an event to the workflow event stream.
   * Events are never lost - stored for replay/debugging.
   */
  async addEvent(workflowId: string, event: Omit<WorkflowEvent, 'workflowId' | 'sequence'>): Promise<WorkflowExecution | null> {
    const workflow = await this.get(workflowId)
    if (!workflow) return null

    const fullEvent: WorkflowEvent = {
      ...event,
      workflowId,
      sequence: workflow.eventSequence++,
      timestamp: event.timestamp || new Date().toISOString(),
    }

    // Buffer events during phase transitions (optional)
    // For now, we just store them
    workflow.bufferedEvents.push(fullEvent)

    // Keep only last 100 events to prevent memory bloat
    if (workflow.bufferedEvents.length > 100) {
      workflow.bufferedEvents = workflow.bufferedEvents.slice(-100)
    }

    workflow.updatedAt = new Date().toISOString()
    await this.store(workflow)

    return workflow
  }

  /**
   * Complete a workflow.
   */
  async complete(workflowId: string): Promise<WorkflowExecution | null> {
    return this.updatePhase(workflowId, 'completed')
  }

  /**
   * Mark a workflow as errored.
   */
  async error(workflowId: string, errorMessage: string): Promise<WorkflowExecution | null> {
    const workflow = await this.get(workflowId)
    if (!workflow) return null

    workflow.error = errorMessage
    return this.updatePhase(workflowId, 'error')
  }

  /**
   * Delete a workflow.
   */
  async delete(workflowId: string): Promise<void> {
    if (this.redis) {
      await this.redis.del(`workflow:${workflowId}`)
    } else {
      this.memory.delete(workflowId)
    }
    console.log(`🗑️ Workflow deleted: ${workflowId}`)
  }

  /**
   * Get all active workflows (for monitoring/debugging).
   */
  async getActiveWorkflows(): Promise<WorkflowExecution[]> {
    if (this.redis) {
      const keys = await this.redis.keys('workflow:*')
      const workflows: WorkflowExecution[] = []
      for (const key of keys) {
        const data = await this.redis.get(key)
        if (data) {
          const workflow = JSON.parse(data) as WorkflowExecution
          if (workflow.activityStatus === 'running' || workflow.activityStatus === 'pending') {
            workflows.push(workflow)
          }
        }
      }
      return workflows
    }

    return Array.from(this.memory.values()).filter(
      w => w.activityStatus === 'running' || w.activityStatus === 'pending'
    )
  }

  /**
   * Cleanup expired workflows (for in-memory mode).
   * Redis handles TTL automatically.
   */
  cleanup(): void {
    if (this.redis) return // Redis handles TTL

    const now = Date.now()
    const ttlMs = this.ttlSeconds * 1000

    for (const [workflowId, workflow] of this.memory.entries()) {
      const createdAt = new Date(workflow.startedAt).getTime()
      if (now - createdAt > ttlMs) {
        this.memory.delete(workflowId)
        console.log(`🗑️ Workflow expired: ${workflowId}`)
      }
    }
  }

  /**
   * Clear all workflows (for testing).
   */
  async clear(): Promise<void> {
    if (this.redis) {
      const keys = await this.redis.keys('workflow:*')
      if (keys.length > 0) {
        await this.redis.del(...keys)
      }
    } else {
      this.memory.clear()
    }
  }
}

// Singleton instance
let instance: WorkflowSessionStore | null = null

export function getWorkflowSessionStore(options?: WorkflowSessionStoreOptions): WorkflowSessionStore {
  if (!instance) {
    instance = new WorkflowSessionStore(options)
  }
  return instance
}

export const workflowSessionStore = getWorkflowSessionStore()
