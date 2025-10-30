import { ensureRootEnvLoaded } from '@/lib/root-env'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

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
}

/**
 * Get orchestrator URL from environment
 */
function getOrchestratorUrl(): string {
  // Check for orchestrator URL in environment
  const orchestratorUrl = process.env.ORCHESTRATOR_URL || process.env.NEXT_PUBLIC_ORCHESTRATOR_URL

  if (orchestratorUrl) {
    return orchestratorUrl
  }

  // Default to localhost:3001 for development
  return 'http://localhost:3001'
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json()

    if (!body.message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    const orchestratorUrl = getOrchestratorUrl()
    console.log(`📡 Forwarding chat request to orchestrator: ${orchestratorUrl}`)

    // Forward request to orchestrator
    const orchestratorResponse = await fetch(`${orchestratorUrl}/api/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    })

    if (!orchestratorResponse.ok) {
      console.error(`Orchestrator returned error: ${orchestratorResponse.status}`)
      return NextResponse.json(
        { error: `Orchestrator error: ${orchestratorResponse.statusText}` },
        { status: orchestratorResponse.status }
      )
    }

    // Stream the response from orchestrator to client
    const stream = new ReadableStream({
      async start(controller) {
        const reader = orchestratorResponse.body?.getReader()
        const decoder = new TextDecoder()

        if (!reader) {
          controller.close()
          return
        }

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            // Forward the chunk as-is
            controller.enqueue(value)
          }
        } catch (error) {
          console.error('Streaming error:', error)
        } finally {
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
      },
    })

  } catch (error) {
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