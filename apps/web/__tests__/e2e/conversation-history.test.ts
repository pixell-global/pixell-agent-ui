/**
 * Conversation History Integration Test
 *
 * End-to-end test for conversation history flow:
 * 1. Frontend sends message with history array
 * 2. Orchestrator passes history in params.metadata.history
 * 3. pixell-sdk agent receives history via ctx.metadata
 * 4. Agent extracts history and hydrates session context
 * 5. Agent uses history for context-aware responses
 *
 * This tests the fix for: "agent can't talk based on conversation history"
 * Root cause was: orchestrator sends history but agent never extracted it
 * Fix: vivid-commenter now extracts ctx.metadata.history and hydrates session
 *
 * Environment Variables Required:
 * - ORCHESTRATOR_URL - Orchestrator URL (default: http://localhost:3001)
 * - VIVID_COMMENTER_URL - Agent URL (default: http://localhost:8000)
 *
 * Prerequisites:
 * - Orchestrator running on port 3001
 * - Agent (vivid-commenter) running on port 8000 with history fix applied
 */

import { test, expect } from '@playwright/test'

// =============================================================================
// CONFIGURATION
// =============================================================================

const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || 'http://localhost:3001'
const VIVID_COMMENTER_URL = process.env.VIVID_COMMENTER_URL || 'http://localhost:8000'

// Timeouts
const AGENT_TIMEOUT = 120000 // 2 minutes for full flow
const STEP_TIMEOUT = 60000 // 60 seconds per step (LLM calls can be slow)

// Test user - kevin_yum@pixell.global
const TEST_USER = {
  id: 'vxSnbazzsSYfABiAXNLoG8QGlYw1',
  orgId: '5d1c6e27-852f-438b-8f69-82dd5b409f5a',
}

// =============================================================================
// TYPES
// =============================================================================

interface SSEEvent {
  type: string
  [key: string]: unknown
}

interface FileAttachment {
  file_name: string
  content: string
  file_type: string
  file_size: number
}

interface HistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

// =============================================================================
// HELPERS
// =============================================================================

