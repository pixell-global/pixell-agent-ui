import { and, eq, desc, isNull, sql, like, or, isNotNull } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { getDb } from '../connection'
import {
  memories,
  memoryExtractionJobs,
  userMemorySettings,
  Memory,
  NewMemory,
  MemoryExtractionJob,
  NewMemoryExtractionJob,
  UserMemorySettings,
  NewUserMemorySettings,
  MemoryMetadata,
} from '../schema'
import { BaseRepository } from './base'

export interface ListMemoriesOptions {
  agentId?: string | null  // null = global only, undefined = all, string = specific agent
  category?: string
  search?: string
  limit?: number
  offset?: number
  includeInactive?: boolean
}

export interface MemoryStats {
  total: number
  global: number
  agentSpecific: number
  byCategory: Record<string, number>
}

export class MemoriesRepo extends BaseRepository {
  // =========================================================================
  // CREATE
  // =========================================================================

  /**
   * Create a new memory
   */
  async create(
    userId: string,
    memory: {
      agentId?: string | null
      category: 'user_preference' | 'project_context' | 'domain_knowledge' | 'conversation_goal' | 'entity'
      key: string
      value: string
      confidence?: number
      source?: 'auto_extracted' | 'user_provided' | 'user_edited'
      sourceConversationId?: string
      metadata?: MemoryMetadata
    }
  ): Promise<Memory> {
    const orgId = await this.getOrgContext(userId)
    const db = await getDb()
    const id = randomUUID()

    const newMemory: NewMemory = {
      id,
      orgId,
      userId,
      agentId: memory.agentId || null,
      category: memory.category,
      key: memory.key,
      value: memory.value,
      confidence: memory.confidence?.toString() || '1.00',
      source: memory.source || 'user_provided',
      sourceConversationId: memory.sourceConversationId || null,
      metadata: memory.metadata || null,
      usageCount: 0,
      isActive: true,
    }

    await db.insert(memories).values(newMemory)

    const [created] = await db
      .select()
      .from(memories)
      .where(eq(memories.id, id))
      .limit(1)

    return created
  }

  /**
   * Create or update a memory by key
   * If a memory with the same key exists, update it instead
   */
  async upsert(
    userId: string,
    memory: {
      agentId?: string | null
      category: 'user_preference' | 'project_context' | 'domain_knowledge' | 'conversation_goal' | 'entity'
      key: string
      value: string
      confidence?: number
      source?: 'auto_extracted' | 'user_provided' | 'user_edited'
      sourceConversationId?: string
      metadata?: MemoryMetadata
    }
  ): Promise<{ memory: Memory; isNew: boolean }> {
    const orgId = await this.getOrgContext(userId)
    const db = await getDb()

    // Check if memory exists
    const existing = await this.getByKey(userId, memory.key, memory.agentId)

    if (existing) {
      // Update existing memory
      await db
        .update(memories)
        .set({
          value: memory.value,
          confidence: memory.confidence?.toString() || existing.confidence,
          source: memory.source || 'user_edited',
          sourceConversationId: memory.sourceConversationId || existing.sourceConversationId,
          metadata: memory.metadata || existing.metadata,
          isActive: true,
        })
        .where(eq(memories.id, existing.id))

      const [updated] = await db
        .select()
        .from(memories)
        .where(eq(memories.id, existing.id))
        .limit(1)

      return { memory: updated, isNew: false }
    }

    // Create new memory
    const created = await this.create(userId, memory)
    return { memory: created, isNew: true }
  }

  // =========================================================================
  // READ
  // =========================================================================

  /**
   * Get a memory by ID
   */
  async getById(id: string, userId: string): Promise<Memory | null> {
    const orgId = await this.getOrgContext(userId)
    const db = await getDb()

    const [memory] = await db
      .select()
      .from(memories)
      .where(and(
        eq(memories.id, id),
        eq(memories.orgId, orgId),
        eq(memories.userId, userId)
      ))
      .limit(1)

    return memory || null
  }

