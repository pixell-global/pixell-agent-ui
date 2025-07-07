import { Request, Response } from 'express'
import { getPafCoreAgentUrl } from '../utils/environments'

// PAF Core Agent service URL
const getCoreAgentUrl = async () => {
  return await getPafCoreAgentUrl()
}

/**
 * POST /api/chat/stream - Stream chat responses from PAF Core Agent
 */
export async function streamChatHandler(req: Request, res: Response) {
  try {
    const { message, fileContext = [], settings = {} } = req.body

    if (!message?.trim()) {
      return res.status(400).json({ error: 'Message is required' })
    }

    const coreAgentUrl = await getCoreAgentUrl()
    
    // Transform fileContext to the format expected by PAF Core Agent
    const files = fileContext.map((file: any) => ({
      path: file.path || file.name || 'unknown',
      content: file.content || ''
    }))

    // Prepare request payload for PAF Core Agent
    const payload = {
      message,
      files,
      settings: {
        showThinking: settings.showThinking || false,
        streamingEnabled: settings.streamingEnabled !== false // default to true
      }
    }

    // Make request to PAF Core Agent
    const response = await fetch(`${coreAgentUrl}/api/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = 'Failed to connect to PAF Core Agent'
      
      try {
        const errorJson = JSON.parse(errorText)
        errorMessage = errorJson.error || errorMessage
      } catch {
        // Use default error message if JSON parsing fails
      }

      return res.status(response.status).json({ error: errorMessage })
    }

    // Set up Server-Sent Events headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type'
    })

    // Stream the response from PAF Core Agent to client
    const reader = response.body?.getReader()
    const decoder = new TextDecoder()

    if (!reader) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'No response stream available' })}\n\n`)
      res.end()
      return
    }

    try {
      let buffer = ''
      let currentEvent = {
        id: '',
        event: '',
        data: ''
      }
      
      const processCurrentEvent = () => {
        if (currentEvent.event && currentEvent.data) {
          console.log('📦 Processing SSE event:', currentEvent)
          
          let sseData = null
          
          // Handle different SSE event types
          if (currentEvent.event === 'EventType.CONTENT') {
            try {
              const contentData = JSON.parse(currentEvent.data)
              sseData = {
                type: 'content',
                delta: { content: contentData.content || '' },
                accumulated: contentData.content || ''
              }
              console.log('📤 Sending content chunk:', contentData.content)
            } catch (parseError) {
              console.log('⚠️ Failed to parse content data:', currentEvent.data)
              // Fallback if data isn't JSON - treat as raw content
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
              // Fallback if data isn't JSON
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
          } else if (currentEvent.event === 'EventType.COMPLETE') {
            sseData = { type: 'complete' }
            console.log('📤 Sending completion signal')
          } else if (currentEvent.event === 'EventType.DONE') {
            sseData = { type: 'complete' }
            console.log('📤 Sending final completion signal')
          } else if (currentEvent.event === 'EventType.ERROR') {
            sseData = { 
              type: 'error', 
              error: currentEvent.data || 'Unknown error occurred'
            }
          }
          
          // Send the transformed SSE data
          if (sseData) {
            res.write(`data: ${JSON.stringify(sseData)}\n\n`)
            console.log('📤 Sent SSE data:', sseData)
          }
          
          // Reset for next event
          currentEvent = { id: '', event: '', data: '' }
        }
      }
      
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        buffer += chunk
        
        // Process complete lines
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep incomplete line in buffer
        
        for (const line of lines) {
          console.log('🔍 PAF Core Agent raw line:', line)
          
          if (line.trim() === '') {
            // Empty line indicates end of SSE event - process if we haven't already
            processCurrentEvent()
            continue
          }
          
          // Parse SSE field lines
          if (line.startsWith('id: ')) {
            // Process previous event if we're starting a new one
            if (currentEvent.event && currentEvent.data) {
              processCurrentEvent()
            }
            currentEvent.id = line.slice(4).trim()
          } else if (line.startsWith('event: ')) {
            currentEvent.event = line.slice(7).trim()
          } else if (line.startsWith('data: ')) {
            currentEvent.data = line.slice(6).trim()
            // Process immediately when we have all three fields
            if (currentEvent.id && currentEvent.event && currentEvent.data) {
              processCurrentEvent()
            }
          } else if (line.startsWith('data:')) {
            currentEvent.data = line.slice(5).trim()
            // Process immediately when we have all three fields
            if (currentEvent.id && currentEvent.event && currentEvent.data) {
              processCurrentEvent()
            }
          }
        }
      }
      
      // Process any remaining event
      processCurrentEvent()
      
      // Send final completion signal if not already sent
      res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`)
      res.write(`data: [DONE]\n\n`)
      console.log('🏁 Stream completed')
      
    } catch (streamError) {
      console.error('Streaming error:', streamError)
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Streaming interrupted' })}\n\n`)
    }

    res.end()

  } catch (error) {
    console.error('Chat API error:', error)
    
    if (!res.headersSent) {
      const errorMessage = error instanceof Error && error.message.includes('fetch') 
        ? 'Cannot connect to PAF Core Agent. Please ensure the service is running.'
        : 'Internal server error'
      
      res.status(500).json({ error: errorMessage })
    }
  }
}

