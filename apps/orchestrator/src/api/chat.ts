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
    const { 
      message, 
      files = [], 
      history = [],
      show_thinking = false,
      model = 'gpt-4o',
      temperature = 0.7,
      max_tokens, // No default limit - let AI complete naturally
      // Legacy support for old format
      fileContext = [], 
      settings = {} 
    } = req.body

    if (!message?.trim()) {
      return res.status(400).json({ error: 'Message is required' })
    }

    const coreAgentUrl = await getCoreAgentUrl()
    
    // Use the new files format if provided, otherwise fall back to legacy fileContext
    let processedFiles = files
    if (files.length === 0 && fileContext.length > 0) {
      // Transform legacy fileContext to new files format for backward compatibility
      processedFiles = fileContext.map((file: any) => ({
        file_name: file.name || 'unknown',
        content: file.content || '',
        file_type: 'text/plain',
        file_size: file.content?.length || 0,
        file_path: file.path
      }))
    }

    // Prepare request payload for PAF Core Agent per official API spec
    const payload: any = {
      message,
      files: processedFiles,
      history,
      show_thinking,
      model,
      temperature
    }
    
    // Only include max_tokens if explicitly provided
    if (max_tokens !== undefined) {
      payload.max_tokens = max_tokens
    }

    console.log('📤 Sending to PAF Core Agent:', {
      message: payload.message,
      filesCount: payload.files.length,
      model: payload.model
    })

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
          } else if (currentEvent.event === 'EventType.UPEE_PHASE') {
            try {
              const upeeData = JSON.parse(currentEvent.data)
              const phaseMap: Record<string, string> = {
                'understand': '🔍 Understanding the request',
                'plan': '📋 Planning the approach', 
                'execute': '⚡ Executing the plan',
                'evaluate': '🎯 Evaluating the results'
              }
              
              sseData = {
                type: 'thinking',
                context: {
                  thoughts: [{
                    id: currentEvent.id || `upee_${upeeData.phase}_${Date.now()}`,
                    content: phaseMap[upeeData.phase] || `${upeeData.phase} phase: ${upeeData.content}`,
                    isCompleted: upeeData.completed || false,
                    timestamp: upeeData.timestamp || new Date().toISOString(),
                    importance: 'high'
                  }]
                }
              }
              console.log(`📤 Sending UPEE ${upeeData.phase} phase event`)
            } catch {
              // Fallback
              sseData = {
                type: 'thinking',
                context: {
                  thoughts: [{
                    id: currentEvent.id || `upee_${Date.now()}`,
                    content: `UPEE Phase: ${currentEvent.data}`,
                    isCompleted: false,
                    timestamp: new Date().toISOString(),
                    importance: 'high'
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
          } else if (currentEvent.event === 'clarification_needed') {
            // Plan Mode: Handle clarification request from agent
            try {
              const clarificationData = JSON.parse(currentEvent.data)
              sseData = {
                type: 'clarification_needed',
                clarification: clarificationData.clarification || clarificationData,
                complexity: clarificationData.complexity,
                request_id: clarificationData.request_id || currentEvent.id
              }
              console.log('📤 Sending clarification_needed event:', clarificationData.clarification?.clarificationId)
            } catch {
              // Fallback for non-JSON data
              sseData = {
                type: 'clarification_needed',
                clarification: {
                  clarificationId: currentEvent.id || `clarification_${Date.now()}`,
                  message: currentEvent.data,
                  questions: []
                }
              }
            }
          } else if (currentEvent.event === 'plan_proposed') {
            // Plan Mode: Handle plan proposal from agent
            try {
              const planData = JSON.parse(currentEvent.data)
              sseData = {
                type: 'plan_proposed',
                plan: planData.plan || planData,
                request_id: planData.request_id || currentEvent.id
              }
              console.log('📤 Sending plan_proposed event:', planData.plan?.planId)
            } catch {
              sseData = {
                type: 'plan_proposed',
                plan: {
                  planId: currentEvent.id || `plan_${Date.now()}`,
                  title: 'Proposed Plan',
                  summary: currentEvent.data,
                  steps: []
                }
              }
            }
          } else if (currentEvent.event === 'plan_executing') {
            // Plan Mode: Handle plan execution progress
            try {
              const stepData = JSON.parse(currentEvent.data)
              sseData = {
                type: 'plan_executing',
                step: stepData.step || stepData,
                plan_id: stepData.plan_id || stepData.planId
              }
              console.log('📤 Sending plan_executing event:', stepData.step?.stepId)
            } catch {
              sseData = {
                type: 'plan_executing',
                step: {
                  stepId: currentEvent.id || `step_${Date.now()}`,
                  status: 'in_progress',
                  message: currentEvent.data
                }
              }
            }
          } else if (currentEvent.event.includes('upee') || currentEvent.event.includes('phase')) {
            // Handle various UPEE phase event formats
            try {
              const upeeData = JSON.parse(currentEvent.data)
              const phase = upeeData.phase || 'unknown'
              const phaseMap: Record<string, string> = {
                'understand': '🔍 Understanding the request',
                'plan': '📋 Planning the approach', 
                'execute': '⚡ Executing the plan',
                'evaluate': '🎯 Evaluating the results'
              }
              
              sseData = {
                type: 'thinking',
                context: {
                  thoughts: [{
                    id: currentEvent.id || `upee_${phase}_${Date.now()}`,
                    content: phaseMap[phase] || `${phase} phase: ${upeeData.content || 'Processing...'}`,
                    isCompleted: upeeData.completed || false,
                    timestamp: upeeData.timestamp || new Date().toISOString(),
                    importance: 'high'
                  }]
                }
              }
              console.log(`📤 Sending UPEE ${phase} phase event`)
            } catch {
              // Fallback for non-JSON UPEE events
              sseData = {
                type: 'thinking',
                context: {
                  thoughts: [{
                    id: currentEvent.id || `upee_${Date.now()}`,
                    content: `UPEE Phase: ${currentEvent.data}`,
                    isCompleted: false,
                    timestamp: new Date().toISOString(),
                    importance: 'high'
                  }]
                }
              }
            }
          } else {
            // Log unhandled event types for debugging
            console.log(`🤔 Unhandled SSE event type: ${currentEvent.event}`, currentEvent.data)
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
    // Only log unexpected errors, not connection failures which are expected when PAF Core Agent is down
    if (!(error instanceof Error && (error.message.includes('ECONNREFUSED') || error.message.includes('fetch failed')))) {
      console.error('Health check error:', error)
    }
    
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

// =============================================================================
// Plan Mode: Clarification Response Endpoint
// =============================================================================

/**
 * POST /api/chat/respond - Send clarification response for plan mode
 *
 * This endpoint forwards clarification responses from the UI to PAF Core Agent
 * (or directly to the target agent's /a2a/respond endpoint).
 *
 * Request body:
 * {
 *   clarificationId: string,
 *   answers: Array<{ questionId: string, value: string }>,
 *   agentUrl?: string  // Optional: direct agent URL for A2A routing
 * }
 */
export async function respondHandler(req: Request, res: Response) {
  try {
    const { clarificationId, answers, agentUrl } = req.body

    if (!clarificationId) {
      return res.status(400).json({
        ok: false,
        error: 'Missing clarificationId in request body'
      })
    }

    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({
        ok: false,
        error: 'Missing or invalid answers array in request body'
      })
    }

    console.log('📤 Sending clarification response:', {
      clarificationId,
      answersCount: answers.length,
      agentUrl: agentUrl || 'paf-core-agent'
    })

    // Build the response payload
    const responsePayload = {
      type: 'clarification_response',
      clarificationId,
      answers
    }

    // Determine target URL
    // If agentUrl is provided, send directly to that agent's /a2a/respond
    // Otherwise, send to PAF Core Agent's /api/chat/respond (to be implemented)
    let targetUrl: string
    if (agentUrl) {
      // Direct to agent's A2A respond endpoint
      targetUrl = `${agentUrl}/a2a/respond`
    } else {
      // Send to PAF Core Agent
      const coreAgentUrl = await getCoreAgentUrl()
      targetUrl = `${coreAgentUrl}/api/chat/respond`
    }

    console.log('📤 Forwarding to:', targetUrl)

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(responsePayload),
      signal: AbortSignal.timeout(30000) // 30 second timeout
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorJson
      try {
        errorJson = JSON.parse(errorText)
      } catch {
        errorJson = { error: errorText }
      }

      console.error('❌ Clarification response failed:', response.status, errorJson)

      return res.status(response.status).json({
        ok: false,
        error: errorJson.error || `Failed to send clarification response: ${response.status}`
      })
    }

    const result = await response.json()
    console.log('✅ Clarification response accepted:', result)

    res.json({
      ok: true,
      ...result
    })

  } catch (error) {
    console.error('Respond handler error:', error)

    const errorMessage = error instanceof Error && error.name === 'TimeoutError'
      ? 'Clarification response timed out'
      : error instanceof Error && error.message.includes('fetch')
      ? 'Cannot connect to target agent'
      : error instanceof Error ? error.message : 'Unknown error'

    res.status(500).json({
      ok: false,
      error: errorMessage
    })
  }
}

/**
 * GET /api/chat/clarifications - Get pending clarifications status
 *
 * Returns the count and IDs of pending clarifications.
 * Useful for debugging and monitoring plan mode state.
 */
export async function clarificationsHandler(req: Request, res: Response) {
  try {
    const { agentUrl } = req.query

    let targetUrl: string
    if (agentUrl && typeof agentUrl === 'string') {
      targetUrl = `${agentUrl}/a2a/clarifications`
    } else {
      const coreAgentUrl = await getCoreAgentUrl()
      targetUrl = `${coreAgentUrl}/api/chat/clarifications`
    }

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(5000)
    })

    if (!response.ok) {
      // If endpoint doesn't exist, return empty state
      if (response.status === 404) {
        return res.json({
          ok: true,
          pending_count: 0,
          message: 'Clarifications endpoint not available'
        })
      }

      const errorText = await response.text()
      return res.status(response.status).json({
        ok: false,
        error: `Failed to get clarifications status: ${errorText}`
      })
    }

    const result = await response.json()
    res.json({
      ok: true,
      ...result
    })

  } catch (error) {
    console.error('Clarifications status error:', error)

    // Return empty state on connection errors (endpoint may not exist)
    res.json({
      ok: true,
      pending_count: 0,
      message: 'Clarifications status unavailable'
    })
  }
}