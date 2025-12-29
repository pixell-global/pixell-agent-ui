import { Request, Response } from 'express'
import { Agent } from 'undici'
import { getPafCoreAgentUrl } from '../utils/environments'
import { MemoriesRepo, getUserOrgId } from '@pixell/db-mysql'
import { compressMemoriesForContext } from './memories'
import { sessionManager } from '../services/session-manager'
import { getWorkflowSessionStore } from '../services/workflow-session'
import { uploadAgentOutputToS3, extractFilename } from '../utils/file-upload'
import { broadcastUpdate } from '../index'
import { queueExtraction } from '../services/memory-extraction'
import {
  createSessionEvents,
  processSSEEvent,
  getPrimaryBillingClaim,
  SessionEvents,
} from '../services/billing-detector'

// Get workflow session store singleton
const workflowStore = getWorkflowSessionStore()

// Initialize memories repository
const memoriesRepo = new MemoriesRepo()

// Custom agent for long-running SSE streams with no body timeout
const sseAgent = new Agent({
  bodyTimeout: 0,  // Disable body timeout for SSE
  headersTimeout: 30000,  // 30 second timeout for headers
  keepAliveMaxTimeout: 600000,  // 10 minute max keep-alive
})

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
      settings = {},
      // Memory system
      memoryContext,
      incognitoMode = false,
      selectedAgentId
    } = req.body

    // Get user ID from headers (passed from frontend)
    const userId = req.headers['x-user-id'] as string

    if (!message?.trim()) {
      return res.status(400).json({ error: 'Message is required' })
    }

    const coreAgentUrl = await getCoreAgentUrl()

    // Load and inject memories if not in incognito mode
    let memoryContextString = ''
    let memoriesUsed: any[] = []

    if (userId && !incognitoMode) {
      try {
        // Check user settings
        const settings = await memoriesRepo.getOrCreateSettings(userId)

        if (settings.memoryEnabled && !settings.incognitoMode) {
          // Load memories for context (global + agent-specific)
          const memories = await memoriesRepo.getForContext(userId, selectedAgentId)

          if (memories.length > 0) {
            // Compress memories for context injection
            memoryContextString = compressMemoriesForContext(memories, 2000)
            memoriesUsed = memories.map(m => ({
              id: m.id,
              key: m.key,
              value: m.value,
              category: m.category
            }))

            console.log(`🧠 Injecting ${memories.length} memories into context`)
          }
        }
      } catch (memoryError) {
        // Don't fail the request if memory loading fails
        console.warn('⚠️ Failed to load memories:', memoryError)
      }
    }
    
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
    // Prepend memory context to message if available
    let messageWithContext = message
    if (memoryContextString) {
      messageWithContext = `${memoryContextString}\n\n---\n\n${message}`
    }

    const payload: any = {
      message: messageWithContext,
      files: processedFiles,
      history,
      show_thinking,
      model,
      temperature,
      // Include memories used for response tracking
      memoriesUsed: memoriesUsed.length > 0 ? memoriesUsed : undefined
    }

    // Only include max_tokens if explicitly provided
    if (max_tokens !== undefined) {
      payload.max_tokens = max_tokens
    }

    console.log('📤 Sending to PAF Core Agent:', {
      message: message.substring(0, 100),
      filesCount: payload.files.length,
      model: payload.model,
      memoriesInjected: memoriesUsed.length
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
    // Check if this is a connection error (PAF Core Agent unavailable)
    const isConnectionError = error instanceof Error &&
      (error.message.includes('fetch') ||
       error.message.includes('ECONNREFUSED') ||
       (error.cause && typeof error.cause === 'object' && 'code' in error.cause && error.cause.code === 'ECONNREFUSED'))

    if (isConnectionError) {
      // Fail silently with a graceful SSE response instead of 500 error
      console.log('⚠️ PAF Core Agent not available - sending graceful response')

      if (!res.headersSent) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type'
        })
      }

      // Send a friendly message as content instead of an error
      const gracefulMessage = {
        type: 'content',
        delta: { content: "I'm currently unable to connect to the AI service. Please ensure the PAF Core Agent is running, or try again in a moment." },
        accumulated: "I'm currently unable to connect to the AI service. Please ensure the PAF Core Agent is running, or try again in a moment."
      }
      res.write(`data: ${JSON.stringify(gracefulMessage)}\n\n`)
      res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`)
      res.write(`data: [DONE]\n\n`)
      res.end()
      return
    }

    console.error('Chat API error:', error)

    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' })
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
    const {
      // Clarification response
      clarificationId,
      answers,
      // Selection response
      selectionId,
      selectedIds,
      // Plan approval response
      planId,
      approved,
      // Schedule response
      proposalId,
      action,  // 'confirm' | 'edit' | 'cancel'
      modifications,
      cancelReason,
      // Common fields
      agentUrl,
      sessionId
    } = req.body

    // Validate that at least one valid response type is present
    const hasValidClarification = clarificationId && answers
    const hasValidSelection = selectionId && selectedIds
    const hasValidPlanApproval = planId && approved !== undefined
    const hasValidScheduleResponse = proposalId && action

    if (!hasValidClarification && !hasValidSelection && !hasValidPlanApproval && !hasValidScheduleResponse) {
      return res.status(400).json({
        ok: false,
        error: 'Invalid response format. Must include clarificationId+answers, selectionId+selectedIds, planId+approved, or proposalId+action'
      })
    }

    // Determine response type for logging
    const responseType = hasValidScheduleResponse ? 'schedule'
      : hasValidClarification ? 'clarification'
      : hasValidSelection ? 'selection'
      : 'plan_approval'

    console.log('📤 Sending response via SessionManager:', {
      responseType,
      clarificationId: clarificationId || '(n/a)',
      selectionId: selectionId || '(n/a)',
      planId: planId || '(n/a)',
      proposalId: proposalId || '(n/a)',
      sessionId: sessionId || '(missing)',
      agentUrl: agentUrl || 'paf-core-agent',
    })

    // Get existing session or create ad-hoc if needed
    console.log('🔴 [respondHandler] Looking for session:', {
      sessionId: sessionId || '(missing)',
      agentUrl: agentUrl || '(missing)',
      availableSessions: sessionManager.getSessionIds(),
    })
    let session = sessionManager.getSession(sessionId)

    if (!session && agentUrl && sessionId) {
      // Fallback: register ad-hoc session for backwards compatibility
      console.log('📋 Registering ad-hoc session for respond:', sessionId)
      session = sessionManager.registerSession(sessionId, agentUrl)
    }

    // If no session and no agentUrl, fall back to PAF Core Agent
    if (!session && !agentUrl) {
      console.log('📤 No session found, forwarding to PAF Core Agent')
      return await respondHandlerFallback(req, res)
    }

    if (!session) {
      return res.status(400).json({
        ok: false,
        error: 'Invalid session - no sessionId or agentUrl provided'
      })
    }

    // Build the response payload for pixell-sdk
    // Include planMode from session to preserve state across clarification responses
    let responsePayload: Record<string, any> = {
      sessionId: session.sessionId,
      plan_mode_enabled: session.planMode,  // Use snake_case to match agent's expectation
      planMode: session.planMode  // Keep for backwards compatibility
    }

    if (hasValidClarification) {
      // Transform answers from array [{questionId, value}] to dict {questionId: value}
      const answersDict: Record<string, any> = {}
      if (Array.isArray(answers)) {
        for (const answer of answers) {
          if (answer.questionId) {
            answersDict[answer.questionId] = answer.value
          }
        }
      } else if (typeof answers === 'object') {
        Object.assign(answersDict, answers)
      }
      responsePayload = { ...responsePayload, clarificationId, answers: answersDict }
    } else if (hasValidSelection) {
      responsePayload = { ...responsePayload, selectionId, selectedIds }
    } else if (hasValidPlanApproval) {
      responsePayload = { ...responsePayload, planId, approved }
    } else if (hasValidScheduleResponse) {
      responsePayload = { ...responsePayload, proposalId, action, modifications, cancelReason }
    }

    // Set up SSE streaming response
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders()

    // Get user context for S3 uploads
    const userId = (req.headers['x-user-id'] as string) || ''
    // Get org from header, or query database if header is missing
    let orgId = req.headers['x-org-id'] as string
    if (!orgId && userId) {
      orgId = await getUserOrgId(userId) || ''
    }

    // Subscribe to session events BEFORE sending response
    console.log('📋 [respondHandler] User context:', { userId, orgId, fromDb: !req.headers['x-org-id'] && !!orgId })
    const unsubscribe = sessionManager.subscribe(session.sessionId, async (event: any) => {
      // DEBUG: Log every event received
      console.log('📨 [respondHandler] Event received:', { type: event.type, keys: Object.keys(event), hasPath: !!event.path })

      // Handle file_created events - upload to S3 and broadcast for Navigator
      if (event.type === 'file_created' && userId && orgId && event.path) {
        console.log('🎯 [respondHandler] file_created detected! Uploading to S3...')
        try {
          const uploadResult = await uploadAgentOutputToS3({
            userId,
            orgId,
            localFilePath: event.path,
            filename: event.name || extractFilename(event),
            agentUrl: session.agentUrl
          })

          if (uploadResult.success && uploadResult.s3Path) {
            // Update event with S3 path
            event.path = uploadResult.s3Path
            console.log('✅ [respondHandler] Uploaded to S3:', uploadResult.s3Path)

            // Broadcast for Navigator refresh
            broadcastUpdate({
              type: 'file_created',
              data: {
                path: uploadResult.s3Path,
                name: event.name,
                format: event.format,
                size: event.size,
                folder: 'outputs'
              }
            })
          }
        } catch (uploadError) {
          console.error('❌ [respondHandler] S3 upload failed:', uploadError)
        }
      }

      res.write(`data: ${JSON.stringify(event)}\n\n`)
    })

    try {
      // Forward response to agent through SessionManager
      // Events will be emitted through the subscription above
      await sessionManager.forwardResponse(session.sessionId, responsePayload)
    } catch (forwardError) {
      console.error('❌ SessionManager forward error:', forwardError)
      res.write(`data: ${JSON.stringify({
        type: 'error',
        error: forwardError instanceof Error ? forwardError.message : 'Forward failed'
      })}\n\n`)
    } finally {
      unsubscribe()
    }

    console.log('✅ Respond handler complete via SessionManager')
    res.write(`data: [DONE]\n\n`)
    res.end()

  } catch (error) {
    console.error('Respond handler error:', error)

    const errorMessage = error instanceof Error && error.name === 'TimeoutError'
      ? 'Response timed out'
      : error instanceof Error && error.message.includes('fetch')
      ? 'Cannot connect to target agent'
      : error instanceof Error ? error.message : 'Unknown error'

    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`)
      res.end()
    } else {
      res.status(500).json({
        ok: false,
        error: errorMessage
      })
    }
  }
}

