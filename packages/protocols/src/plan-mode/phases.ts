import { z } from 'zod'

/**
 * Plan Mode Phase Protocol
 *
 * Defines the standardized phases that agents can implement for
 * structured plan mode execution. All agents follow the same phase
 * pattern but can declare which phases they support.
 */

// =============================================================================
// Phase Type Definitions
// =============================================================================

export const PlanModePhaseSchema = z.enum([
  'idle',           // Not in plan mode
  'clarification',  // Initial questions (all agents)
  'discovery',      // Agent-specific discovery (subreddits, hashtags, channels)
  'selection',      // User selects from discovered items
  'preview',        // Show final plan for approval
  'executing',      // Agent running with refined params
  'completed',      // Plan execution finished
  'error',          // Error state
])
export type PlanModePhase = z.infer<typeof PlanModePhaseSchema>

// =============================================================================
// Discovered Items (for discovery/selection phases)
// =============================================================================

export const DiscoveredItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  metadata: z.record(z.any()).optional(), // Agent-specific (subscribers, engagement, etc.)
})
export type DiscoveredItem = z.infer<typeof DiscoveredItemSchema>

// =============================================================================
// Search Plan Preview (for preview phase)
// =============================================================================

export const SearchPlanPreviewSchema = z.object({
  planId: z.string(), // Can be UUID or agent-generated ID
  title: z.string(),
  keywords: z.array(z.string()).default([]),
  targets: z.array(z.string()).default([]), // Subreddits, hashtags, channels, etc.
  filters: z.record(z.any()).optional(),
  estimatedResults: z.number().optional(),
  agentId: z.string().optional(),
  agentUrl: z.string().optional(),
})
export type SearchPlanPreview = z.infer<typeof SearchPlanPreviewSchema>

// =============================================================================
// Plan Mode Context (accumulated state across phases)
// =============================================================================

export const PlanModeContextSchema = z.object({
  phase: PlanModePhaseSchema,
  agentId: z.string(),
  agentUrl: z.string().optional(),
  sessionId: z.string().uuid(),
  taskId: z.string().optional(),
  userAnswers: z.record(z.any()).default({}), // Accumulated across phases
  discoveredItems: z.array(DiscoveredItemSchema).optional(),
  selectedItems: z.array(z.string()).optional(),
  searchPlan: SearchPlanPreviewSchema.optional(),
  error: z.string().optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
})
export type PlanModeContext = z.infer<typeof PlanModeContextSchema>

// =============================================================================
// Agent Plan Mode Configuration
// =============================================================================

export const AgentPlanModeConfigSchema = z.object({
  supported: z.boolean().default(false),
  phases: z.array(PlanModePhaseSchema), // Which phases this agent supports
  discoveryType: z.string().optional(), // 'subreddits' | 'hashtags' | 'channels' | etc.
  llmQuestions: z.boolean().default(false), // Whether questions are LLM-generated
  maxDiscoveryItems: z.number().default(20),
  selectionMode: z.enum(['single', 'multiple']).default('multiple'),
})
export type AgentPlanModeConfig = z.infer<typeof AgentPlanModeConfigSchema>

// =============================================================================
// Phase Transition Helpers
// =============================================================================

export const PHASE_ORDER: readonly PlanModePhase[] = [
  'idle',
  'clarification',
  'discovery',
  'selection',
  'preview',
  'executing',
  'completed',
] as const

/**
 * Get the next phase in the standard flow
 */
export function getNextPhase(
  currentPhase: PlanModePhase,
  supportedPhases: PlanModePhase[]
): PlanModePhase | null {
  const currentIndex = PHASE_ORDER.indexOf(currentPhase)
  if (currentIndex === -1 || currentIndex >= PHASE_ORDER.length - 1) {
    return null
  }

  // Find the next supported phase
  for (let i = currentIndex + 1; i < PHASE_ORDER.length; i++) {
    const nextPhase = PHASE_ORDER[i]
    if (supportedPhases.includes(nextPhase)) {
      return nextPhase
    }
  }
  return null
}

/**
 * Check if a phase transition is valid
 */
export function isValidTransition(
  fromPhase: PlanModePhase,
  toPhase: PlanModePhase,
  supportedPhases: PlanModePhase[]
): boolean {
  // Always allow transition to error or completed
  if (toPhase === 'error' || toPhase === 'completed') {
    return true
  }

  // Always allow transition from error back to idle
  if (fromPhase === 'error' && toPhase === 'idle') {
    return true
  }

  // Check if toPhase is supported
  if (!supportedPhases.includes(toPhase)) {
    return false
  }

  // Check phase order
  const fromIndex = PHASE_ORDER.indexOf(fromPhase)
  const toIndex = PHASE_ORDER.indexOf(toPhase)

  // Allow forward progression or reset to idle
  return toPhase === 'idle' || toIndex > fromIndex
}

/**
 * Get phase display info for UI
 */
export function getPhaseDisplayInfo(phase: PlanModePhase): {
  label: string
  description: string
  icon: string
} {
  const info: Record<PlanModePhase, { label: string; description: string; icon: string }> = {
    idle: {
      label: 'Ready',
      description: 'Ready to start',
      icon: 'circle',
    },
    clarification: {
      label: 'Questions',
      description: 'Gathering requirements',
      icon: 'help-circle',
    },
    discovery: {
      label: 'Discovery',
      description: 'Finding relevant items',
      icon: 'search',
    },
    selection: {
      label: 'Selection',
      description: 'Choose items to include',
      icon: 'check-square',
    },
    preview: {
      label: 'Preview',
      description: 'Review search plan',
      icon: 'eye',
    },
    executing: {
      label: 'Executing',
      description: 'Running search',
      icon: 'loader',
    },
    completed: {
      label: 'Complete',
      description: 'Search finished',
      icon: 'check-circle',
    },
    error: {
      label: 'Error',
      description: 'Something went wrong',
      icon: 'alert-circle',
    },
  }
  return info[phase]
}

/**
 * Create initial plan mode context
 */
export function createPlanModeContext(
  agentId: string,
  agentUrl?: string
): PlanModeContext {
  return {
    phase: 'idle',
    agentId,
    agentUrl,
    sessionId: crypto.randomUUID(),
    userAnswers: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

/**
 * Update plan mode context with new phase
 */
export function updatePlanModeContext(
  context: PlanModeContext,
  updates: Partial<PlanModeContext>
): PlanModeContext {
  return {
    ...context,
    ...updates,
    updatedAt: new Date().toISOString(),
  }
}
