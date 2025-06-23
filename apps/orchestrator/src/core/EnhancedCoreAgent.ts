import { EventEmitter } from 'events'
import { v4 as uuidv4 } from 'uuid'
import {
  AgentCard,
  AgentId,
  Task,
  TaskId,
  UserId,
  Message,
  AgentError,
  TaskStatus
} from '@pixell/protocols'
import { AgentRegistry } from '@pixell/protocols'
import { AgentRuntimeAdapter } from './AgentRuntimeAdapter'
import { StrandAdapter } from './StrandAdapter'

// Import cognitive components
import { 
  CognitiveEngine, 
  CognitiveConfig, 
  CognitiveResult 
} from './cognitive/CognitiveEngine'
import { ConversationMemoryManager } from './cognitive/ConversationMemory'
import { UnderstandingEngine } from './cognitive/UnderstandingEngine'
import { EvaluationEngine } from './cognitive/EvaluationEngine'
import { UserFeedback } from './cognitive/UnderstandingEngine'
import { FeedbackData } from './cognitive/EvaluationEngine'
import { AdvancedPlanningEngine } from './cognitive/AdvancedPlanningEngine'
import { ExecutionMonitor } from './cognitive/ExecutionMonitor'
import { FeedbackLoopEngine } from './cognitive/FeedbackLoopEngine'
import { LearningEngine } from './cognitive/LearningEngine'
import { MetaCognitiveEngine } from './cognitive/MetaCognitiveEngine'

export interface EnhancedCoreAgentConfig {
  runtimeProvider: 'aws-strand' | 'langgraph' | 'openai'
  runtimeConfig: Record<string, any>
  maxConcurrentTasks: number
  defaultTimeout: number
  
  // Enhanced cognitive configuration
  cognitive: CognitiveConfig
  
  // Enhanced features
  enableAdvancedUnderstanding: boolean
  enableClarificationRequests: boolean
  enableContinuousEvaluation: boolean
  enableLearningFromFeedback: boolean
}

export interface ClarificationRequest {
  sessionId: string
  userId: UserId
  questions: Array<{
    id: string
    text: string
    type: 'yes_no' | 'multiple_choice' | 'open_ended'
    options?: string[]
    priority: 'low' | 'medium' | 'high'
  }>
  deadline?: string
  context: Record<string, any>
}

/**
 * EnhancedCoreAgent - Next-generation CoreAgent with cognitive architecture
 */
export class EnhancedCoreAgent extends EventEmitter {
  private registry: AgentRegistry
  private runtime: AgentRuntimeAdapter
  private cognitive: CognitiveEngine
  private config: EnhancedCoreAgentConfig
  
  // Enhanced state management
  private activeSessions = new Map<string, CognitiveResult>()
  private activeTasks = new Map<TaskId, Task>()
  private pendingClarifications = new Map<string, ClarificationRequest>()
  private performanceHistory: Array<{
    sessionId: string
    timestamp: string
    confidence: number
    iterations: number
    userSatisfaction?: number
  }> = []
  
  private isInitialized = false

  // Phase 1 components
  private memoryManager: ConversationMemoryManager
  private understandingEngine: UnderstandingEngine
  private evaluationEngine: EvaluationEngine
  
  // Phase 2 components
  private planningEngine: AdvancedPlanningEngine
  private executionMonitor: ExecutionMonitor
  
  // Phase 3 components - NEW
  private feedbackLoopEngine: FeedbackLoopEngine
  private learningEngine: LearningEngine
  private metaCognitiveEngine: MetaCognitiveEngine

  constructor(
    config: EnhancedCoreAgentConfig,
    registry?: AgentRegistry
  ) {
    super()
    
    this.config = config
    this.registry = registry || new AgentRegistry()
    this.runtime = this.createRuntimeAdapter()
    
    this.initializePhase3Components()
    this.setupEventHandlers()
  }

