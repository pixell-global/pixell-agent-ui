import { z } from 'zod'

/**
 * Plan Mode Protocol Types
 *
 * Defines the message types for agent clarification requests,
 * plan proposals, and user responses.
 */

// =============================================================================
// Question Types
// =============================================================================

export const QuestionTypeSchema = z.enum([
  'single_choice',    // Radio buttons - one selection
  'multiple_choice',  // Checkboxes - multiple selections
  'free_text',        // Open text input
  'yes_no',           // Simple yes/no confirmation
  'numeric_range',    // Slider or min/max inputs
])
export type QuestionType = z.infer<typeof QuestionTypeSchema>

// Option for choice-based questions
export const QuestionOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
})
export type QuestionOption = z.infer<typeof QuestionOptionSchema>

// Individual question
export const QuestionSchema = z.object({
  questionId: z.string(),
  questionType: QuestionTypeSchema,
  question: z.string(),
  header: z.string().max(12).optional(), // Short label for chip/tag display
  options: z.array(QuestionOptionSchema).optional(),
  allowFreeText: z.boolean().default(false),
  default: z.string().optional(),
  placeholder: z.string().optional(),
  // For numeric_range type
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
})
export type Question = z.infer<typeof QuestionSchema>

// =============================================================================
// Clarification Request (Agent → Client)
// =============================================================================

export const ClarificationNeededSchema = z.object({
  type: z.literal('clarification_needed'),
  clarificationId: z.string().uuid(),
  agentId: z.string(),
  questions: z.array(QuestionSchema).min(1).max(4),
  context: z.string().optional(), // Why the agent is asking
  message: z.string().optional(), // Friendly message to display
  timeoutMs: z.number().int().positive().default(300000), // 5 minutes default
})
export type ClarificationNeeded = z.infer<typeof ClarificationNeededSchema>

// =============================================================================
// Clarification Response (Client → Agent)
// =============================================================================

export const AnswerSchema = z.object({
  questionId: z.string(),
  value: z.union([z.string(), z.array(z.string()), z.number()]),
})
export type Answer = z.infer<typeof AnswerSchema>

export const ClarificationResponseSchema = z.object({
  type: z.literal('clarification_response'),
  clarificationId: z.string().uuid(),
  answers: z.array(AnswerSchema),
})
export type ClarificationResponse = z.infer<typeof ClarificationResponseSchema>

// =============================================================================
// Plan Proposal (Agent → Client)
// =============================================================================

export const PlanStepStatusSchema = z.enum([
  'pending',
  'in_progress',
  'completed',
  'failed',
  'skipped',
])
export type PlanStepStatus = z.infer<typeof PlanStepStatusSchema>

export const PlanStepSchema = z.object({
  id: z.string(),
  description: z.string(),
  status: PlanStepStatusSchema.default('pending'),
  estimatedDuration: z.string().optional(), // e.g., "10s", "2min"
  toolHint: z.string().optional(), // Hint about which tool will be used
  dependencies: z.array(z.string()).optional(), // IDs of dependent steps
})
export type PlanStep = z.infer<typeof PlanStepSchema>

export const PlanProposedSchema = z.object({
  type: z.literal('plan_proposed'),
  planId: z.string().uuid(),
  agentId: z.string(),
  title: z.string(),
  steps: z.array(PlanStepSchema),
  autoStartAfterMs: z.number().int().positive().optional(), // null = requires explicit approval
  requiresApproval: z.boolean().default(false),
  message: z.string().optional(), // Friendly message
})
export type PlanProposed = z.infer<typeof PlanProposedSchema>

// =============================================================================
// Plan Approval/Response (Client → Agent)
// =============================================================================

export const PlanApprovalSchema = z.object({
  type: z.literal('plan_approval'),
  planId: z.string().uuid(),
  approved: z.boolean(),
  modifications: z.record(z.any()).optional(), // Any modifications to the plan
})
export type PlanApproval = z.infer<typeof PlanApprovalSchema>

export const PlanInterruptSchema = z.object({
  type: z.literal('plan_interrupt'),
  planId: z.string().uuid().optional(),
  sessionId: z.string().uuid().optional(),
  reason: z.enum(['user_requested', 'timeout', 'error']),
})
export type PlanInterrupt = z.infer<typeof PlanInterruptSchema>

// =============================================================================
// Plan Execution Updates (Agent → Client)
// =============================================================================

export const PlanExecutingSchema = z.object({
  type: z.literal('plan_executing'),
  planId: z.string().uuid(),
  currentStepId: z.string(),
  stepStatus: PlanStepStatusSchema,
  progress: z.number().min(0).max(100).optional(),
  message: z.string().optional(),
})
export type PlanExecuting = z.infer<typeof PlanExecutingSchema>

// =============================================================================
// Session State
// =============================================================================

export const PlanModeStateSchema = z.enum([
  'idle',
  'waiting_clarification',
  'waiting_approval',
  'executing',
  'completed',
  'error',
])
export type PlanModeState = z.infer<typeof PlanModeStateSchema>

export const PlanModeSessionSchema = z.object({
  sessionId: z.string().uuid(),
  taskId: z.string().uuid().optional(),
  state: PlanModeStateSchema,
  currentPlan: PlanProposedSchema.optional(),
  pendingClarification: ClarificationNeededSchema.optional(),
  clarificationHistory: z.array(z.object({
    clarification: ClarificationNeededSchema,
    response: ClarificationResponseSchema,
    timestamp: z.string().datetime(),
  })).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type PlanModeSession = z.infer<typeof PlanModeSessionSchema>

// =============================================================================
// Union type for all plan mode events
// =============================================================================

export const PlanModeEventSchema = z.discriminatedUnion('type', [
  ClarificationNeededSchema,
  ClarificationResponseSchema,
  PlanProposedSchema,
  PlanApprovalSchema,
  PlanInterruptSchema,
  PlanExecutingSchema,
])
export type PlanModeEvent = z.infer<typeof PlanModeEventSchema>

// =============================================================================
// Helper functions
// =============================================================================

export function createClarificationNeeded(
  agentId: string,
  questions: Question[],
  options?: {
    context?: string
    message?: string
    timeoutMs?: number
  }
): ClarificationNeeded {
  return {
    type: 'clarification_needed',
    clarificationId: crypto.randomUUID(),
    agentId,
    questions,
    context: options?.context,
    message: options?.message,
    timeoutMs: options?.timeoutMs ?? 300000,
  }
}

export function createPlanProposed(
  agentId: string,
  title: string,
  steps: Omit<PlanStep, 'status'>[],
  options?: {
    autoStartAfterMs?: number
    requiresApproval?: boolean
    message?: string
  }
): PlanProposed {
  return {
    type: 'plan_proposed',
    planId: crypto.randomUUID(),
    agentId,
    title,
    steps: steps.map(step => ({ ...step, status: 'pending' as const })),
    autoStartAfterMs: options?.autoStartAfterMs ?? 5000,
    requiresApproval: options?.requiresApproval ?? false,
    message: options?.message,
  }
}
