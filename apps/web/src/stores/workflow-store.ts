/**
 * Workflow Store - Single source of truth for multi-phase agent workflows.
 *
 * This store provides centralized workflow state management that ALL components
 * can subscribe to. It mirrors the orchestrator's WorkflowSessionStore but tracks
 * client-side workflow state.
 *
 * Key principles:
 * - workflowId is the root correlation ID that ties everything together
 * - All events include workflowId for reliable message correlation
 * - Phase state machine ensures explicit transitions
 * - Activity pane, chat, and thinking indicators all use this store
 */

import { create } from 'zustand'
import { devtools, subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type {
  ClarificationNeeded,
  DiscoveryResult,
  SelectionRequired,
  PreviewReady,
  SearchPlan,
} from '@pixell/protocols'

// =============================================================================
// Types
// =============================================================================

export type WorkflowPhase =
  | 'initial'
  | 'clarification'
  | 'discovery'
  | 'selection'
  | 'preview'
  | 'executing'
  | 'completed'
  | 'error'

export type WorkflowActivityStatus = 'pending' | 'running' | 'completed' | 'error'

export interface PhaseTransition {
  phase: WorkflowPhase
  timestamp: string
  previousPhase?: WorkflowPhase
  reason?: string
}

export interface WorkflowProgress {
  current: number
  total?: number
  message?: string
  percentage?: number
}

export interface WorkflowPhaseData {
  clarification?: ClarificationNeeded
  discovery?: DiscoveryResult
  selection?: SelectionRequired
  preview?: PreviewReady | SearchPlan
}

export interface Workflow {
  // Correlation IDs
  workflowId: string
  sessionId: string
  agentId: string
  agentUrl: string

  // Message correlation - NEVER loses track
  initialMessageId: string      // User message that started workflow
  responseMessageId: string     // Where assistant content goes

  // Phase state machine
  phase: WorkflowPhase
  phaseHistory: PhaseTransition[]
  phaseData: WorkflowPhaseData

  // Progress tracking (for activity pane)
  progress: WorkflowProgress

  // Activity pane integration
  activityId?: string
  activityStatus: WorkflowActivityStatus

  // Event tracking
  eventSequence: number

  // Lifecycle
  startedAt: string
  updatedAt: string
  completedAt?: string
  error?: string
}

export interface StartWorkflowParams {
  workflowId: string
  sessionId: string
  agentId: string
  agentUrl: string
  initialMessageId: string
  responseMessageId: string
}

// =============================================================================
// Store Interface
// =============================================================================

interface WorkflowState {
  // All active workflows indexed by workflowId
  workflows: Record<string, Workflow>

  // Current active workflow (for single-workflow UI)
  activeWorkflowId: string | null

  // Actions
  startWorkflow: (params: StartWorkflowParams) => Workflow
  updatePhase: (workflowId: string, phase: WorkflowPhase, data?: Partial<WorkflowPhaseData>, reason?: string) => void
  updateProgress: (workflowId: string, progress: Partial<WorkflowProgress>) => void
  completeWorkflow: (workflowId: string) => void
  errorWorkflow: (workflowId: string, error: string) => void
  clearWorkflow: (workflowId: string) => void
  setActiveWorkflow: (workflowId: string | null) => void

  // Queries - used by ALL components
  getWorkflow: (workflowId: string) => Workflow | undefined
  getActiveWorkflow: () => Workflow | undefined
  getWorkflowByMessageId: (messageId: string) => Workflow | undefined
  getWorkflowBySessionId: (sessionId: string) => Workflow | undefined
  getRunningWorkflows: () => Workflow[]
}

// =============================================================================
// Store Implementation
// =============================================================================

export const useWorkflowStore = create<WorkflowState>()(
  subscribeWithSelector(
    devtools(
      immer((set, get) => ({
        workflows: {},
        activeWorkflowId: null,

        startWorkflow: (params) => {
          const now = new Date().toISOString()
          const workflow: Workflow = {
            workflowId: params.workflowId,
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
            startedAt: now,
            updatedAt: now,
          }

          set((state) => {
            state.workflows[params.workflowId] = workflow
            state.activeWorkflowId = params.workflowId
          })

          console.log('📋 [workflow-store] Workflow started:', params.workflowId)
          return workflow
        },

        updatePhase: (workflowId, phase, data, reason) => {
          set((state) => {
            const workflow = state.workflows[workflowId]
            if (!workflow) {
              console.warn('⚠️ [workflow-store] Workflow not found:', workflowId)
              return
            }

            const previousPhase = workflow.phase
            const now = new Date().toISOString()

            // Record transition
            workflow.phaseHistory.push({
              phase,
              timestamp: now,
              previousPhase,
              reason,
            })

            workflow.phase = phase
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

            console.log(`📋 [workflow-store] Phase: ${workflowId} | ${previousPhase} → ${phase}`)
          })
        },

        updateProgress: (workflowId, progress) => {
          set((state) => {
            const workflow = state.workflows[workflowId]
            if (workflow) {
              workflow.progress = { ...workflow.progress, ...progress }
              workflow.updatedAt = new Date().toISOString()
            }
          })
        },

        completeWorkflow: (workflowId) => {
          const { updatePhase } = get()
          updatePhase(workflowId, 'completed')
        },

        errorWorkflow: (workflowId, error) => {
          set((state) => {
            const workflow = state.workflows[workflowId]
            if (workflow) {
              workflow.error = error
            }
          })
          const { updatePhase } = get()
          updatePhase(workflowId, 'error')
        },

        clearWorkflow: (workflowId) => {
          set((state) => {
            delete state.workflows[workflowId]
            if (state.activeWorkflowId === workflowId) {
              state.activeWorkflowId = null
            }
          })
        },

        setActiveWorkflow: (workflowId) => {
          set((state) => {
            state.activeWorkflowId = workflowId
          })
        },

        // Query methods
        getWorkflow: (workflowId) => {
          return get().workflows[workflowId]
        },

        getActiveWorkflow: () => {
          const { activeWorkflowId, workflows } = get()
          return activeWorkflowId ? workflows[activeWorkflowId] : undefined
        },

        getWorkflowByMessageId: (messageId) => {
          const { workflows } = get()
          return Object.values(workflows).find(
            w => w.initialMessageId === messageId || w.responseMessageId === messageId
          )
        },

        getWorkflowBySessionId: (sessionId) => {
          const { workflows } = get()
          return Object.values(workflows).find(w => w.sessionId === sessionId)
        },

        getRunningWorkflows: () => {
          const { workflows } = get()
          return Object.values(workflows).filter(
            w => w.activityStatus === 'running' || w.activityStatus === 'pending'
          )
        },
      })),
      { name: 'workflow-store' }
    )
  )
)

// =============================================================================
// Selectors for Component Subscriptions
// =============================================================================

export const selectActiveWorkflow = (state: WorkflowState) =>
  state.activeWorkflowId ? state.workflows[state.activeWorkflowId] : undefined

export const selectWorkflowProgress = (workflowId: string) => (state: WorkflowState) =>
  state.workflows[workflowId]?.progress

export const selectWorkflowPhase = (workflowId: string) => (state: WorkflowState) =>
  state.workflows[workflowId]?.phase

export const selectWorkflowPhaseData = (workflowId: string) => (state: WorkflowState) =>
  state.workflows[workflowId]?.phaseData

export const selectRunningWorkflows = (state: WorkflowState) =>
  Object.values(state.workflows).filter(
    w => w.activityStatus === 'running' || w.activityStatus === 'pending'
  )

export const selectResponseMessageId = (workflowId: string) => (state: WorkflowState) =>
  state.workflows[workflowId]?.responseMessageId
