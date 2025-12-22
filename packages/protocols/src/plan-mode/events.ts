import { z } from 'zod'
import {
  PlanModePhaseSchema,
  DiscoveredItemSchema,
  SearchPlanPreviewSchema,
} from './phases'
import { ClarificationNeededSchema, ClarificationResponseSchema } from './types'

/**
 * Plan Mode Event Protocol
 *
 * Defines the event types for communication between agents and the UI
 * during plan mode execution. Events are phase-specific and carry
 * the necessary data for UI rendering.
 */

// =============================================================================
// Discovery Events
// =============================================================================

export const DiscoveryResultSchema = z.object({
  type: z.literal('discovery_result'),
  phase: z.literal('discovery'),
  agentId: z.string(),
  agentUrl: z.string().optional(),
  discoveryType: z.string(), // 'subreddits' | 'hashtags' | 'channels' | etc.
  items: z.array(DiscoveredItemSchema),
  message: z.string().optional(),
})
export type DiscoveryResult = z.infer<typeof DiscoveryResultSchema>

// =============================================================================
// Selection Events
// =============================================================================

export const SelectionRequiredSchema = z.object({
  type: z.literal('selection_required'),
  phase: z.literal('selection'),
  agentId: z.string(),
  agentUrl: z.string().optional(),
  discoveryType: z.string(),
  items: z.array(DiscoveredItemSchema),
  minSelect: z.number().default(1),
  maxSelect: z.number().optional(), // undefined = unlimited
  message: z.string(),
})
export type SelectionRequired = z.infer<typeof SelectionRequiredSchema>

export const SelectionResponseSchema = z.object({
  type: z.literal('selection_response'),
  selectedIds: z.array(z.string()),
})
export type SelectionResponse = z.infer<typeof SelectionResponseSchema>

// =============================================================================
// Preview Events
// =============================================================================

export const PreviewReadySchema = z.object({
  type: z.literal('preview_ready'),
  phase: z.literal('preview').optional(), // May not be present in transformed events
  agentId: z.string().optional(),
  agentUrl: z.string().optional(),
  sessionId: z.string().optional(),
  plan: SearchPlanPreviewSchema,
  message: z.string().optional(),
})
export type PreviewReady = z.infer<typeof PreviewReadySchema>

export const PreviewResponseSchema = z.object({
  type: z.literal('preview_response'),
  planId: z.string().uuid(),
  approved: z.boolean(),
  editedPlan: SearchPlanPreviewSchema.optional(), // If user made edits
})
export type PreviewResponse = z.infer<typeof PreviewResponseSchema>

// =============================================================================
// Phase Transition Events
// =============================================================================

// Note: Named PhaseTransitionEvent to avoid conflict with PhaseTransition in types.ts
// PhaseTransition (types.ts) = audit record of phase changes
// PhaseTransitionEvent (events.ts) = SSE event for communicating phase changes
export const PhaseTransitionEventSchema = z.object({
  type: z.literal('phase_transition'),
  fromPhase: PlanModePhaseSchema,
  toPhase: PlanModePhaseSchema,
  agentId: z.string(),
  message: z.string().optional(),
})
export type PhaseTransitionEvent = z.infer<typeof PhaseTransitionEventSchema>

export const PhaseCompleteSchema = z.object({
  type: z.literal('phase_complete'),
  phase: PlanModePhaseSchema,
  agentId: z.string(),
  result: z.record(z.any()).optional(), // Phase-specific results
  nextPhase: PlanModePhaseSchema.optional(),
})
export type PhaseComplete = z.infer<typeof PhaseCompleteSchema>

// =============================================================================
// Error Events
// =============================================================================

export const PlanModeErrorSchema = z.object({
  type: z.literal('plan_mode_error'),
  phase: PlanModePhaseSchema,
  agentId: z.string(),
  error: z.string(),
  recoverable: z.boolean().default(true),
  suggestedAction: z.enum(['retry', 'restart', 'abort']).optional(),
})
export type PlanModeError = z.infer<typeof PlanModeErrorSchema>

// =============================================================================
// Unified Plan Mode Event
// =============================================================================

/**
 * Wrapper for all plan mode events with phase context
 */
