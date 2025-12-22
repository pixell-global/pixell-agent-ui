import { Request, Response } from 'express'
import { MemoriesRepo, ListMemoriesOptions } from '@pixell/db-mysql'

// Initialize repository
const memoriesRepo = new MemoriesRepo()

/**
 * List memories for a user with optional filters
 * GET /api/memories?agentId=&category=&search=&limit=&offset=
 */
export async function listMemoriesHandler(req: Request, res: Response) {
  try {
    const userId = req.headers['x-user-id'] as string
    if (!userId) {
      return res.status(401).json({ ok: false, error: 'User ID required' })
    }

    const options: ListMemoriesOptions = {
      agentId: req.query.agentId as string | undefined,
      category: req.query.category as string | undefined,
      search: req.query.search as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
      includeInactive: req.query.includeInactive === 'true',
    }

    // Handle special case: agentId=null for global memories only
    if (req.query.agentId === 'null') {
      options.agentId = null
    }

    const memories = await memoriesRepo.list(userId, options)
    const stats = await memoriesRepo.getStats(userId)

    res.json({
      ok: true,
      memories,
      stats,
      pagination: {
        limit: options.limit,
        offset: options.offset,
        total: stats.total,
      },
    })
  } catch (error) {
    console.error('List memories error:', error)
    res.status(500).json({ ok: false, error: 'Failed to list memories' })
  }
}

/**
 * Get a single memory by ID
 * GET /api/memories/:id
 */
export async function getMemoryHandler(req: Request, res: Response) {
  try {
    const userId = req.headers['x-user-id'] as string
    if (!userId) {
      return res.status(401).json({ ok: false, error: 'User ID required' })
    }

    const { id } = req.params
    const memory = await memoriesRepo.getById(id, userId)

    if (!memory) {
      return res.status(404).json({ ok: false, error: 'Memory not found' })
    }

    res.json({ ok: true, memory })
  } catch (error) {
    console.error('Get memory error:', error)
    res.status(500).json({ ok: false, error: 'Failed to get memory' })
  }
}

/**
 * Create a new memory
 * POST /api/memories
 */
export async function createMemoryHandler(req: Request, res: Response) {
  try {
    const userId = req.headers['x-user-id'] as string
    if (!userId) {
      return res.status(401).json({ ok: false, error: 'User ID required' })
    }

    const { agentId, category, key, value, confidence, metadata } = req.body

    if (!category || !key || !value) {
      return res.status(400).json({
        ok: false,
        error: 'Missing required fields: category, key, value'
      })
    }

    // Validate category
    const validCategories = ['user_preference', 'project_context', 'domain_knowledge', 'conversation_goal', 'entity']
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        ok: false,
        error: `Invalid category. Must be one of: ${validCategories.join(', ')}`
      })
    }

    const memory = await memoriesRepo.create(userId, {
      agentId: agentId || null,
      category,
      key,
      value,
      confidence: confidence || 1.0,
      source: 'user_provided',
      metadata,
    })

    res.status(201).json({ ok: true, memory })
  } catch (error) {
    console.error('Create memory error:', error)
    res.status(500).json({ ok: false, error: 'Failed to create memory' })
  }
}

/**
 * Update a memory
 * PATCH /api/memories/:id
 */
export async function updateMemoryHandler(req: Request, res: Response) {
  try {
    const userId = req.headers['x-user-id'] as string
    if (!userId) {
      return res.status(401).json({ ok: false, error: 'User ID required' })
    }

    const { id } = req.params
    const { value, confidence, isActive, metadata } = req.body

    const memory = await memoriesRepo.update(id, userId, {
      value,
      confidence,
      isActive,
      metadata,
    })

    if (!memory) {
      return res.status(404).json({ ok: false, error: 'Memory not found' })
    }

    res.json({ ok: true, memory })
  } catch (error) {
    console.error('Update memory error:', error)
    res.status(500).json({ ok: false, error: 'Failed to update memory' })
  }
}

/**
 * Delete a memory
 * DELETE /api/memories/:id
 */
export async function deleteMemoryHandler(req: Request, res: Response) {
  try {
    const userId = req.headers['x-user-id'] as string
    if (!userId) {
      return res.status(401).json({ ok: false, error: 'User ID required' })
    }

    const { id } = req.params
    const hardDelete = req.query.hard === 'true'

    const success = hardDelete
      ? await memoriesRepo.hardDelete(id, userId)
      : await memoriesRepo.softDelete(id, userId)

    if (!success) {
      return res.status(404).json({ ok: false, error: 'Memory not found' })
    }

    res.json({ ok: true, deleted: true })
  } catch (error) {
    console.error('Delete memory error:', error)
    res.status(500).json({ ok: false, error: 'Failed to delete memory' })
  }
}

/**
 * Delete all memories for a user
 * DELETE /api/memories
 */
export async function deleteAllMemoriesHandler(req: Request, res: Response) {
  try {
    const userId = req.headers['x-user-id'] as string
    if (!userId) {
      return res.status(401).json({ ok: false, error: 'User ID required' })
    }

    // Require confirmation
    if (req.query.confirm !== 'true') {
      return res.status(400).json({
        ok: false,
        error: 'Confirmation required. Add ?confirm=true to delete all memories.'
      })
    }

    const count = await memoriesRepo.deleteAll(userId)

    res.json({ ok: true, deleted: count })
  } catch (error) {
    console.error('Delete all memories error:', error)
    res.status(500).json({ ok: false, error: 'Failed to delete memories' })
  }
}

