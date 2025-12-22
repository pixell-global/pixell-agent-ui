import { z } from 'zod'
import { AgentPlanModeConfigSchema } from './phases'

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
// Workflow Execution (NEW - Root Correlation System)
// =============================================================================

/**
 * WorkflowPhase - explicit phase state machine for multi-phase agent workflows.
 * Each workflow transitions through these phases in order.
 */
export const WorkflowPhaseSchema = z.enum([
  'initial',        // Workflow just started
  'clarification',  // Agent asking for clarification
  'discovery',      // Agent discovering items (e.g., subreddits)
  'selection',      // User selecting from discovered items
  'preview',        // Showing plan preview before execution
  'executing',      // Plan/task is executing
  'completed',      // Workflow finished successfully
  'error',          // Workflow failed
])
export type WorkflowPhase = z.infer<typeof WorkflowPhaseSchema>

/**
 * WorkflowEvent - individual event in the workflow event stream.
 * All events include workflowId for correlation.
 */
export const WorkflowEventSchema = z.object({
  workflowId: z.string().uuid(),
  sequence: z.number().int().nonnegative(),
  timestamp: z.string().datetime(),
  type: z.string(),
  phase: WorkflowPhaseSchema.optional(),
  data: z.any(),
})
export type WorkflowEvent = z.infer<typeof WorkflowEventSchema>

/**
 * PhaseTransition - record of phase changes for audit trail.
 */
export const PhaseTransitionSchema = z.object({
  phase: WorkflowPhaseSchema,
  timestamp: z.string().datetime(),
  previousPhase: WorkflowPhaseSchema.optional(),
  reason: z.string().optional(),
})
export type PhaseTransition = z.infer<typeof PhaseTransitionSchema>

/**
 * WorkflowPhaseData - data associated with each phase.
 * Stores the pending/active data for that phase.
 */
export const WorkflowPhaseDataSchema = z.object({
  clarification: ClarificationNeededSchema.optional(),
  discovery: z.any().optional(), // DiscoveryResult
  selection: z.any().optional(), // SelectionRequired
  preview: z.any().optional(),   // PreviewReady / SearchPlan
})
export type WorkflowPhaseData = z.infer<typeof WorkflowPhaseDataSchema>

/**
 * WorkflowExecution - the root workflow context that ties EVERYTHING together.
 *
 * This is the single source of truth for a multi-phase agent workflow.
 * All components (chat, activity pane, etc.) subscribe to this.
 *
 * Key principles:
 * - workflowId is the root correlation ID
 * - All events include workflowId
 * - Message IDs are tracked so content never gets lost
 * - Phase state machine ensures explicit transitions
 */
export const WorkflowExecutionSchema = z.object({
  // Correlation IDs
  workflowId: z.string().uuid(),           // Root ID - ties everything
  sessionId: z.string().uuid(),            // For API routing
  agentId: z.string(),                     // Which agent is handling
  agentUrl: z.string().url().optional(),   // Agent endpoint

  // Message correlation - NEVER loses track
  initialMessageId: z.string(),            // User message that started this
  responseMessageId: z.string(),           // Where assistant content goes

  // Phase state machine
  phase: WorkflowPhaseSchema,
  phaseHistory: z.array(PhaseTransitionSchema).default([]),
  phaseData: WorkflowPhaseDataSchema.default({}),

  // Progress tracking (for activity pane)
  progress: z.object({
    current: z.number().default(0),
    total: z.number().optional(),
    message: z.string().optional(),
    percentage: z.number().min(0).max(100).optional(),
  }).default({ current: 0 }),

  // Activity pane integration
  activityId: z.string().optional(),
  activityStatus: z.enum(['pending', 'running', 'completed', 'error']).default('pending'),

  // Event stream - never lost
  eventSequence: z.number().int().nonnegative().default(0),
  bufferedEvents: z.array(WorkflowEventSchema).default([]),

  // Lifecycle
  startedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  error: z.string().optional(),
})
export type WorkflowExecution = z.infer<typeof WorkflowExecutionSchema>

/**
 * Helper to create a new workflow execution.
 */
export function createWorkflowExecution(
  params: {
    sessionId: string
    agentId: string
    agentUrl?: string
    initialMessageId: string
    responseMessageId: string
  }
): WorkflowExecution {
  const now = new Date().toISOString()
  return {
    workflowId: crypto.randomUUID(),
    sessionId: params.sessionId,
    agentId: params.agentId,
    agentUrl: params.agentUrl,
    initialMessageId: params.initialMessageId,
    responseMessageId: params.responseMessageId,
    phase: 'initial',
    phaseHistory: [{ phase: 'initial', timestamp: now }],
    phaseData: {},
    progress: { current: 0 },
    activityStatus: 'pending',
    eventSequence: 0,
    bufferedEvents: [],
    startedAt: now,
    updatedAt: now,
  }
}

// =============================================================================
// Session State (Legacy - kept for backwards compatibility)
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

// =============================================================================
// Search Plan (tik-agent specific - Query Builder Pattern)
// =============================================================================

export const SearchPlanSchema = z.object({
  type: z.literal('search_plan'),
  planId: z.string().uuid(),
  agentId: z.string(),
  agentUrl: z.string().optional(), // URL to respond to
  userIntent: z.string(), // Original query
  userAnswers: z.record(z.any()).default({}), // Stored for reference
  searchKeywords: z.array(z.string()).default([]), // LLM-generated search terms
  hashtags: z.array(z.string()).default([]),
  followerMin: z.number().default(1000),
  followerMax: z.number().default(100000),
  location: z.string().optional(),
  minEngagement: z.number().default(0.03),
  message: z.string().default("Here's my search plan based on your preferences"),
})
export type SearchPlan = z.infer<typeof SearchPlanSchema>

export const SearchPlanResponseSchema = z.object({
  type: z.literal('search_plan_response'),
  planId: z.string().uuid(),
  approved: z.boolean(),
  editedKeywords: z.array(z.string()).optional(),
  editedFilters: z.record(z.any()).optional(),
})
export type SearchPlanResponse = z.infer<typeof SearchPlanResponseSchema>

// =============================================================================
// Agent Configuration
// =============================================================================

export const AgentProtocolSchema = z.enum(['paf', 'a2a'])
export type AgentProtocol = z.infer<typeof AgentProtocolSchema>

export const AgentConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  url: z.string().url(),
  protocol: AgentProtocolSchema,
  default: z.boolean().default(false),
  capabilities: z.array(z.string()).default([]),
  planMode: AgentPlanModeConfigSchema.optional(),
})
export type AgentConfig = z.infer<typeof AgentConfigSchema>

export const AgentsConfigSchema = z.object({
  agents: z.array(AgentConfigSchema),
})
export type AgentsConfig = z.infer<typeof AgentsConfigSchema>
