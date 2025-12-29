import { create } from 'zustand'
import { devtools, subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { ChatMessage, FileReference, StreamingResponse, ChatUISettings, ThinkingStep, AgentHealth, FileAttachment, FileMention, FileOutput } from '@/types'
import type {
  ClarificationNeeded,
  ClarificationResponse,
  PlanProposed,
  PlanApproval,
  PlanModeState as PlanModeStateType,
  PlanExecuting,
  SearchPlan,
  SearchPlanResponse,
  AgentConfig,
  // New phase-based types
  PlanModePhase,
  PlanModeContext,
  DiscoveredItem,
  SearchPlanPreview,
  DiscoveryResult,
  SelectionRequired,
  SelectionResponse,
  PreviewReady,
  PreviewResponse,
} from '@pixell/protocols'

interface ChatState {
  // Messages and streaming
  messages: ChatMessage[]
  streamingMessageId: string | null
  isLoading: boolean

  // Conversation context
  currentConversationId: string | null
  isNewConversation: boolean

  // Session tracking for plan mode (SessionManager integration)
  activeSessionId: string | null
  activeAgentUrl: string | null

  // File context
  selectedFiles: FileReference[]

  // File attachments
  pendingAttachments: FileAttachment[]

  // AI Agent status
  agentHealth: AgentHealth | null

  // Plan mode state (legacy - kept for backward compatibility)
  planModeEnabled: boolean
  planModeState: PlanModeStateType
  pendingClarification: ClarificationNeeded | null
  currentPlan: PlanProposed | null
  currentStepId: string | null
  pendingSearchPlan: SearchPlan | null

  // New phase-based plan mode context
  planModeContext: PlanModeContext | null
  pendingDiscovery: DiscoveryResult | null
  pendingSelection: SelectionRequired | null
  pendingPreview: PreviewReady | null

  // Selected agent
  selectedAgent: AgentConfig | null

  // UI settings
  settings: ChatUISettings

  // Conversation actions
  setConversationId: (id: string | null) => void
  setIsNewConversation: (isNew: boolean) => void
  loadConversation: (conversationId: string) => Promise<void>
  saveMessage: (message: ChatMessage) => Promise<void>

  // Actions
  addMessage: (message: ChatMessage) => void
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void
  appendToStreamingMessage: (id: string, token: string) => void
  setStreamingMessage: (id: string | null) => void
  setLoading: (loading: boolean) => void
  
  // File context actions
  addFileReference: (file: FileReference) => void
  removeFileReference: (id: string) => void
  clearFileReferences: () => void
  
  // File attachment actions
  addAttachment: (attachment: FileAttachment) => void
  removeAttachment: (id: string) => void
  updateAttachment: (id: string, updates: Partial<FileAttachment>) => void
  clearAttachments: () => void
  
  // Streaming actions
  handleStreamingChunk: (chunk: StreamingResponse) => void
  addThinkingStep: (messageId: string, step: ThinkingStep) => void
  completeThinkingStep: (messageId: string, stepId: string) => void
  
  // AI health
  setAgentHealth: (health: AgentHealth) => void

  // Plan mode actions
  setPlanModeEnabled: (enabled: boolean) => void
  setPlanModeState: (state: PlanModeStateType) => void
  setPendingClarification: (clarification: ClarificationNeeded | null) => void
  setCurrentPlan: (plan: PlanProposed | null) => void
  updatePlanStepStatus: (stepId: string, status: string) => void
  handlePlanModeEvent: (event: ClarificationNeeded | PlanProposed | PlanExecuting | SearchPlan) => void
  respondToClarification: (response: ClarificationResponse) => Promise<void>
  approvePlan: (approval: PlanApproval) => Promise<void>
  clearPlanMode: () => void

  // Search plan actions
  setPendingSearchPlan: (plan: SearchPlan | null) => void
  respondToSearchPlan: (response: SearchPlanResponse) => Promise<void>

  // New phase-based plan mode actions
  initPlanModeContext: (agentId: string, agentUrl?: string) => void
  advancePlanPhase: (nextPhase: PlanModePhase, data?: Partial<PlanModeContext>) => void
  updateUserAnswers: (answers: Record<string, any>) => void
  setDiscoveredItems: (items: DiscoveredItem[]) => void
  setSelectedItems: (ids: string[]) => void
  setPendingDiscovery: (discovery: DiscoveryResult | null) => void
  setPendingSelection: (selection: SelectionRequired | null) => void
  setPendingPreview: (preview: PreviewReady | null) => void
  respondToSelection: (response: SelectionResponse) => Promise<void>
  respondToPreview: (response: PreviewResponse) => Promise<void>
  handlePhaseEvent: (event: DiscoveryResult | SelectionRequired | PreviewReady) => void

  // Agent selection
  setSelectedAgent: (agent: AgentConfig | null) => void

  // Session tracking actions (SessionManager integration)
  setActiveSessionId: (sessionId: string | null) => void
  setActiveAgentUrl: (agentUrl: string | null) => void
  setActiveSession: (sessionId: string | null, agentUrl: string | null) => void

  // Settings
  updateSettings: (settings: Partial<ChatUISettings>) => void

  // Input prefill (for welcome state prompt cards)
  inputPrefill: string | null
  setInputPrefill: (text: string | null) => void
  clearInputPrefill: () => void

  // Utility actions
  clearMessages: () => void
  getRecentHistory: (maxMessages?: number) => Array<{ role: 'user' | 'assistant', content: string }>
}

export const useChatStore = create<ChatState>()(
  devtools(
    subscribeWithSelector(
      immer((set, get) => ({
        // Initial state
        messages: [],
        streamingMessageId: null,
        isLoading: false,
        currentConversationId: null,
        isNewConversation: true,
        // Session tracking for plan mode (SessionManager integration)
        activeSessionId: null,
        activeAgentUrl: null,
        selectedFiles: [],
        pendingAttachments: [],
        agentHealth: null,
        // Plan mode initial state (legacy)
        planModeEnabled: false,
        planModeState: 'idle' as PlanModeStateType,
        pendingClarification: null,
        currentPlan: null,
        currentStepId: null,
        pendingSearchPlan: null,
        // New phase-based plan mode context
        planModeContext: null,
        pendingDiscovery: null,
        pendingSelection: null,
        pendingPreview: null,
        selectedAgent: null,
        inputPrefill: null,
        settings: {
          showThinking: 'always',
          streamingEnabled: true,
          markdownEnabled: true,
          codeHighlightEnabled: true,
          autoScrollEnabled: true
          // Removed maxTokensPerStream - using natural completion without limits
        },

        // Conversation actions
        setConversationId: (id) =>
          set((state) => {
            state.currentConversationId = id
            state.isNewConversation = !id
          }),

        setIsNewConversation: (isNew) =>
          set((state) => {
            state.isNewConversation = isNew
          }),

        loadConversation: async (conversationId) => {
          set((state) => {
            state.isLoading = true
            state.messages = []
            state.currentConversationId = conversationId
            state.isNewConversation = false
          })

          try {
            const response = await fetch(`/api/conversations/${conversationId}`)
            if (!response.ok) {
              throw new Error('Failed to load conversation')
            }

            const data = await response.json()

            // Transform database messages to ChatMessage format
            const messages: ChatMessage[] = data.messages.map((m: any) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              messageType: m.metadata?.messageType || 'text',
              fileReferences: m.metadata?.fileReferences || [],
              thinkingSteps: m.metadata?.thinkingSteps || [],
              attachments: m.metadata?.attachments || [],
              createdAt: m.createdAt,
            }))

            set((state) => {
              state.messages = messages
              state.isLoading = false
            })
          } catch (error) {
            console.error('Error loading conversation:', error)
            set((state) => {
              state.isLoading = false
            })
          }
        },

        saveMessage: async (message) => {
          const state = get()
          const conversationId = state.currentConversationId

          if (!conversationId) {
            console.warn('No conversation ID, cannot save message')
            return
          }

          try {
            const response = await fetch(`/api/conversations/${conversationId}/messages`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                role: message.role,
                content: message.content,
                metadata: {
                  messageType: message.messageType,
                  fileReferences: message.fileReferences,
                  thinkingSteps: message.thinkingSteps,
                  attachments: message.attachments,
                },
              }),
            })

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}))
              console.error('Failed to save message:', response.status, errorData)
              return
            }

            const data = await response.json()

            // Check if we need to trigger title generation
            if (data.needsTitleGeneration) {
              // Fire and forget title generation
              fetch(`/api/conversations/${conversationId}/generate-title`, {
                method: 'POST',
              }).catch((err) => console.error('Title generation failed:', err))
            }
          } catch (error) {
            console.error('Error saving message:', error)
          }
        },

        // Message actions
        addMessage: (message) =>
          set((state) => {
            state.messages.push(message)
          }),
          
        updateMessage: (id, updates) =>
          set((state) => {
            const messageIndex = state.messages.findIndex(m => m.id === id)
            if (messageIndex !== -1) {
              Object.assign(state.messages[messageIndex], updates)
            }
          }),
          
        appendToStreamingMessage: (id, token) =>
          set((state) => {
            const message = state.messages.find(m => m.id === id)
            if (message) {
              message.content += token
              message.updatedAt = new Date().toISOString()
            }
          }),
          
        setStreamingMessage: (id) =>
          set((state) => {
            state.streamingMessageId = id
          }),
          
        setLoading: (loading) =>
          set((state) => {
            state.isLoading = loading
          }),
          
        // File reference actions
        addFileReference: (file) =>
          set((state) => {
            if (!state.selectedFiles.find(f => f.id === file.id)) {
              state.selectedFiles.push(file)
            }
          }),
          
        removeFileReference: (id) =>
          set((state) => {
            state.selectedFiles = state.selectedFiles.filter(f => f.id !== id)
          }),
          
        clearFileReferences: () =>
          set((state) => {
            state.selectedFiles = []
          }),
          
        // File attachment actions
        addAttachment: (attachment) =>
          set((state) => {
            state.pendingAttachments.push(attachment)
          }),
          
        removeAttachment: (id) =>
          set((state) => {
            state.pendingAttachments = state.pendingAttachments.filter(a => a.id !== id)
          }),
          
        updateAttachment: (id, updates) =>
          set((state) => {
            const attachment = state.pendingAttachments.find(a => a.id === id)
            if (attachment) {
              Object.assign(attachment, updates)
            }
          }),
          
        clearAttachments: () =>
          set((state) => {
            state.pendingAttachments = []
          }),
          
        // Streaming actions
        handleStreamingChunk: (chunk) =>
          set((state) => {
            const streamingMessage = state.streamingMessageId 
              ? state.messages.find(m => m.id === state.streamingMessageId)
              : null
              
            if (!streamingMessage) {
              console.warn('No streaming message found for chunk:', chunk)
              return
            }
            
            console.log('🔄 Processing chunk:', chunk.type, chunk)
            console.log('🔄 Current streaming message ID:', state.streamingMessageId)
            console.log('🔄 Current streaming message content before update:', streamingMessage.content)
            
            switch (chunk.type) {
              case 'thinking':
                if (chunk.context?.thoughts) {
                  const messageIndex = state.messages.findIndex(m => m.id === state.streamingMessageId)
                  if (messageIndex !== -1) {
                    state.messages[messageIndex] = {
                      ...state.messages[messageIndex],
                      thinkingSteps: [
                        ...(state.messages[messageIndex].thinkingSteps || []),
                        ...chunk.context.thoughts
                      ],
                      isThinking: true
                    }
                  }
                }
                break
                
              case 'content':
                // Find the message index for proper Immer/Zustand reactivity
                const messageIndex = state.messages.findIndex(m => m.id === state.streamingMessageId)
                if (messageIndex !== -1) {
                  if (chunk.delta?.content) {
                    const newContent = state.messages[messageIndex].content + chunk.delta.content
                    state.messages[messageIndex] = {
                      ...state.messages[messageIndex],
                      content: newContent,
                      updatedAt: new Date().toISOString()
                    }
                    // Content updated successfully
                  } else if (chunk.accumulated) {
                    // Fallback: use accumulated content if delta is not available
                    state.messages[messageIndex] = {
                      ...state.messages[messageIndex],
                      content: chunk.accumulated,
                      updatedAt: new Date().toISOString()
                    }
                    console.log('Updated message with accumulated content:', chunk.accumulated)
                  }
                }
                break
                
              case 'complete':
                const completeMessageIndex = state.messages.findIndex(m => m.id === state.streamingMessageId)
                if (completeMessageIndex !== -1) {
                  state.messages[completeMessageIndex] = {
                    ...state.messages[completeMessageIndex],
                    streaming: false,
                    isThinking: false
                  }
                }
                state.streamingMessageId = null
                state.isLoading = false
                console.log('Stream completed')
                break
                
              case 'error':
                const errorMessageIndex = state.messages.findIndex(m => m.id === state.streamingMessageId)
                if (errorMessageIndex !== -1) {
                  state.messages[errorMessageIndex] = {
                    ...state.messages[errorMessageIndex],
                    streaming: false,
                    isThinking: false,
                    messageType: 'alert',
                    content: chunk.error ? `Error: ${chunk.error}` : state.messages[errorMessageIndex].content
                  }
                }
                state.streamingMessageId = null
                state.isLoading = false
                console.log('Stream error:', chunk.error)
                break

              case 'clarification_needed':
                console.log('📋 Received clarification_needed event:', chunk)
                if (chunk.clarification) {
                  state.pendingClarification = {
                    type: 'clarification_needed',
                    ...chunk.clarification
                  } as unknown as ClarificationNeeded
                  state.planModeState = 'waiting_clarification'
                }
                break

              case 'search_plan':
                console.log('📋 Received search_plan event:', chunk)
                if (chunk.plan) {
                  state.pendingSearchPlan = chunk.plan as unknown as SearchPlan
                  state.planModeState = 'waiting_approval'
                }
                break

              case 'progress':
                // Progress event from agent with step metadata
                console.log('📊 Received progress event:', chunk)
                const progressMessageIndex = state.messages.findIndex(m => m.id === state.streamingMessageId)
                if (progressMessageIndex !== -1) {
                  const message = state.messages[progressMessageIndex]
                  const stepType = chunk.step || 'working'
                  const stepMessage = chunk.message || 'Processing...'

                  // Find existing step with same type or add new one
                  const existingStepIndex = message.thinkingSteps?.findIndex(
                    s => s.step === stepType
                  ) ?? -1

                  const newStep: ThinkingStep = {
                    id: `step-${stepType}-${Date.now()}`,
                    content: stepMessage,
                    step: stepType,
                    metadata: chunk.metadata,
                    isCompleted: false,
                    timestamp: new Date().toISOString(),
                    importance: 'medium' as const,
                  }

                  if (existingStepIndex >= 0 && message.thinkingSteps) {
                    // Update existing step
                    message.thinkingSteps[existingStepIndex] = {
                      ...message.thinkingSteps[existingStepIndex],
                      content: stepMessage,
                      metadata: chunk.metadata,
                    }
                  } else {
                    // Add new step
                    message.thinkingSteps = [...(message.thinkingSteps || []), newStep]
                  }

                  state.messages[progressMessageIndex] = {
                    ...message,
                    thinkingSteps: message.thinkingSteps,
                    isThinking: true,
                  }
                }
                break

              case 'file_created':
                // Agent created a file (report, export, etc.)
                console.log('📁 Received file_created event:', chunk)
                console.log('📊 Current state:', {
                  streamingMessageId: state.streamingMessageId,
                  totalMessages: state.messages.length,
                  assistantMessages: state.messages.filter(m => m.role === 'assistant').length
                })

                // Strategy 1: Try to find message by streamingMessageId
                let fileMessageIndex = state.messages.findIndex(m => m.id === state.streamingMessageId)
                console.log(`🔍 Strategy 1 result: fileMessageIndex=${fileMessageIndex}`)

                // Strategy 2: If streamingMessageId is null, find the most recent assistant message
                if (fileMessageIndex === -1) {
                  console.log('⚠️ streamingMessageId is null or message not found, finding most recent assistant message')
                  console.log('📋 All assistant messages:', state.messages
                    .filter(m => m.role === 'assistant')
                    .map((m, idx) => ({ index: state.messages.indexOf(m), id: m.id, content: m.content?.substring(0, 50) }))
                  )
                  // Find last assistant message (search backwards)
                  for (let i = state.messages.length - 1; i >= 0; i--) {
                    if (state.messages[i].role === 'assistant') {
                      fileMessageIndex = i
                      console.log(`✅ Strategy 2: Attaching file to most recent assistant message at index ${i}:`, {
                        id: state.messages[i].id,
                        content: state.messages[i].content?.substring(0, 50),
                        hasOutputs: state.messages[i].outputs?.length || 0
                      })
                      break
                    }
                  }
                }

                if (fileMessageIndex !== -1) {
                  const message = state.messages[fileMessageIndex]

                  // Check if this file was already added (deduplicate by path)
                  const alreadyExists = message.outputs?.some(output => output.path === chunk.path)
                  if (alreadyExists) {
                    console.log('⚠️ File output already exists, skipping duplicate:', chunk.name)
                    break
                  }

                  const fileOutput = {
                    type: 'report' as const,
                    path: chunk.path || '',
                    name: chunk.name || 'file',
                    format: (chunk.format || 'txt') as 'html' | 'csv' | 'json' | 'txt' | 'pdf' | 'xlsx',
                    size: chunk.size,
                    summary: chunk.summary,
                    createdAt: new Date().toISOString(),
                  }

                  state.messages[fileMessageIndex] = {
                    ...message,
                    outputs: [...(message.outputs || []), fileOutput],
                  }

                  console.log('✅✅✅ File output ATTACHED:', {
                    fileName: fileOutput.name,
                    messageId: message.id,
                    messageIndex: fileMessageIndex,
                    messageContent: message.content?.substring(0, 80),
                    outputsCount: (message.outputs?.length || 0) + 1,
                    fileOutput: fileOutput
                  })
                  console.log('🔍 Updated message outputs:', state.messages[fileMessageIndex].outputs)
                } else {
                  console.error('❌❌❌ CRITICAL: No assistant message found to attach file output!')
                  console.error('Current messages:', state.messages.map(m => ({ id: m.id, role: m.role, content: m.content?.substring(0, 30) })))
                }
                break
            }
          }),
          
        addThinkingStep: (messageId, step) =>
          set((state) => {
            const message = state.messages.find(m => m.id === messageId)
            if (message) {
              message.thinkingSteps = message.thinkingSteps || []
              message.thinkingSteps.push(step)
              message.isThinking = true
            }
          }),
          
        completeThinkingStep: (messageId, stepId) =>
          set((state) => {
            const message = state.messages.find(m => m.id === messageId)
            if (message?.thinkingSteps) {
              const step = message.thinkingSteps.find(s => s.id === stepId)
              if (step) {
                step.isCompleted = true
              }
            }
          }),
          
        // AI health
        setAgentHealth: (health) =>
          set((state) => {
            state.agentHealth = health
          }),

        // Plan mode actions
        setPlanModeEnabled: (enabled) =>
          set((state) => {
            state.planModeEnabled = enabled
          }),

        setPlanModeState: (newState) =>
          set((state) => {
            state.planModeState = newState
          }),

        setPendingClarification: (clarification) =>
          set((state) => {
            // Debug: Log what we're storing including agentUrl and sessionId
            console.log('📋 setPendingClarification:', {
              clarificationId: (clarification as any)?.clarificationId,
              agentUrl: (clarification as any)?.agentUrl,
              sessionId: (clarification as any)?.sessionId,
              hasQuestions: !!clarification?.questions?.length,
            })
            state.pendingClarification = clarification
            if (clarification) {
              state.planModeState = 'waiting_clarification'
            }
          }),

        setCurrentPlan: (plan) =>
          set((state) => {
            state.currentPlan = plan
            if (plan) {
              state.planModeState = plan.requiresApproval ? 'waiting_approval' : 'executing'
            }
          }),

        updatePlanStepStatus: (stepId, status) =>
          set((state) => {
            if (state.currentPlan) {
              const step = state.currentPlan.steps.find(s => s.id === stepId)
              if (step) {
                step.status = status as any
              }
              state.currentStepId = stepId
            }
          }),

        handlePlanModeEvent: (event) =>
          set((state) => {
            if (event.type === 'clarification_needed') {
              state.pendingClarification = event as ClarificationNeeded
              state.planModeState = 'waiting_clarification'
            } else if (event.type === 'plan_proposed') {
              state.currentPlan = event as PlanProposed
              state.planModeState = (event as PlanProposed).requiresApproval
                ? 'waiting_approval'
                : 'executing'
            } else if (event.type === 'plan_executing') {
              const execEvent = event as PlanExecuting
              state.planModeState = 'executing'
              state.currentStepId = execEvent.currentStepId
              // Update step status in the plan
              if (state.currentPlan) {
                const step = state.currentPlan.steps.find(s => s.id === execEvent.currentStepId)
                if (step) {
                  step.status = execEvent.stepStatus
                }
              }
            } else if (event.type === 'search_plan') {
              state.pendingSearchPlan = event as SearchPlan
              state.planModeState = 'waiting_approval'
            }
          }),

        respondToClarification: async (response) => {
          const currentState = get()
          const pendingClarification = currentState.pendingClarification

          // Find the last assistant message to append content to
          const lastAssistantMessage = currentState.messages
            .filter(m => m.role === 'assistant')
            .pop()
          const streamingId = lastAssistantMessage?.id || null

          // Extract agentUrl and sessionId - use active session as fallback
          const agentUrl = (pendingClarification as any)?.agentUrl || currentState.activeAgentUrl
          const sessionId = (pendingClarification as any)?.sessionId || currentState.activeSessionId

          // Debug: Log session info
          console.log('📤 respondToClarification - using session:', {
            sessionId,
            agentUrl,
            fromPending: !!(pendingClarification as any)?.sessionId,
            fromActive: !!currentState.activeSessionId,
          })
          console.log('📤 respondToClarification:', response.clarificationId, '→', agentUrl || 'core-agent')

          // Clear pending clarification and set loading state
          set((state) => {
            state.pendingClarification = null
            state.isLoading = true
            state.planModeState = 'executing'
            if (streamingId) {
              state.streamingMessageId = streamingId
            }
          })

          try {
            const res = await fetch('/api/chat/respond', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                clarificationId: response.clarificationId,
                answers: response.answers,
                agentUrl,
                sessionId,
              }),
            })

            if (!res.ok) {
              const errorText = await res.text()
              console.error('Clarification response failed:', res.status, errorText)
              set((state) => {
                state.isLoading = false
                state.planModeState = 'error'
              })
              throw new Error('Failed to send clarification response')
            }

            // Handle SSE streaming response
            const reader = res.body?.getReader()
            if (!reader) {
              throw new Error('No response stream available')
            }

            const decoder = new TextDecoder()
            let buffer = ''

            while (true) {
              const { done, value } = await reader.read()
              if (done) {
                console.log('📥 SSE stream ended')
                break
              }

              const chunk = decoder.decode(value, { stream: true })
              buffer += chunk

              const lines = buffer.split('\n')
              buffer = lines.pop() || ''

              for (const line of lines) {
                if (line.trim() === '' || line.startsWith(':')) continue

                if (line.startsWith('data: ')) {
                  const dataStr = line.slice(6).trim()
                  if (dataStr === '[DONE]') {
                    console.log('📥 Received [DONE] marker')
                    set((state) => {
                      state.isLoading = false
                      if (state.planModeState === 'executing') {
                        state.planModeState = 'idle'
                      }
                    })
                    continue
                  }

                  try {
                    const event = JSON.parse(dataStr)
                    console.log('📥 SSE event:', event.type, event)

                    switch (event.type) {
                      case 'clarification_needed':
                        // New clarification question from agent
                        set((state) => {
                          const clarification = event.clarification || event
                          state.pendingClarification = {
                            type: 'clarification_needed',
                            clarificationId: clarification.clarificationId,
                            agentId: clarification.agentId || 'unknown',
                            questions: clarification.questions || [],
                            message: clarification.message,
                            timeoutMs: clarification.timeoutMs || 300000,
                            agentUrl: clarification.agentUrl || agentUrl,
                            sessionId: clarification.sessionId || sessionId,
                          } as ClarificationNeeded & { agentUrl?: string; sessionId?: string }
                          state.planModeState = 'waiting_clarification'
                          state.isLoading = false
                        })
                        console.log('📥 New clarification:', event.clarification?.clarificationId)
                        break

                      case 'discovery_result':
                        set((state) => {
                          state.pendingDiscovery = event
                          // Also set pendingSelection for the DiscoverySelector component
                          // Include selectionId and sessionId from the event for SDK compatibility
                          state.pendingSelection = {
                            type: 'selection_required',
                            phase: 'selection' as const,
                            selectionId: event.selectionId || event.discoveryId || crypto.randomUUID(),
                            agentId: event.agentId || 'unknown',
                            items: event.items || [],
                            discoveryType: event.discoveryType || 'items',
                            message: event.message || 'Select items to continue',
                            minSelect: event.minSelect || 1,
                            maxSelect: event.maxSelect,
                            timeoutMs: event.timeoutMs || 300000,
                            agentUrl: event.agentUrl || agentUrl,
                            sessionId: event.sessionId || sessionId,
                          } as SelectionRequired & { agentUrl?: string; sessionId?: string; selectionId?: string }
                          state.planModeState = 'waiting_approval'
                          state.isLoading = false
                        })
                        console.log('📥 Discovery result → pendingSelection:', event.selectionId, event.sessionId)
                        break

                      case 'selection_required':
                        set((state) => {
                          // Include selectionId and sessionId for SDK compatibility
                          state.pendingSelection = {
                            ...event,
                            phase: 'selection' as const,
                            selectionId: event.selectionId,
                            agentUrl: event.agentUrl || agentUrl,
                            sessionId: event.sessionId || sessionId,
                          } as SelectionRequired & { agentUrl?: string; sessionId?: string; selectionId?: string }
                          state.planModeState = 'waiting_approval'
                          state.isLoading = false
                        })
                        console.log('📥 Selection required:', event.selectionId, event.sessionId)
                        break

                      case 'preview_ready':
                        set((state) => {
                          state.pendingPreview = event
                          state.planModeState = 'waiting_approval'
                          state.isLoading = false
                        })
                        break

                      case 'status':
                        // Working/progress status update (legacy)
                        console.log('📥 Status update:', event.status)
                        break

                      case 'progress':
                        // Progress event with step metadata
                        console.log('📊 Progress event:', event.step, event.message)
                        if (streamingId) {
                          set((state) => {
                            const msgIndex = state.messages.findIndex(m => m.id === streamingId)
                            if (msgIndex !== -1) {
                              const msg = state.messages[msgIndex]
                              const stepType = event.step || 'working'
                              const stepMessage = event.message || 'Processing...'

                              const existingIdx = msg.thinkingSteps?.findIndex(
                                s => s.step === stepType
                              ) ?? -1

                              const newStep: ThinkingStep = {
                                id: `step-${stepType}-${Date.now()}`,
                                content: stepMessage,
                                step: stepType,
                                metadata: event.metadata,
                                isCompleted: false,
                                timestamp: new Date().toISOString(),
                                importance: 'medium' as const,
                              }

                              if (existingIdx >= 0 && msg.thinkingSteps) {
                                msg.thinkingSteps[existingIdx] = {
                                  ...msg.thinkingSteps[existingIdx],
                                  content: stepMessage,
                                  metadata: event.metadata,
                                }
                              } else {
                                msg.thinkingSteps = [...(msg.thinkingSteps || []), newStep]
                              }

                              state.messages[msgIndex] = {
                                ...msg,
                                thinkingSteps: msg.thinkingSteps,
                                isThinking: true,
                              }
                            }
                          })
                        }
                        break

                      case 'content':
                        // Content chunk from agent - append to message
                        if (streamingId && event.content) {
                          set((state) => {
                            const message = state.messages.find(m => m.id === streamingId)
                            if (message) {
                              message.content = (message.content || '') + event.content
                            }
                          })
                        }
                        break

                      case 'done':
                        set((state) => {
                          state.isLoading = false
                          state.planModeState = event.state === 'completed' ? 'completed' : 'idle'
                          state.streamingMessageId = null
                        })
                        console.log('📥 Task completed')
                        break

                      case 'error':
                        set((state) => {
                          state.isLoading = false
                          state.planModeState = 'error'
                        })
                        console.error('📥 Error from agent:', event.error)
                        break

                      default:
                        console.log('📥 Unknown event type:', event.type)
                    }
                  } catch (parseError) {
                    console.warn('Failed to parse SSE data:', dataStr, parseError)
                  }
                }
              }
            }

            reader.releaseLock()

          } catch (error) {
            console.error('Error responding to clarification:', error)
            set((state) => {
              state.isLoading = false
              state.planModeState = 'error'
            })
            throw error
          }
        },

        approvePlan: async (approval) => {
          const state = get()
          const conversationId = state.currentConversationId

          try {
            const res = await fetch('/api/chat/respond', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                conversationId,
                response: approval,
              }),
            })

            if (!res.ok) {
              throw new Error('Failed to send plan approval')
            }

            set((state) => {
              if (approval.approved) {
                state.planModeState = 'executing'
              } else {
                state.currentPlan = null
                state.planModeState = 'idle'
              }
            })
          } catch (error) {
            console.error('Error approving plan:', error)
          }
        },

        clearPlanMode: () =>
          set((state) => {
            state.pendingClarification = null
            state.currentPlan = null
            state.currentStepId = null
            state.pendingSearchPlan = null
            state.planModeState = 'idle'
          }),

        // Search plan actions
        setPendingSearchPlan: (plan) =>
          set((state) => {
            state.pendingSearchPlan = plan
            if (plan) {
              state.planModeState = 'waiting_approval'
            }
          }),

        respondToSearchPlan: async (response) => {
          const state = get()
          const searchPlan = state.pendingSearchPlan
          const agentUrl = searchPlan?.agentUrl

          // Find the last assistant message to restore streaming to
          const lastAssistantMessage = state.messages
            .filter(m => m.role === 'assistant')
            .pop()
          const streamingId = lastAssistantMessage?.id || null

          try {
            const res = await fetch('/api/chat/respond', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                planId: response.planId,
                approved: response.approved,
                editedKeywords: response.editedKeywords,
                editedFilters: response.editedFilters,
                agentUrl,
              }),
            })

            if (!res.ok) {
              throw new Error('Failed to send search plan response')
            }

            set((state) => {
              state.pendingSearchPlan = null
              if (response.approved) {
                state.planModeState = 'executing'
                state.isLoading = true // Show loading spinner
                // Re-enable streaming message ID so progress events update the UI
                if (streamingId) {
                  state.streamingMessageId = streamingId
                }
              } else {
                state.planModeState = 'idle'
              }
            })
          } catch (error) {
            console.error('Error responding to search plan:', error)
          }
        },

        // New phase-based plan mode actions
        initPlanModeContext: (agentId, agentUrl) =>
          set((state) => {
            state.planModeContext = {
              phase: 'idle' as PlanModePhase,
              agentId,
              agentUrl,
              sessionId: crypto.randomUUID(),
              userAnswers: {},
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }
          }),

        advancePlanPhase: (nextPhase, data) =>
          set((state) => {
            if (state.planModeContext) {
              state.planModeContext = {
                ...state.planModeContext,
                ...data,
                phase: nextPhase,
                updatedAt: new Date().toISOString(),
              }
            }
          }),

        updateUserAnswers: (answers) =>
          set((state) => {
            if (state.planModeContext) {
              state.planModeContext.userAnswers = {
                ...state.planModeContext.userAnswers,
                ...answers,
              }
              state.planModeContext.updatedAt = new Date().toISOString()
            }
          }),

        setDiscoveredItems: (items) =>
          set((state) => {
            if (state.planModeContext) {
              state.planModeContext.discoveredItems = items
              state.planModeContext.updatedAt = new Date().toISOString()
            }
          }),

        setSelectedItems: (ids) =>
          set((state) => {
            if (state.planModeContext) {
              state.planModeContext.selectedItems = ids
              state.planModeContext.updatedAt = new Date().toISOString()
            }
          }),

        setPendingDiscovery: (discovery) =>
          set((state) => {
            state.pendingDiscovery = discovery
            if (discovery && state.planModeContext) {
              state.planModeContext.phase = 'discovery' as PlanModePhase
              state.planModeContext.discoveredItems = discovery.items
            }
          }),

        setPendingSelection: (selection) =>
          set((state) => {
            state.pendingSelection = selection
            if (selection && state.planModeContext) {
              state.planModeContext.phase = 'selection' as PlanModePhase
            }
          }),

        setPendingPreview: (preview) =>
          set((state) => {
            state.pendingPreview = preview
            if (preview && state.planModeContext) {
              state.planModeContext.phase = 'preview' as PlanModePhase
              state.planModeContext.searchPlan = preview.plan
            }
          }),

        respondToSelection: async (response) => {
          const currentState = get()
          const selection = currentState.pendingSelection as (SelectionRequired & { agentUrl?: string; sessionId?: string; selectionId?: string }) | null

          // Extract agentUrl and sessionId - use active session as fallback
          const agentUrl = selection?.agentUrl || currentState.activeAgentUrl
          const selectionId = selection?.selectionId
          const sessionId = selection?.sessionId || currentState.activeSessionId

          console.log('📤 respondToSelection - using session:', {
            selectionId,
            selectedIds: response.selectedIds,
            sessionId,
            agentUrl,
            fromActive: !!currentState.activeSessionId,
          })

          const lastAssistantMessage = currentState.messages
            .filter(m => m.role === 'assistant')
            .pop()
          const streamingId = lastAssistantMessage?.id || null

          try {
            // SDK format: { selectionId, selectedIds, sessionId }
            const res = await fetch('/api/chat/respond', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                selectionId,
                selectedIds: response.selectedIds,
                sessionId,
                agentUrl,
              }),
            })

            if (!res.ok) {
              const errorText = await res.text()
              console.error('Selection response failed:', res.status, errorText)
              throw new Error('Failed to send selection response')
            }

            set((state) => {
              state.pendingSelection = null
              if (state.planModeContext) {
                state.planModeContext.selectedItems = response.selectedIds
                state.planModeContext.phase = 'preview' as PlanModePhase
              }
              state.isLoading = true
              if (streamingId) {
                state.streamingMessageId = streamingId
              }
            })

            // Handle SSE streaming response (same pattern as respondToClarification)
            const reader = res.body?.getReader()
            if (reader) {
              const decoder = new TextDecoder()
              let buffer = ''

              while (true) {
                const { done, value } = await reader.read()
                if (done) break

                const chunk = decoder.decode(value, { stream: true })
                buffer += chunk

                const lines = buffer.split('\n')
                buffer = lines.pop() || ''

                for (const line of lines) {
                  if (line.trim() === '' || line.startsWith(':')) continue

                  if (line.startsWith('data: ')) {
                    const dataStr = line.slice(6).trim()
                    if (dataStr === '[DONE]') continue

                    try {
                      const event = JSON.parse(dataStr)
                      console.log('📥 Selection response SSE event:', event.type, event)

                      // Handle next phase events
                      if (event.type === 'preview_ready') {
                        set((state) => {
                          state.pendingPreview = {
                            ...event,
                            agentUrl: event.agentUrl || agentUrl,
                            sessionId: event.sessionId || sessionId,
                          }
                          state.planModeState = 'waiting_approval'
                          state.isLoading = false
                        })
                      } else if (event.type === 'content') {
                        if (streamingId && event.content) {
                          set((state) => {
                            const message = state.messages.find(m => m.id === streamingId)
                            if (message) {
                              message.content = (message.content || '') + event.content
                            }
                          })
                        }
                      } else if (event.type === 'done') {
                        set((state) => {
                          state.isLoading = false
                          state.planModeState = event.state === 'completed' ? 'completed' : 'idle'
                          state.streamingMessageId = null
                        })
                      } else if (event.type === 'progress') {
                        // Progress event with step metadata
                        console.log('📊 Selection progress event:', event.step, event.message)
                        if (streamingId) {
                          set((state) => {
                            const msgIndex = state.messages.findIndex(m => m.id === streamingId)
                            if (msgIndex !== -1) {
                              const msg = state.messages[msgIndex]
                              const stepType = event.step || 'working'
                              const stepMessage = event.message || 'Processing...'

                              const existingIdx = msg.thinkingSteps?.findIndex(
                                s => s.step === stepType
                              ) ?? -1

                              const newStep: ThinkingStep = {
                                id: `step-${stepType}-${Date.now()}`,
                                content: stepMessage,
                                step: stepType,
                                metadata: event.metadata,
                                isCompleted: false,
                                timestamp: new Date().toISOString(),
                                importance: 'medium' as const,
                              }

                              if (existingIdx >= 0 && msg.thinkingSteps) {
                                msg.thinkingSteps[existingIdx] = {
                                  ...msg.thinkingSteps[existingIdx],
                                  content: stepMessage,
                                  metadata: event.metadata,
                                }
                              } else {
                                msg.thinkingSteps = [...(msg.thinkingSteps || []), newStep]
                              }

                              state.messages[msgIndex] = {
                                ...msg,
                                thinkingSteps: msg.thinkingSteps,
                                isThinking: true,
                              }
                            }
                          })
                        }
                      } else if (event.type === 'error') {
                        set((state) => {
                          state.isLoading = false
                          state.planModeState = 'error'
                        })
                        console.error('📥 Error from agent:', event.error)
                      }
                    } catch (parseError) {
                      console.warn('Failed to parse SSE data:', dataStr, parseError)
                    }
                  }
                }
              }

              reader.releaseLock()
            }
          } catch (error) {
            console.error('Error responding to selection:', error)
            set((state) => {
              state.isLoading = false
              state.planModeState = 'error'
            })
            throw error
          }
        },

        respondToPreview: async (response) => {
          const currentState = get()
          const preview = currentState.pendingPreview
          const agentUrl = preview?.agentUrl
          const sessionId = preview?.sessionId

          const lastAssistantMessage = currentState.messages
            .filter(m => m.role === 'assistant')
            .pop()
          const streamingId = lastAssistantMessage?.id || null

          console.log('📤 respondToPreview - using session:', {
            planId: response.planId,
            approved: response.approved,
            sessionId,
            agentUrl,
          })

          try {
            const res = await fetch('/api/chat/respond', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'preview_response',
                planId: response.planId,
                approved: response.approved,
                editedPlan: response.editedPlan,
                agentUrl,
                sessionId,
              }),
            })

            if (!res.ok) {
              const errorText = await res.text()
              console.error('Preview response failed:', res.status, errorText)
              throw new Error('Failed to send preview response')
            }

            set((state) => {
              state.pendingPreview = null
              if (state.planModeContext) {
                state.planModeContext.phase = response.approved
                  ? 'executing' as PlanModePhase
                  : 'idle' as PlanModePhase
                if (response.editedPlan) {
                  state.planModeContext.searchPlan = response.editedPlan
                }
              }
              if (response.approved) {
                state.isLoading = true
                if (streamingId) {
                  state.streamingMessageId = streamingId
                }
              }
            })

            // Handle SSE streaming response (same pattern as other respond methods)
            const reader = res.body?.getReader()
            if (reader) {
              const decoder = new TextDecoder()
              let buffer = ''

              while (true) {
                const { done, value } = await reader.read()
                if (done) {
                  console.log('📥 Preview response SSE stream ended')
                  break
                }

                const chunk = decoder.decode(value, { stream: true })
                buffer += chunk

                const lines = buffer.split('\n')
                buffer = lines.pop() || ''

                for (const line of lines) {
                  if (line.trim() === '' || line.startsWith(':')) continue

                  if (line.startsWith('data: ')) {
                    const dataStr = line.slice(6).trim()
                    if (dataStr === '[DONE]') {
                      console.log('📥 Received [DONE] marker')
                      set((state) => {
                        state.isLoading = false
                        if (state.planModeState === 'executing') {
                          state.planModeState = 'completed'
                        }
                      })
                      continue
                    }

                    try {
                      const event = JSON.parse(dataStr)
                      console.log('📥 Preview response SSE event:', event.type, event)

                      if (event.type === 'progress') {
                        // Progress event with step metadata
                        console.log('📊 Execution progress:', event.step, event.message)
                        if (streamingId) {
                          set((state) => {
                            const msgIndex = state.messages.findIndex(m => m.id === streamingId)
                            if (msgIndex !== -1) {
                              const msg = state.messages[msgIndex]
                              const stepType = event.step || 'working'
                              const stepMessage = event.message || 'Processing...'

                              const existingIdx = msg.thinkingSteps?.findIndex(
                                s => s.step === stepType
                              ) ?? -1

                              const newStep: ThinkingStep = {
                                id: `step-${stepType}-${Date.now()}`,
                                content: stepMessage,
                                step: stepType,
                                metadata: event.metadata,
                                isCompleted: false,
                                timestamp: new Date().toISOString(),
                                importance: 'medium' as const,
                              }

                              if (existingIdx >= 0 && msg.thinkingSteps) {
                                msg.thinkingSteps[existingIdx] = {
                                  ...msg.thinkingSteps[existingIdx],
                                  content: stepMessage,
                                  metadata: event.metadata,
                                }
                              } else {
                                msg.thinkingSteps = [...(msg.thinkingSteps || []), newStep]
                              }

                              state.messages[msgIndex] = {
                                ...msg,
                                thinkingSteps: msg.thinkingSteps,
                                isThinking: true,
                              }
                            }
                          })
                        }
                      } else if (event.type === 'content') {
                        // Content chunk from agent - append to message
                        if (streamingId && event.content) {
                          set((state) => {
                            const message = state.messages.find(m => m.id === streamingId)
                            if (message) {
                              message.content = (message.content || '') + event.content
                            }
                          })
                        }
                      } else if (event.type === 'done') {
                        set((state) => {
                          state.isLoading = false
                          state.planModeState = event.state === 'completed' ? 'completed' : 'idle'
                          state.streamingMessageId = null
                          const msgIndex = state.messages.findIndex(m => m.id === streamingId)
                          if (msgIndex !== -1) {
                            state.messages[msgIndex] = {
                              ...state.messages[msgIndex],
                              isThinking: false,
                            }
                          }
                        })
                        console.log('📥 Execution completed')
                      } else if (event.type === 'error') {
                        set((state) => {
                          state.isLoading = false
                          state.planModeState = 'error'
                        })
                        console.error('📥 Error from agent:', event.error)
                      }
                    } catch (parseError) {
                      console.warn('Failed to parse SSE data:', dataStr, parseError)
                    }
                  }
                }
              }

              reader.releaseLock()
            }
          } catch (error) {
            console.error('Error responding to preview:', error)
            set((state) => {
              state.isLoading = false
              state.planModeState = 'error'
            })
            throw error
          }
        },

        handlePhaseEvent: (event) =>
          set((state) => {
            if (event.type === 'discovery_result') {
              state.pendingDiscovery = event as DiscoveryResult
              if (state.planModeContext) {
                state.planModeContext.phase = 'discovery' as PlanModePhase
                state.planModeContext.discoveredItems = (event as DiscoveryResult).items
              }
            } else if (event.type === 'selection_required') {
              state.pendingSelection = event as SelectionRequired
              if (state.planModeContext) {
                state.planModeContext.phase = 'selection' as PlanModePhase
              }
            } else if (event.type === 'preview_ready') {
              state.pendingPreview = event as PreviewReady
              if (state.planModeContext) {
                state.planModeContext.phase = 'preview' as PlanModePhase
                state.planModeContext.searchPlan = (event as PreviewReady).plan
              }
            }
            // Stop loading spinner when we have a pending event
            state.isLoading = false
            state.streamingMessageId = null
          }),

        // Agent selection
        setSelectedAgent: (agent) =>
          set((state) => {
            state.selectedAgent = agent
          }),

        // Session tracking actions (SessionManager integration)
        setActiveSessionId: (sessionId) =>
          set((state) => {
            state.activeSessionId = sessionId
          }),

        setActiveAgentUrl: (agentUrl) =>
          set((state) => {
            state.activeAgentUrl = agentUrl
          }),

        setActiveSession: (sessionId, agentUrl) =>
          set((state) => {
            state.activeSessionId = sessionId
            state.activeAgentUrl = agentUrl
            console.log('📋 Active session set:', { sessionId, agentUrl })
          }),

        // Input prefill actions (for welcome state prompt cards)
        setInputPrefill: (text) =>
          set((state) => {
            state.inputPrefill = text
          }),

        clearInputPrefill: () =>
          set((state) => {
            state.inputPrefill = null
          }),

        // Settings
        updateSettings: (newSettings) =>
          set((state) => {
            Object.assign(state.settings, newSettings)
          }),
          
        // Utility actions
        clearMessages: () =>
          set((state) => {
            state.messages = []
            state.streamingMessageId = null
            state.isLoading = false
            state.currentConversationId = null
            state.isNewConversation = true
            // Clear active session
            state.activeSessionId = null
            state.activeAgentUrl = null
            // Also clear plan mode state (legacy)
            state.pendingClarification = null
            state.currentPlan = null
            state.currentStepId = null
            state.pendingSearchPlan = null
            state.planModeState = 'idle'
            // Clear new phase-based plan mode state
            state.planModeContext = null
            state.pendingDiscovery = null
            state.pendingSelection = null
            state.pendingPreview = null
          }),
          
        // Get recent message history for LLM context
        getRecentHistory: (maxMessages = 10) => {
          const state = get()
          return state.messages
            .filter(m => m.role === 'user' || m.role === 'assistant') // Only user/assistant messages
            .filter(m => !m.streaming) // Don't include currently streaming messages
            .slice(-maxMessages) // Keep last N messages
            .map(m => ({
              role: m.role as 'user' | 'assistant',
              content: m.content
            }))
        }
              }))
    )
  )
)

