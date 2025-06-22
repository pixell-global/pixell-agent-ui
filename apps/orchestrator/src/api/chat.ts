import { Request, Response } from 'express'
import { CoreAgent } from '../core/CoreAgent'

// Initialize Core Agent with environment configuration
let coreAgent: CoreAgent | null = null

const initializeCoreAgent = async () => {
  if (!coreAgent) {
    // Agent Runtime (execution framework)
    const agentRuntime = process.env.AGENT_RUNTIME || 'aws-strand'
    
    // AI Provider (model API)
    const aiProvider = process.env.AI_DEFAULT_PROVIDER || 'openai'
    
    coreAgent = new CoreAgent({
      runtimeProvider: agentRuntime as any,
      runtimeConfig: {
        // Multi-provider AI configuration
        aiProvider,
        
        // OpenAI configuration
        openaiApiKey: process.env.OPENAI_API_KEY,
        openaiModel: process.env.OPENAI_MODEL || 'gpt-4o',
        openaiOrganization: process.env.OPENAI_ORGANIZATION,
        openaiBaseUrl: process.env.OPENAI_BASE_URL,
        
        // Anthropic configuration
        anthropicApiKey: process.env.ANTHROPIC_API_KEY,
        anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
        
        // AWS Bedrock configuration
        awsRegion: process.env.AWS_REGION || 'us-east-1',
        awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
        awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        awsBedrockModel: process.env.AWS_BEDROCK_MODEL || 'anthropic.claude-3-5-sonnet-20241022-v2:0',
        
        // Azure OpenAI configuration
        azureApiKey: process.env.AZURE_OPENAI_API_KEY,
        azureEndpoint: process.env.AZURE_OPENAI_ENDPOINT,
        azureDeployment: process.env.AZURE_OPENAI_DEPLOYMENT,
        azureApiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-02-01',
        
        // Google AI configuration
        googleApiKey: process.env.GOOGLE_AI_API_KEY,
        googleModel: process.env.GOOGLE_AI_MODEL || 'gemini-1.5-pro'
      },
      maxConcurrentTasks: 5,
      defaultTimeout: 30000
    })
    
    // Actually initialize the agent
    await coreAgent.initialize()
  }
  return coreAgent
}

/**
 * POST /api/chat/stream - Stream chat responses from Core Agent
 */
