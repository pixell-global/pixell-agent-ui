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

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json()
    
    if (!body.message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // Connect to orchestrator instead of PAF Core Agent directly
    const orchestratorUrl = process.env.ORCHESTRATOR_URL || 'http://localhost:3001'
    
    // Forward request to orchestrator
    const orchestratorResponse = await fetch(`${orchestratorUrl}/api/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      },
      body: JSON.stringify(body)
    })

    if (!orchestratorResponse.ok) {
      const errorText = await orchestratorResponse.text()
      console.error('Orchestrator error:', orchestratorResponse.status, errorText)
      
      return NextResponse.json(
        { error: `Orchestrator service error: ${orchestratorResponse.status}` }, 
        { status: orchestratorResponse.status }
      )
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