  /**
   * Get a memory by key
   */
  async getByKey(userId: string, key: string, agentId?: string | null): Promise<Memory | null> {
    const orgId = await this.getOrgContext(userId)
    const db = await getDb()

    const conditions = [
      eq(memories.orgId, orgId),
      eq(memories.userId, userId),
      eq(memories.key, key),
    ]

    // Handle agentId: null means global, string means specific agent
    if (agentId === null) {
      conditions.push(isNull(memories.agentId))
    } else if (agentId !== undefined) {
      conditions.push(eq(memories.agentId, agentId))
    }

    const [memory] = await db
      .select()
      .from(memories)
      .where(and(...conditions))
      .limit(1)

    return memory || null
  }

  /**
   * List memories for a user with optional filters
   */
  async list(userId: string, options: ListMemoriesOptions = {}): Promise<Memory[]> {
    const { agentId, category, search, limit = 50, offset = 0, includeInactive = false } = options
    const orgId = await this.getOrgContext(userId)
    const db = await getDb()

    const conditions = [
      eq(memories.orgId, orgId),
      eq(memories.userId, userId),
    ]

    // Filter by active status
    if (!includeInactive) {
      conditions.push(eq(memories.isActive, true))
    }

    // Filter by agentId
    if (agentId === null) {
      // Global memories only
      conditions.push(isNull(memories.agentId))
    } else if (agentId !== undefined) {
      // Specific agent memories only
      conditions.push(eq(memories.agentId, agentId))
    }
    // If agentId is undefined, return all memories

    // Filter by category
    if (category) {
      conditions.push(eq(memories.category, category as any))
    }

    // Search filter
    if (search) {
      conditions.push(
        or(
          like(memories.key, `%${search}%`),
          like(memories.value, `%${search}%`)
        )!
      )
    }

    return db
      .select()
      .from(memories)
      .where(and(...conditions))
      .orderBy(desc(memories.usageCount), desc(memories.updatedAt))
      .limit(limit)
      .offset(offset)
  }

  /**
   * Get all memories for a user including global and agent-specific
   * Used for context injection
   */
  async getForContext(userId: string, agentId?: string): Promise<Memory[]> {
    const orgId = await this.getOrgContext(userId)
    const db = await getDb()

    // Get global memories and agent-specific memories
    const conditions = [
      eq(memories.orgId, orgId),
      eq(memories.userId, userId),
      eq(memories.isActive, true),
    ]

    if (agentId) {
      // Get global OR agent-specific
      conditions.push(
        or(
          isNull(memories.agentId),
          eq(memories.agentId, agentId)
        )!
      )
    } else {
      // Global only
      conditions.push(isNull(memories.agentId))
    }

    return db
      .select()
      .from(memories)
      .where(and(...conditions))
      .orderBy(desc(memories.usageCount), desc(memories.confidence), desc(memories.updatedAt))
      .limit(20) // Context limit
  }

  /**
   * Get global memories only
   */
  async getGlobalMemories(userId: string): Promise<Memory[]> {
    return this.list(userId, { agentId: null })
  }

  /**
   * Get agent-specific memories only
   */
  async getAgentMemories(userId: string, agentId: string): Promise<Memory[]> {
    return this.list(userId, { agentId })
  }