export async function streamChatHandler(req: Request, res: Response) {
  try {
    const { message, fileContext = [], settings = {} } = req.body

    if (!message?.trim()) {
      return res.status(400).json({ error: 'Message is required' })
    }

    // Initialize Core Agent
    const agent = await initializeCoreAgent()
    
    // Check if agent is properly configured based on AI provider
    const aiProvider = process.env.AI_DEFAULT_PROVIDER || 'openai'
    let isConfigured = false
    
    switch (aiProvider) {
      case 'openai':
        isConfigured = !!process.env.OPENAI_API_KEY
        break
      case 'anthropic':
        isConfigured = !!process.env.ANTHROPIC_API_KEY
        break
      case 'aws-bedrock':
        isConfigured = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY)
        break
      case 'azure-openai':
        isConfigured = !!(process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_ENDPOINT)
        break
      case 'google':
        isConfigured = !!process.env.GOOGLE_AI_API_KEY
        break
      default:
        isConfigured = false
    }

    if (!isConfigured) {
      return res.status(503).json({ 
        error: `AI provider "${aiProvider}" not configured. Run "pixell config ai" to setup API keys.` 
      })
    }

    // Set up Server-Sent Events for streaming
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type'
    })

    const sendChunk = (data: any) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`)
    }

    try {
      // Show thinking if enabled
      if (settings.showThinking) {
        sendChunk({
          type: 'thinking',
          context: {
            thoughts: [{
              id: `thinking_${Date.now()}`,
              content: 'Processing your request and determining the best approach...',
              isCompleted: false,
              timestamp: new Date().toISOString(),
              importance: 'medium'
            }]
          }
        })
      }

      // Prepare context from files
      let contextPrompt = message
      if (fileContext.length > 0) {
        const fileContextStr = fileContext.map((file: any) => 
          `File: ${file.name}\nPath: ${file.path}\n${file.content ? `Content:\n${file.content}\n` : ''}`
        ).join('\n---\n')
        
        contextPrompt = `Context files:\n${fileContextStr}\n\nUser request: ${message}`
      }

      // Create user intent for Core Agent
      const userIntent = {
        message: contextPrompt,
        userId: 'web-user',
        context: {
          timestamp: new Date().toISOString(),
          source: 'web-chat',
          fileReferences: fileContext
        }
      }

      // Make direct OpenAI API call for now (bypassing Core Agent complexity)
      const aiProvider = process.env.AI_DEFAULT_PROVIDER || 'openai'
      let aiResponse = "I'm sorry, I couldn't generate a response."
      
      if (aiProvider === 'openai' && process.env.OPENAI_API_KEY) {
        try {
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: process.env.OPENAI_MODEL || 'gpt-4o',
              messages: [
                {
                  role: 'system',
                  content: 'You are a helpful AI assistant in the Pixell Agent Framework. Be concise and helpful.'
                },
                {
                  role: 'user',
                  content: contextPrompt
                }
              ],
              max_tokens: 1000,
              temperature: 0.7,
              stream: false
            })
          })
          
          if (response.ok) {
            const data = await response.json() as any
            aiResponse = data.choices?.[0]?.message?.content || "I couldn't generate a response."
          } else {
            console.error('OpenAI API error:', response.status, response.statusText)
            aiResponse = "Sorry, I encountered an error while processing your request."
          }
        } catch (error) {
          console.error('OpenAI API call failed:', error)
          aiResponse = "Sorry, I couldn't connect to the AI service."
        }
      } else {
        aiResponse = `AI provider "${aiProvider}" is not yet implemented for direct API calls.`
      }

      // Stream response back to frontend
      if (settings.streamingEnabled) {
        // Simulate streaming by breaking response into chunks
        const words = aiResponse.split(' ')
        let accumulated = ''

        for (let i = 0; i < words.length; i++) {
          const word = words[i] + (i < words.length - 1 ? ' ' : '')
          accumulated += word
          
          sendChunk({
            type: 'content',
            delta: { content: word },
            accumulated
          })

          // Small delay to simulate real streaming
          await new Promise(resolve => setTimeout(resolve, 30))
        }
      } else {
        // Send complete response
        sendChunk({
          type: 'content',
          delta: { content: aiResponse },
          accumulated: aiResponse
        })
      }

      // Complete thinking step
      if (settings.showThinking) {
        sendChunk({
          type: 'thinking',
          context: {
            thoughts: [{
              id: `thinking_${Date.now()}`,
              content: 'Response generated successfully',
              isCompleted: true,
              timestamp: new Date().toISOString(),
              importance: 'low'
            }]
          }
        })
      }

      sendChunk({ type: 'complete' })
      res.write('data: [DONE]\n\n')

    } catch (aiError) {
      console.error('AI processing error:', aiError)
      
      sendChunk({
        type: 'error',
        error: 'Failed to get AI response. Please check your API configuration.'
      })
    }

    res.end()

  } catch (error) {
    console.error('Chat API error:', error)
    
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' })
    }
  }
}

/**
 * GET /api/health - Check Core Agent health
 */
export async function healthHandler(req: Request, res: Response) {
  try {
    const agent = await initializeCoreAgent()
    
    // Get configuration details
    const agentRuntime = process.env.AGENT_RUNTIME || 'aws-strand'
    const aiProvider = process.env.AI_DEFAULT_PROVIDER || 'openai'
    
    // Check if AI provider is configured
    let isConfigured = false
    let modelId = 'unknown'
    
    switch (aiProvider) {
      case 'openai':
        isConfigured = !!process.env.OPENAI_API_KEY
        modelId = process.env.OPENAI_MODEL || 'gpt-4o'
        break
      case 'anthropic':
        isConfigured = !!process.env.ANTHROPIC_API_KEY
        modelId = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022'
        break
      case 'aws-bedrock':
        isConfigured = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY)
        modelId = process.env.AWS_BEDROCK_MODEL || 'anthropic.claude-3-5-sonnet-20241022-v2:0'
        break
      case 'azure-openai':
        isConfigured = !!(process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_ENDPOINT)
        modelId = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o'
        break
      case 'google':
        isConfigured = !!process.env.GOOGLE_AI_API_KEY
        modelId = process.env.GOOGLE_AI_MODEL || 'gemini-1.5-pro'
        break
    }
    
    if (!isConfigured) {
      return res.json({
        status: 'error',
        error: `AI provider "${aiProvider}" not configured`,
        runtime: {
          provider: aiProvider,
          agentRuntime,
          configured: false
        }
      })
    }

    // Get status from Core Agent
    const stats = agent.getStats()
    
    res.json({
      status: 'healthy',
      runtime: {
        provider: aiProvider,
        agentRuntime,
        modelId,
        configured: true,
        initialized: true,
        stats
      }
    })
    
  } catch (error) {
    console.error('Health check error:', error)
    res.status(500).json({ 
      status: 'error', 
      error: error instanceof Error ? error.message : 'Unknown error',
      runtime: { 
        provider: 'unknown', 
        agentRuntime: 'unknown',
        configured: false 
      }
    })
  }
} 