async function collectSSEEvents(
  response: Response,
  options: {
    timeout?: number
    stopOnType?: string | string[]
    maxEvents?: number
  } = {}
): Promise<SSEEvent[]> {
  const { timeout = STEP_TIMEOUT, stopOnType, maxEvents = 100 } = options
  const stopTypes = Array.isArray(stopOnType) ? stopOnType : stopOnType ? [stopOnType] : ['complete']
  const events: SSEEvent[] = []
  const reader = response.body?.getReader()

  if (!reader) {
    throw new Error('No response body reader available')
  }

  const decoder = new TextDecoder()
  let buffer = ''
  const startTime = Date.now()

  try {
    while (true) {
      if (Date.now() - startTime > timeout) {
        console.log(`SSE collection timed out after ${timeout}ms with ${events.length} events`)
        break
      }

      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6).trim()

          if (dataStr === '[DONE]') {
            return events
          }

          try {
            const eventData = JSON.parse(dataStr)
            events.push(eventData)

            if (stopTypes.includes(eventData.type)) {
              return events
            }

            if (events.length >= maxEvents) {
              return events
            }
          } catch {
            // Not valid JSON, skip
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
 * Extract response text from SSE events
 */
function extractResponseText(events: SSEEvent[]): string {
  // Look for complete event with message
  const completeEvent = events.find(e => e.type === 'complete')
  if (completeEvent && completeEvent.message) {
    return String(completeEvent.message)
  }

  // Look for content in result.message
  if (completeEvent && completeEvent.result) {
    const result = completeEvent.result as Record<string, unknown>
    if (result.message) return String(result.message)
    if (result.answer) return String(result.answer)
  }

  // Accumulate from content events
  const contentEvents = events.filter(e => e.type === 'content' || e.type === 'message')
  const allContent = contentEvents
    .map(e => {
      if (typeof e.content === 'string') return e.content
      if (typeof e.delta === 'object' && e.delta && 'content' in e.delta) {
        return String((e.delta as Record<string, unknown>).content)
      }
      if (e.message && typeof e.message === 'object' && 'parts' in e.message) {
        const parts = (e.message as Record<string, unknown>).parts as Array<Record<string, unknown>>
        return parts
          .filter(p => p.text)
          .map(p => String(p.text))
          .join(' ')
      }
      return ''
    })
    .join('')

  return allContent
}

/**
 * Create a sample text file for testing
 */
function createTestFile(name: string, content: string): FileAttachment {
  return {
    file_name: name,
    content: content,
    file_type: 'text/plain',
    file_size: content.length,
  }
}

/**
 * Send message with history to A2A agent via orchestrator
 */
async function sendMessageWithHistory(
  message: string,
  history: HistoryMessage[],
  files: FileAttachment[] = [],
  sessionId?: string
): Promise<{ response: Response; sessionId: string }> {
  const sid = sessionId || `history-test-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`

  const response = await fetch(`${ORCHESTRATOR_URL}/api/chat/a2a/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      'x-user-id': TEST_USER.id,
      'x-org-id': TEST_USER.orgId,
    },
    body: JSON.stringify({
      message,
      agentUrl: VIVID_COMMENTER_URL,
      sessionId: sid,
      files,
      planMode: false,
      history, // KEY: Include conversation history
    }),
  })

  return { response, sessionId: sid }
}

// =============================================================================
// TEST SUITES
// =============================================================================

test.describe('Conversation History Tests', () => {
  test.describe.configure({ timeout: AGENT_TIMEOUT })

  test.describe('History Hydration', () => {
    test('agent should use history for follow-up questions about files', async () => {
      console.log('\n=== HISTORY FOLLOW-UP TEST ===')
      console.log('Testing: Agent uses history to answer follow-up questions')

      const testFile = createTestFile(
        'skincare-report.txt',
        `
Key Findings from Q4 Skincare Trend Analysis:

1. Niacinamide is trending up 45% this quarter
2. Retinol remains the most discussed ingredient on social media
3. K-beauty products are gaining significant market share
4. Sustainable packaging mentions increased by 30%

Recommendation: Focus marketing efforts on niacinamide-based products with sustainable packaging.
        `.trim()
      )

      // First message - send file and ask for summary
      console.log('Step 1: Sending first message with file...')
      const { response: response1, sessionId } = await sendMessageWithHistory(
        '@skincare-report.txt summarize this report',
        [], // No history for first message
        [testFile]
      )

      if (!response1.ok) {
        const errorText = await response1.text()
        console.error(`First request failed: ${response1.status} - ${errorText}`)
        if (response1.status === 403) {
          console.log('Quota exceeded - skipping test')
          test.skip()
          return
        }
        throw new Error(`First request failed: ${response1.status}`)
      }

      const events1 = await collectSSEEvents(response1, {
        timeout: STEP_TIMEOUT,
        stopOnType: ['complete', 'error'],
      })

      const firstResponse = extractResponseText(events1)
      console.log(`First response (${firstResponse.length} chars): ${firstResponse.substring(0, 150)}...`)

      expect(firstResponse.length).toBeGreaterThan(0)

      // Second message - follow-up WITH history
      console.log('\nStep 2: Sending follow-up with history...')
      const { response: response2 } = await sendMessageWithHistory(
        'what was the main recommendation?', // Follow-up question
        [
          { role: 'user', content: '@skincare-report.txt summarize this report' },
          { role: 'assistant', content: firstResponse },
        ],
        [], // No new files
        sessionId // Same session
      )

      if (!response2.ok) {
        const errorText = await response2.text()
        console.error(`Second request failed: ${response2.status} - ${errorText}`)
        if (response2.status === 403) {
          console.log('Quota exceeded - skipping test')
          test.skip()
          return
        }
        throw new Error(`Second request failed: ${response2.status}`)
      }

      const events2 = await collectSSEEvents(response2, {
        timeout: STEP_TIMEOUT,
        stopOnType: ['complete', 'error'],
      })

      const secondResponse = extractResponseText(events2)
      console.log(`Second response (${secondResponse.length} chars): ${secondResponse.substring(0, 150)}...`)

      // Verify agent references previous context
      const responseText = secondResponse.toLowerCase()
      const referencesContext =
        responseText.includes('niacinamide') ||
        responseText.includes('sustainable') ||
        responseText.includes('packaging') ||
        responseText.includes('marketing') ||
        responseText.includes('recommendation')

      if (referencesContext) {
        console.log('✓ Agent correctly references previous context from history')
      } else {
        console.log('❌ Agent does NOT reference previous context')
        console.log('Response:', secondResponse)
      }

      expect(referencesContext).toBe(true)
    })

    test('agent should remember context from history', async () => {
      console.log('\n=== CONTEXT MEMORY TEST ===')
      console.log('Testing: Agent remembers context from conversation history')

      // Send message with history about a project topic
      const { response, sessionId } = await sendMessageWithHistory(
        'what product category were we discussing?',
        [
          { role: 'user', content: 'I want to research organic skincare products for my brand launch.' },
          { role: 'assistant', content: "Great choice! Organic skincare is a growing market. What specific products are you considering - serums, moisturizers, or cleansers?" },
          { role: 'user', content: 'Mainly vitamin C serums and hyaluronic acid products.' },
          { role: 'assistant', content: 'Excellent selection! Vitamin C serums and hyaluronic acid products are trending strongly. Would you like me to research what Reddit users are saying about these?' },
        ]
      )

      console.log(`Session ID: ${sessionId}`)

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`Request failed: ${response.status} - ${errorText}`)
        if (response.status === 403) {
          console.log('Quota exceeded - skipping test')
          test.skip()
          return
        }
        throw new Error(`Request failed: ${response.status}`)
      }

      const events = await collectSSEEvents(response, {
        timeout: STEP_TIMEOUT,
        stopOnType: ['complete', 'error'],
      })

      const responseText = extractResponseText(events)
      console.log(`Response: ${responseText.substring(0, 200)}...`)

      // Agent should mention skincare, vitamin C, hyaluronic, or organic
      const lower = responseText.toLowerCase()
      const mentionsContext =
        lower.includes('skincare') ||
        lower.includes('vitamin c') ||
        lower.includes('hyaluronic') ||
        lower.includes('organic') ||
        lower.includes('serum')

      if (mentionsContext) {
        console.log('✓ Agent correctly remembers context from history')
      } else {
        console.log('❌ Agent does NOT remember context from history')
      }

      expect(mentionsContext).toBe(true)
    })

    test('agent should maintain context across multi-turn conversation', async () => {
      console.log('\n=== MULTI-TURN CONTEXT TEST ===')
      console.log('Testing: Agent maintains context across multiple turns')

      // Simulate a 3-turn conversation
      const history: HistoryMessage[] = [
        { role: 'user', content: "I'm researching skincare ingredients for my brand." },
        { role: 'assistant', content: "That's great! What specific ingredients are you interested in learning about?" },
        { role: 'user', content: "Mainly niacinamide and hyaluronic acid." },
        { role: 'assistant', content: 'Both are excellent choices. Niacinamide helps with oil control and pore minimization, while hyaluronic acid is known for hydration. Would you like detailed research on either?' },
      ]

      const { response, sessionId } = await sendMessageWithHistory(
        'which one do you think would be better for oily skin types?',
        history
      )

      console.log(`Session ID: ${sessionId}`)

      if (!response.ok) {
        const errorText = await response.text()
        if (response.status === 403) {
          console.log('Quota exceeded - skipping test')
          test.skip()
          return
        }
        throw new Error(`Request failed: ${response.status} - ${errorText}`)
      }

      const events = await collectSSEEvents(response, {
        timeout: STEP_TIMEOUT,
        stopOnType: ['complete', 'error'],
      })

      const responseText = extractResponseText(events)
      console.log(`Response: ${responseText.substring(0, 200)}...`)

      // Agent should reference the ingredients discussed
      const lower = responseText.toLowerCase()
      const mentionsIngredients =
        lower.includes('niacinamide') ||
        lower.includes('hyaluronic') ||
        lower.includes('oily') ||
        lower.includes('oil control')

      if (mentionsIngredients) {
        console.log('✓ Agent maintains multi-turn context')
      } else {
        console.log('❌ Agent lost context from previous turns')
      }

      expect(mentionsIngredients).toBe(true)
    })
  })

  test.describe('Edge Cases', () => {
    test('agent should handle empty history gracefully', async () => {
      console.log('\n=== EMPTY HISTORY TEST ===')

      const { response } = await sendMessageWithHistory(
        'Hello, what can you help me with?',
        [] // Empty history
      )

      if (!response.ok) {
        if (response.status === 403) {
          console.log('Quota exceeded - skipping test')
          test.skip()
          return
        }
      }

      const events = await collectSSEEvents(response, {
        timeout: STEP_TIMEOUT,
        stopOnType: ['complete', 'error'],
      })

      expect(events.length).toBeGreaterThan(0)
      console.log('✓ Agent handles empty history gracefully')
    })

    test('agent should handle history with file references', async () => {
      console.log('\n=== HISTORY WITH FILE REFERENCES TEST ===')

      // History mentions a file that was previously discussed
      const { response } = await sendMessageWithHistory(
        'can you summarize it again but shorter?',
        [
          { role: 'user', content: '@report.txt analyze this market report' },
          { role: 'assistant', content: 'The market report shows three key trends: 1) Growing demand for sustainable products (up 40%), 2) Shift to online channels (60% of sales), 3) Premium segment growth (25% increase). The report recommends focusing on eco-friendly product lines.' },
        ]
      )

      if (!response.ok) {
        if (response.status === 403) {
          console.log('Quota exceeded - skipping test')
          test.skip()
          return
        }
      }

      const events = await collectSSEEvents(response, {
        timeout: STEP_TIMEOUT,
        stopOnType: ['complete', 'error'],
      })

      const responseText = extractResponseText(events)
      console.log(`Response: ${responseText.substring(0, 150)}...`)

      // Should reference something from the previous analysis
      const lower = responseText.toLowerCase()
      const referencesHistory =
        lower.includes('sustainable') ||
        lower.includes('online') ||
        lower.includes('premium') ||
        lower.includes('trend') ||
        lower.includes('eco')

      expect(referencesHistory).toBe(true)
      console.log('✓ Agent uses history with file references')
    })
  })
})
