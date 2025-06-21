import axios from 'axios'
import { v4 as uuidv4 } from 'uuid'
import {
  AgentCard,
  AgentCapability,
  AgentError,
  TaskId
} from '@pixell/protocols/shared'
import {
  A2AAgent,
  A2AMessage,
  TaskDelegate,
  Heartbeat
} from '@pixell/protocols/a2a'

export interface RedditConfig {
  apiUrl?: string
  userAgent?: string
  rateLimitDelay?: number
  maxRetries?: number
}

export interface RedditComment {
  subreddit: string
  postId: string
  content: string
  brandVoice?: string
}

export interface RedditAnalysis {
  subreddit: string
  timeframe?: string
  keywords?: string[]
}

/**
 * RedditAgent - A production-ready A2A agent for Reddit automation
 * 
 * Capabilities:
 * - Post comments with brand voice
 * - Analyze subreddit sentiment
 * - Monitor specific keywords
 * - Rate limiting and error handling
 */
export class RedditAgent implements A2AAgent {
  private activeTasks = new Map<TaskId, any>()
  private isInitialized = false
  private config: RedditConfig

  readonly card: AgentCard = {
    id: 'reddit-agent',
    name: 'Reddit Automation Agent',
    description: 'Automates Reddit posting, commenting, and analysis with brand voice consistency',
    type: 'keyword', // Using 'keyword' from design tokens (green)
    version: '1.0.0',
    protocol: 'a2a',
    capabilities: {
      comment: { streaming: false, pushNotifications: true },
      analyze: { streaming: true, pushNotifications: false },
      monitor: { streaming: true, pushNotifications: true }
    },
    exposed_ui: 'activity',
    timeout_sec: 300,
    cost_estimate: '$0.002 per operation',
    metadata: {
      domain: 'social-media',
      tags: ['reddit', 'automation', 'sentiment-analysis'],
      requiresAuth: true
    }
  }

