/**
 * Billing Integration Tests
 *
 * Tests the full billing flow by sending requests to the test agent
 * and verifying billing detection works correctly.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { startTestAgent, stopTestAgent } from '../../test-agent'
import {
  createSessionEvents,
  processSSEEvent,
  getPrimaryBillingClaim,
  detectBillingClaims,
  SessionEvents,
} from '../../services/billing-detector'

const TEST_AGENT_PORT = 9998 // Different port to avoid conflicts
const TEST_AGENT_URL = `http://localhost:${TEST_AGENT_PORT}`

/**
 * Helper to fetch SSE stream from test agent and collect events
 */
async function fetchAgentSSEEvents(scenario: string): Promise<any[]> {
  const response = await fetch(`${TEST_AGENT_URL}?scenario=${scenario}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: 'Test request',
      params: { sessionId: 'test-session-123' },
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Agent request failed: ${response.status} - ${error}`)
  }

  const events: any[] = []
  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    // Parse SSE events
    const lines = buffer.split('\n')
    buffer = lines.pop() || '' // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6)
        if (data && data !== '[DONE]') {
          try {
            events.push(JSON.parse(data))
          } catch {
            // Skip non-JSON data
          }
        }
      }
    }
  }

  return events
}

/**
 * Helper to process events through billing detector
 */
function processEventsForBilling(events: any[]): SessionEvents {
  const session = createSessionEvents()
  for (const event of events) {
    processSSEEvent(session, event)
  }
  return session
}