/**
 * Fallback handler for PAF Core Agent (when no sessionId/agentUrl provided)
 * This preserves backwards compatibility with non-plan-mode responses
 */
async function respondHandlerFallback(req: Request, res: Response) {
  const {
    clarificationId,
    answers,
    selectionId,
    selectedIds,
    planId,
    approved,
    sessionId
  } = req.body

  const coreAgentUrl = await getCoreAgentUrl()
  const targetUrl = `${coreAgentUrl}/api/chat/respond`

  // Build payload
  let responsePayload: Record<string, any> = { sessionId }

  if (clarificationId && answers) {
    const answersDict: Record<string, any> = {}
    if (Array.isArray(answers)) {
      for (const answer of answers) {
        if (answer.questionId) {
          answersDict[answer.questionId] = answer.value
        }
      }
    } else if (typeof answers === 'object') {
      Object.assign(answersDict, answers)
    }
    responsePayload = { ...responsePayload, clarificationId, answers: answersDict }
  } else if (selectionId && selectedIds) {
    responsePayload = { ...responsePayload, selectionId, selectedIds }
  } else if (planId && approved !== undefined) {
    responsePayload = { ...responsePayload, planId, approved }
  }

  console.log('📤 Fallback forwarding to PAF Core Agent:', targetUrl)

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify(responsePayload),
      signal: AbortSignal.timeout(300000)
    })

    if (!response.ok) {
      const errorText = await response.text()
      res.write(`data: ${JSON.stringify({ type: 'error', error: errorText })}\n\n`)
      res.end()
      return
    }

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()

    if (!reader) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'No response stream' })}\n\n`)
      res.end()
      return
    }

    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        buffer += chunk

        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.trim() === '' || line.startsWith(':')) continue
          if (line.startsWith('data: ')) {
            res.write(`${line}\n\n`)
          }
        }
      }
    } finally {
      reader.releaseLock()
    }

    res.write(`data: [DONE]\n\n`)
    res.end()

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    res.write(`data: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`)
    res.end()
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

    const result = (await response.json()) as unknown
    // `fetch().json()` may be typed as `unknown` in Node/undici typings.
    // Spread only when we actually have an object.
    const resultObj =
      result && typeof result === 'object'
        ? (result as Record<string, unknown>)
        : { result }

    res.json({
      ok: true,
      ...resultObj,
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

// =============================================================================
// A2A Protocol: Stream from External Agent
// =============================================================================

/**
 * POST /api/chat/a2a/stream - Stream chat from an external A2A agent
 *
 * This endpoint creates a task on an A2A-compatible agent and streams
 * the response events back to the client.
 *
 * Request body:
 * {
 *   message: string,
 *   agentUrl: string,     // e.g., "http://localhost:9999"
 *   planMode?: boolean,
 *   history?: Array<{ role: string, content: string }>
 * }
 */
export async function a2aStreamHandler(req: Request, res: Response) {
  try {
    const {
      message,
      agentUrl,
      planMode = false,
      history = [],
      // File attachments
      files = [],
      fileContext = [], // Legacy support
      // Memory system
      incognitoMode = false,
      selectedAgentId,
      // Conversation tracking (for memory extraction)
      conversationId
    } = req.body

    // Get user ID from headers (passed from frontend)
    const userId = req.headers['x-user-id'] as string

    if (!message?.trim()) {
      return res.status(400).json({ error: 'Message is required' })
    }

    if (!agentUrl) {
      return res.status(400).json({ error: 'agentUrl is required for A2A streaming' })
    }

    // Get org ID from headers (passed from frontend)
    const orgId = req.headers['x-org-id'] as string

    // BILLING DEBUG: Log all billing-relevant parameters at request start
    console.log('💰 [BILLING DEBUG] Request parameters:', {
      orgId: orgId || '❌ MISSING',
      userId: userId || '❌ MISSING',
      selectedAgentId: selectedAgentId || '❌ MISSING',
      agentUrl,
      hasOrgId: !!orgId,
      hasUserId: !!userId,
      hasSelectedAgentId: !!selectedAgentId,
    })

    // Initialize billing event tracker for output-based detection
    const billingSessionEvents: SessionEvents = createSessionEvents()

    // Check quota before executing agent task
    let quotaFeature: FeatureType | null = null
    if (orgId && selectedAgentId) {
      console.log('💰 [BILLING DEBUG] Checking quota for agent:', selectedAgentId)
      const quotaCheck = await checkAgentQuota(orgId, selectedAgentId)
      quotaFeature = quotaCheck.feature
      console.log('💰 [BILLING DEBUG] Quota check result:', {
        feature: quotaFeature || '❌ NO FEATURE MAPPING',
        allowed: quotaCheck.allowed,
        result: quotaCheck.result,
      })

      if (!quotaCheck.allowed && quotaCheck.result) {
        return res.status(403).json({
          error: 'Quota exceeded',
          message: quotaCheck.result.reason,
          featureAvailable: quotaCheck.result.featureAvailable,
          limit: quotaCheck.result.limit,
          used: quotaCheck.result.used,
          remaining: quotaCheck.result.remaining,
        })
      }
    } else {
      console.log('💰 [BILLING DEBUG] ⚠️ Skipping quota check - missing:', {
        orgId: !orgId ? '❌ orgId' : '✅',
        selectedAgentId: !selectedAgentId ? '❌ selectedAgentId' : '✅',
      })
    }

    // Load and inject memories if not in incognito mode
    let memoryContextString = ''
    let memoriesUsed: any[] = []

    if (userId && !incognitoMode) {
      try {
        const settings = await memoriesRepo.getOrCreateSettings(userId)

        if (settings.memoryEnabled && !settings.incognitoMode) {
          // Use selectedAgentId or extract agent ID from URL
          const agentId = selectedAgentId || new URL(agentUrl).hostname
          const memories = await memoriesRepo.getForContext(userId, agentId)

          if (memories.length > 0) {
            memoryContextString = compressMemoriesForContext(memories, 2000)
            memoriesUsed = memories.map(m => ({
              id: m.id,
              key: m.key,
              value: m.value,
              category: m.category
            }))

            console.log(`🧠 Injecting ${memories.length} memories into A2A context`)
          }
        }
      } catch (memoryError) {
        console.warn('⚠️ Failed to load memories for A2A:', memoryError)
      }
    }

    // Prepend memory context to message if available
    let messageWithContext = message
    if (memoryContextString) {
      messageWithContext = `${memoryContextString}\n\n---\n\n${message}`
    }

    // Process files for A2A message (similar to PAF handler)
    // Use new files format if provided, otherwise fall back to legacy fileContext
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

    // Convert files to A2A FilePart format for pixell-sdk
    const fileParts = processedFiles.map((file: any) => ({
      file: {
        name: file.file_name || file.name || 'unknown',
        mimeType: file.file_type || file.mimeType || 'text/plain',
        bytes: file.content // Already base64 for binary, UTF-8 for text
      }
    }))

    // Build parts array: text message + file attachments
    const messageParts: Array<{ text: string } | { file: { name: string; mimeType: string; bytes: string } }> = [
      { text: messageWithContext }
    ]
    if (fileParts.length > 0) {
      messageParts.push(...fileParts)
    }

    console.log('📤 Sending A2A streaming message:', {
      agentUrl,
      message: message.substring(0, 100),
      planMode,
      memoriesInjected: memoriesUsed.length,
      filesCount: fileParts.length
    })

    // Set up SSE headers immediately for streaming
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type'
    })

    // Use JSON-RPC message/stream endpoint for real-time progress events
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`
    // Generate sessionId for pixell-sdk session tracking
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`

    // Create workflow for centralized tracking (orchestrator-owned sessions)
    // workflowId is the root correlation ID that ties all events together
    const workflow = await workflowStore.createWorkflow({
      sessionId,
      agentId: selectedAgentId || 'unknown',
      agentUrl,
      initialMessageId: messageId,
      responseMessageId: `response_${messageId}`,
    })

    console.log('📋 Workflow created:', workflow.workflowId, 'for session:', sessionId)

    // Register session with SessionManager for plan mode state tracking
    sessionManager.registerSession(sessionId, agentUrl, planMode)

    // Send session_created event to frontend so it can track the session
    // Include workflowId for frontend workflow store correlation
    res.write(`data: ${JSON.stringify({
      type: 'session_created',
      sessionId,
      workflowId: workflow.workflowId,
      agentUrl
    })}\n\n`)

    // Use custom agent with no body timeout for long-running SSE streams
    console.log('📤 Sending A2A request with plan_mode_enabled:', planMode, 'sessionId:', sessionId, 'workflowId:', workflow.workflowId)
    const sseResponse = await fetch(agentUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'message/stream',  // Use streaming method for progress events
        id: messageId,
        params: {
          sessionId,  // Include sessionId for pixell-sdk session tracking
          workflowId: workflow.workflowId,  // Root correlation ID - SDK will auto-inject into all events
          message: {
            messageId,
            role: 'user',
            parts: messageParts, // Text message + file attachments
            metadata: {
              plan_mode_enabled: planMode,
              memoriesUsed: memoriesUsed.length > 0 ? memoriesUsed : undefined
            }
          },
          metadata: {
            plan_mode_enabled: planMode,  // Use snake_case to match agent's expectation
            planMode,  // Keep for backwards compatibility
            history,
            memoriesUsed: memoriesUsed.length > 0 ? memoriesUsed : undefined
          }
        }
      }),
      // @ts-ignore - dispatcher is a valid option for undici-based fetch
      dispatcher: sseAgent,
    })

    console.log('📥 A2A fetch response received:', sseResponse.status, sseResponse.statusText)

    if (!sseResponse.ok) {
      const errorText = await sseResponse.text()
      console.error('❌ A2A streaming request failed:', sseResponse.status, errorText)
      res.write(`data: ${JSON.stringify({ type: 'error', error: `A2A request failed: ${errorText}` })}\n\n`)
      res.write(`data: [DONE]\n\n`)
      res.end()
      return
    }

    // Stream and transform events from A2A agent
    const reader = sseResponse.body?.getReader()
    const decoder = new TextDecoder()

    if (!reader) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'No response stream available' })}\n\n`)
      res.write(`data: [DONE]\n\n`)
      res.end()
      return
    }

    let buffer = ''
    let accumulatedContent = ''
    let taskCompletedSuccessfully = false

    try {
      console.log('📖 Starting to read A2A SSE stream...')
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          console.log('📖 A2A SSE stream ended (done=true)')
          break
        }

        const chunk = decoder.decode(value, { stream: true })
        buffer += chunk
        console.log('📖 Received chunk:', chunk.substring(0, 200))

        // Process complete lines
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.trim() === '' || line.startsWith(':')) continue

          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim()
            if (dataStr === '[DONE]') {
              continue
            }

            try {
              const event = JSON.parse(dataStr)
              const result = event.result

              // Track events for billing detection
              processSSEEvent(billingSessionEvents, event)

              // Handle pixell-sdk flat event format (no result wrapper)
              // pixell-sdk sends events like: {"state": "input-required", "type": "clarification_needed", ...}
              if (!result && event.state) {
                // Use sessionId from event if available, otherwise use the one we generated
                const eventSessionId = event.sessionId || sessionId

                // Handle clarification_needed event from pixell-sdk
                if (event.type === 'clarification_needed' && event.clarificationId) {
                  // Update workflow phase to clarification
                  const eventWorkflowId = event.workflowId || workflow.workflowId
                  await workflowStore.updatePhase(eventWorkflowId, 'clarification', {
                    clarification: {
                      type: 'clarification_needed',
                      clarificationId: event.clarificationId,
                      agentId: selectedAgentId || agentUrl,
                      questions: event.questions,
                      message: event.message,
                      timeoutMs: event.timeoutMs || 300000,
                    }
                  })

                  const sseData = {
                    type: 'clarification_needed',
                    workflowId: eventWorkflowId,
                    clarification: {
                      clarificationId: event.clarificationId,
                      questions: event.questions,
                      message: event.message,
                      agentUrl,
                      sessionId: eventSessionId
                    }
                  }
                  res.write(`data: ${JSON.stringify(sseData)}\n\n`)
                  console.log('📤 [pixell-sdk] Sending clarification_needed event:', event.clarificationId, 'workflowId:', eventWorkflowId)
                  continue
                }

                // Handle file_created event from pixell-sdk
                // Note: pixell-sdk sends file events via progress_callback as status updates with step='file_created'
                console.log('🔍 [DEBUG] Checking file_created condition:', {
                  eventType: event.type,
                  eventStep: event.step,
                  hasPath: !!event.path,
                  hasName: !!event.name,
                  eventKeys: Object.keys(event)
                })
                if (event.type === 'file_created' || event.type === 'file_saved' || event.step === 'file_created' || event.step === 'file_saved') {
                  const userId = req.headers['x-user-id'] as string
                  const orgId = req.headers['x-org-id'] as string
                  const filename = extractFilename(event)
                  let s3Path = event.path

                  // Upload to S3 if user context is available
                  if (userId && orgId && event.path) {
                    try {
                      const uploadResult = await uploadAgentOutputToS3({
                        userId,
                        orgId,
                        localFilePath: event.path,
                        filename,
                        agentUrl
                      })

                      if (uploadResult.success && uploadResult.s3Path) {
                        s3Path = uploadResult.s3Path
                        console.log('✅ [file_created] Uploaded to S3:', s3Path)
                      }
                    } catch (uploadError) {
                      console.error('❌ [file_created] Failed to upload to S3:', uploadError)
                      // Continue with original path if S3 upload fails
                    }
                  }

                  // Send SSE event with S3 path
                  const sseData = {
                    type: 'file_created',
                    path: s3Path,
                    name: filename,
                    format: event.format || event.fileType || 'html',
                    size: event.size,
                    summary: event.summary,
                    agentUrl,
                    sessionId: eventSessionId
                  }
                  res.write(`data: ${JSON.stringify(sseData)}\n\n`)
                  console.log('📤 [pixell-sdk] Sending file_created event:', s3Path)

                  // Broadcast WebSocket event for Navigator refresh
                  broadcastUpdate({
                    type: 'file_created',
                    data: {
                      path: s3Path,
                      name: filename,
                      format: event.format || event.fileType || 'html',
                      size: event.size,
                      folder: 'outputs'
                    }
                  })

                  continue
                }

                // Handle status-update (working) events from pixell-sdk
                if (event.state === 'working' && event.message) {
                  const thinkingEvent = {
                    type: 'thinking',
                    context: {
                      thoughts: [{
                        id: `thought_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                        content: event.message,
                        isCompleted: false,
                        timestamp: event.timestamp || new Date().toISOString(),
                        importance: 'medium',
                        eventType: 'status_update',
                      }]
                    }
                  }
                  res.write(`data: ${JSON.stringify(thinkingEvent)}\n\n`)
                  continue
                }

                // Handle completed state from pixell-sdk
                if (event.state === 'completed') {
                  const eventWorkflowId = event.workflowId || workflow.workflowId
                  taskCompletedSuccessfully = true

                  // Extract content from message.parts if available (from plan.complete())
                  if (event.message && event.message.parts) {
                    const parts = event.message.parts
                    for (const part of parts) {
                      if (part.text) {
                        // Send content event for each text part
                        accumulatedContent += part.text
                        const contentEvent = {
                          type: 'content',
                          workflowId: eventWorkflowId,
                          delta: { content: part.text },
                          accumulated: accumulatedContent
                        }
                        res.write(`data: ${JSON.stringify(contentEvent)}\n\n`)
                        console.log('📤 [pixell-sdk] Sending content from completed message:', part.text.substring(0, 100))
                      }
                    }
                  }

                  // Mark workflow as completed
                  await workflowStore.complete(eventWorkflowId)
                  console.log('📋 Workflow completed:', eventWorkflowId)

                  res.write(`data: ${JSON.stringify({ type: 'complete', workflowId: eventWorkflowId })}\n\n`)
                  continue
                }

                // Handle failed state from pixell-sdk
                if (event.state === 'failed') {
                  const eventWorkflowId = event.workflowId || workflow.workflowId
                  await workflowStore.error(eventWorkflowId, event.message || 'Task failed')
                  res.write(`data: ${JSON.stringify({ type: 'error', workflowId: eventWorkflowId, error: event.message || 'Task failed' })}\n\n`)
                  continue
                }

                // Handle schedule_proposal event from pixell-sdk
                // pixell-sdk sends: {"state": "input-required", "type": "schedule_proposal", "proposalId": "...", ...}
                if (event.type === 'schedule_proposal' && event.proposalId) {
                  const eventWorkflowId = event.workflowId || workflow.workflowId
                  const eventSessionId = event.sessionId || sessionId

                  const sseData = {
                    type: 'schedule_proposal',
                    workflowId: eventWorkflowId,
                    proposalId: event.proposalId,
                    name: event.name,
                    prompt: event.prompt,
                    scheduleType: event.scheduleType,
                    cron: event.cron,
                    interval: event.interval,
                    oneTimeAt: event.oneTimeAt,
                    scheduleDisplay: event.scheduleDisplay,
                    timezone: event.timezone || 'UTC',
                    description: event.description,
                    rationale: event.rationale,
                    nextRunsPreview: event.nextRunsPreview,
                    agentId: event.agentId || selectedAgentId,
                    agentUrl,
                    sessionId: eventSessionId
                  }
                  res.write(`data: ${JSON.stringify(sseData)}\n\n`)
                  console.log('📅 [pixell-sdk] Sending schedule_proposal event:', event.proposalId, 'workflowId:', eventWorkflowId)
                  continue
                }
              }

              if (!result) continue

              // Handle A2A SDK status-update events (progress/thinking)
              if (result.kind === 'status-update') {
                const status = result.status
                const statusMessage = status?.message
                // Extract sessionId from event for session continuity (pixell-sdk includes it)
                // Fall back to the outer generated sessionId if event doesn't include one
                const eventSessionId = result.sessionId || event.sessionId || status?.sessionId || sessionId

                // Check for input-required state (clarification, search plan, discovery, selection, preview)
                // Note: A2A spec uses "input-required" with hyphen
                if (status?.state === 'input-required' || status?.state === 'input_required') {
                  const parts = statusMessage?.parts || []
                  for (const part of parts) {
                    // Handle clarification request - check for clarificationId + questions structure
                    // (agent may not include explicit type field)
                    if (part.data?.type === 'clarification_needed' ||
                        (part.data?.clarificationId && part.data?.questions)) {
                      const sseData = {
                        type: 'clarification_needed',
                        clarification: {
                          ...part.data,
                          agentUrl,
                          sessionId: eventSessionId  // Include sessionId for respond endpoint
                        }
                      }
                      res.write(`data: ${JSON.stringify(sseData)}\n\n`)
                      console.log('📤 Sending clarification_needed event:', part.data.clarificationId, 'sessionId:', eventSessionId)
                      continue
                    }
                    // Handle search plan preview - check for planId + keywords structure
                    if (part.data?.type === 'search_plan' ||
                        part.data?.type === 'search_plan_ready' ||
                        (part.data?.planId && part.data?.keywords)) {
                      const sseData = {
                        type: 'search_plan',
                        plan: {
                          ...part.data,
                          agentUrl,
                          sessionId: eventSessionId  // Include sessionId for respond endpoint
                        }
                      }
                      res.write(`data: ${JSON.stringify(sseData)}\n\n`)
                      console.log('📤 Sending search_plan event:', part.data.planId, 'sessionId:', eventSessionId)
                      continue
                    }
                    // Handle discovery result (new phase-based event)
                    if (part.data?.type === 'discovery_result') {
                      const eventWorkflowId = part.data.workflowId || event.workflowId || workflow.workflowId
                      await workflowStore.updatePhase(eventWorkflowId, 'discovery', {
                        discovery: part.data
                      })

                      const sseData = {
                        type: 'discovery_result',
                        workflowId: eventWorkflowId,
                        discovery: {
                          ...part.data,
                          agentUrl,
                          sessionId: eventSessionId
                        }
                      }
                      res.write(`data: ${JSON.stringify(sseData)}\n\n`)
                      console.log('📤 Sending discovery_result event, workflowId:', eventWorkflowId)
                      continue
                    }
                    // Handle selection required (new phase-based event)
                    if (part.data?.type === 'selection_required') {
                      // Use workflowId from event or fall back to our created workflow
                      const eventWorkflowId = part.data.workflowId || event.workflowId || workflow.workflowId
                      await workflowStore.updatePhase(eventWorkflowId, 'selection', {
                        selection: part.data
                      })

                      const sseData = {
                        type: 'selection_required',
                        workflowId: eventWorkflowId,
                        selection: {
                          ...part.data,
                          agentUrl,
                          sessionId: eventSessionId
                        }
                      }
                      res.write(`data: ${JSON.stringify(sseData)}\n\n`)
                      console.log('📤 Sending selection_required event, workflowId:', eventWorkflowId)
                      continue
                    }
                    // Handle preview ready (new phase-based event)
                    if (part.data?.type === 'preview_ready') {
                      const eventWorkflowId = part.data.workflowId || event.workflowId || workflow.workflowId
                      await workflowStore.updatePhase(eventWorkflowId, 'preview', {
                        preview: part.data
                      })

                      const sseData = {
                        type: 'preview_ready',
                        workflowId: eventWorkflowId,
                        preview: {
                          ...part.data,
                          agentUrl,
                          sessionId: eventSessionId
                        }
                      }
                      res.write(`data: ${JSON.stringify(sseData)}\n\n`)
                      console.log('📤 Sending preview_ready event, workflowId:', eventWorkflowId)
                      continue
                    }
                    // Handle phase transition (new phase-based event)
                    if (part.data?.type === 'phase_transition') {
                      const sseData = {
                        type: 'phase_transition',
                        ...part.data,
                        agentUrl,
                        sessionId: eventSessionId
                      }
                      res.write(`data: ${JSON.stringify(sseData)}\n\n`)
                      console.log('📤 Sending phase_transition event:', part.data.fromPhase, '->', part.data.toPhase)
                      continue
                    }
                    // Handle file_created event (when agent saves a file)
                    if (part.data?.type === 'file_created' || part.data?.type === 'file_saved') {
                      const userId = req.headers['x-user-id'] as string
                      const orgId = req.headers['x-org-id'] as string
                      const filename = extractFilename(part.data)
                      let s3Path = part.data.path

                      // Upload to S3 if user context is available
                      if (userId && orgId && part.data.path) {
                        try {
                          const uploadResult = await uploadAgentOutputToS3({
                            userId,
                            orgId,
                            localFilePath: part.data.path,
                            filename,
                            agentUrl
                          })

                          if (uploadResult.success && uploadResult.s3Path) {
                            s3Path = uploadResult.s3Path
                            console.log('✅ [file_created] Uploaded to S3:', s3Path)
                          }
                        } catch (uploadError) {
                          console.error('❌ [file_created] Failed to upload to S3:', uploadError)
                        }
                      }

                      const sseData = {
                        type: 'file_created',
                        path: s3Path,
                        name: filename,
                        format: part.data.format || part.data.fileType || 'html',
                        size: part.data.size,
                        summary: part.data.summary,
                        agentUrl,
                        sessionId: eventSessionId
                      }
                      res.write(`data: ${JSON.stringify(sseData)}\n\n`)
                      console.log('📤 Sending file_created event:', s3Path)

                      // Broadcast WebSocket event for Navigator refresh
                      broadcastUpdate({
                        type: 'file_created',
                        data: {
                          path: s3Path,
                          name: filename,
                          format: part.data.format || part.data.fileType || 'html',
                          size: part.data.size,
                          folder: 'outputs'
                        }
                      })

                      continue
                    }
                  }
                }

                // Handle working state - convert to thinking events
                if (status?.state === 'working' && statusMessage?.parts) {
                  const textPart = statusMessage.parts.find((p: any) => p.text || p.kind === 'text')
                  if (textPart?.text) {
                    const metadata = statusMessage.metadata || {}
                    const eventType = metadata.event_type || ''

                    // Send as thinking event
                    const thinkingEvent = {
                      type: 'thinking',
                      context: {
                        thoughts: [{
                          id: `thought_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                          content: textPart.text,
                          isCompleted: eventType.endsWith('_complete'),
                          timestamp: new Date().toISOString(),
                          importance: getEventImportance(eventType),
                          eventType: eventType,
                        }]
                      }
                    }
                    res.write(`data: ${JSON.stringify(thinkingEvent)}\n\n`)
                  }
                }

                // Handle completed state
                if (status?.state === 'completed') {
                  taskCompletedSuccessfully = true
                  res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`)
                }

                // Handle failed state
                if (status?.state === 'failed') {
                  const errorText = statusMessage?.parts?.[0]?.text || 'Task failed'
                  res.write(`data: ${JSON.stringify({ type: 'error', error: errorText })}\n\n`)
                }
              }

              // Handle final message (the actual response content)
              if (result.kind === 'message') {
                const parts = result.parts || []
                for (const part of parts) {
                  if (part.text) {
                    accumulatedContent += part.text
                    const sseData = {
                      type: 'content',
                      delta: { content: part.text },
                      accumulated: accumulatedContent
                    }
                    res.write(`data: ${JSON.stringify(sseData)}\n\n`)
                  }
                }
              }

            } catch (parseError) {
              console.log('⚠️ Failed to parse A2A event:', dataStr.substring(0, 200))
            }
          }
        }
      }

      reader.releaseLock()

    } catch (streamError) {
      console.error('Streaming error:', streamError)
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Streaming interrupted' })}\n\n`)
    }

    // Record usage on successful completion
    // Try output-based detection first, fall back to agent config
    const detectedClaim = getPrimaryBillingClaim(billingSessionEvents)
    const finalFeatureType = detectedClaim?.type || quotaFeature

    // BILLING DEBUG: Log all conditions for quota recording
    console.log('💰 [BILLING DEBUG] Quota recording check:', {
      taskCompletedSuccessfully,
      orgId: orgId || '❌ MISSING',
      userId: userId || '❌ MISSING',
      quotaFeatureFromAgent: quotaFeature || '❌ MISSING',
      detectedClaim: detectedClaim ? {
        type: detectedClaim.type,
        source: detectedClaim.source,
        confidence: detectedClaim.confidence,
      } : '❌ NO DETECTION',
      finalFeatureType: finalFeatureType || '❌ NONE',
      allConditionsMet: !!(taskCompletedSuccessfully && orgId && userId && finalFeatureType),
      selectedAgentId: selectedAgentId || '❌ MISSING',
    })

    if (taskCompletedSuccessfully && orgId && userId && finalFeatureType) {
      console.log('💰 [BILLING DEBUG] ✅ All conditions met - recording quota usage')
      console.log('💰 [BILLING DEBUG] Using feature type:', finalFeatureType, 'from:', detectedClaim ? detectedClaim.source : 'agent_config')

      const usageResult = await recordAgentUsage(orgId, userId, selectedAgentId || agentUrl, {
        workflowId: workflow.workflowId,
        sessionId,
        completedAt: new Date().toISOString(),
        // Include billing metadata for audit
        billingSource: detectedClaim?.source || 'agent_config',
        billingMetadata: detectedClaim?.metadata,
      })
      if (usageResult.success) {
        console.log(`💰 [BILLING DEBUG] ✅ Quota usage recorded: ${usageResult.newUsage} total uses`)
      } else {
        console.warn(`💰 [BILLING DEBUG] ⚠️ Failed to record quota usage: ${usageResult.error}`)
      }
    } else {
      console.log('💰 [BILLING DEBUG] ❌ NOT recording quota - missing conditions:', {
        taskCompletedSuccessfully: !taskCompletedSuccessfully ? '❌' : '✅',
        orgId: !orgId ? '❌' : '✅',
        userId: !userId ? '❌' : '✅',
        finalFeatureType: !finalFeatureType ? '❌' : '✅',
      })
    }

    // Queue memory extraction on successful completion (if not in incognito mode)
    if (taskCompletedSuccessfully && userId && conversationId && !incognitoMode) {
      try {
        // Check if user has auto extraction enabled
        const settings = await memoriesRepo.getOrCreateSettings(userId)
        if (settings.memoryEnabled && settings.autoExtractionEnabled && !settings.incognitoMode) {
          const jobId = await queueExtraction(userId, conversationId)
          console.log(`🧠 Memory extraction queued: ${jobId} for conversation ${conversationId}`)
        }
      } catch (extractionError) {
        // Don't fail the request if memory extraction queuing fails
        console.warn('⚠️ Failed to queue memory extraction:', extractionError)
      }
    }

    // Send final completion signal
    res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`)
    res.write(`data: [DONE]\n\n`)
    res.end()

    console.log('🏁 A2A stream completed')

  } catch (error) {
    console.error('A2A stream error:', error)

    const errorMessage = error instanceof Error && error.name === 'TimeoutError'
      ? 'A2A task creation timed out'
      : error instanceof Error && error.message.includes('fetch')
      ? 'Cannot connect to A2A agent'
      : error instanceof Error ? error.message : 'Unknown error'

    if (!res.headersSent) {
      res.status(500).json({ error: errorMessage })
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`)
      res.write(`data: [DONE]\n\n`)
      res.end()
    }
  }
}

