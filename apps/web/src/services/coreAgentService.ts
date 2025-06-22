import { StreamingResponse, ChatMessage, ChatUISettings, AgentHealth, FileReference } from '@/types'

export interface SendMessageRequest {
  message: string
  fileReferences?: FileReference[]
  settings: ChatUISettings
}

export class CoreAgentService {
  private baseUrl: string

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_ORCHESTRATOR_URL || 'http://localhost:3001'
  }

  /**
   * Send message to Core Agent and handle streaming response
   */
  async sendMessage(
    request: SendMessageRequest,
    onStream: (chunk: StreamingResponse) => void,
    onComplete: (finalResponse: ChatMessage) => void,
    onError: (error: string) => void
  ): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/chat/stream`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify({
          message: request.message,
          fileContext: request.fileReferences?.map(f => ({
            path: f.path,
            name: f.name,
            content: f.content
          })),
          settings: {
            showThinking: request.settings.showThinking !== 'never',
            enableMarkdown: request.settings.markdownEnabled,
            streamingEnabled: request.settings.streamingEnabled
          }
        })
      })

      if (!response.ok) {
        throw new Error(`Core Agent API error: ${response.status} ${response.statusText}`)
      }

      // Handle Server-Sent Events streaming
      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No streaming response available')
      }

      const decoder = new TextDecoder()
      let buffer = ''

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.trim() === '' || !line.startsWith('data: ')) continue
            
            try {
              const jsonData = line.slice(6)
              if (jsonData === '[DONE]') {
                onComplete({
                  id: `msg_${Date.now()}`,
                  role: 'assistant',
                  content: '',
                  messageType: 'text',
                  createdAt: new Date().toISOString()
                })
                return
              }

              const chunk: StreamingResponse = JSON.parse(jsonData)
              onStream(chunk)
            } catch (parseError) {
              console.warn('Failed to parse streaming chunk:', parseError)
            }
          }
        }
      } finally {
        reader.releaseLock()
      }

    } catch (error) {
      console.error('Core Agent Service Error:', error)
      onError(error instanceof Error ? error.message : 'AI service error')
    }
  }

  /**
   * Get Core Agent health status
   */
  async getHealthStatus(): Promise<AgentHealth> {
    try {
      const response = await fetch(`${this.baseUrl}/api/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`)
      }

      const data = await response.json()
      
      return {
        healthy: data.status === 'healthy',
        runtime: data.runtime?.provider || 'unknown',
        model: data.runtime?.modelId,
        status: data.status === 'healthy' ? 'connected' : 'error',
        lastCheck: new Date().toISOString()
      }
    } catch (error) {
      console.error('Health check failed:', error)
      return {
        healthy: false,
        runtime: 'unknown',
        status: 'disconnected',
        lastCheck: new Date().toISOString()
      }
    }
  }

  /**
   * Test connection to Core Agent
   */
  async testConnection(): Promise<boolean> {
    try {
      const health = await this.getHealthStatus()
      return health.healthy
    } catch {
      return false
    }
  }
}

// Singleton instance
export const coreAgentService = new CoreAgentService() 