// Selectors for optimized subscriptions
export const selectMessages = (state: ChatState) => state.messages
export const selectStreamingMessage = (state: ChatState) =>
  state.streamingMessageId ? state.messages.find(m => m.id === state.streamingMessageId) : null
export const selectSelectedFiles = (state: ChatState) => state.selectedFiles
export const selectIsLoading = (state: ChatState) => state.isLoading
export const selectAgentHealth = (state: ChatState) => state.agentHealth
export const selectSettings = (state: ChatState) => state.settings
export const selectCurrentConversationId = (state: ChatState) => state.currentConversationId
export const selectIsNewConversation = (state: ChatState) => state.isNewConversation

// Plan mode selectors (legacy)
export const selectPlanModeEnabled = (state: ChatState) => state.planModeEnabled
export const selectPlanModeState = (state: ChatState) => state.planModeState
export const selectPendingClarification = (state: ChatState) => state.pendingClarification
export const selectCurrentPlan = (state: ChatState) => state.currentPlan
export const selectCurrentStepId = (state: ChatState) => state.currentStepId
export const selectPendingSearchPlan = (state: ChatState) => state.pendingSearchPlan
export const selectSelectedAgent = (state: ChatState) => state.selectedAgent
export const selectInputPrefill = (state: ChatState) => state.inputPrefill

// New phase-based plan mode selectors
export const selectPlanModeContext = (state: ChatState) => state.planModeContext
export const selectCurrentPhase = (state: ChatState) => state.planModeContext?.phase ?? 'idle'
export const selectPendingDiscovery = (state: ChatState) => state.pendingDiscovery
export const selectPendingSelection = (state: ChatState) => state.pendingSelection
export const selectPendingPreview = (state: ChatState) => state.pendingPreview
export const selectDiscoveredItems = (state: ChatState) => state.planModeContext?.discoveredItems ?? []
export const selectSelectedItems = (state: ChatState) => state.planModeContext?.selectedItems ?? []
export const selectUserAnswers = (state: ChatState) => state.planModeContext?.userAnswers ?? {}

// Session tracking selectors (SessionManager integration)
export const selectActiveSessionId = (state: ChatState) => state.activeSessionId
export const selectActiveAgentUrl = (state: ChatState) => state.activeAgentUrl
export const selectActiveSession = (state: ChatState) => ({
  sessionId: state.activeSessionId,
  agentUrl: state.activeAgentUrl,
})