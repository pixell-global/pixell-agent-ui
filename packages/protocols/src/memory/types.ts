/**
 * Memory System Protocol Types
 *
 * Shared types for the memory system across frontend, orchestrator, and agents.
 */

// =============================================================================
// ENUMS
// =============================================================================

export type MemoryCategory =
  | 'user_preference'
  | 'project_context'
  | 'domain_knowledge'
  | 'conversation_goal'
  | 'entity'

export type MemorySource = 'auto_extracted' | 'user_provided' | 'user_edited'

export type ExtractionJobStatus = 'pending' | 'processing' | 'completed' | 'failed'

// =============================================================================
// CORE TYPES
// =============================================================================

/**
 * A stored memory fact
 */
export interface Memory {
  id: string
  orgId: string
  userId: string
  agentId: string | null // null = global memory
  category: MemoryCategory
  key: string
  value: string
  confidence: number
  source: MemorySource
  sourceConversationId: string | null
  metadata: Record<string, any> | null
  usageCount: number
  lastUsedAt: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/**
 * Lightweight memory reference for context injection
 */
export interface MemoryReference {
  id: string
  key: string
  value: string
  category: MemoryCategory
  agentId?: string | null
}

/**
 * Memory context to be injected into agent prompts
 */
export interface MemoryContext {
  memories: MemoryReference[]
  incognitoMode: boolean
  contextString: string
}

/**
 * User settings for the memory system
 */
export interface MemorySettings {
  userId: string
  memoryEnabled: boolean
  autoExtractionEnabled: boolean
  incognitoMode: boolean
  extractionCategories: MemoryCategory[]
  updatedAt: string
}

/**
 * Statistics about a user's memories
 */
export interface MemoryStats {
  total: number
  active: number
  inactive: number
  byCategory: Record<MemoryCategory, number>
  byAgent: Record<string, number>
  globalCount: number
}

// =============================================================================
// EXTRACTION TYPES
// =============================================================================

/**
 * Memory extraction job
 */
export interface ExtractionJob {
  id: string
  orgId: string
  userId: string
  conversationId: string
  status: ExtractionJobStatus
  memoriesExtracted: number
  memoriesUpdated: number
  error: string | null
  createdAt: string
}

/**
 * Extracted memory before storage (from LLM)
 */
export interface ExtractedMemory {
  category: MemoryCategory
  key: string
  value: string
  confidence: number
}

/**
 * Result of a memory extraction job
 */
export interface ExtractionResult {
  success: boolean
  memoriesExtracted: number
  memoriesUpdated: number
  error?: string
}

// =============================================================================
// API TYPES
// =============================================================================

/**
 * Input for creating a new memory
 */
export interface CreateMemoryInput {
  agentId?: string | null
  category: MemoryCategory
  key: string
  value: string
  confidence?: number
  metadata?: Record<string, any>
}

/**
 * Input for updating an existing memory
 */
export interface UpdateMemoryInput {
  value?: string
  confidence?: number
  isActive?: boolean
  metadata?: Record<string, any>
}

/**
 * Options for listing memories
 */
export interface ListMemoriesOptions {
  agentId?: string | null
  category?: MemoryCategory
  search?: string
  limit?: number
  offset?: number
  includeInactive?: boolean
}

/**
 * API response for listing memories
 */
export interface ListMemoriesResponse {
  ok: boolean
  memories: Memory[]
  stats: MemoryStats
  pagination: {
    limit: number
    offset: number
    total: number
  }
}

/**
 * API response for memory context
 */
export interface MemoryContextResponse {
  ok: boolean
  memories: Memory[]
  contextString: string
  count: number
}

// =============================================================================
// SSE EVENT TYPES
// =============================================================================

/**
 * SSE event indicating which memories were used in a response
 */
export interface MemoriesUsedEvent {
  type: 'memories_used'
  memories: MemoryReference[]
}

/**
 * SSE event indicating extraction status
 */
export interface ExtractionStatusEvent {
  type: 'extraction_status'
  jobId: string
  status: ExtractionJobStatus
  memoriesExtracted?: number
}
