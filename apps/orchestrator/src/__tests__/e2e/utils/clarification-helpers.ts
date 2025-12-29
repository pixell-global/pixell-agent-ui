/**
 * Clarification Helpers for E2E Tests
 *
 * Provides utilities for handling plan mode clarification flows:
 * - Finding clarification/input-required events
 * - Sending clarification responses
 * - Handling multi-step clarification flows
 */

import type { SSEEvent } from './sse-helpers'
import { collectSSEEvents } from './sse-helpers'

export interface ClarificationQuestion {
  id: string
  question: string
  type: 'single_select' | 'multi_select' | 'text' | 'chips'
  options?: Array<{
    id: string
    label: string
    description?: string
  }>
  required?: boolean
}

export interface ClarificationEvent {
  type: 'clarification' | 'input-required'
  state: 'input-required'
  sessionId: string
  clarificationId?: string
  questions: ClarificationQuestion[]
  message?: string
  context?: string
}

/**
 * Find clarification/input-required event in SSE events
 */
export function findClarificationEvent(events: SSEEvent[]): ClarificationEvent | null {
  for (const event of events) {
    // Check for clarification_needed event format (from orchestrator)
    // Orchestrator wraps clarification data in a 'clarification' object
    if (
      event.data?.type === 'clarification_needed' &&
      event.data?.clarification?.questions &&
      Array.isArray(event.data.clarification.questions)
    ) {
      const clarification = event.data.clarification
      // Map questionId to id for compatibility
      const mappedQuestions = clarification.questions.map((q: any) => ({
        ...q,
        id: q.id || q.questionId,  // Use questionId as fallback
      }))
      return {
        type: 'clarification',
        state: 'input-required',
        sessionId: clarification.sessionId || clarification.session_id,
        clarificationId: clarification.clarificationId,
        questions: mappedQuestions,
        message: clarification.message,
        context: clarification.context,
      }
    }

    // Also check for direct input-required state with questions (legacy/direct format)
    if (
      event.data?.state === 'input-required' &&
      event.data?.questions &&
      Array.isArray(event.data.questions)
    ) {
      // Map questionId to id for compatibility
      const mappedQuestions = event.data.questions.map((q: any) => ({
        ...q,
        id: q.id || q.questionId,
      }))
      return {
        type: 'clarification',
        state: 'input-required',
        sessionId: event.data.sessionId || event.data.session_id,
        clarificationId: event.data.clarificationId,
        questions: mappedQuestions,
        message: event.data.message,
        context: event.data.context,
      }
    }
  }
  return null
}

/**
 * Check if events contain a clarification request
 */
export function hasClarificationEvent(events: SSEEvent[]): boolean {
  return findClarificationEvent(events) !== null
}

/**
 * Build clarification response payload
 */
export function buildClarificationResponse(
  sessionId: string,
  clarificationId: string,
  answers: Record<string, string | string[]>
): {
  sessionId: string
  clarificationId: string
  type: 'clarification_response'
  answers: Record<string, string | string[]>
} {
  return {
    sessionId,
    clarificationId,
    type: 'clarification_response',
    answers,
  }
}

/**
 * Send clarification response via orchestrator API
 * Returns the SSE events from the response stream
 */
export async function sendClarificationResponse(
  orchestratorUrl: string,
  userId: string,
  orgId: string,
  sessionId: string,
  clarificationId: string,
  answers: Record<string, string | string[]>,
  agentUrl: string,
  options: {
    timeoutMs?: number
    stopOnStates?: string[]
  } = {}
): Promise<SSEEvent[]> {
  const {
    timeoutMs = 120000,
    stopOnStates = ['completed', 'failed', 'input-required'],
  } = options

  const response = await fetch(`${orchestratorUrl}/api/chat/respond`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': userId,
      'x-org-id': orgId,
    },
    body: JSON.stringify({
      sessionId,
      clarificationId,
      type: 'clarification_response',
      answers,
      agentUrl,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to send clarification response: ${response.status} - ${error}`)
  }

  // Collect SSE events from response
  const events = await collectSSEEvents(response, {
    timeoutMs,
    stopOnStates,
  })

  return events
}

/**
 * Auto-answer clarification questions with default/first options
 * Useful for testing when specific answers don't matter
 */
export function autoAnswerQuestions(
  questions: ClarificationQuestion[]
): Record<string, string | string[]> {
  const answers: Record<string, string | string[]> = {}

  for (const question of questions) {
    if (question.options && question.options.length > 0) {
      if (question.type === 'multi_select') {
        // Select first option for multi-select
        answers[question.id] = [question.options[0].id]
      } else {
        // Select first option for single-select
        answers[question.id] = question.options[0].id
      }
    } else if (question.type === 'text') {
      // Default text answer
      answers[question.id] = 'test answer'
    }
  }

  return answers
}

/**
 * Extract all clarification events from SSE stream (for multi-step flows)
 */
export function extractAllClarificationEvents(events: SSEEvent[]): ClarificationEvent[] {
  const clarifications: ClarificationEvent[] = []

  for (const event of events) {
    // Check for clarification_needed event format (from orchestrator)
    if (
      event.data?.type === 'clarification_needed' &&
      event.data?.clarification?.questions &&
      Array.isArray(event.data.clarification.questions)
    ) {
      const clarification = event.data.clarification
      // Map questionId to id for compatibility
      const mappedQuestions = clarification.questions.map((q: any) => ({
        ...q,
        id: q.id || q.questionId,
      }))
      clarifications.push({
        type: 'clarification',
        state: 'input-required',
        sessionId: clarification.sessionId || clarification.session_id,
        clarificationId: clarification.clarificationId,
        questions: mappedQuestions,
        message: clarification.message,
        context: clarification.context,
      })
    }
    // Also check for direct input-required state with questions (legacy/direct format)
    else if (
      event.data?.state === 'input-required' &&
      event.data?.questions &&
      Array.isArray(event.data.questions)
    ) {
      // Map questionId to id for compatibility
      const mappedQuestions = event.data.questions.map((q: any) => ({
        ...q,
        id: q.id || q.questionId,
      }))
      clarifications.push({
        type: 'clarification',
        state: 'input-required',
        sessionId: event.data.sessionId || event.data.session_id,
        clarificationId: event.data.clarificationId,
        questions: mappedQuestions,
        message: event.data.message,
        context: event.data.context,
      })
    }
  }

  return clarifications
}
