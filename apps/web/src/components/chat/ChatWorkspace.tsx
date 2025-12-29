'use client'

import React, { useEffect, useRef } from 'react'
import { Search, Hash, Target, Play, Loader2 } from 'lucide-react'
import { ChatMessage, FileReference, FileAttachment, FileMention } from '@/types'
import { EnhancedMessageBubble } from './EnhancedMessageBubble'
import { ChatInput } from './ChatInput'
import { SteppedClarificationCard } from './SteppedClarificationCard'
import { DiscoverySelector } from './DiscoverySelector'
import { SearchPlanCard } from './SearchPlanCard'
import { ScheduleProposalCard } from './ScheduleProposalCard'
import { WelcomeState } from './WelcomeState'
import { QuotaExceededCard, type QuotaError } from './QuotaExceededCard'
import type { ScheduleResponse } from '@pixell/protocols'
import { useChatStore, selectMessages, selectIsLoading, selectStreamingMessage, selectCurrentConversationId, selectIsNewConversation, selectPendingClarification, selectPendingSelection, selectPendingPreview, selectPendingSearchPlan } from '@/stores/chat-store'
import { useTabStore } from '@/stores/tab-store'
import { useHistoryStore } from '@/stores/history-store'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { useWorkflowStore } from '@/stores/workflow-store'
import { coreAgentService } from '@/services/coreAgentService'
import { AgentConfig } from './AgentSelector'

interface ChatWorkspaceProps {
  className?: string
}