  /**
   * Get memory stats for a user
   */
  async getStats(userId: string): Promise<MemoryStats> {
    const orgId = await this.getOrgContext(userId)
    const db = await getDb()

    // Total count
    const [totalResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(memories)
      .where(and(
        eq(memories.orgId, orgId),
        eq(memories.userId, userId),
        eq(memories.isActive, true)
      ))

    // Global count
    const [globalResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(memories)
      .where(and(
        eq(memories.orgId, orgId),
        eq(memories.userId, userId),
        eq(memories.isActive, true),
        isNull(memories.agentId)
      ))

    // Count by category
    const categoryResults = await db
      .select({
        category: memories.category,
        count: sql<number>`count(*)`
      })
      .from(memories)
      .where(and(
        eq(memories.orgId, orgId),
        eq(memories.userId, userId),
        eq(memories.isActive, true)
      ))
      .groupBy(memories.category)

    const byCategory: Record<string, number> = {}
    for (const row of categoryResults) {
      byCategory[row.category] = row.count
    }

    const total = totalResult?.count || 0
    const global = globalResult?.count || 0

    return {
      total,
      global,
      agentSpecific: total - global,
      byCategory,
    }
  }

  // =========================================================================
  // UPDATE
  // =========================================================================

  /**
   * Update a memory
   */
  async update(
    id: string,
    userId: string,
    updates: {
      value?: string
      confidence?: number
      isActive?: boolean
      metadata?: MemoryMetadata
    }
  ): Promise<Memory | null> {
    const memory = await this.getById(id, userId)
    if (!memory) return null

    const db = await getDb()
    const updateData: Partial<NewMemory> = {}

    if (updates.value !== undefined) {
      updateData.value = updates.value
      updateData.source = 'user_edited'
    }

    if (updates.confidence !== undefined) {
      updateData.confidence = updates.confidence.toString()
    }

    if (updates.isActive !== undefined) {
      updateData.isActive = updates.isActive
    }

    if (updates.metadata !== undefined) {
      updateData.metadata = updates.metadata
    }

    await db
      .update(memories)
      .set(updateData)
      .where(eq(memories.id, id))

    return this.getById(id, userId)
  }

  /**
   * Increment usage count for memories
   */
  async incrementUsage(memoryIds: string[]): Promise<void> {
    if (memoryIds.length === 0) return

    const db = await getDb()
    const now = new Date()

    for (const id of memoryIds) {
      await db
        .update(memories)
        .set({
          usageCount: sql`${memories.usageCount} + 1`,
          lastUsedAt: now,
        })
        .where(eq(memories.id, id))
    }
  }

  // =========================================================================
  // DELETE
  // =========================================================================

  /**
   * Soft delete a memory (set isActive to false)
   */
  async softDelete(id: string, userId: string): Promise<boolean> {
    const memory = await this.getById(id, userId)
    if (!memory) return false

    const db = await getDb()
    await db
      .update(memories)
      .set({ isActive: false })
      .where(eq(memories.id, id))

    return true
  }

  /**
   * Hard delete a memory
   */
  async hardDelete(id: string, userId: string): Promise<boolean> {
    const memory = await this.getById(id, userId)
    if (!memory) return false

    const db = await getDb()
    await db
      .delete(memories)
      .where(eq(memories.id, id))

    return true
  }

  /**
   * Delete all memories for a user
   */
  async deleteAll(userId: string): Promise<number> {
    const orgId = await this.getOrgContext(userId)
    const db = await getDb()

    const result = await db
      .delete(memories)
      .where(and(
        eq(memories.orgId, orgId),
        eq(memories.userId, userId)
      ))

    return (result as any)[0]?.affectedRows || 0
  }

  // =========================================================================
  // EXTRACTION JOBS
  // =========================================================================

  /**
   * Create a new extraction job
   */
  async createExtractionJob(userId: string, conversationId: string): Promise<MemoryExtractionJob> {
    const orgId = await this.getOrgContext(userId)
    const db = await getDb()
    const id = randomUUID()

    const newJob: NewMemoryExtractionJob = {
      id,
      orgId,
      userId,
      conversationId,
      status: 'pending',
      memoriesExtracted: 0,
      memoriesUpdated: 0,
      retryCount: 0,
    }

    await db.insert(memoryExtractionJobs).values(newJob)

    const [created] = await db
      .select()
      .from(memoryExtractionJobs)
      .where(eq(memoryExtractionJobs.id, id))
      .limit(1)

    return created
  }

  /**
   * Get pending extraction jobs
   */
  async getPendingExtractionJobs(limit: number = 10): Promise<MemoryExtractionJob[]> {
    const db = await getDb()
    return db
      .select()
      .from(memoryExtractionJobs)
      .where(eq(memoryExtractionJobs.status, 'pending'))
      .orderBy(memoryExtractionJobs.createdAt)
      .limit(limit)
  }

  /**
   * Get a single extraction job by ID
   */
  async getExtractionJob(id: string): Promise<MemoryExtractionJob | null> {
    const db = await getDb()
    const [job] = await db
      .select()
      .from(memoryExtractionJobs)
      .where(eq(memoryExtractionJobs.id, id))
      .limit(1)
    return job || null
  }

  /**
   * Update extraction job status
   */
  async updateExtractionJob(
    id: string,
    updates: {
      status?: 'pending' | 'processing' | 'completed' | 'failed'
      memoriesExtracted?: number
      memoriesUpdated?: number
      error?: string
      retryCount?: number
    }
  ): Promise<void> {
    const db = await getDb()
    const updateData: Partial<NewMemoryExtractionJob> = {}

    if (updates.status !== undefined) {
      updateData.status = updates.status
      if (updates.status === 'completed' || updates.status === 'failed') {
        updateData.processedAt = new Date()
      }
    }

    if (updates.memoriesExtracted !== undefined) {
      updateData.memoriesExtracted = updates.memoriesExtracted
    }

    if (updates.memoriesUpdated !== undefined) {
      updateData.memoriesUpdated = updates.memoriesUpdated
    }

    if (updates.error !== undefined) {
      updateData.error = updates.error
    }

    if (updates.retryCount !== undefined) {
      updateData.retryCount = updates.retryCount
    }

    await db
      .update(memoryExtractionJobs)
      .set(updateData)
      .where(eq(memoryExtractionJobs.id, id))
  }

  // =========================================================================
  // USER SETTINGS
  // =========================================================================

  /**
   * Get user memory settings
   */
  async getSettings(userId: string): Promise<UserMemorySettings | null> {
    const db = await getDb()
    const [settings] = await db
      .select()
      .from(userMemorySettings)
      .where(eq(userMemorySettings.userId, userId))
      .limit(1)

    return settings || null
  }

  /**
   * Get or create user memory settings with defaults
   */
  async getOrCreateSettings(userId: string): Promise<UserMemorySettings> {
    const existing = await this.getSettings(userId)
    if (existing) return existing

    const db = await getDb()
    const newSettings: NewUserMemorySettings = {
      userId,
      memoryEnabled: true,
      autoExtractionEnabled: true,
      incognitoMode: false,
      extractionCategories: ['user_preference', 'project_context', 'domain_knowledge', 'conversation_goal'],
    }

    await db.insert(userMemorySettings).values(newSettings)

    const [created] = await db
      .select()
      .from(userMemorySettings)
      .where(eq(userMemorySettings.userId, userId))
      .limit(1)

    return created
  }

  /**
   * Update user memory settings
   */
  async updateSettings(
    userId: string,
    updates: {
      memoryEnabled?: boolean
      autoExtractionEnabled?: boolean
      incognitoMode?: boolean
      extractionCategories?: string[]
    }
  ): Promise<UserMemorySettings> {
    // Ensure settings exist
    await this.getOrCreateSettings(userId)

    const db = await getDb()
    const updateData: Partial<NewUserMemorySettings> = {}

    if (updates.memoryEnabled !== undefined) {
      updateData.memoryEnabled = updates.memoryEnabled
    }

    if (updates.autoExtractionEnabled !== undefined) {
      updateData.autoExtractionEnabled = updates.autoExtractionEnabled
    }

    if (updates.incognitoMode !== undefined) {
      updateData.incognitoMode = updates.incognitoMode
    }

    if (updates.extractionCategories !== undefined) {
      updateData.extractionCategories = updates.extractionCategories
    }

    await db
      .update(userMemorySettings)
      .set(updateData)
      .where(eq(userMemorySettings.userId, userId))

    return (await this.getSettings(userId))!
  }
}