/**
 * Get importance level for event types (for UI display priority)
 */
function getEventImportance(eventType: string): 'low' | 'medium' | 'high' {
  const highImportance = [
    'seed_detected', 'verification_complete', 'synthesis_complete',
    'tool_error', 'clarification_needed', 'search_plan',
    // New phase-based events
    'discovery_result', 'selection_required', 'preview_ready',
    'phase_transition'
  ]
  const lowImportance = [
    'keyword_search_complete', 'hashtag_search_complete', 'comment_mining_start',
    'status_change'
  ]

  if (highImportance.some(e => eventType.includes(e))) return 'high'
  if (lowImportance.some(e => eventType.includes(e))) return 'low'
  return 'medium'
}

// =============================================================================
// Agent Configuration Endpoint
// =============================================================================

import { getAgents, getDefaultAgent } from '../utils/agents'
import { checkAgentQuota, recordAgentUsage, FeatureType } from '../services/quota-service'

/**
 * GET /api/agents - Get configured agents
 */
export async function agentsHandler(req: Request, res: Response) {
  try {
    const agents = getAgents()
    const defaultAgent = getDefaultAgent()

    res.json({
      ok: true,
      agents,
      defaultAgentId: defaultAgent.id
    })
  } catch (error) {
    console.error('Error getting agents:', error)
    res.status(500).json({
      ok: false,
      error: 'Failed to load agent configuration'
    })
  }
}