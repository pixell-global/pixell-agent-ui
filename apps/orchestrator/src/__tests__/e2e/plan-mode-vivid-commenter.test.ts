/**
 * E2E Integration Test: Pixell UI → Orchestrator → vivid-commenter
 *
 * Tests the complete plan mode flow with timeout debugging
 */

import { describe, it, expect, beforeAll } from 'vitest'
import fetch from 'node-fetch'

const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || 'http://localhost:3001'
const VIVID_COMMENTER_URL = process.env.VIVID_COMMENTER_URL || 'http://localhost:8000'

// Helper to parse SSE stream (node-fetch compatible)
async function* parseSSE(response: any) {
  const stream = response.body
  if (!stream) throw new Error('No response body')

  let buffer = ''

  for await (const chunk of stream) {
    buffer += chunk.toString()
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6)
        if (data === '[DONE]') return
        try {
          yield JSON.parse(data)
        } catch (e) {
          console.error('Failed to parse SSE data:', data)
        }
      }
    }
  }
}

describe('Plan Mode E2E: Pixell UI → vivid-commenter', () => {
  let sessionId: string
  let workflowId: string

  beforeAll(async () => {
    // Check that both services are running
    try {
      await fetch(`${ORCHESTRATOR_URL}/health`)
    } catch (e) {
      throw new Error(`Orchestrator not running at ${ORCHESTRATOR_URL}`)
    }

    try {
      await fetch(`${VIVID_COMMENTER_URL}/health`)
    } catch (e) {
      throw new Error(`vivid-commenter not running at ${VIVID_COMMENTER_URL}`)
    }
  })

  it('should complete plan mode flow without timeout', async () => {
    const testId = Date.now()
    console.log(`\n🧪 Test ${testId}: Starting plan mode flow test\n`)

    // Step 1: Send initial message with planMode=true
    console.log('📤 Step 1: Sending initial message with planMode=true')

    const messageResponse = await fetch(`${ORCHESTRATOR_URL}/api/chat/a2a/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `research on acne trends (test ${testId})`,
        agentUrl: VIVID_COMMENTER_URL,
        planMode: true,
        history: []
      })
    })

    expect(messageResponse.ok).toBe(true)
    expect(messageResponse.headers.get('content-type')).toContain('text/event-stream')

    // Collect events until clarification is needed
    const events: any[] = []
    let clarificationId: string | null = null
    let timeoutReached = false

    const timeout = setTimeout(() => {
      timeoutReached = true
      console.error('❌ TIMEOUT: No clarification received within 30 seconds')
    }, 30000) // 30 second timeout

    console.log('📥 Collecting events until clarification...')

    for await (const event of parseSSE(messageResponse)) {
      events.push(event)
      console.log(`   Event: ${event.type || 'unknown'}`, event.message?.parts?.[0]?.text?.substring(0, 60))

      if (event.type === 'session_created') {
        sessionId = event.sessionId
        workflowId = event.workflowId
        console.log(`   ✅ Session created: ${sessionId}`)
      }

      // Check for direct clarification_needed event (vivid-commenter format)
      if (event.type === 'clarification_needed') {
        clarificationId = event.clarification?.clarificationId || event.clarificationId || event.data?.clarificationId
        if (clarificationId) {
          console.log(`   ✅ Clarification received: ${clarificationId}`)
          console.log(`   Questions: ${event.clarification?.questions?.length || event.questions?.length || 0}`)
          break
        }
      }

      // Check for task_status_update format (PAF core agent format)
      if (event.type === 'task_status_update') {
        const state = event.status?.state
        const message = event.status?.message

        if (state === 'input_required' && message?.metadata?.type === 'clarification_needed') {
          const data = message.parts?.find((p: any) => p.data)?.data
          if (data?.clarificationId) {
            clarificationId = data.clarificationId
            console.log(`   ✅ Clarification received (task_status): ${clarificationId}`)
            console.log(`   Questions: ${data.questions?.length || 0}`)
            break
          }
        }
      }

      if (timeoutReached) {
        break
      }
    }

    clearTimeout(timeout)

    if (timeoutReached) {
      console.error('\n❌ TEST FAILED: Timeout waiting for clarification')
      console.log('\nEvents received:', JSON.stringify(events, null, 2))
      throw new Error('Timeout waiting for clarification')
    }

    expect(clarificationId).toBeTruthy()
    console.log(`\n✅ Step 1 complete: Received clarification ${clarificationId}\n`)

    // Step 2: Respond to clarification
    console.log('📤 Step 2: Responding to clarification')

    const clarificationResponse = await fetch(`${ORCHESTRATOR_URL}/api/chat/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clarificationId,
        answers: [
          { questionId: 'time_range', value: 'month' },
          { questionId: 'content_type', value: 'reviews' },
          { questionId: 'use_case', value: 'market_research' }
        ],
        agentUrl: VIVID_COMMENTER_URL,
        sessionId
      })
    })

    expect(clarificationResponse.ok).toBe(true)
    console.log('   ✅ Clarification response sent')

    // Step 3: Wait for discovery to complete (or timeout)
    const discoveryEvents: any[] = []
    let discoveryComplete = false
    let discoveryTimeoutReached = false

    const discoveryTimeout = setTimeout(() => {
      discoveryTimeoutReached = true
      console.error('❌ TIMEOUT: Discovery did not complete within 45 seconds')
    }, 45000) // 45 second timeout for discovery

    console.log('📥 Waiting for discovery to complete...')
    const startTime = Date.now()

    for await (const event of parseSSE(clarificationResponse)) {
      discoveryEvents.push(event)
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      console.log(`   [${elapsed}s] Event: ${event.type || 'unknown'}`,
        event.status?.message || event.message?.parts?.[0]?.text?.substring(0, 60) || '')

      // Check for direct selection_required event (vivid-commenter format)
      if (event.type === 'selection_required') {
        discoveryComplete = true
        console.log(`   ✅ Discovery complete! (${elapsed}s)`)
        break
      }

      if (event.type === 'task_status_update') {
        const state = event.status?.state
        const message = event.status?.message

        // Check for selection request (means discovery completed)
        if (state === 'input_required' && message?.metadata?.type === 'selection_needed') {
          discoveryComplete = true
          console.log(`   ✅ Discovery complete! (${elapsed}s)`)
          break
        }

        // Check for preview (alternative completion)
        if (state === 'input_required' && message?.metadata?.type === 'preview_ready') {
          discoveryComplete = true
          console.log(`   ✅ Preview received! (${elapsed}s)`)
          break
        }

        // Check for errors
        if (state === 'error') {
          console.error(`   ❌ Agent error: ${message?.parts?.[0]?.text}`)
          break
        }
      }

      if (discoveryTimeoutReached) {
        break
      }
    }

    clearTimeout(discoveryTimeout)

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)

    if (discoveryTimeoutReached) {
      console.error(`\n❌ TEST FAILED: Discovery timeout after ${totalTime}s`)
      console.log('\nDiscovery events received:', JSON.stringify(discoveryEvents, null, 2))
      throw new Error(`Discovery timeout after ${totalTime}s`)
    }

    if (!discoveryComplete) {
      console.error(`\n❌ TEST FAILED: Discovery did not complete (${totalTime}s)`)
      console.log('\nDiscovery events received:', JSON.stringify(discoveryEvents, null, 2))
      throw new Error(`Discovery did not complete after ${totalTime}s`)
    }

    console.log(`\n✅ Step 2 complete: Discovery finished in ${totalTime}s\n`)
    console.log(`\n🎉 TEST PASSED: Plan mode flow completed successfully in ${totalTime}s`)

    expect(discoveryComplete).toBe(true)
    expect(parseFloat(totalTime)).toBeLessThan(45) // Should complete in under 45 seconds (quick_mode enabled)

  }, 120000) // 2 minute test timeout

  it('should receive file_created event before stream closes', async () => {
    const testId = Date.now()
    console.log(`\n🧪 Test ${testId}: Testing file_created event in SSE stream\n`)

    // Step 1: Send initial message with planMode=true
    console.log('📤 Step 1: Sending initial message')

    const messageResponse = await fetch(`${ORCHESTRATOR_URL}/api/chat/a2a/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `research on skincare for dry skin (test ${testId})`,
        agentUrl: VIVID_COMMENTER_URL,
        planMode: true,
        history: []
      })
    })

    expect(messageResponse.ok).toBe(true)

    // Collect clarification
    let clarificationId: string | null = null
    for await (const event of parseSSE(messageResponse)) {
      if (event.type === 'session_created') {
        sessionId = event.sessionId
      }
      if (event.type === 'clarification_needed') {
        clarificationId = event.clarification?.clarificationId || event.clarificationId
        if (clarificationId) break
      }
    }

    expect(clarificationId).toBeTruthy()
    console.log(`✅ Clarification received: ${clarificationId}`)

    // Step 2: Respond to clarification
    console.log('📤 Step 2: Responding to clarification')
    const clarificationResponse = await fetch(`${ORCHESTRATOR_URL}/api/chat/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clarificationId,
        answers: [
          { questionId: 'time_range', value: 'month' },
          { questionId: 'content_type', value: 'reviews' },
          { questionId: 'use_case', value: 'market_research' }
        ],
        agentUrl: VIVID_COMMENTER_URL,
        sessionId
      })
    })

    expect(clarificationResponse.ok).toBe(true)

    // Collect subreddits from discovery
    let subreddits: any[] = []
    let selectionId: string | null = null
    for await (const event of parseSSE(clarificationResponse)) {
      console.log(`   Discovery event: ${event.type}`, JSON.stringify(event).substring(0, 100))

      if (event.type === 'selection_required') {
        // Extract items from the event (vivid-commenter uses 'items' not 'options')
        subreddits = event.items || event.options || event.selection?.options || []
        selectionId = event.selectionId || event.selection?.selectionId
        console.log(`   Found ${subreddits.length} subreddits, selectionId: ${selectionId}`)
        if (subreddits.length > 0) break
      }

      if (event.type === 'discovery_result') {
        // Try to extract from discovery_result as well
        const discovered = event.subreddits || event.data?.subreddits || []
        if (discovered.length > 0) {
          console.log(`   Found ${discovered.length} subreddits in discovery_result`)
        }
      }
    }

    expect(subreddits.length).toBeGreaterThan(0)
    console.log(`✅ Discovery complete: ${subreddits.length} subreddits`)

    // Step 3: Select subreddits and trigger execution
    console.log('📤 Step 3: Selecting subreddits and triggering execution')
    console.log(`   Using selectionId: ${selectionId}`)
    console.log(`   Selected subreddit: ${subreddits[0].name}`)

    const selectionResponse = await fetch(`${ORCHESTRATOR_URL}/api/chat/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        selectionId,  // Use selectionId, not clarificationId
        selectedIds: [subreddits[0].id],  // Send selected IDs
        agentUrl: VIVID_COMMENTER_URL,
        sessionId
      })
    })

    expect(selectionResponse.ok).toBe(true)

    // Step 4: Wait for preview and approve it
    console.log('📥 Step 4: Waiting for preview...')
    let planId: string | null = null
    for await (const event of parseSSE(selectionResponse)) {
      console.log(`   Preview event: ${event.type}`)

      if (event.type === 'preview_ready') {
        console.log(`   Full preview event:`, JSON.stringify(event, null, 2))
        planId = event.planId || event.preview?.planId || event.plan?.planId || event.id
        console.log(`   ✅ Preview ready, planId: ${planId}`)

        // For vivid-commenter, preview_ready might not need approval - just proceed to execution
        // Skip the approval step and continue listening for file_created
        if (!planId) {
          console.log(`   ⚠️  No planId found, assuming auto-execution`)
          break
        }
        break
      }
    }

    // Determine which stream to listen on for file_created event
    let eventStream: any
    if (planId) {
      // Step 5: Approve preview to trigger execution
      console.log('📤 Step 5: Approving preview to trigger execution')
      const approvalResponse = await fetch(`${ORCHESTRATOR_URL}/api/chat/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          approved: true,
          agentUrl: VIVID_COMMENTER_URL,
          sessionId
        })
      })

      expect(approvalResponse.ok).toBe(true)
      console.log('   ✅ Preview approved, execution starting...')
      eventStream = approvalResponse
    } else {
      // vivid-commenter auto-executes after preview, continue listening on selection response
      console.log('   ⚠️  No planId - vivid-commenter is auto-executing, continuing on same stream')
      eventStream = selectionResponse
    }

    // Step 6: Wait for file_created event
    console.log('📥 Step 6: Waiting for file_created event...')
    let fileCreatedEvent: any = null
    let streamEndedBeforeFile = false
    let completedBeforeFile = false
    const startTime = Date.now()

    const executionTimeout = setTimeout(() => {
      console.error('❌ TIMEOUT: Execution did not complete within 60 seconds')
    }, 60000)

    for await (const event of parseSSE(eventStream)) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      console.log(`   [${elapsed}s] Event: ${event.type}`,
        event.step || event.status?.message || event.message?.parts?.[0]?.text?.substring(0, 60) || '')

      // Track if we see completed before file_created
      if (event.type === 'task_completed' || event.status?.state === 'completed') {
        if (!fileCreatedEvent) {
          completedBeforeFile = true
          console.warn(`   ⚠️  Task completed but no file_created event yet`)
        }
      }

      // Check for file_created event
      if (event.type === 'file_created' || event.step === 'file_created') {
        fileCreatedEvent = event
        console.log(`   ✅ file_created event received! (${elapsed}s)`)
        console.log(`      Path: ${event.path}`)
        console.log(`      Name: ${event.name}`)
        console.log(`      Format: ${event.format}`)
        console.log(`      Size: ${event.size} bytes`)
        console.log(`      Summary: ${event.summary}`)
        break
      }
    }

    clearTimeout(executionTimeout)
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)

    // Verify results
    if (!fileCreatedEvent) {
      console.error(`\n❌ TEST FAILED: No file_created event received (${totalTime}s)`)
      if (completedBeforeFile) {
        console.error('   Stream was closed before file_created could be sent!')
      }
      throw new Error(`No file_created event in SSE stream after ${totalTime}s`)
    }

    // Verify event has all required fields
    expect(fileCreatedEvent.path).toBeTruthy()
    expect(fileCreatedEvent.name).toBeTruthy()
    expect(fileCreatedEvent.format).toBe('html')
    expect(fileCreatedEvent.size).toBeGreaterThan(0)
    expect(fileCreatedEvent.summary).toBeTruthy()

    console.log(`\n✅ Step 6 complete: file_created event verified in ${totalTime}s`)
    console.log(`\n🎉 TEST PASSED: file_created event received in SSE stream`)

    expect(fileCreatedEvent).toBeTruthy()
  }, 180000) // 3 minute test timeout (includes discovery + execution)
})