/**
 * Get memories for context injection
 * GET /api/memories/context?agentId=
 */
export async function getMemoryContextHandler(req: Request, res: Response) {
  try {
    const userId = req.headers['x-user-id'] as string
    if (!userId) {
      return res.status(401).json({ ok: false, error: 'User ID required' })
    }

    const agentId = req.query.agentId as string | undefined
    const memories = await memoriesRepo.getForContext(userId, agentId)

    // Format as context string for LLM injection
    const contextString = formatMemoriesForContext(memories)

    res.json({
      ok: true,
      memories,
      contextString,
      count: memories.length,
    })
  } catch (error) {
    console.error('Get memory context error:', error)
    res.status(500).json({ ok: false, error: 'Failed to get memory context' })
  }
}

/**
 * Get user memory settings
 * GET /api/memories/settings
 */
export async function getSettingsHandler(req: Request, res: Response) {
  try {
    const userId = req.headers['x-user-id'] as string
    if (!userId) {
      return res.status(401).json({ ok: false, error: 'User ID required' })
    }

    const settings = await memoriesRepo.getOrCreateSettings(userId)

    res.json({ ok: true, settings })
  } catch (error) {
    console.error('Get settings error:', error)
    res.status(500).json({ ok: false, error: 'Failed to get settings' })
  }
}

/**
 * Update user memory settings
 * PATCH /api/memories/settings
 */
export async function updateSettingsHandler(req: Request, res: Response) {
  try {
    const userId = req.headers['x-user-id'] as string
    if (!userId) {
      return res.status(401).json({ ok: false, error: 'User ID required' })
    }

    const { memoryEnabled, autoExtractionEnabled, incognitoMode, extractionCategories } = req.body

    const settings = await memoriesRepo.updateSettings(userId, {
      memoryEnabled,
      autoExtractionEnabled,
      incognitoMode,
      extractionCategories,
    })

    res.json({ ok: true, settings })
  } catch (error) {
    console.error('Update settings error:', error)
    res.status(500).json({ ok: false, error: 'Failed to update settings' })
  }
}

/**
 * Trigger memory extraction for a conversation
 * POST /api/memories/extract
 */
export async function triggerExtractionHandler(req: Request, res: Response) {
  try {
    const userId = req.headers['x-user-id'] as string
    if (!userId) {
      return res.status(401).json({ ok: false, error: 'User ID required' })
    }

    const { conversationId } = req.body
    if (!conversationId) {
      return res.status(400).json({ ok: false, error: 'conversationId required' })
    }

    // Check if user has auto extraction enabled
    const settings = await memoriesRepo.getOrCreateSettings(userId)
    if (!settings.autoExtractionEnabled) {
      return res.status(400).json({
        ok: false,
        error: 'Auto extraction is disabled for this user'
      })
    }

    // Create extraction job
    const job = await memoriesRepo.createExtractionJob(userId, conversationId)

    res.status(202).json({
      ok: true,
      jobId: job.id,
      message: 'Extraction job queued',
    })
  } catch (error) {
    console.error('Trigger extraction error:', error)
    res.status(500).json({ ok: false, error: 'Failed to trigger extraction' })
  }
}

/**
 * Record memory usage (called when memories are used in a response)
 * POST /api/memories/usage
 */
export async function recordUsageHandler(req: Request, res: Response) {
  try {
    const userId = req.headers['x-user-id'] as string
    if (!userId) {
      return res.status(401).json({ ok: false, error: 'User ID required' })
    }

    const { memoryIds } = req.body
    if (!Array.isArray(memoryIds) || memoryIds.length === 0) {
      return res.status(400).json({ ok: false, error: 'memoryIds array required' })
    }

    await memoriesRepo.incrementUsage(memoryIds)

    res.json({ ok: true, updated: memoryIds.length })
  } catch (error) {
    console.error('Record usage error:', error)
    res.status(500).json({ ok: false, error: 'Failed to record usage' })
  }
}

// =========================================================================
// HELPER FUNCTIONS
// =========================================================================

/**
 * Format memories into a context string for LLM injection
 */
function formatMemoriesForContext(memories: any[]): string {
  if (memories.length === 0) return ''

  // Group by category
  const grouped: Record<string, any[]> = {}
  for (const memory of memories) {
    if (!grouped[memory.category]) {
      grouped[memory.category] = []
    }
    grouped[memory.category].push(memory)
  }

  // Format as markdown-like context
  let context = '## User Context (from memory)\n'

  const categoryLabels: Record<string, string> = {
    user_preference: 'Preferences',
    project_context: 'Current Project',
    domain_knowledge: 'Domain Knowledge',
    conversation_goal: 'Goals',
    entity: 'Related Entities',
  }

  for (const [category, mems] of Object.entries(grouped)) {
    const label = categoryLabels[category] || category
    context += `\n### ${label}\n`
    for (const m of mems) {
      context += `- **${m.key}**: ${m.value}\n`
    }
  }

  return context
}

/**
 * Compress memories for context injection (max chars limit)
 */
export function compressMemoriesForContext(memories: any[], maxChars: number = 2000): string {
  const context = formatMemoriesForContext(memories)

  if (context.length <= maxChars) {
    return context
  }

  // Truncate and add indicator
  return context.substring(0, maxChars - 30) + '\n\n[... truncated ...]'
}
