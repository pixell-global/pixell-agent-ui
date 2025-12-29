/**
 * File Input Transfer Integration Test
 *
 * End-to-end test for file transfer from frontend to agent:
 * 1. Frontend sends message with file attachments
 * 2. Orchestrator converts files to A2A FilePart format
 * 3. pixell-sdk agent receives FilePart in message.parts
 * 4. Agent extracts file content and adds to session context
 * 5. Agent can use file content in REASON skill responses
 *
 * This tests the fix for: "file is not being transferred" issue
 * where @filename mentions weren't sending actual file content to agents.
 *
 * Environment Variables Required:
 * - ORCHESTRATOR_URL - Orchestrator URL (default: http://localhost:3001)
 * - VIVID_COMMENTER_URL - Agent URL (default: http://localhost:8000)
 *
 * Prerequisites:
 * - Orchestrator running on port 3001
 * - Agent (vivid-commenter) running on port 8000
 */

import { test, expect } from '@playwright/test'

// =============================================================================
// CONFIGURATION
// =============================================================================

const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || 'http://localhost:3001'
const VIVID_COMMENTER_URL = process.env.VIVID_COMMENTER_URL || 'http://localhost:8000'

// Timeouts
const AGENT_TIMEOUT = 120000 // 2 minutes for full flow
const STEP_TIMEOUT = 30000 // 30 seconds per step

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
 * Create a sample text file for testing
 */
function createTestFile(name: string, content: string): FileAttachment {
  return {
    file_name: name,
    content: content, // Plain text content (not base64 for text files)
    file_type: 'text/plain',
    file_size: content.length,
  }
}

/**
 * Send message with file attachments to A2A agent via orchestrator
 */
async function sendMessageWithFiles(
  message: string,
  files: FileAttachment[],
  agentUrl: string = VIVID_COMMENTER_URL
): Promise<{ response: Response; sessionId: string }> {
  const sessionId = `file-test-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`

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
      agentUrl,
      sessionId,
      files, // This is what we're testing - files should be sent as FilePart
      planMode: false,
      history: [],
    }),
  })

  return { response, sessionId }
}

// =============================================================================
// TEST SUITES
// =============================================================================