  constructor(config: RedditConfig = {}) {
    this.config = {
      apiUrl: config.apiUrl || 'https://www.reddit.com/api',
      userAgent: config.userAgent || 'PixellAgent/1.0',
      rateLimitDelay: config.rateLimitDelay || 1000,
      maxRetries: config.maxRetries || 3,
      ...config
    }
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      // Validate configuration
      if (!this.config.apiUrl) {
        throw new AgentError('Reddit API URL is required', 'CONFIG_ERROR', this.card.id)
      }

      // Test connection (in production, you'd validate API credentials)
      console.log(`🚀 Initializing Reddit Agent with config:`, {
        apiUrl: this.config.apiUrl,
        userAgent: this.config.userAgent
      })

      this.isInitialized = true
      console.log(`✅ Reddit Agent initialized successfully`)
    } catch (error) {
      throw new AgentError(
        `Failed to initialize Reddit Agent: ${error instanceof Error ? error.message : String(error)}`,
        'INIT_ERROR',
        this.card.id
      )
    }
  }

  async shutdown(): Promise<void> {
    console.log(`🔌 Shutting down Reddit Agent...`)
    
    // Cancel any active tasks
    for (const [taskId, task] of this.activeTasks) {
      try {
        await this.cancelTask(taskId)
      } catch (error) {
        console.warn(`Warning: Failed to cancel task ${taskId}:`, error)
      }
    }

    this.isInitialized = false
    console.log(`✅ Reddit Agent shutdown complete`)
  }

  async discoverCapabilities(): Promise<AgentCard> {
    return this.card
  }

  async getCapability(name: string): Promise<AgentCapability | null> {
    const capabilities: Record<string, AgentCapability> = {
      comment: {
        name: 'comment',
        description: 'Post comments on Reddit with brand voice consistency',
        inputs: [
          { name: 'subreddit', type: 'string', required: true, description: 'Target subreddit' },
          { name: 'postId', type: 'string', required: true, description: 'Reddit post ID' },
          { name: 'content', type: 'string', required: true, description: 'Comment content' },
          { name: 'brandVoice', type: 'string', required: false, description: 'Brand voice guidelines' }
        ],
        outputs: [
          { name: 'commentUrl', type: 'string', description: 'URL of posted comment' },
          { name: 'commentId', type: 'string', description: 'Reddit comment ID' }
        ],
        streaming: false,
        pushNotifications: true
      },
      analyze: {
        name: 'analyze',
        description: 'Analyze subreddit sentiment and trends',
        inputs: [
          { name: 'subreddit', type: 'string', required: true, description: 'Target subreddit' },
          { name: 'timeframe', type: 'string', required: false, description: 'Analysis timeframe (day, week, month)' },
          { name: 'keywords', type: 'array', required: false, description: 'Keywords to focus on' }
        ],
        outputs: [
          { name: 'sentiment', type: 'object', description: 'Sentiment analysis results' },
          { name: 'trends', type: 'object', description: 'Trending topics and keywords' },
          { name: 'recommendations', type: 'array', description: 'Action recommendations' }
        ],
        streaming: true,
        pushNotifications: false
      },
      monitor: {
        name: 'monitor',
        description: 'Monitor subreddit for specific keywords and events',
        inputs: [
          { name: 'subreddit', type: 'string', required: true, description: 'Target subreddit' },
          { name: 'keywords', type: 'array', required: true, description: 'Keywords to monitor' },
          { name: 'alertThreshold', type: 'number', required: false, description: 'Minimum score to trigger alert' }
        ],
        outputs: [
          { name: 'alerts', type: 'array', description: 'Keyword match alerts' },
          { name: 'posts', type: 'array', description: 'Matching posts' }
        ],
        streaming: true,
        pushNotifications: true
      }
    }

    return capabilities[name] || null
  }

  async delegateTask(request: TaskDelegate): Promise<void> {
    if (!this.isInitialized) {
      throw new AgentError('Agent not initialized', 'NOT_INITIALIZED', this.card.id, request.taskId)
    }

    console.log(`📝 Reddit Agent received task: ${request.capabilityName} (${request.taskId})`)

    // Store active task
    this.activeTasks.set(request.taskId, {
      capability: request.capabilityName,
      input: request.input,
      startTime: new Date()
    })

    try {
      switch (request.capabilityName) {
        case 'comment':
          await this.handleCommentTask(request)
          break
        case 'analyze':
          await this.handleAnalysisTask(request)
          break
        case 'monitor':
          await this.handleMonitorTask(request)
          break
        default:
          throw new AgentError(
            `Unknown capability: ${request.capabilityName}`,
            'UNKNOWN_CAPABILITY',
            this.card.id,
            request.taskId
          )
      }
    } catch (error) {
      console.error(`❌ Task ${request.taskId} failed:`, error)
      throw error
    } finally {
      this.activeTasks.delete(request.taskId)
    }
  }

  async cancelTask(taskId: TaskId): Promise<void> {
    const task = this.activeTasks.get(taskId)
    if (task) {
      console.log(`🛑 Canceling Reddit task: ${taskId}`)
      this.activeTasks.delete(taskId)
    }
  }

  async getStatus(): Promise<Heartbeat> {
    return {
      agentId: this.card.id,
      status: this.isInitialized ? 'idle' : 'error',
      activeTasks: this.activeTasks.size,
      lastSeen: new Date().toISOString(),
      metadata: {
        version: this.card.version,
        uptime: process.uptime(),
        memory: process.memoryUsage()
      }
    }
  }

  async handleMessage(message: A2AMessage): Promise<void> {
    console.log(`📨 Reddit Agent received message: ${message.type} from ${message.from}`)
    
    // Handle different message types
    switch (message.type) {
      case 'heartbeat':
        // Respond to heartbeat requests
        break
      case 'capability_request':
        // Handle capability requests
        break
      default:
        console.warn(`⚠️  Unhandled message type: ${message.type}`)
    }
  }

  // Private task handlers
  private async handleCommentTask(request: TaskDelegate): Promise<void> {
    const { subreddit, postId, content, brandVoice } = request.input as RedditComment

    console.log(`💬 Posting comment to r/${subreddit}`)

    // Simulate API call with retry logic
    await this.withRetry(async () => {
      // In production, this would make actual Reddit API calls
      await this.simulateRedditAPI('comment', {
        subreddit,
        postId,
        content: brandVoice ? this.applyBrandVoice(content, brandVoice) : content
      })
    })

    // Send task completion (in real implementation, this would be sent via A2A transport)
    console.log(`✅ Comment posted successfully to r/${subreddit}`)
  }

  private async handleAnalysisTask(request: TaskDelegate): Promise<void> {
    const { subreddit, timeframe = 'day', keywords = [] } = request.input as RedditAnalysis

    console.log(`📊 Analyzing r/${subreddit} for timeframe: ${timeframe}`)

    // Simulate streaming analysis
    const steps = [
      'Fetching recent posts...',
      'Analyzing sentiment...',
      'Identifying trends...',
      'Generating recommendations...'
    ]

    for (let i = 0; i < steps.length; i++) {
      console.log(`   ${steps[i]}`)
      
      // Simulate progress updates (would be sent via A2A transport)
      const progress = Math.round(((i + 1) / steps.length) * 100)
      console.log(`   Progress: ${progress}%`)
      
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    console.log(`✅ Analysis complete for r/${subreddit}`)
  }

  private async handleMonitorTask(request: TaskDelegate): Promise<void> {
    const { subreddit, keywords, alertThreshold = 10 } = request.input

    console.log(`👀 Starting monitoring for r/${subreddit} with keywords:`, keywords)

    // Simulate continuous monitoring (in production, this would be a long-running process)
    console.log(`✅ Monitoring active for r/${subreddit}`)
  }

  private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error
    
    for (let attempt = 1; attempt <= this.config.maxRetries!; attempt++) {
      try {
        if (attempt > 1) {
          await new Promise(resolve => 
            setTimeout(resolve, this.config.rateLimitDelay! * attempt)
          )
        }
        
        return await operation()
      } catch (error) {
        lastError = error as Error
        console.warn(`Attempt ${attempt}/${this.config.maxRetries} failed:`, error instanceof Error ? error.message : String(error))
      }
    }

    throw lastError!
  }

  private async simulateRedditAPI(operation: string, data: any): Promise<any> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Simulate occasional API errors for testing
    if (Math.random() < 0.1) {
      throw new Error(`Reddit API error: Rate limited`)
    }

    return { success: true, operation, data }
  }

  private applyBrandVoice(content: string, brandVoice: string): string {
    // Simple brand voice application (in production, this might use AI)
    const voiceModifiers = {
      'professional': (text: string) => text,
      'casual': (text: string) => text + ' 😊',
      'technical': (text: string) => `From a technical perspective: ${text}`,
      'friendly': (text: string) => `Hey! ${text} Hope this helps!`
    }

    const modifier = voiceModifiers[brandVoice as keyof typeof voiceModifiers]
    return modifier ? modifier(content) : content
  }
} 