/**
 * GET /api/health - Check PAF Core Agent health
 */
export async function healthHandler(req: Request, res: Response) {
  try {
    const coreAgentUrl = await getCoreAgentUrl()
    
    // Check PAF Core Agent health
    const response = await fetch(`${coreAgentUrl}/api/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Add timeout for health checks
      signal: AbortSignal.timeout(5000) // 5 second timeout
    })

    if (!response.ok) {
      const errorText = await response.text()
      return res.status(response.status).json({
        status: 'error',
        error: `PAF Core Agent health check failed: ${errorText}`,
        runtime: {
          provider: 'unknown',
          configured: false,
          coreAgentUrl,
          connected: false
        }
      })
    }

    const healthData = await response.json() as any
    
    // Return the health data from PAF Core Agent with additional orchestrator info
    res.json({
      status: healthData.status || 'healthy',
      runtime: healthData.runtime || {},
      orchestrator: {
        status: 'healthy',
        coreAgentUrl,
        connected: true
      }
    })
    
  } catch (error) {
    console.error('Health check error:', error)
    
    const errorMessage = error instanceof Error && error.name === 'TimeoutError'
      ? 'PAF Core Agent health check timed out'
      : error instanceof Error && error.message.includes('fetch')
      ? 'Cannot connect to PAF Core Agent'
      : error instanceof Error ? error.message : 'Unknown error'
    
    res.status(500).json({ 
      status: 'error', 
      error: errorMessage,
      runtime: { 
        provider: 'unknown', 
        configured: false,
        coreAgentUrl: await getCoreAgentUrl(),
        connected: false
      }
    })
  }
}

/**
 * GET /api/chat/status - Check PAF Core Agent detailed status
 */
export async function statusHandler(req: Request, res: Response) {
  try {
    const coreAgentUrl = await getCoreAgentUrl()
    
    const response = await fetch(`${coreAgentUrl}/api/chat/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(5000)
    })

    if (!response.ok) {
      const errorText = await response.text()
      return res.status(response.status).json({
        error: `PAF Core Agent status check failed: ${errorText}`
      })
    }

    const statusData = await response.json()
    res.json(statusData)
    
  } catch (error) {
    console.error('Status check error:', error)
    
    const errorMessage = error instanceof Error && error.name === 'TimeoutError'
      ? 'PAF Core Agent status check timed out'
      : error instanceof Error && error.message.includes('fetch')
      ? 'Cannot connect to PAF Core Agent'
      : error instanceof Error ? error.message : 'Unknown error'
    
    res.status(500).json({ error: errorMessage })
  }
}

/**
 * GET /api/chat/models - Get available models from PAF Core Agent
 */
export async function modelsHandler(req: Request, res: Response) {
  try {
    const coreAgentUrl = await getCoreAgentUrl()
    
    const response = await fetch(`${coreAgentUrl}/api/chat/models`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(5000)
    })

    if (!response.ok) {
      const errorText = await response.text()
      return res.status(response.status).json({
        error: `PAF Core Agent models check failed: ${errorText}`
      })
    }

    const modelsData = await response.json()
    res.json(modelsData)
    
  } catch (error) {
    console.error('Models check error:', error)
    
    const errorMessage = error instanceof Error && error.name === 'TimeoutError'
      ? 'PAF Core Agent models check timed out'
      : error instanceof Error && error.message.includes('fetch')
      ? 'Cannot connect to PAF Core Agent'
      : error instanceof Error ? error.message : 'Unknown error'
    
    res.status(500).json({ error: errorMessage })
  }
}