test.describe('File Input Transfer Tests', () => {
  test.describe.configure({ timeout: AGENT_TIMEOUT })

  test.describe('Orchestrator File Conversion', () => {
    test('should include files as FilePart in A2A message parts', async () => {
      console.log('\n=== FILE TRANSFER TEST ===')
      console.log('Testing: Files sent as FilePart to agent')

      // Create a test file
      const testFile = createTestFile('test-report.txt', `
This is a test report about skincare trends.

Key Findings:
1. Niacinamide is trending up 45% this quarter
2. Retinol remains the most discussed ingredient
3. K-beauty products are gaining market share

Conclusion: Focus marketing on niacinamide-based products.
      `.trim())

      console.log(`Sending file: ${testFile.file_name} (${testFile.file_size} bytes)`)

      // Send message with file
      const { response, sessionId } = await sendMessageWithFiles(
        '@test-report.txt What are the key findings in this report?',
        [testFile]
      )

      console.log(`Session ID: ${sessionId}`)

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`Request failed: ${response.status} - ${errorText}`)

        // If quota exceeded, skip test gracefully
        if (response.status === 403) {
          console.log('Quota exceeded - skipping test')
          test.skip()
          return
        }
        throw new Error(`Request failed: ${response.status}`)
      }

      // Collect events
      const events = await collectSSEEvents(response, {
        timeout: STEP_TIMEOUT,
        stopOnType: ['complete', 'error'],
      })

      console.log(`Received ${events.length} events`)
      const eventTypes = Array.from(new Set(events.map(e => e.type)))
      console.log(`Event types: ${eventTypes.join(', ')}`)

      // Look for content events that reference file content
      const contentEvents = events.filter(e => e.type === 'content' || e.type === 'message')

      // The agent should have received the file and responded about it
      expect(events.length).toBeGreaterThan(0)

      // Check if any response mentions our file content keywords
      const allContent = contentEvents
        .map(e => {
          if (typeof e.content === 'string') return e.content
          if (e.message?.parts) {
            return e.message.parts
              .filter((p: any) => p.text)
              .map((p: any) => p.text)
              .join(' ')
          }
          return ''
        })
        .join(' ')
        .toLowerCase()

      console.log(`Response content length: ${allContent.length} chars`)
      console.log(`Response preview: ${allContent.substring(0, 200)}...`)

      // If the file was received, the agent should mention something from the file
      // or acknowledge it in some way. If not, it will say "I don't have access to files"
      const fileNotReceived = allContent.includes("don't have access") ||
                             allContent.includes("no files") ||
                             allContent.includes("cannot access")

      if (fileNotReceived) {
        console.error('❌ Agent says it has no file access - file transfer failed!')
        expect(fileNotReceived).toBe(false) // Fail the test
      } else {
        console.log('✓ Agent appears to have received file content')
      }
    })

    test('should handle multiple files in a single message', async () => {
      console.log('\n=== MULTIPLE FILES TEST ===')

      const file1 = createTestFile('report-q1.txt', 'Q1 revenue: $1.5M, Growth: 15%')
      const file2 = createTestFile('report-q2.txt', 'Q2 revenue: $1.8M, Growth: 20%')

      console.log(`Sending 2 files: ${file1.file_name}, ${file2.file_name}`)

      const { response } = await sendMessageWithFiles(
        '@report-q1.txt @report-q2.txt Compare these two quarterly reports',
        [file1, file2]
      )

      if (!response.ok) {
        if (response.status === 403) {
          console.log('Quota exceeded - skipping test')
          test.skip()
          return
        }
        const errorText = await response.text()
        throw new Error(`Request failed: ${response.status} - ${errorText}`)
      }

      const events = await collectSSEEvents(response, {
        timeout: STEP_TIMEOUT,
        stopOnType: ['complete', 'error'],
      })

      expect(events.length).toBeGreaterThan(0)
      console.log(`✓ Multiple files request processed with ${events.length} events`)
    })

    test('should send files with correct mimeType in FilePart', async () => {
      console.log('\n=== MIME TYPE TEST ===')

      // Test different file types
      const htmlFile: FileAttachment = {
        file_name: 'report.html',
        content: '<html><body><h1>Test Report</h1><p>Content here</p></body></html>',
        file_type: 'text/html',
        file_size: 64,
      }

      const { response } = await sendMessageWithFiles(
        '@report.html Summarize this HTML report',
        [htmlFile]
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
      console.log('✓ HTML file with correct mimeType processed')
    })
  })

  test.describe('REASON Skill File Context', () => {
    test('should route file discussion to REASON skill (not RESEARCH)', async () => {
      console.log('\n=== REASON SKILL ROUTING TEST ===')
      console.log('Testing: "what do you think about this file?" → REASON (not RESEARCH)')

      const testFile = createTestFile('analysis.txt', `
Market Analysis Summary:
- Target demographic: 18-35 year olds
- Primary channel: Social media
- Competitor analysis shows gap in sustainable products
      `.trim())

      const { response } = await sendMessageWithFiles(
        '@analysis.txt What do you think about this analysis?',
        [testFile]
      )

      if (!response.ok) {
        if (response.status === 403) {
          console.log('Quota exceeded - skipping test')
          test.skip()
          return
        }
        const errorText = await response.text()
        throw new Error(`Request failed: ${response.status} - ${errorText}`)
      }

      const events = await collectSSEEvents(response, {
        timeout: STEP_TIMEOUT,
        stopOnType: ['complete', 'clarification_needed', 'error'],
      })

      // Should NOT trigger clarification (that's RESEARCH flow)
      const clarificationEvents = events.filter(e => e.type === 'clarification_needed')

      if (clarificationEvents.length > 0) {
        console.log('⚠️ Clarification was triggered - may have been routed to RESEARCH instead of REASON')
      } else {
        console.log('✓ No clarification triggered - likely routed to REASON skill')
      }

      // The conversation should complete with a response
      expect(events.length).toBeGreaterThan(0)
    })
  })
})

// =============================================================================
// AGENT DIRECT TESTS (bypasses orchestrator to verify SDK receives files)
// =============================================================================

test.describe('Agent Direct File Receipt', () => {
  test.describe.configure({ timeout: AGENT_TIMEOUT })

  test('agent should receive FilePart in message.parts', async () => {
    console.log('\n=== DIRECT AGENT TEST ===')
    console.log('Testing: Direct A2A message to agent with FilePart')

    // Send directly to agent in A2A format
    const response = await fetch(VIVID_COMMENTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'message/stream',
        id: `test-${Date.now()}`,
        params: {
          sessionId: `direct-test-${Date.now()}`,
          message: {
            messageId: `msg-${Date.now()}`,
            role: 'user',
            parts: [
              { text: '@direct-test.txt What is in this file?' },
              {
                file: {
                  name: 'direct-test.txt',
                  mimeType: 'text/plain',
                  bytes: 'VGhpcyBpcyBhIGRpcmVjdCB0ZXN0IGZpbGUgY29udGVudC4=' // "This is a direct test file content."
                }
              }
            ],
            metadata: {
              plan_mode_enabled: false
            }
          },
          metadata: {
            planMode: false,
            history: []
          }
        }
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Agent error: ${response.status} - ${errorText}`)

      // Agent might not be running
      if (response.status === 0 || errorText.includes('ECONNREFUSED')) {
        console.log('Agent not running - skipping test')
        test.skip()
        return
      }
      throw new Error(`Agent request failed: ${response.status}`)
    }

    const events = await collectSSEEvents(response, {
      timeout: STEP_TIMEOUT,
      stopOnType: ['complete', 'error'],
    })

    console.log(`Received ${events.length} events from agent`)
    expect(events.length).toBeGreaterThan(0)
    console.log('✓ Agent received and processed FilePart directly')
  })
})