  private initializePhase3Components(): void {
    console.log('🚀 Initializing Enhanced Core Agent with Phase 3 capabilities')

    // Initialize Phase 1 components
    this.memoryManager = new ConversationMemoryManager({
      shortTermCapacity: 50,
      workingMemoryCapacity: 20,
      longTermRetentionDays: 30,
      enableSemanticClustering: true,
      enableEmotionalContext: true,
      enableContextualPrioritization: true
    })

    this.understandingEngine = new UnderstandingEngine(this.memoryManager, this.runtime, {
      enableDeepAnalysis: true,
      enableAmbiguityDetection: true,
      enableContextualInference: true,
      enableGoalExtraction: true,
      enableConstraintAnalysis: true,
      confidenceThreshold: 0.7,
      maxAmbiguityResolutionAttempts: 3
    })

    this.evaluationEngine = new EvaluationEngine({
      enableDetailedMetrics: true,
      enableQualityAssessment: true,
      enableRiskAnalysis: true,
      enableComparisonAnalysis: true,
      enableLearningFromEvaluation: true,
      evaluationTimeoutMs: 30000,
      minConfidenceThreshold: 0.6
    })

    // Initialize Phase 2 components
    this.planningEngine = new AdvancedPlanningEngine({
      maxAlternatives: 3,
      simulationEnabled: true,
      riskAssessmentEnabled: true,
      optimizationEnabled: true,
      validationStrictness: 'medium',
      resourceConstraints: {}
    }, this.runtime)

    this.executionMonitor = new ExecutionMonitor({
      enableRealTimeMonitoring: true,
      enableAnomalyDetection: true,
      enableAdaptiveAlerts: true,
      enablePerformanceAnalytics: true,
      monitoringIntervalMs: 1000,
      anomalyThreshold: 2.0,
      alertThreshold: 0.8,
      performanceWindowSize: 100
    })

    // Initialize Phase 3 components - NEW
    this.feedbackLoopEngine = new FeedbackLoopEngine({
      maxIterations: 5,
      convergenceThreshold: 0.05,
      refinementThreshold: 0.6,
      enableAutomaticRefinement: true,
      learningRate: 0.1,
      confidenceThreshold: 0.7,
      performanceThreshold: 0.8,
      issueDetectionSensitivity: 'medium',
      refinementStrategies: ['replan', 'adjust_understanding', 'optimize_resources', 'modify_goals']
    })

    this.learningEngine = new LearningEngine({
      enablePatternRecognition: true,
      enableSuccessAnalysis: true,
      enableFailureAnalysis: true,
      minExamplesForPattern: 5,
      patternConfidenceThreshold: 0.7,
      learningRetentionDays: 90,
      knowledgeUpdateFrequency: 'realtime',
      insightGenerationEnabled: true,
      crossDomainLearningEnabled: true
    })

    this.metaCognitiveEngine = new MetaCognitiveEngine({
      enableSelfAssessment: true,
      enableLoadBalancing: true,
      enableMetaLearning: true,
      assessmentFrequency: 'per_task',
      loadBalancingStrategy: 'adaptive',
      confidenceCalibration: true,
      capabilityTracking: true,
      improvementRecommendations: true,
      metaInsightGeneration: true
    })

    // Initialize enhanced cognitive engine with all Phase 3 components
    this.cognitive = new CognitiveEngine(
      {
        // Phase 1 configuration
        memoryRetentionDays: 30,
        understandingThreshold: 0.7,
        evaluationCriteria: ['accuracy', 'completeness', 'relevance', 'feasibility'],
        
        // Phase 2 configuration
        planningComplexity: 'advanced',
        monitoringFrequency: 'high',
        executionOptimization: true,
        
        // Phase 3 configuration - NEW
        enableFeedbackLoops: true,
        enableLearning: true,
        enableMetaCognition: true,
        feedbackIterations: 3,
        learningRetention: 0.9,
        metaCognitiveSensitivity: 'medium',
        
        // Advanced settings
        crossSessionLearning: true,
        adaptiveProcessing: true,
        cognitiveLoadBalancing: true
      },
      this.memoryManager,
      this.understandingEngine,
      this.evaluationEngine,
      this.runtime,
      this.planningEngine,
      this.executionMonitor,
      this.feedbackLoopEngine,
      this.learningEngine,
      this.metaCognitiveEngine
    )

    console.log('✅ Enhanced Core Agent initialized with Phase 3 cognitive feedback loops and meta-cognition')
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      console.log(`🚀 Initializing Enhanced Core Agent with cognitive architecture`)

      await this.runtime.initialize(this.config.runtimeConfig)
      await this.setupRegistry()

      this.isInitialized = true
      console.log(`✅ Enhanced Core Agent initialized successfully`)

      this.emit('initialized', {
        cognitiveCapabilities: this.cognitive.getCognitiveStats(),
        configuration: this.config
      })
    } catch (error) {
      throw new AgentError(
        `Failed to initialize Enhanced Core Agent: ${error instanceof Error ? error.message : String(error)}`,
        'INIT_ERROR'
      )
    }
  }

  async shutdown(): Promise<void> {
    console.log(`🔌 Shutting down Enhanced Core Agent...`)
    
    for (const [taskId, task] of this.activeTasks) {
      try {
        await this.cancelTask(taskId)
      } catch (error) {
        console.warn(`Warning: Failed to cancel task ${taskId}:`, error)
      }
    }

    this.activeSessions.clear()
    this.pendingClarifications.clear()

    if (this.runtime) {
      await this.runtime.shutdown()
    }

    this.isInitialized = false
    console.log(`✅ Enhanced Core Agent shutdown complete`)

    this.emit('shutdown')
  }

  /**
   * Process user message with enhanced cognitive understanding
   */
  async processUserMessage(
    userId: UserId,
    message: string,
    context?: Record<string, any>
  ): Promise<{ 
    sessionId: string
    clarificationRequest?: ClarificationRequest
    cognitiveInsights?: Record<string, any>
  }> {
    if (!this.isInitialized) {
      throw new AgentError('Enhanced Core Agent not initialized', 'NOT_INITIALIZED')
    }

    const sessionId = uuidv4()
    console.log(`💬 Processing enhanced user message: "${message.substring(0, 50)}..." (Session: ${sessionId})`)

    try {
      // Process through cognitive engine
      const cognitiveResult = await this.cognitive.processUserIntent({
        userId,
        message
      })

      // Store session - adapt CognitiveProcessingResult to CognitiveResult interface
      const adaptedResult = {
        understanding: cognitiveResult.understanding,
        finalConfidence: cognitiveResult.confidence,
        iterationsCompleted: cognitiveResult.feedbackCycleId ? cognitiveResult.learningInsights.length + 1 : 1,
        refinementHistory: cognitiveResult.improvementRecommendations.map((rec, index) => ({
          iteration: index + 1,
          reason: 'System improvement recommendation',
          improvement: rec,
          confidenceChange: 0.05 // Estimate based on recommendations
        }))
      }
      this.activeSessions.set(sessionId, adaptedResult)

              // Track performance
        this.performanceHistory.push({
          sessionId,
          timestamp: new Date().toISOString(),
          confidence: cognitiveResult.confidence,
          iterations: adaptedResult.iterationsCompleted
      })

      this.emit('message:processed', {
        sessionId,
        userId,
        cognitiveResult,
        performance: this.getPerformanceStats()
      })

      return { 
        sessionId,
        cognitiveInsights: {
          understanding: cognitiveResult.understanding,
          confidence: cognitiveResult.confidence,
          iterations: adaptedResult.iterationsCompleted,
          refinements: adaptedResult.refinementHistory.length
        }
      }
    } catch (error) {
      console.error(`❌ Failed to process enhanced user message:`, error)
      
      this.emit('message', {
        id: uuidv4(),
        role: 'assistant',
        content: `I encountered an error processing your request: ${error instanceof Error ? error.message : String(error)}`,
        messageType: 'alert',
        userId,
        createdAt: new Date().toISOString()
      })

      throw error
    }
  }

  /**
   * Collect user feedback on the cognitive processing
   */
  async collectUserFeedback(
    userId: UserId,
    sessionId: string,
    feedback: {
      rating: number // 1-5 scale
      comment?: string
    }
  ): Promise<void> {
    console.log(`📝 Collecting user feedback for session ${sessionId}: ${feedback.rating}/5`)

    try {
      const feedbackData: Partial<FeedbackData> = {
        source: 'user',
        type: 'rating',
        content: feedback,
        metadata: {
          timestamp: new Date().toISOString(),
          context: { sessionId, userId },
          reliability: 1.0
        }
      }

      await this.cognitive.collectUserFeedback(userId, sessionId, feedbackData)

      const historyEntry = this.performanceHistory.find(h => h.sessionId === sessionId)
      if (historyEntry) {
        historyEntry.userSatisfaction = feedback.rating / 5
      }

      this.emit('feedback:collected', userId, sessionId, feedback)

    } catch (error) {
      console.error(`❌ Failed to collect user feedback:`, error)
      throw error
    }
  }

  /**
   * Get enhanced performance statistics
   */
  getEnhancedStats(): Record<string, any> {
    const cognitiveStats = this.cognitive.getCognitiveStats()
    const basicStats = this.getBasicStats()
    
    const recentPerformance = this.performanceHistory.slice(-10)
    const averageConfidence = recentPerformance.length > 0 
      ? recentPerformance.reduce((sum, p) => sum + p.confidence, 0) / recentPerformance.length
      : 0

    return {
      ...basicStats,
      cognitive: cognitiveStats,
      performance: {
        totalSessions: this.performanceHistory.length,
        averageConfidence,
        clarificationRate: this.pendingClarifications.size / Math.max(this.activeSessions.size, 1)
      },
      capabilities: {
        advancedUnderstanding: this.config.enableAdvancedUnderstanding,
        clarificationRequests: this.config.enableClarificationRequests,
        continuousEvaluation: this.config.enableContinuousEvaluation,
        feedbackLearning: this.config.enableLearningFromFeedback
      }
    }
  }

  // Private helper methods

  private getBasicStats() {
    return {
      agents: this.registry.getStats(),
      tasks: {
        active: this.activeTasks.size,
        total: this.activeTasks.size
      },
      runtime: {
        provider: this.config.runtimeProvider,
        initialized: this.isInitialized
      }
    }
  }

  private getPerformanceStats() {
    if (this.performanceHistory.length === 0) {
      return { sessions: 0, averageConfidence: 0, averageIterations: 0 }
    }

    const recent = this.performanceHistory.slice(-10)
    return {
      sessions: this.performanceHistory.length,
      averageConfidence: recent.reduce((sum, p) => sum + p.confidence, 0) / recent.length,
      averageIterations: recent.reduce((sum, p) => sum + p.iterations, 0) / recent.length
    }
  }

  private createRuntimeAdapter(): AgentRuntimeAdapter {
    switch (this.config.runtimeProvider) {
      case 'aws-strand':
        return new StrandAdapter()
      default:
        throw new AgentError(`Unsupported runtime provider: ${this.config.runtimeProvider}`, 'INVALID_RUNTIME')
    }
  }

  private async setupRegistry(): Promise<void> {
    console.log(`📋 Setting up enhanced agent registry...`)
  }

  private setupEventHandlers(): void {
    this.cognitive.on('clarification:required', (sessionId, clarificationData) => {
      const clarificationRequest: ClarificationRequest = {
        sessionId,
        userId: clarificationData.userId,
        questions: clarificationData.questions,
        context: { understanding: clarificationData.understanding }
      }
      
      this.pendingClarifications.set(sessionId, clarificationRequest)
      this.emit('clarification:required', clarificationRequest)
    })

    this.cognitive.on('processing:completed', (sessionId, result) => {
      this.emit('cognitive:processing:completed', sessionId, result)
    })

    this.cognitive.on('cognitive:understanding', (userId, understanding) => {
      this.emit('cognitive:understanding:processed', userId, understanding)
    })
  }

  async cancelTask(taskId: TaskId): Promise<void> {
    const task = this.activeTasks.get(taskId)
    if (!task) return

    console.log(`🛑 Canceling task: ${taskId}`)

    task.status = 'paused'
    task.updatedAt = new Date().toISOString()
    
    this.activeTasks.delete(taskId)
    this.emit('task:cancelled', task)
  }

  getActiveTasks(): Task[] {
    return Array.from(this.activeTasks.values())
  }
}
