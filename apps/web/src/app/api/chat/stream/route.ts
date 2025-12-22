import { NextRequest, NextResponse } from 'next/server'
import { Agent } from 'undici'
import { verifySessionCookie } from '@pixell/auth-firebase/server'

export const dynamic = 'force-dynamic'

// Custom agent for long-running SSE streams with no body timeout
const sseAgent = new Agent({
  bodyTimeout: 0,  // Disable body timeout for SSE
  headersTimeout: 30000,  // 30 second timeout for headers
  keepAliveMaxTimeout: 600000,  // 10 minute max keep-alive
})


interface ChatRequest {
  message: string
  history?: Array<{
    role: 'user' | 'assistant'
    content: string
  }>
  fileContext?: Array<{
    path: string
    name: string
    content?: string
  }>
  settings: {
    showThinking: boolean
    enableMarkdown: boolean
    streamingEnabled: boolean
  }
  // Agent selection
  selectedAgent?: {
    id: string
    name: string
    url: string
    protocol: 'paf' | 'a2a'
  } | null
  planMode?: boolean
  // Conversation tracking (for memory extraction)
  conversationId?: string | null
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json()

    if (!body.message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // Get user ID from Firebase session cookie
    const sessionCookieName = process.env.SESSION_COOKIE_NAME || 'session'
    const sessionCookie = request.cookies.get(sessionCookieName)?.value
    let userId = ''
    if (sessionCookie) {
      try {
        const decoded = await verifySessionCookie(sessionCookie)
        userId = decoded.sub as string
      } catch { /* Ignore auth errors for unauthenticated users */ }
    }

    // Get org ID from ORG cookie
    const orgId = request.cookies.get('ORG')?.value || ''

    // BILLING DEBUG: Log authentication and org context
    console.log('💰 [BILLING DEBUG] Frontend stream route:', {
      userId: userId || '❌ NOT AUTHENTICATED',
      orgId: orgId || '❌ NO ORG COOKIE',
      hasSessionCookie: !!sessionCookie,
      selectedAgentId: body.selectedAgent?.id || '❌ NO AGENT SELECTED',
      selectedAgentUrl: body.selectedAgent?.url,
      allCookies: Array.from(request.cookies.getAll()).map(c => c.name),
    })

    // Connect to orchestrator instead of PAF Core Agent directly
    const orchestratorUrl = process.env.ORCHESTRATOR_URL || 'http://localhost:3001'

    // Always use A2A stream endpoint when an agent with URL is selected
    // This bypasses PAF Core Agent and connects directly to the agent
    const hasAgentUrl = body.selectedAgent?.url
    const endpoint = hasAgentUrl
      ? `${orchestratorUrl}/api/chat/a2a/stream`
      : `${orchestratorUrl}/api/chat/stream`

    // Build request body - always pass agent URL for direct connection
    const requestBody = hasAgentUrl
      ? {
          message: body.message,
          agentUrl: body.selectedAgent?.url,
          planMode: body.planMode,
          history: body.history,
          // Include conversationId for memory extraction
          conversationId: body.conversationId,
          selectedAgentId: body.selectedAgent?.id,
        }
      : body

    // Forward request to orchestrator with custom agent for long SSE streams
    const orchestratorResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'x-user-id': userId,
        'x-org-id': orgId,
      },
      body: JSON.stringify(requestBody),
      // @ts-ignore - dispatcher is a valid option for undici-based fetch
      dispatcher: sseAgent,
    })

    if (!orchestratorResponse.ok) {
      const errorText = await orchestratorResponse.text()
      console.error('Orchestrator error:', orchestratorResponse.status, errorText)

      // Try to parse the error as JSON to preserve quota error details
      try {
        const errorJson = JSON.parse(errorText)
        // If it's a quota error (403), pass through the detailed info
        if (orchestratorResponse.status === 403 && errorJson.message) {
          return NextResponse.json(errorJson, { status: 403 })
        }
        return NextResponse.json(
          { error: errorJson.error || errorJson.message || `Orchestrator service error: ${orchestratorResponse.status}` },
          { status: orchestratorResponse.status }
        )
      } catch {
        // If not JSON, return generic error
        return NextResponse.json(
          { error: `Orchestrator service error: ${orchestratorResponse.status}` },
          { status: orchestratorResponse.status }
        )
      }
    }

    // Return streaming response
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const reader = orchestratorResponse.body?.getReader()
          if (!reader) {
            controller.enqueue(encoder.encode('data: {"type":"error","error":"No response stream"}\n\n'))
            controller.close()
            return
          }

          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            // Forward the chunk directly from orchestrator
            controller.enqueue(value)
          }

          controller.close()
        } catch (error) {
          console.error('Streaming error:', error)
          controller.enqueue(encoder.encode(`data: {"type":"error","error":"${error}"}\n\n`))
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    })

  } catch (error) {
    // Check if this is a connection error (orchestrator unavailable)
    const isConnectionError = error instanceof Error &&
      (error.message.includes('fetch') ||
       error.message.includes('ECONNREFUSED') ||
       (error.cause && typeof error.cause === 'object' && 'code' in error.cause))

    if (isConnectionError) {
      // Fail silently with a graceful SSE response instead of 500 error
      console.log('⚠️ Orchestrator not available - sending graceful response')

      const encoder = new TextEncoder()
      const gracefulMessage = {
        type: 'content',
        delta: { content: "I'm currently unable to connect to the backend service. Please ensure the orchestrator is running, or try again in a moment." },
        accumulated: "I'm currently unable to connect to the backend service. Please ensure the orchestrator is running, or try again in a moment."
      }

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(gracefulMessage)}\n\n`))
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'complete' })}\n\n`))
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`))
          controller.close()
        }
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      })
    }

    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  })
} 