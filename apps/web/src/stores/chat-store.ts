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
        selectedFiles: [],
        pendingAttachments: [],
        agentHealth: null,
        settings: {
          showThinking: 'always',
          streamingEnabled: true,
          markdownEnabled: true,
          codeHighlightEnabled: true,
          autoScrollEnabled: true
          // Removed maxTokensPerStream - using natural completion without limits
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