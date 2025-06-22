import { create } from 'zustand'
import { devtools, subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { ChatMessage, FileReference, StreamingResponse, ChatUISettings, ThinkingStep, AgentHealth, FileAttachment, FileMention } from '@/types'

interface ChatState {
  // Messages and streaming
  messages: ChatMessage[]
  streamingMessageId: string | null
  isLoading: boolean
  
  // File context
  selectedFiles: FileReference[]
  
  // File attachments
  pendingAttachments: FileAttachment[]
  
  // AI Agent status
  agentHealth: AgentHealth | null
  
  // UI settings
  settings: ChatUISettings
  
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
  
  // Settings
  updateSettings: (settings: Partial<ChatUISettings>) => void
  
  // Utility actions
  clearMessages: () => void
}

export const useChatStore = create<ChatState>()(
  devtools(
    subscribeWithSelector(
      immer((set, get) => ({
        // Initial state
        messages: [],
        streamingMessageId: null,
        isLoading: false,
        selectedFiles: [],
        pendingAttachments: [],
        agentHealth: null,
        settings: {
          showThinking: 'auto',
          streamingEnabled: true,
          markdownEnabled: true,
          codeHighlightEnabled: true,
          autoScrollEnabled: true,
          maxTokensPerStream: 4096
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
              
            if (!streamingMessage) return
            
            switch (chunk.type) {
              case 'thinking':
                if (chunk.context?.thoughts) {
                  streamingMessage.thinkingSteps = [
                    ...(streamingMessage.thinkingSteps || []),
                    ...chunk.context.thoughts
                  ]
                  streamingMessage.isThinking = true
                }
                break
                
              case 'content':
                if (chunk.delta?.content) {
                  streamingMessage.content += chunk.delta.content
                  streamingMessage.updatedAt = new Date().toISOString()
                }
                break
                
              case 'complete':
                streamingMessage.streaming = false
                streamingMessage.isThinking = false
                state.streamingMessageId = null
                state.isLoading = false
                break
                
              case 'error':
                streamingMessage.streaming = false
                streamingMessage.isThinking = false
                streamingMessage.messageType = 'alert'
                if (chunk.error) {
                  streamingMessage.content = `Error: ${chunk.error}`
                }
                state.streamingMessageId = null
                state.isLoading = false
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
          })
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