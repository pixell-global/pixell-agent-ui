/**
 * SSE Helpers for E2E Tests
 *
 * Provides utilities for collecting and parsing Server-Sent Events (SSE)
 * from the orchestrator's streaming endpoints.
 */

export interface SSEEvent {
  id?: string
  event?: string
  data: any
  retry?: number
}

/**
 * Parse a single SSE message into an event object
 */
export function parseSSEMessage(message: string): SSEEvent | null {
  const lines = message.split('\n')
  const event: Partial<SSEEvent> = {}

  for (const line of lines) {
    if (line.startsWith('id:')) {
      event.id = line.slice(3).trim()
    } else if (line.startsWith('event:')) {
      event.event = line.slice(6).trim()
    } else if (line.startsWith('data:')) {
      const dataStr = line.slice(5).trim()
      try {
        event.data = JSON.parse(dataStr)
      } catch {
        event.data = dataStr
      }
    } else if (line.startsWith('retry:')) {
      event.retry = parseInt(line.slice(6).trim(), 10)
    }
  }

  if (event.data !== undefined) {
    return event as SSEEvent
  }

  return null
}

/**
 * Collect SSE events from a streaming response
 */
export async function collectSSEEvents(
  response: Response,
  options: {
    maxEvents?: number
    timeoutMs?: number
    stopOnStates?: string[]
  } = {}
): Promise<SSEEvent[]> {
  const {
    maxEvents = 100,
    timeoutMs = 120000,
    stopOnStates = ['completed', 'failed'],
  } = options

  const events: SSEEvent[] = []
  const reader = response.body?.getReader()

  if (!reader) {
    throw new Error('Response body is not readable')
  }

  const decoder = new TextDecoder()
  let buffer = ''
  const startTime = Date.now()

  try {
    while (true) {
      // Check timeout
      if (Date.now() - startTime > timeoutMs) {
        console.warn(`SSE collection timed out after ${timeoutMs}ms`)
        break
      }

      // Check max events
      if (events.length >= maxEvents) {
        console.warn(`SSE collection stopped after ${maxEvents} events`)
        break
      }

      const { done, value } = await reader.read()

      if (done) {
        break
      }

      buffer += decoder.decode(value, { stream: true })

      // Split buffer by double newlines (SSE message separator)
      const messages = buffer.split('\n\n')
      buffer = messages.pop() || '' // Keep incomplete message in buffer

      for (const message of messages) {
        if (!message.trim()) continue

        const event = parseSSEMessage(message)
        if (event) {
          events.push(event)

          // Check for terminal state
          const state = event.data?.state
          if (state && stopOnStates.includes(state)) {
            return events
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  return events
}

/**
 * Filter events by type or step
 */
export function filterEvents(
  events: SSEEvent[],
  filter: { type?: string; step?: string; state?: string }
): SSEEvent[] {
  return events.filter((e) => {
    if (filter.type && e.data?.type !== filter.type) return false
    if (filter.step && e.data?.step !== filter.step) return false
    if (filter.state && e.data?.state !== filter.state) return false
    return true
  })
}

/**
 * Find first event matching criteria
 */
export function findEvent(
  events: SSEEvent[],
  filter: { type?: string; step?: string; state?: string }
): SSEEvent | undefined {
  return filterEvents(events, filter)[0]
}

/**
 * Check if events contain a file_created event
 */
export function hasFileCreatedEvent(events: SSEEvent[]): boolean {
  return events.some(
    (e) =>
      e.data?.step === 'file_created' ||
      e.data?.type === 'file_created' ||
      e.data?.event_type === 'file_created'
  )
}

/**
 * Get file_created event details
 */
export function getFileCreatedEvent(events: SSEEvent[]): {
  path?: string
  name?: string
  format?: string
  summary?: string
} | null {
  const event = events.find(
    (e) =>
      e.data?.step === 'file_created' ||
      e.data?.type === 'file_created' ||
      e.data?.event_type === 'file_created'
  )

  if (!event?.data) return null

  return {
    path: event.data.path || event.data.filepath || event.data.file_path,
    name: event.data.name || event.data.filename || event.data.file_name,
    format: event.data.format || event.data.fileType,
    summary: event.data.summary,
  }
}

/**
 * Extract session ID from events
 */
export function extractSessionId(events: SSEEvent[]): string | undefined {
  for (const event of events) {
    if (event.data?.sessionId) {
      return event.data.sessionId
    }
  }
  return undefined
}

/**
 * Extract workflow ID from events
 */
export function extractWorkflowId(events: SSEEvent[]): string | undefined {
  for (const event of events) {
    if (event.data?.workflowId) {
      return event.data.workflowId
    }
  }
  return undefined
}

/**
 * Get all unique states from events
 */
export function getStateHistory(events: SSEEvent[]): string[] {
  const states: string[] = []
  for (const event of events) {
    const state = event.data?.state
    if (state && !states.includes(state)) {
      states.push(state)
    }
  }
  return states
}

/**
 * Check if the stream completed successfully
 * Handles both:
 * - state === 'completed' (from pixell-sdk)
 * - type === 'complete' (from orchestrator transformation)
 */
export function isStreamCompleted(events: SSEEvent[]): boolean {
  return events.some(
    (e) =>
      e.data?.state === 'completed' ||
      e.data?.type === 'complete' ||
      e.data === '[DONE]'
  )
}

/**
 * Check if the stream failed
 */
export function isStreamFailed(events: SSEEvent[]): boolean {
  return events.some((e) => e.data?.state === 'failed')
}

/**
 * Get error details if stream failed
 */
export function getStreamError(events: SSEEvent[]): {
  type?: string
  message?: string
} | null {
  const failedEvent = events.find((e) => e.data?.state === 'failed')
  if (!failedEvent?.data) return null

  return {
    type: failedEvent.data.error_type || failedEvent.data.errorType,
    message: failedEvent.data.message || failedEvent.data.error,
  }
}

/**
 * Pretty print events for debugging
 */
export function printEvents(events: SSEEvent[]): void {
  console.log('\n=== SSE Events ===')
  events.forEach((e, i) => {
    console.log(`[${i}] ${e.event || 'message'}:`, JSON.stringify(e.data, null, 2))
  })
  console.log('=== End SSE Events ===\n')
}
