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
 * Get Core Agent URL from environment
 * Direct connection to Core Agent, bypassing Orchestrator
 */
function getCoreAgentUrl(): string {
  // Get PAR Runtime URL (base URL for agent apps)
  const parRuntimeUrl = process.env.PAR_RUNTIME_URL || process.env.PAF_CORE_AGENT_URL
  
  // Get Agent App ID
  const agentAppId = process.env.PAF_CORE_AGENT_APP_ID

  if (!parRuntimeUrl) {
    console.warn('⚠️ No PAR_RUNTIME_URL or PAF_CORE_AGENT_URL configured, using default')
    return 'http://localhost:8000'
  }

  // Remove trailing slash
  const baseUrl = parRuntimeUrl.replace(/\/$/, '')

  // Build URL: {baseUrl}/agents/{agentAppId}/api/chat/stream
  if (agentAppId) {
    return `${baseUrl}/agents/${agentAppId}/api/chat/stream`
  }

  // Fallback: direct URL without agent app ID path
  console.warn('⚠️ No PAF_CORE_AGENT_APP_ID configured, using direct URL')
  return `${baseUrl}/api/chat/stream`
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json()

    if (!body.message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    const coreAgentUrl = getCoreAgentUrl()
    console.log(`📡 Sending chat request directly to Core Agent: ${coreAgentUrl}`)

    // Transform request body to match Core Agent API format
    const coreAgentPayload = {
      message: body.message,
      history: body.history || [],
      files: body.fileContext?.map(file => ({
        file_name: file.name,
        content: file.content || '',
        file_type: 'text/plain',
        file_size: file.content?.length || 0,
        file_path: file.path
      })) || [],
      show_thinking: body.settings?.showThinking !== false,
      model: 'gpt-4o',
      temperature: 0.7
    }

    // Send request directly to Core Agent
    const coreAgentResponse = await fetch(coreAgentUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(coreAgentPayload)
    })

    if (!coreAgentResponse.ok) {
      console.error(`Core Agent returned error: ${coreAgentResponse.status}`)
      const errorText = await coreAgentResponse.text()
      return NextResponse.json(
        { error: `Core Agent error: ${errorText || coreAgentResponse.statusText}` },
        { status: coreAgentResponse.status }
      )
    }

    // Stream the response from Core Agent to client
    // Core Agent sends SSE in format: id: ...\nevent: ...\ndata: ...\n\n
    // We need to transform it to: data: {...}\n\n format for client
    const stream = new ReadableStream({
      async start(controller) {
        const reader = coreAgentResponse.body?.getReader()
        const decoder = new TextDecoder()
        const encoder = new TextEncoder()

        if (!reader) {
          controller.close()
          return
        }

        try {
          let buffer = ''
          let currentEvent: { id: string; event: string; data: string } = { id: '', event: '', data: '' }

          const processCurrentEvent = () => {
            if (currentEvent.event && currentEvent.data) {
              let sseData = null

              // Transform Core Agent SSE format to client format
              if (currentEvent.event === 'EventType.CONTENT') {
                try {
                  const contentData = JSON.parse(currentEvent.data)
                  sseData = {
                    type: 'content',
                    delta: { content: contentData.content || '' },
                    accumulated: contentData.content || ''
                  }
                } catch {
                  // Fallback if data isn't JSON
                  sseData = {
                    type: 'content',
                    delta: { content: currentEvent.data },
                    accumulated: currentEvent.data
                  }
                }
              } else if (currentEvent.event === 'EventType.THINKING') {
                try {
                  const thinkingData = JSON.parse(currentEvent.data)
                  sseData = {
                    type: 'thinking',
                    context: {
                      thoughts: [{
                        id: currentEvent.id || `thinking_${Date.now()}`,
                        content: thinkingData.content || thinkingData.message || 'Processing...',
                        isCompleted: thinkingData.completed || false,
                        timestamp: thinkingData.timestamp || new Date().toISOString(),
                        importance: thinkingData.importance || 'medium'
                      }]
                    }
                  }
                } catch {
                  sseData = {
                    type: 'thinking',
                    context: {
                      thoughts: [{
                        id: currentEvent.id || `thinking_${Date.now()}`,
                        content: currentEvent.data,
                        isCompleted: false,
                        timestamp: new Date().toISOString(),
                        importance: 'medium'
                      }]
                    }
                  }
                }
              } else if (currentEvent.event === 'EventType.COMPLETE' || currentEvent.event === 'EventType.DONE') {
                sseData = { type: 'complete' }
              } else if (currentEvent.event === 'EventType.ERROR') {
                sseData = {
                  type: 'error',
                  error: currentEvent.data || 'Unknown error occurred'
                }
              }

              // Send transformed data
              if (sseData) {
                const output = `data: ${JSON.stringify(sseData)}\n\n`
                controller.enqueue(encoder.encode(output))
              }

              // Reset for next event
              currentEvent = { id: '', event: '', data: '' }
            }
          }

          while (true) {
            const { done, value } = await reader.read()
            if (done) {
              // Process any remaining event
              processCurrentEvent()
              // Send final completion
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'complete' })}\n\n`))
              controller.enqueue(encoder.encode('data: [DONE]\n\n'))
              break
            }

            const chunk = decoder.decode(value, { stream: true })
            buffer += chunk

            // Process complete lines
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              if (line.trim() === '') {
                // Empty line indicates end of SSE event
                processCurrentEvent()
                continue
              }

              // Parse SSE field lines
              if (line.startsWith('id: ')) {
                if (currentEvent.event && currentEvent.data) {
                  processCurrentEvent()
                }
                currentEvent.id = line.slice(4).trim()
              } else if (line.startsWith('event: ')) {
                currentEvent.event = line.slice(7).trim()
              } else if (line.startsWith('data: ')) {
                currentEvent.data = line.slice(6).trim()
                if (currentEvent.id && currentEvent.event && currentEvent.data) {
                  processCurrentEvent()
                }
              } else if (line.startsWith('data:')) {
                currentEvent.data = line.slice(5).trim()
                if (currentEvent.id && currentEvent.event && currentEvent.data) {
                  processCurrentEvent()
                }
              }
            }
          }
        } catch (error) {
          console.error('Streaming error:', error)
          const errorData = encoder.encode(`data: ${JSON.stringify({ type: 'error', error: 'Stream processing error' })}\n\n`)
          controller.enqueue(errorData)
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