describe('Billing Integration Tests', () => {
  beforeAll(async () => {
    await startTestAgent(TEST_AGENT_PORT)
  }, 10000)

  afterAll(async () => {
    await stopTestAgent()
  })

  describe('Test Agent Health', () => {
    it('should respond to health check', async () => {
      const response = await fetch(`${TEST_AGENT_URL}/health`)
      const data = await response.json()
      expect(data.status).toBe('ok')
      expect(data.agent).toBe('test-agent')
    })

    it('should list available scenarios', async () => {
      const response = await fetch(`${TEST_AGENT_URL}/scenarios`)
      const data = await response.json()
      expect(data.available).toContain('research-report')
      expect(data.available).toContain('fraud-inflated-tier')
    })
  })

  describe('Research Billing Scenarios', () => {
    it('should detect research billing from report file output', async () => {
      const events = await fetchAgentSSEEvents('research-report')
      const session = processEventsForBilling(events)

      // Should have file output
      expect(session.fileOutputs.length).toBeGreaterThan(0)
      expect(session.taskCompleted).toBe(true)

      // Should detect research billing
      const claim = getPrimaryBillingClaim(session)
      expect(claim).not.toBeNull()
      expect(claim?.type).toBe('research')
    })

    it('should detect research from SDK billing event', async () => {
      const events = await fetchAgentSSEEvents('research-sdk-billing')
      const session = processEventsForBilling(events)

      // Should have SDK billing event
      expect(session.sdkBillingEvents.length).toBeGreaterThan(0)

      // Should use SDK billing as authoritative
      const claim = getPrimaryBillingClaim(session)
      expect(claim?.source).toBe('sdk')
      expect(claim?.type).toBe('research')
    })

  })

  describe('Ideation Billing Scenarios', () => {
    it('should detect ideation from content calendar output', async () => {
      const events = await fetchAgentSSEEvents('ideation-content-calendar')
      const session = processEventsForBilling(events)

      // Should have file output with content type
      expect(session.fileOutputs.length).toBeGreaterThan(0)

      // Should detect ideation billing
      const claim = getPrimaryBillingClaim(session)
      expect(claim?.type).toBe('ideation')
    })

    it('should detect ideation from SDK billing only', async () => {
      const events = await fetchAgentSSEEvents('ideation-sdk-only')
      const session = processEventsForBilling(events)

      const claim = getPrimaryBillingClaim(session)
      expect(claim?.source).toBe('sdk')
      expect(claim?.type).toBe('ideation')
    })
  })

  describe('Auto-Posting Billing Scenarios', () => {
    it('should detect auto_posting from scheduled post event', async () => {
      const events = await fetchAgentSSEEvents('auto-post-scheduled')
      const session = processEventsForBilling(events)

      // Should have scheduled post event
      expect(session.scheduledPosts.length).toBeGreaterThan(0)

      // Should detect auto_posting billing
      const claim = getPrimaryBillingClaim(session)
      expect(claim?.type).toBe('auto_posting')
      expect(claim?.confidence).toBe(1.0) // Definitive detection
    })

    it('should track multiple platforms', async () => {
      const events = await fetchAgentSSEEvents('auto-post-multi-platform')
      const session = processEventsForBilling(events)

      const claim = getPrimaryBillingClaim(session)
      expect(claim?.type).toBe('auto_posting')
      expect(claim?.metadata?.platforms).toEqual(
        expect.arrayContaining(['reddit', 'twitter'])
      )
    })
  })

  describe('Monitor Billing Scenarios', () => {
    it('should detect monitors from monitor_created event', async () => {
      const events = await fetchAgentSSEEvents('monitor-create')
      const session = processEventsForBilling(events)

      // Should have monitor event
      expect(session.monitorEvents.length).toBeGreaterThan(0)

      // Should detect monitors billing
      const claim = getPrimaryBillingClaim(session)
      expect(claim?.type).toBe('monitors')
    })

    it('should not bill for monitor deletion', async () => {
      const events = await fetchAgentSSEEvents('monitor-delete')
      const session = processEventsForBilling(events)

      // Monitor deletions should not generate billing claims
      const claims = detectBillingClaims(session)
      const monitorClaims = claims.filter(c => c.type === 'monitors')
      expect(monitorClaims).toHaveLength(0)
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty output without billing', async () => {
      const events = await fetchAgentSSEEvents('no-output')
      const session = processEventsForBilling(events)

      const claim = getPrimaryBillingClaim(session)
      expect(claim).toBeNull()
    })

    it('should handle task failure with partial output', async () => {
      const events = await fetchAgentSSEEvents('task-fail-partial')
      const session = processEventsForBilling(events)

      // Should still bill if file output was generated
      if (session.fileOutputs.length > 0 && session.fileOutputs[0].size > 0) {
        const claim = getPrimaryBillingClaim(session)
        expect(claim).not.toBeNull()
      }
    })

    it('should handle task failure with no output', async () => {
      const events = await fetchAgentSSEEvents('task-fail-no-output')
      const session = processEventsForBilling(events)

      const claim = getPrimaryBillingClaim(session)
      expect(claim).toBeNull()
    })
  })

  describe('Fraud Detection Scenarios', () => {
    it('should still record inflated tier claims (for audit)', async () => {
      const events = await fetchAgentSSEEvents('fraud-inflated-tier')
      const session = processEventsForBilling(events)

      // The claim should still be recorded (for later audit)
      const claim = getPrimaryBillingClaim(session)
      expect(claim).not.toBeNull()

      // The inflated tier should be captured in metadata for audit
      // Note: This is recorded now, flagged by LLM auditor later
    })

    it('should record wrong type claims (for audit)', async () => {
      const events = await fetchAgentSSEEvents('fraud-wrong-type')
      const session = processEventsForBilling(events)

      // The SDK claim with wrong type should still be recorded
      const claim = getPrimaryBillingClaim(session)
      expect(claim).not.toBeNull()
      // Type verification happens in async LLM audit
    })

    it('should handle double billing attempts', async () => {
      const events = await fetchAgentSSEEvents('fraud-double-billing')
      const session = processEventsForBilling(events)

      // Should only use first completed SDK event
      const sdkCompleteEvents = session.sdkBillingEvents.filter(e => e.action === 'complete')
      expect(sdkCompleteEvents.length).toBeGreaterThan(1) // Agent sent multiple

      // But only one claim should be generated
      const claims = detectBillingClaims(session)
      const sdkClaims = claims.filter(c => c.source === 'sdk')
      expect(sdkClaims).toHaveLength(1)
    })
  })

  describe('Multiple Action Types', () => {
    it('should handle research + monitor in same session', async () => {
      const events = await fetchAgentSSEEvents('research-with-monitor')
      const session = processEventsForBilling(events)

      const claims = detectBillingClaims(session)

      // Should have both research and monitor claims
      const types = claims.map(c => c.type)
      expect(types).toContain('research')
      expect(types).toContain('monitors')
    })

    it('should handle ideation + auto_posting in same session', async () => {
      const events = await fetchAgentSSEEvents('ideation-with-posting')
      const session = processEventsForBilling(events)

      const claims = detectBillingClaims(session)

      const types = claims.map(c => c.type)
      expect(types).toContain('ideation')
      expect(types).toContain('auto_posting')
    })
  })
})