export function ChatWorkspace({ className = '' }: ChatWorkspaceProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const [quotaError, setQuotaError] = React.useState<QuotaError | null>(null)

  // Zustand store selectors
  const messages = useChatStore(selectMessages)
  const isLoading = useChatStore(selectIsLoading)
  const streamingMessage = useChatStore(selectStreamingMessage)
  const currentConversationId = useChatStore(selectCurrentConversationId)
  const isNewConversation = useChatStore(selectIsNewConversation)
  const pendingClarification = useChatStore(selectPendingClarification)
  const pendingSelection = useChatStore(selectPendingSelection)
  const pendingPreview = useChatStore(selectPendingPreview)
  const pendingSearchPlan = useChatStore(selectPendingSearchPlan)

  // Plan mode actions
  const respondToClarification = useChatStore(state => state.respondToClarification)
  const setPendingClarification = useChatStore(state => state.setPendingClarification)
  const respondToSelection = useChatStore(state => state.respondToSelection)
  const setPendingSelection = useChatStore(state => state.setPendingSelection)
  const respondToPreview = useChatStore(state => state.respondToPreview)
  const setPendingPreview = useChatStore(state => state.setPendingPreview)
  const respondToSearchPlan = useChatStore(state => state.respondToSearchPlan)
  const setPendingSearchPlan = useChatStore(state => state.setPendingSearchPlan)
  const setPendingDiscovery = useChatStore(state => state.setPendingDiscovery)

  // Session tracking for plan mode (SessionManager integration)
  const setActiveSession = useChatStore(state => state.setActiveSession)

  // Debug logging removed - rendering now working

  const settings = useChatStore(state => state.settings)
  const agentHealth = useChatStore(state => state.agentHealth)

  // Store actions
  const addMessage = useChatStore(state => state.addMessage)
  const getRecentHistory = useChatStore(state => state.getRecentHistory)
  const setConversationId = useChatStore(state => state.setConversationId)
  const saveMessage = useChatStore(state => state.saveMessage)

  // Tab store
  const { getActiveTab, updateTabConversation, updateTabTitle } = useTabStore()

  // History store for creating conversations
  const { createConversation, updateConversation } = useHistoryStore()

  // Workspace store for activity pane
  const createOptimisticActivity = useWorkspaceStore(state => state.createOptimisticActivity)
  const setActivityPaneState = useWorkspaceStore(state => state.setActivityPaneState)

  // Schedule proposals from workspace store
  const pendingScheduleProposals = useWorkspaceStore(state => state.pendingScheduleProposals)

  // Remove test message - rendering confirmed to work
  const setStreamingMessage = useChatStore(state => state.setStreamingMessage)
  const handleStreamingChunk = useChatStore(state => state.handleStreamingChunk)
  const setLoading = useChatStore(state => state.setLoading)
  const setAgentHealth = useChatStore(state => state.setAgentHealth)

  // Auto-scroll to bottom when new messages arrive or during streaming
  useEffect(() => {
    if (settings.autoScrollEnabled && scrollAreaRef.current) {
      // Use requestAnimationFrame to ensure the DOM has updated
      requestAnimationFrame(() => {
        if (scrollAreaRef.current) {
          scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
        }
      })
    }
  }, [messages, streamingMessage, settings.autoScrollEnabled])

  // Additional effect to handle streaming content updates
  useEffect(() => {
    if (streamingMessage && settings.autoScrollEnabled && scrollAreaRef.current) {
      // Smooth scroll during streaming
      requestAnimationFrame(() => {
        if (scrollAreaRef.current) {
          scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
        }
      })
    }
  }, [streamingMessage, settings.autoScrollEnabled])

  // Check AI health on mount and clear temp folder
  useEffect(() => {
    const checkHealth = async () => {
      const health = await coreAgentService.getHealthStatus()
      setAgentHealth(health)
    }

    const clearTempFolder = async () => {
      try {
        // Simply ensure .temp folder exists, but don't try to clear it on app start
        // This was causing deletion of wrong files
        await fetch('/api/files/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: '.temp',
            type: 'folder'
          })
        }).catch(() => {
          // Ignore error if folder already exists
        })

        console.log('.temp folder ensured to exist')
      } catch (error) {
        console.error('Failed to ensure temp folder exists:', error)
      }
    }

    checkHealth()
    clearTempFolder()

    // Check health every 30 seconds
    const healthInterval = setInterval(checkHealth, 30000)
    return () => clearInterval(healthInterval)
  }, [setAgentHealth])

  const handleSendMessage = async (content: string, fileReferences: FileReference[], attachments: FileAttachment[], mentions: FileMention[], planMode?: boolean, selectedAgent?: AgentConfig | null) => {
    if (!content.trim() || isLoading) return

    // Clear any previous quota error when starting a new message
    setQuotaError(null)

    // Create conversation if this is a new conversation
    let conversationId = currentConversationId
    if (!conversationId || isNewConversation) {
      try {
        const newConversation = await createConversation()
        // newConversation can be null if user is not authenticated
        if (newConversation) {
          conversationId = newConversation.id
          setConversationId(conversationId)

          // Update the current tab with the conversation
          const activeTab = getActiveTab()
          if (activeTab) {
            updateTabConversation(activeTab.id, conversationId)
          }
        }
      } catch (error) {
        console.error('Failed to create conversation:', error)
        // Continue without persistence if creation fails
      }
    }

    // Add user message
    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content,
      messageType: 'text',
      fileReferences: fileReferences.length > 0 ? fileReferences : undefined,
      attachments: attachments.length > 0 ? attachments : undefined,
      mentions: mentions.length > 0 ? mentions : undefined,
      createdAt: new Date().toISOString()
    }

    addMessage(userMessage)

    // Save user message to database (fire and forget)
    if (conversationId) {
      saveMessage(userMessage).catch((err) => console.error('Failed to save user message:', err))
    }

    // Create optimistic activity for instant feedback in Activity Pane
    setActivityPaneState('transitioning')
    const activityName = content.length > 50 ? content.substring(0, 47) + '...' : content
    const optimisticActivity = createOptimisticActivity(userMessage.id, activityName)
    console.log('📊 Created optimistic activity:', optimisticActivity.id, activityName)

    // Create assistant message for streaming
    const assistantMessage: ChatMessage = {
      id: `assistant_${Date.now()}`,
      role: 'assistant',
      content: '',
      messageType: 'text',
      streaming: true,
      createdAt: new Date().toISOString()
    }
    addMessage(assistantMessage)
    setStreamingMessage(assistantMessage.id)
    setLoading(true)

    // Store reference to assistant message for saving after completion
    const assistantMessageRef = assistantMessage

    // Send to agent (Core Agent or external A2A agent)
    try {
      // Get recent message history for context (last 10 exchanges)
      const history = getRecentHistory(10)

      // Process file attachments - combine file references and attachments
      const allFileReferences: FileReference[] = [...fileReferences]

      // Combine file context from navigator selections AND @ mentions
      const fileContextFromRefs = allFileReferences.map(f => ({
        path: f.path,
        name: f.name,
        content: f.content
      }))

      // Add file context from @ mentions (these have loaded content)
      const fileContextFromMentions = mentions
        .filter(m => m.loadingState === 'loaded' && m.content)
        .map(m => ({
          path: m.path,
          name: m.name,
          content: m.content
        }))

      const allFileContext = [...fileContextFromRefs, ...fileContextFromMentions]

      // Build request body - include selectedAgent for routing
      const requestBody = {
        message: content,
        history,
        fileContext: allFileContext,
        settings: {
          showThinking: settings.showThinking !== 'never',
          enableMarkdown: settings.markdownEnabled,
          streamingEnabled: settings.streamingEnabled
        },
        selectedAgent: selectedAgent || null,
        planMode: planMode || false,
        // Include conversationId for memory extraction
        conversationId: conversationId || null
      }

      console.log('📤 Sending message with agent:', selectedAgent?.name || 'default', requestBody)

      // Use the Next.js API route which will handle routing based on selectedAgent
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        // Check for quota error (403)
        if (response.status === 403) {
          try {
            const errorData = await response.json()
            if (errorData.message && 'featureAvailable' in errorData) {
              // This is a quota error - show upgrade prompt
              setQuotaError(errorData as QuotaError)
              // Update the assistant message to indicate the error
              const state = useChatStore.getState()
              const msgIdx = state.messages.findIndex(m => m.id === assistantMessage.id)
              if (msgIdx !== -1) {
                useChatStore.setState({
                  messages: state.messages.filter(m => m.id !== assistantMessage.id)
                })
              }
              setStreamingMessage(null)
              setLoading(false)
              return
            }
          } catch {
            // Fall through to generic error
          }
        }
        throw new Error(`API error: ${response.status} ${response.statusText}`)
      }

      // Handle SSE streaming
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('No response stream available')
      }

      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        buffer += chunk

        // Process complete lines
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (trimmed === '' || !trimmed.startsWith('data: ')) continue

          const jsonData = trimmed.slice(6).trim()
          if (jsonData === '[DONE]') continue

          try {
            const eventData = JSON.parse(jsonData)
            console.log('📥 Received SSE event:', eventData)

            // Handle event types
            if (eventData.type === 'session_created') {
              // Session created by orchestrator's SessionManager
              // Store for use in subsequent respond calls
              console.log('🔗 Session created:', eventData.sessionId, eventData.agentUrl, 'workflowId:', eventData.workflowId)
              setActiveSession(eventData.sessionId, eventData.agentUrl)

              // Create workflow in workflow store for centralized tracking
              // This provides the single source of truth for all components
              if (eventData.workflowId) {
                const { startWorkflow } = useWorkflowStore.getState()
                startWorkflow({
                  workflowId: eventData.workflowId,
                  sessionId: eventData.sessionId,
                  agentId: selectedAgent?.id || 'unknown',
                  agentUrl: eventData.agentUrl,
                  initialMessageId: userMessage.id,
                  responseMessageId: assistantMessageRef.id,
                })
              }
              // Don't break - continue processing other events
            } else if (eventData.type === 'content') {
              handleStreamingChunk({
                type: 'content',
                delta: { content: eventData.delta?.content || '' },
                accumulated: eventData.accumulated || ''
              })
            } else if (eventData.type === 'thinking') {
              handleStreamingChunk({
                type: 'thinking',
                context: eventData.context || { thoughts: [] }
              })
            } else if (eventData.type === 'complete') {
              // Update workflow phase to completed if workflowId present
              if (eventData.workflowId) {
                const { completeWorkflow } = useWorkflowStore.getState()
                completeWorkflow(eventData.workflowId)
                console.log('📋 Workflow completed:', eventData.workflowId)
              }
              handleStreamingChunk({ type: 'complete' })
            } else if (eventData.type === 'error') {
              // Update workflow phase to error if workflowId present
              if (eventData.workflowId) {
                const { errorWorkflow } = useWorkflowStore.getState()
                errorWorkflow(eventData.workflowId, eventData.error || 'Unknown error')
                console.log('📋 Workflow error:', eventData.workflowId, eventData.error)
              }
              handleStreamingChunk({
                type: 'error',
                error: eventData.error || 'Unknown error'
              })
            } else if (eventData.type === 'clarification_needed') {
              // Handle plan mode clarification
              console.log('🔍 Received clarification_needed:', {
                clarificationId: eventData.clarification?.clarificationId,
                agentUrl: eventData.clarification?.agentUrl,
                sessionId: eventData.clarification?.sessionId,
                workflowId: eventData.workflowId,
                keys: eventData.clarification ? Object.keys(eventData.clarification) : [],
              })

              // Update workflow phase to clarification
              if (eventData.workflowId) {
                const { updatePhase } = useWorkflowStore.getState()
                updatePhase(eventData.workflowId, 'clarification', {
                  clarification: eventData.clarification
                })
              }

              const setPendingClarification = useChatStore.getState().setPendingClarification
              setPendingClarification(eventData.clarification)
              // Update UI state to show clarification card (stop loading spinner)
              setStreamingMessage(null)
              setLoading(false)
              // NOTE: Do NOT break out of the stream reading loop!
              // The stream needs to stay open so the agent can wait for and receive
              // the clarification response via /a2a/respond. Closing the stream would
              // cancel the task and clean up the clarification waiter.
              // The stream will continue in the background and process further events.
            } else if (eventData.type === 'search_plan') {
              // Handle search plan approval
              const setPendingSearchPlan = useChatStore.getState().setPendingSearchPlan
              setPendingSearchPlan(eventData.plan)
              // Update UI state to show plan viewer (stop loading spinner)
              setStreamingMessage(null)
              setLoading(false)
              // NOTE: Do NOT break out of the stream reading loop!
              // The stream needs to stay open so the agent can receive the approval.
            } else if (eventData.type === 'discovery_result') {
              // Discovery phase: store results (often immediately followed by selection_required)
              console.log('🔍 Discovery result:', eventData)
              const setPendingDiscovery = useChatStore.getState().setPendingDiscovery
              setPendingDiscovery(eventData)
              setStreamingMessage(null)
              setLoading(false)
              // NOTE: Stream stays open - agent will emit selection_required next
            } else if (eventData.type === 'selection_required') {
              // Selection phase: show DiscoverySelector component
              console.log('📋 Selection required:', eventData, 'workflowId:', eventData.workflowId)

              // Update workflow phase to selection
              if (eventData.workflowId) {
                const { updatePhase } = useWorkflowStore.getState()
                updatePhase(eventData.workflowId, 'selection', {
                  selection: eventData.selection || eventData
                })
              }

              const setPendingSelection = useChatStore.getState().setPendingSelection
              setPendingSelection({
                ...eventData,
                agentUrl: eventData.agentUrl,
                sessionId: eventData.sessionId,
                selectionId: eventData.selectionId,
              })
              setStreamingMessage(null)
              setLoading(false)
              // NOTE: Stream stays open for selection response
            } else if (eventData.type === 'preview_ready') {
              // Preview phase: show plan approval UI
              console.log('📝 Preview ready:', eventData, 'workflowId:', eventData.workflowId)

              // Update workflow phase to preview
              if (eventData.workflowId) {
                const { updatePhase } = useWorkflowStore.getState()
                updatePhase(eventData.workflowId, 'preview', {
                  preview: eventData.preview || eventData
                })
              }

              const setPendingPreview = useChatStore.getState().setPendingPreview
              setPendingPreview({
                ...eventData,
                agentUrl: eventData.agentUrl,
                sessionId: eventData.sessionId,
              })
              setStreamingMessage(null)
              setLoading(false)
              // NOTE: Stream stays open for approval response
            } else if (eventData.type === 'phase_transition') {
              // Phase transition: log for debugging
              console.log('🔄 Phase transition:', eventData.fromPhase, '→', eventData.toPhase)
              // Stream continues - no state change needed
            } else if (eventData.type === 'plan_executing') {
              // Execution started: create new message for response content
              console.log('🚀 Plan executing:', eventData, 'workflowId:', eventData.workflowId)

              // Update workflow phase to executing
              if (eventData.workflowId) {
                const { updatePhase, getWorkflow } = useWorkflowStore.getState()
                updatePhase(eventData.workflowId, 'executing')

                // Get the workflow to check for responseMessageId
                const workflow = getWorkflow(eventData.workflowId)
                if (workflow) {
                  console.log('📋 Workflow found for execution:', workflow.workflowId, 'responseMessageId:', workflow.responseMessageId)
                }
              }

              // Create a new assistant message for execution response
              // This is needed because streamingMessageId was cleared during clarification/selection phases
              const executionMessage: ChatMessage = {
                id: `assistant_exec_${Date.now()}`,
                role: 'assistant',
                content: '',
                messageType: 'text',
                streaming: true,
                createdAt: new Date().toISOString()
              }
              addMessage(executionMessage)
              setStreamingMessage(executionMessage.id)
              setLoading(true)
            } else if (eventData.type === 'schedule_proposal') {
              // Handle schedule proposal from agent
              console.log('📅 Received schedule_proposal:', eventData)

              // Store the proposal in workspace store
              const { addPendingProposal } = useWorkspaceStore.getState()
              addPendingProposal(eventData)

              // Stop loading/streaming - waiting for user input
              setStreamingMessage(null)
              setLoading(false)
              // NOTE: Stream stays open for schedule response
            } else if (eventData.type === 'file_created') {
              // Handle file created: agent-generated file output
              console.log('🎯 [ChatWorkspace] FILE_CREATED event received!')
              console.log('📁 File data:', {
                name: eventData.name,
                path: eventData.path,
                format: eventData.format,
                size: eventData.size,
                summary: eventData.summary
              })
              handleStreamingChunk({
                type: 'file_created',
                path: eventData.path,
                name: eventData.name,
                format: eventData.format,
                size: eventData.size,
                summary: eventData.summary,
              })
            }
          } catch (parseError) {
            console.warn('Failed to parse SSE data:', parseError, jsonData)
          }
        }
      }

      reader.releaseLock()

      // Mark complete
      setStreamingMessage(null)
      setLoading(false)

      // Save completed assistant message to database (only if it has content)
      if (conversationId) {
        const state = useChatStore.getState()
        const finalMessage = state.messages.find(m => m.id === assistantMessageRef.id)
        // Don't save empty messages (e.g., when only clarification was received)
        if (finalMessage && finalMessage.content && finalMessage.content.trim().length > 0) {
          saveMessage({
            ...finalMessage,
            streaming: false,
          }).catch((err) => console.error('Failed to save assistant message:', err))
        }
      }

    } catch (error) {
      console.error('Failed to send message:', error)

      // Add error message
      const errorMessage: ChatMessage = {
        id: `error_${Date.now()}`,
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error}`,
        messageType: 'alert',
        createdAt: new Date().toISOString()
      }

      addMessage(errorMessage)
      setStreamingMessage(null)
      setLoading(false)
    }
  }

  // Welcome state is now handled by the WelcomeState component

  // Handle schedule proposal responses (confirm/cancel)
  const handleScheduleResponse = async (response: ScheduleResponse) => {
    const { removePendingProposal, addSchedule } = useWorkspaceStore.getState()
    const { activeSessionId, activeAgentUrl } = useChatStore.getState()

    setLoading(true)

    try {
      // Forward response to agent via respond endpoint (so agent knows user's decision)
      if (activeSessionId) {
        const orchestratorUrl = process.env.NEXT_PUBLIC_ORCHESTRATOR_URL || 'http://localhost:3001'
        console.log('📅 Forwarding schedule response to agent:', { proposalId: response.proposalId, action: response.action })

        const respondRes = await fetch(`${orchestratorUrl}/api/chat/respond`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            proposalId: response.proposalId,
            action: response.action,
            modifications: response.modifications,
            cancelReason: response.cancelReason,
            sessionId: activeSessionId,
            agentUrl: activeAgentUrl,
          })
        })

        // Process streaming response from agent (consume but don't block)
        if (respondRes.ok && respondRes.body) {
          const reader = respondRes.body.getReader()
          const decoder = new TextDecoder()

          // Read response stream in background
          ;(async () => {
            try {
              while (true) {
                const { done, value } = await reader.read()
                if (done) break
                const text = decoder.decode(value, { stream: true })
                console.log('📅 Schedule response stream:', text)
              }
            } catch (e) {
              console.error('Error reading schedule response stream:', e)
            }
          })()
        }
      }

      // If confirmed, also create schedule in database
      if (response.action === 'confirm') {
        const proposal = Object.values(pendingScheduleProposals).find(p => p.proposalId === response.proposalId)
        if (proposal) {
          const orchestratorUrl = process.env.NEXT_PUBLIC_ORCHESTRATOR_URL || 'http://localhost:3001'
          const scheduleRes = await fetch(`${orchestratorUrl}/api/schedules/from-proposal`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(proposal)
          })

          if (scheduleRes.ok) {
            const schedule = await scheduleRes.json()
            addSchedule(schedule)
            console.log('✅ Schedule created:', schedule)
          } else {
            console.error('Failed to create schedule:', await scheduleRes.text())
          }
        }
      }
    } catch (error) {
      console.error('Error handling schedule response:', error)
    } finally {
      // Remove from pending regardless of action
      removePendingProposal(response.proposalId)
      setLoading(false)
    }
  }

  return (
    <div className={`chat-workspace flex flex-col h-full bg-pixell-black ${className}`}>
      {/* Messages Area - Following Design Guide */}
      <div ref={scrollAreaRef} className="flex-1 overflow-y-auto overflow-x-auto px-4 py-6 custom-scrollbar">
        {messages.length === 0 && isLoading && currentConversationId ? (
          // Loading state when loading an existing conversation from history
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-white/50">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/50 mx-auto mb-3" />
              <p className="text-sm">Loading conversation...</p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <WelcomeState />
        ) : (
          <div className="space-y-6 mx-auto max-w-4xl">
            {messages.map((message) => (
              <EnhancedMessageBubble
                key={message.id}
                message={message}
                isStreaming={streamingMessage?.id === message.id}
              />
            ))}
            {/* Quota Error: Show upgrade prompt */}
            {quotaError && (
              <QuotaExceededCard
                quotaError={quotaError}
                onDismiss={() => setQuotaError(null)}
              />
            )}
            {/* Plan Mode: Clarification Questions (Stepped) */}
            {pendingClarification && (
              <SteppedClarificationCard
                clarification={pendingClarification}
                onRespond={respondToClarification}
                onDismiss={() => setPendingClarification(null)}
                isSubmitting={isLoading}
              />
            )}
            {/* Plan Mode: Selection (after discovery) */}
            {pendingSelection && (
              <DiscoverySelector
                discoveryType={pendingSelection.discoveryType || 'items'}
                items={pendingSelection.items || []}
                onSelect={respondToSelection}
                onCancel={() => setPendingSelection(null)}
                minSelect={pendingSelection.minSelect || 1}
                maxSelect={pendingSelection.maxSelect}
                message={pendingSelection.message}
                isSubmitting={isLoading}
              />
            )}
            {/* Plan Mode: Search Plan Approval (TikTok-style) */}
            {pendingSearchPlan && (
              <SearchPlanCard
                plan={pendingSearchPlan}
                onApprove={respondToSearchPlan}
                onReject={(response) => {
                  respondToSearchPlan({ ...response, approved: false })
                  setPendingSearchPlan(null)
                }}
                isSubmitting={isLoading}
              />
            )}
            {/* Plan Mode: Preview/Plan Approval (SearchPlanPreview) */}
            {pendingPreview && pendingPreview.plan && (
              <div className="glass-card p-5 max-w-xl w-full animate-in fade-in slide-in-from-bottom-2 duration-300">
                {/* Header */}
                <div className="flex items-start gap-3 mb-4">
                  <div className="icon-container-yellow shrink-0">
                    <Search className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-white mb-1">
                      {pendingPreview.plan.title || 'Search Plan Preview'}
                    </h3>
                    {pendingPreview.message && (
                      <p className="text-xs text-pixell-grey leading-relaxed">{pendingPreview.message}</p>
                    )}
                  </div>
                </div>

                {/* Plan Details */}
                <div className="space-y-3 mb-5">
                  {/* Keywords */}
                  {pendingPreview.plan.keywords?.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs text-pixell-grey">
                        <Hash className="h-3 w-3" />
                        <span>Search Keywords</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {pendingPreview.plan.keywords.map((keyword: string, idx: number) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 text-xs rounded-full bg-pixell-yellow/10 text-pixell-yellow border border-pixell-yellow/20"
                          >
                            {keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Targets/Subreddits */}
                  {pendingPreview.plan.targets?.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs text-pixell-grey">
                        <Target className="h-3 w-3" />
                        <span>Target Sources</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {pendingPreview.plan.targets.map((target: string, idx: number) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 text-xs rounded-full bg-pixell-orange/10 text-pixell-orange border border-pixell-orange/20"
                          >
                            {target}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                  <button
                    onClick={() => {
                      respondToPreview({ type: 'preview_response', planId: pendingPreview.plan.planId, approved: false })
                      setPendingPreview(null)
                    }}
                    className="px-4 py-2 text-xs font-medium text-white/70 hover:text-white border border-white/20 hover:border-white/40 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => respondToPreview({ type: 'preview_response', planId: pendingPreview.plan.planId, approved: true })}
                    disabled={isLoading}
                    className="px-4 py-2 text-xs font-medium bg-pixell-yellow text-pixell-black hover:bg-pixell-yellow/90 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Play className="h-3 w-3" />
                        Approve & Execute
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
            {/* Plan Mode: Schedule Proposal */}
            {Object.values(pendingScheduleProposals).map(proposal => (
              <ScheduleProposalCard
                key={proposal.proposalId}
                proposal={proposal}
                onRespond={handleScheduleResponse}
                isSubmitting={isLoading}
              />
            ))}
          </div>
        )}
      </div>

      {/* Removed AI status indicator per UX request */}

      {/* Input Area - Following Design Guide */}
      <div className="gradient-divider" />
      <div className="bg-pixell-black p-4">
        <div className="max-w-3xl mx-auto">
          <ChatInput
            onSendMessage={handleSendMessage}
            disabled={isLoading}
          />
        </div>
      </div>
    </div>
  )
}