export const PlanModePhaseEventSchema = z.object({
  type: z.literal('plan_mode_event'),
  phase: PlanModePhaseSchema,
  agentId: z.string(),
  taskId: z.string().optional(),
  sessionId: z.string().optional(),
  timestamp: z.string().datetime().optional(),
  data: z.discriminatedUnion('type', [
    // From types.ts (existing)
    ClarificationNeededSchema,
    ClarificationResponseSchema,
    // New phase events
    DiscoveryResultSchema,
    SelectionRequiredSchema,
    SelectionResponseSchema,
    PreviewReadySchema,
    PreviewResponseSchema,
    PhaseTransitionEventSchema,
    PhaseCompleteSchema,
    PlanModeErrorSchema,
  ]),
})
export type PlanModePhaseEvent = z.infer<typeof PlanModePhaseEventSchema>

// =============================================================================
// Event Factory Functions
// =============================================================================

export function createDiscoveryResult(
  agentId: string,
  discoveryType: string,
  items: z.infer<typeof DiscoveredItemSchema>[],
  options?: { agentUrl?: string; message?: string }
): DiscoveryResult {
  return {
    type: 'discovery_result',
    phase: 'discovery',
    agentId,
    agentUrl: options?.agentUrl,
    discoveryType,
    items,
    message: options?.message,
  }
}

export function createSelectionRequired(
  agentId: string,
  discoveryType: string,
  items: z.infer<typeof DiscoveredItemSchema>[],
  message: string,
  options?: { agentUrl?: string; minSelect?: number; maxSelect?: number }
): SelectionRequired {
  return {
    type: 'selection_required',
    phase: 'selection',
    agentId,
    agentUrl: options?.agentUrl,
    discoveryType,
    items,
    minSelect: options?.minSelect ?? 1,
    maxSelect: options?.maxSelect,
    message,
  }
}

export function createPreviewReady(
  agentId: string,
  plan: z.infer<typeof SearchPlanPreviewSchema>,
  options?: { agentUrl?: string; message?: string }
): PreviewReady {
  return {
    type: 'preview_ready',
    phase: 'preview',
    agentId,
    agentUrl: options?.agentUrl,
    plan,
    message: options?.message,
  }
}

export function createPhaseTransitionEvent(
  agentId: string,
  fromPhase: z.infer<typeof PlanModePhaseSchema>,
  toPhase: z.infer<typeof PlanModePhaseSchema>,
  message?: string
): PhaseTransitionEvent {
  return {
    type: 'phase_transition',
    fromPhase,
    toPhase,
    agentId,
    message,
  }
}

export function createPlanModeError(
  agentId: string,
  phase: z.infer<typeof PlanModePhaseSchema>,
  error: string,
  options?: { recoverable?: boolean; suggestedAction?: 'retry' | 'restart' | 'abort' }
): PlanModeError {
  return {
    type: 'plan_mode_error',
    phase,
    agentId,
    error,
    recoverable: options?.recoverable ?? true,
    suggestedAction: options?.suggestedAction,
  }
}

// =============================================================================
// Event Type Guards
// =============================================================================

export function isDiscoveryResult(event: unknown): event is DiscoveryResult {
  return (
    typeof event === 'object' &&
    event !== null &&
    (event as DiscoveryResult).type === 'discovery_result'
  )
}

export function isSelectionRequired(event: unknown): event is SelectionRequired {
  return (
    typeof event === 'object' &&
    event !== null &&
    (event as SelectionRequired).type === 'selection_required'
  )
}

export function isPreviewReady(event: unknown): event is PreviewReady {
  return (
    typeof event === 'object' &&
    event !== null &&
    (event as PreviewReady).type === 'preview_ready'
  )
}

export function isPhaseTransitionEvent(event: unknown): event is PhaseTransitionEvent {
  return (
    typeof event === 'object' &&
    event !== null &&
    (event as PhaseTransitionEvent).type === 'phase_transition'
  )
}

export function isPlanModeError(event: unknown): event is PlanModeError {
  return (
    typeof event === 'object' &&
    event !== null &&
    (event as PlanModeError).type === 'plan_mode_error'
  )
}
