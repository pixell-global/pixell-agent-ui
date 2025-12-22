import { EventEmitter } from 'events'

export interface SSEEvent {
  type: string
  [key: string]: any
}

export interface AgentSession {
  sessionId: string
  agentUrl: string
  eventEmitter: EventEmitter
  createdAt: Date
  lastActivity: Date
  isActive: boolean
}

/**
 * SessionManager maintains session state across plan mode phases.
 *
 * The pixell-sdk agent expects the same sessionId to be used throughout
 * the conversation. This manager ensures:
 * 1. Sessions are registered when initial SSE connection is opened
 * 2. Respond calls forward through the same session
 * 3. Events from respond calls are broadcast to subscribers
 */
export class SessionManager {
  private sessions = new Map<string, AgentSession>()
  private static instance: SessionManager
  private cleanupInterval: NodeJS.Timeout | null = null

  private constructor(skipCleanupInterval = false) {
    // Start cleanup interval (every 5 minutes) - can be skipped for testing
    if (!skipCleanupInterval) {
      this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000)
    }
  }

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager()
    }
    return SessionManager.instance
  }

  /**
   * Create an isolated instance for testing (no cleanup interval, no singleton)
   */
  static createForTesting(): SessionManager {
    return new SessionManager(true)
  }

  /**
   * Register a new session when initial SSE connection is opened
   */
  registerSession(sessionId: string, agentUrl: string): AgentSession {
    const existingSession = this.sessions.get(sessionId)
    if (existingSession) {
      console.log(`📋 Session already exists: ${sessionId}`)
      existingSession.lastActivity = new Date()
      return existingSession
    }

    const session: AgentSession = {
      sessionId,
      agentUrl,
      eventEmitter: new EventEmitter(),
      createdAt: new Date(),
      lastActivity: new Date(),
      isActive: true,
    }

    this.sessions.set(sessionId, session)
    console.log(`📋 Session registered: ${sessionId} -> ${agentUrl}`)

    return session
  }

  /**
   * Get an existing session by ID
   */
  getSession(sessionId: string): AgentSession | undefined {
    const session = this.sessions.get(sessionId)
    if (session) {
      session.lastActivity = new Date()
    }
    return session
  }

  /**
   * Forward a response to the agent and stream events back through the session's emitter
   */
  async forwardResponse(sessionId: string, payload: any): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    const targetUrl = `${session.agentUrl}/respond`
    console.log(`📤 SessionManager forwarding to ${targetUrl}:`, JSON.stringify(payload, null, 2))

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(300000), // 5 minute timeout
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ Agent response failed: ${response.status} ${errorText}`)
      session.eventEmitter.emit('event', {
        type: 'error',
        error: errorText || 'Agent response failed',
      })
      throw new Error(`Agent response failed: ${response.status}`)
    }

    // Stream SSE events from agent and emit through session
    const reader = response.body?.getReader()
    const decoder = new TextDecoder()

    if (!reader) {
      session.eventEmitter.emit('event', {
        type: 'error',
        error: 'No response stream available',
      })
      throw new Error('No response stream available')
    }

    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          console.log(`📥 SessionManager: Agent SSE stream ended for ${sessionId}`)
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
              console.log(`📥 SessionManager: Received [DONE] for ${sessionId}`)
              session.eventEmitter.emit('done')
              continue
            }

            try {
              const event = JSON.parse(dataStr)

              // Transform the event to match frontend expectations
              const transformedEvent = this.transformEvent(event, session)

              console.log(`📥 SessionManager: Emitting event for ${sessionId}:`, transformedEvent.type)
              session.eventEmitter.emit('event', transformedEvent)

            } catch (parseError) {
              console.warn(`Failed to parse SSE data: ${dataStr.substring(0, 200)}`)
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
      session.eventEmitter.emit('done')
    }

    session.lastActivity = new Date()
  }

  /**
   * Transform agent events to match frontend expectations
   * @public for testing purposes
   */
  transformEvent(event: any, session: AgentSession): SSEEvent {
    const { sessionId, agentUrl } = session
    const eventType = event.type
    const state = event.state

    console.log(`🔄 transformEvent input: type=${eventType}, state=${state}, step=${event.step}, keys=${Object.keys(event).join(',')}`)
    if (event.step === 'file_created' || event.step === 'file_saved') {
      console.log(`🔴🔴🔴 FILE EVENT DETECTED via step: ${JSON.stringify(event).substring(0, 500)}`)
    }

    // Handle clarification_needed
    if (eventType === 'clarification_needed' && event.clarificationId) {
      return {
        type: 'clarification_needed',
        clarification: {
          clarificationId: event.clarificationId,
          questions: event.questions,
          message: event.message,
          agentId: event.agentId,
          agentUrl,
          sessionId: event.sessionId || sessionId,
        },
      }
    }

    // Handle discovery_result
    if (eventType === 'discovery_result') {
      return {
        type: 'discovery_result',
        items: event.items,
        discoveryType: event.discoveryType || event.discovery_type,
        discoveryId: event.discoveryId || event.discovery_id,
        message: event.message,
        agentUrl,
        sessionId: event.sessionId || sessionId,
      }
    }

    // Handle selection_required
    if (eventType === 'selection_required') {
      return {
        type: 'selection_required',
        items: event.items,
        selectionId: event.selectionId || event.selection_id,
        discoveryType: event.discoveryType || event.discovery_type,
        minSelect: event.minSelect || event.min_select,
        maxSelect: event.maxSelect || event.max_select,
        message: event.message,
        agentUrl,
        sessionId: event.sessionId || sessionId,
      }
    }

    // Handle preview_ready
    if (eventType === 'preview_ready') {
      return {
        type: 'preview_ready',
        ...event,
        agentUrl,
        sessionId: event.sessionId || sessionId,
      }
    }

    // Handle search_plan (alias for preview_ready in some agents like vivid-commenter)
    // Transform flat structure to nested structure expected by frontend
    if (eventType === 'search_plan') {
      console.log(`🔄 Transforming search_plan → preview_ready for ${sessionId}`)
      return {
        type: 'preview_ready',
        plan: {
          title: event.userIntent || event.message || 'Search Plan',
          keywords: event.searchKeywords || [],
          targets: event.subreddits || event.targets || [],
          planId: event.planId,
        },
        message: event.message,
        agentUrl,
        sessionId: event.sessionId || sessionId,
      }
    }

    // Handle completion
    if (state === 'completed') {
      let resultContent = ''

      // Check for content in various formats:
      // 1. event.result (original format)
      if (event.result) {
        resultContent = typeof event.result === 'string' ? event.result : JSON.stringify(event.result)
      }
      // 2. event.message.parts[].text (pixell-sdk format)
      else if (event.message?.parts) {
        const parts = event.message.parts
        for (const part of parts) {
          if (part.text) {
            resultContent += part.text
          }
        }
      }
      // 3. event.content (direct content)
      else if (event.content) {
        resultContent = typeof event.content === 'string' ? event.content : JSON.stringify(event.content)
      }

      if (resultContent) {
        return {
          type: 'content',
          content: resultContent,
        }
      }
      return { type: 'done', state: 'completed' }
    }

    // Handle file_created event (when agent saves a file)
    // Supports multiple formats:
    // 1. Direct type: event.type === 'file_created'
    // 2. Step-based: event.step === 'file_created' (pixell-sdk format)
    // 3. Old A2A format: event.message.metadata.event_type === 'file_created'
    const messageMetadata = event.message?.metadata
    const messageEventType = messageMetadata?.event_type
    const messageData = messageMetadata?.data || {}

    if (eventType === 'file_created' || eventType === 'file_saved' ||
        event.step === 'file_created' || event.step === 'file_saved' ||
        messageEventType === 'file_created' || messageEventType === 'file_saved') {

      // Extract file info from the appropriate location (supports all formats)
      const path = event.path || messageData.path
      const name = event.name || event.filename || messageData.name
      const format = event.format || messageData.format || 'html'
      const size = event.size || messageData.size
      const summary = event.summary || messageData.summary

      console.log(`✅ [file_created] Detected file event: name=${name}, path=${path}, format=${format}`)

      return {
        type: 'file_created',
        path,
        name,
        format,
        size,
        summary,
        agentUrl,
        sessionId,
      }
    }

    // Handle failure
    if (state === 'failed') {
      return {
        type: 'error',
        error: event.error || event.message || 'Task failed',
      }
    }

    // Handle working state with progress metadata
    if (state === 'working') {
      // Extract step and metadata from the event
      const { type: _type, state: _state, message, step, ...metadata } = event

      return {
        type: 'progress',
        step: step || 'working',
        message: message || 'Processing...',
        metadata: {
          ...metadata,
        },
        state: 'working',
      }
    }

    // Return event as-is if no transformation needed
    return {
      type: eventType || 'unknown',
      ...event,
      agentUrl,
      sessionId,
    }
  }

  /**
   * Subscribe to session events
   * Returns an unsubscribe function
   */
  subscribe(sessionId: string, callback: (event: SSEEvent) => void): () => void {
    const session = this.sessions.get(sessionId)
    if (!session) {
      console.warn(`Cannot subscribe to non-existent session: ${sessionId}`)
      return () => {}
    }

    const eventHandler = (event: SSEEvent) => {
      callback(event)
    }

    const doneHandler = () => {
      // Optionally handle done event
    }

    session.eventEmitter.on('event', eventHandler)
    session.eventEmitter.on('done', doneHandler)

    console.log(`📋 Subscriber added for session: ${sessionId}`)

    // Return unsubscribe function
    return () => {
      session.eventEmitter.off('event', eventHandler)
      session.eventEmitter.off('done', doneHandler)
      console.log(`📋 Subscriber removed for session: ${sessionId}`)
    }
  }

  /**
   * Mark session as inactive
   */
  deactivateSession(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (session) {
      session.isActive = false
      console.log(`📋 Session deactivated: ${sessionId}`)
    }
  }

  /**
   * Clean up expired sessions (older than 30 minutes of inactivity)
   */
  cleanup(): void {
    const now = new Date()
    const maxAge = 30 * 60 * 1000 // 30 minutes

    for (const [sessionId, session] of this.sessions.entries()) {
      const age = now.getTime() - session.lastActivity.getTime()
      if (age > maxAge) {
        session.eventEmitter.removeAllListeners()
        this.sessions.delete(sessionId)
        console.log(`🗑️ Session expired and removed: ${sessionId}`)
      }
    }
  }

  /**
   * Get active session count (for monitoring)
   */
  getActiveSessionCount(): number {
    return Array.from(this.sessions.values()).filter(s => s.isActive).length
  }

  /**
   * Get all session IDs (for debugging)
   */
  getSessionIds(): string[] {
    return Array.from(this.sessions.keys())
  }
}

export const sessionManager = SessionManager.getInstance()
