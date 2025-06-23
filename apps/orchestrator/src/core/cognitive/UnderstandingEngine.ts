import { EventEmitter } from 'events'
import { UserId } from '@pixell/protocols'
import { ConversationMemoryManager, ConversationMemory } from './ConversationMemory'
import {
  ParsedIntent,
  UserIntent,
  AgentRuntimeAdapter
} from '../AgentRuntimeAdapter'

export interface UnderstandingEngineConfig {
  enableDeepAnalysis?: boolean
  enableAmbiguityDetection?: boolean
  enableContextualInference?: boolean
  enableGoalExtraction?: boolean
  enableConstraintAnalysis?: boolean
  confidenceThreshold?: number
  maxAmbiguityResolutionAttempts?: number
  semanticAnalysisDepth?: 'surface' | 'semantic' | 'strategic' | 'all'
  contextWindowSize?: number
  ambiguityThreshold?: number
}

export interface Goal {
  id: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  measurable: boolean
  deadline?: string
}

export interface Constraint {
  type: 'resource' | 'time' | 'scope' | 'quality' | 'compliance'
  description: string
  severity: 'soft' | 'hard'
  impact: string
}

export interface ContextualInfo {
  domain: string
  complexity: 'simple' | 'moderate' | 'complex' | 'expert'
  urgency: 'low' | 'normal' | 'high' | 'urgent'
  stakeholders: string[]
  relatedProjects: string[]
  technicalRequirements: string[]
}

export interface Ambiguity {
  id: string
  type: 'lexical' | 'syntactic' | 'semantic' | 'pragmatic'
  description: string
  possibleInterpretations: string[]
  confidence: number
  criticality: 'low' | 'medium' | 'high'
}

export interface SuccessCriteria {
  id: string
  description: string
  measurable: boolean
  threshold?: number
  unit?: string
}

export interface RiskFactor {
  id: string
  description: string
  probability: number // 0-1
  impact: 'low' | 'medium' | 'high' | 'critical'
  mitigation?: string
}

export interface CognitiveUnderstanding {
  // Level 1: Surface intent
  surfaceIntent: ParsedIntent
  
  // Level 2: Deep semantic understanding
  semanticIntent: {
    goals: Goal[]
    constraints: Constraint[]
    context: ContextualInfo
    ambiguities: Ambiguity[]
  }
  
  // Level 3: Strategic understanding
  strategicIntent: {
    businessObjectives: string[]
    successCriteria: SuccessCriteria[]
    riskFactors: RiskFactor[]
  }
  
  // Confidence and metadata
  confidence: number
  processingTime: number
  requiresClarification: boolean
}

export interface Question {
  id: string
  text: string
  type: 'yes_no' | 'multiple_choice' | 'open_ended' | 'clarification'
  options?: string[]
  priority: 'low' | 'medium' | 'high'
  relatedAmbiguity?: string
}

export interface UserFeedback {
  questionId: string
  response: string | string[]
  confidence: number
  timestamp: string
}

export interface EnhancedUnderstanding extends CognitiveUnderstanding {
  clarificationHistory: Array<{
    question: Question
    response: UserFeedback
    impact: string
  }>
  refinementIterations: number
}

export interface ClarificationEngine {
  detectAmbiguities(intent: CognitiveUnderstanding): Ambiguity[]
  generateClarificationQuestions(ambiguities: Ambiguity[]): Question[]
  incorporateFeedback(originalUnderstanding: CognitiveUnderstanding, feedback: UserFeedback, userId: string): Promise<EnhancedUnderstanding>
}

/**
 * UnderstandingEngine - Enhanced cognitive understanding with multi-level processing
 * 
 * Provides sophisticated intent understanding through:
 * - Multi-level intent processing (surface, semantic, strategic)
 * - Context-aware interpretation using conversation memory
 * - Ambiguity detection and clarification
 * - Iterative refinement through user feedback
 */
export class UnderstandingEngine extends EventEmitter implements ClarificationEngine {
  private memory: ConversationMemoryManager
  private runtime: AgentRuntimeAdapter
  private config: UnderstandingEngineConfig
  private clarificationHistory = new Map<string, Array<{ question: Question; response: UserFeedback; impact: string }>>()
  
  constructor(memory: ConversationMemoryManager, runtime: AgentRuntimeAdapter, config: UnderstandingEngineConfig = {}) {
    super()
    this.memory = memory
    this.runtime = runtime
    this.config = {
      enableDeepAnalysis: true,
      enableAmbiguityDetection: true,
      enableContextualInference: true,
      enableGoalExtraction: true,
      enableConstraintAnalysis: true,
      confidenceThreshold: 0.7,
      maxAmbiguityResolutionAttempts: 3,
      semanticAnalysisDepth: 'all',
      contextWindowSize: 10,
      ambiguityThreshold: 0.6,
      ...config
    }
    
    console.log('🧠 UnderstandingEngine initialized with enhanced cognitive capabilities')
  }

  /**
   * Process user input string (convenience method)
   */
  async processUserInput(userInput: string): Promise<CognitiveUnderstanding> {
    const userIntent: UserIntent = {
      message: userInput,
      userId: 'default-user' // TODO: get from context
    }
    return this.processIntent(userIntent)
  }

  /**
   * Process user intent with enhanced cognitive understanding
   */
  async processIntent(userIntent: UserIntent): Promise<CognitiveUnderstanding> {
    const startTime = Date.now()
    
    try {
      // Get conversation context
      const conversationMemory = await this.memory.getContext(userIntent.userId)
      
      // Level 1: Surface intent parsing
      const surfaceIntent = await this.runtime.parseIntent(userIntent)
      
      // Level 2: Deep semantic understanding
      const semanticIntent = await this.performSemanticAnalysis(
        userIntent,
        surfaceIntent,
        conversationMemory
      )
      
      // Level 3: Strategic understanding
      const strategicIntent = await this.performStrategicAnalysis(
        userIntent,
        surfaceIntent,
        semanticIntent,
        conversationMemory
      )
      
      // Calculate overall confidence
      const confidence = this.calculateConfidence(surfaceIntent, semanticIntent, strategicIntent)
      
      // Detect if clarification is needed
      const requiresClarification = semanticIntent.ambiguities.length > 0 && 
        semanticIntent.ambiguities.some(a => a.criticality === 'high')
        
      const understanding: CognitiveUnderstanding = {
        surfaceIntent,
        semanticIntent,
        strategicIntent,
        confidence,
        processingTime: Date.now() - startTime,
        requiresClarification
      }

      // Store understanding in memory
      await this.storeUnderstanding(userIntent.userId, understanding)
      
      this.emit('understanding:processed', userIntent.userId, understanding)
      
      return understanding
      
    } catch (error) {
      this.emit('understanding:error', userIntent.userId, error)
      throw error
    }
  }

  /**
   * Detect ambiguities in the understanding
   */
  detectAmbiguities(intent: CognitiveUnderstanding): Ambiguity[] {
    return intent.semanticIntent.ambiguities
  }

  /**
   * Generate clarification questions for detected ambiguities
   */
  generateClarificationQuestions(ambiguities: Ambiguity[]): Question[] {
    const questions: Question[] = []
    
    // Sort ambiguities by criticality
    const sortedAmbiguities = ambiguities.sort((a, b) => {
      const criticalityOrder = { 'high': 3, 'medium': 2, 'low': 1 }
      return criticalityOrder[b.criticality] - criticalityOrder[a.criticality]
    })

    sortedAmbiguities.forEach((ambiguity, index) => {
      const question = this.createQuestionForAmbiguity(ambiguity, index)
      if (question) {
        questions.push(question)
      }
    })

    return questions.slice(0, 3) // Limit to top 3 questions to avoid overwhelming user
  }

  /**
   * Incorporate user feedback to refine understanding
   */
  async incorporateFeedback(
    originalUnderstanding: CognitiveUnderstanding,
    feedback: UserFeedback,
    userId: UserId
  ): Promise<EnhancedUnderstanding> {
    const clarificationHistory = this.clarificationHistory.get(userId) || []
    
    // Find the related question
    const relatedQuestion = this.findQuestionById(feedback.questionId)
    if (!relatedQuestion) {
      throw new Error(`Question with ID ${feedback.questionId} not found`)
    }

    // Apply feedback to understanding
    const refinedUnderstanding = await this.applyFeedback(
      originalUnderstanding,
      feedback,
      relatedQuestion
    )

    // Update clarification history
    clarificationHistory.push({
      question: relatedQuestion,
      response: feedback,
      impact: this.assessFeedbackImpact(originalUnderstanding, refinedUnderstanding)
    })
    this.clarificationHistory.set(userId, clarificationHistory)

    const enhancedUnderstanding: EnhancedUnderstanding = {
      ...refinedUnderstanding,
      clarificationHistory,
      refinementIterations: clarificationHistory.length
    }

    // Update memory with refined understanding
    await this.storeUnderstanding(userId, enhancedUnderstanding)
    
    this.emit('understanding:refined', userId, enhancedUnderstanding)
    
    return enhancedUnderstanding
  }

  /**
   * Get clarification questions for a user's understanding
   */
  async getClarificationQuestions(
    userId: UserId,
    understanding: CognitiveUnderstanding
  ): Promise<Question[]> {
    const ambiguities = this.detectAmbiguities(understanding)
    
    if (ambiguities.length === 0) {
      return []
    }

    // Filter out ambiguities we've already clarified
    const history = this.clarificationHistory.get(userId) || []
    const clarifiedAmbiguities = new Set(
      history.map(h => h.question.relatedAmbiguity).filter(Boolean)
    )
    
    const unclarifiedAmbiguities = ambiguities.filter(
      a => !clarifiedAmbiguities.has(a.id)
    )

    return this.generateClarificationQuestions(unclarifiedAmbiguities)
  }

  /**
   * Check if understanding needs clarification
   */
  needsClarification(understanding: CognitiveUnderstanding): boolean {
    return understanding.requiresClarification || 
           understanding.confidence < 0.7 ||
           understanding.semanticIntent.ambiguities.some(a => a.criticality === 'high')
  }

  /**
   * Get understanding statistics for a user
   */
  getUnderstandingStats(userId: UserId): Record<string, any> {
    const history = this.clarificationHistory.get(userId) || []
    
    return {
      totalClarifications: history.length,
      averageRefinementImpact: this.calculateAverageImpact(history),
      topAmbiguityTypes: this.getTopAmbiguityTypes(history),
      clarificationSuccessRate: this.calculateSuccessRate(history)
    }
  }

  // Private implementation methods

  private async performSemanticAnalysis(
    userIntent: UserIntent,
    surfaceIntent: ParsedIntent,
    memory: ConversationMemory | null
  ): Promise<{
    goals: Goal[]
    constraints: Constraint[]
    context: ContextualInfo
    ambiguities: Ambiguity[]
  }> {
    // Extract goals from intent
    const goals = await this.extractGoals(userIntent.message, surfaceIntent, memory)
    
    // Identify constraints
    const constraints = await this.identifyConstraints(userIntent.message, memory)
    
    // Build contextual information
    const context = await this.buildContext(userIntent, memory)
    
    // Detect ambiguities
    const ambiguities = await this.detectAmbiguitiesInMessage(userIntent.message, surfaceIntent)

    return { goals, constraints, context, ambiguities }
  }

  private async performStrategicAnalysis(
    userIntent: UserIntent,
    surfaceIntent: ParsedIntent,
    semanticIntent: any,
    memory: ConversationMemory | null
  ): Promise<{
    businessObjectives: string[]
    successCriteria: SuccessCriteria[]
    riskFactors: RiskFactor[]
  }> {
    // Infer business objectives
    const businessObjectives = await this.inferBusinessObjectives(
      userIntent,
      semanticIntent,
      memory
    )
    
    // Define success criteria
    const successCriteria = await this.defineSuccessCriteria(
      semanticIntent.goals,
      businessObjectives
    )
    
    // Assess risk factors
    const riskFactors = await this.assessRiskFactors(
      userIntent,
      semanticIntent,
      memory
    )

    return { businessObjectives, successCriteria, riskFactors }
  }

  private async extractGoals(
    message: string,
    surfaceIntent: ParsedIntent,
    memory: ConversationMemory | null
  ): Promise<Goal[]> {
    const goals: Goal[] = []
    
    // Extract explicit goals using patterns
    const goalPatterns = [
      /I want to (.+)/gi,
      /I need to (.+)/gi,
      /help me (.+)/gi,
      /can you (.+)/gi,
      /please (.+)/gi
    ]

    goalPatterns.forEach((pattern, index) => {
      const matches = message.match(pattern)
      if (matches) {
        matches.forEach(match => {
          goals.push({
            id: `goal-${index}-${goals.length}`,
            description: match.replace(pattern, '$1').trim(),
            priority: this.inferPriority(match, message),
            measurable: this.isMeasurable(match)
          })
        })
      }
    })

    // Add implicit goals based on surface intent
    if (surfaceIntent.action && goals.length === 0) {
      goals.push({
        id: 'implicit-goal',
        description: `Execute ${surfaceIntent.action}`,
        priority: 'medium',
        measurable: false
      })
    }

    return goals
  }

  private async identifyConstraints(
    message: string,
    memory: ConversationMemory | null
  ): Promise<Constraint[]> {
    const constraints: Constraint[] = []
    
    // Look for time constraints
    const timePatterns = [
      /by (.+day|.+week|.+month|tomorrow|today|asap|urgent)/gi,
      /deadline (.+)/gi,
      /within (.+)/gi
    ]

    timePatterns.forEach(pattern => {
      const matches = message.match(pattern)
      if (matches) {
        matches.forEach(match => {
          constraints.push({
            type: 'time',
            description: `Time constraint: ${match}`,
            severity: match.includes('urgent') || match.includes('asap') ? 'hard' : 'soft',
            impact: 'Affects delivery timeline'
          })
        })
      }
    })

    // Look for resource constraints
    if (message.includes('budget') || message.includes('cost') || message.includes('cheap')) {
      constraints.push({
        type: 'resource',
        description: 'Budget/cost consideration mentioned',
        severity: 'soft',
        impact: 'May limit available options'
      })
    }

    // Consider user preferences from memory
    if (memory?.longTerm.riskTolerance === 'low') {
      constraints.push({
        type: 'quality',
        description: 'User has low risk tolerance',
        severity: 'hard',
        impact: 'Requires conservative approach'
      })
    }

    return constraints
  }

  private async buildContext(
    userIntent: UserIntent,
    memory: ConversationMemory | null
  ): Promise<ContextualInfo> {
    // Infer domain from message and memory
    const domain = await this.inferDomain(userIntent.message, memory)
    
    // Assess complexity
    const complexity = this.assessComplexity(userIntent.message)
    
    // Determine urgency
    const urgency = this.determineUrgency(userIntent.message)
    
    // Extract stakeholders
    const stakeholders = this.extractStakeholders(userIntent.message)
    
    // Find related projects from memory
    const relatedProjects = memory ? 
      memory.projectContext.activeProjects.map(p => p.name) : 
      []
    
    // Extract technical requirements
    const technicalRequirements = this.extractTechnicalRequirements(userIntent.message)

    return {
      domain,
      complexity,
      urgency,
      stakeholders,
      relatedProjects,
      technicalRequirements
    }
  }

  private async detectAmbiguitiesInMessage(
    message: string,
    surfaceIntent: ParsedIntent
  ): Promise<Ambiguity[]> {
    const ambiguities: Ambiguity[] = []
    
    // Detect pronouns without clear referents
    const pronouns = message.match(/\b(it|this|that|they|them|these|those)\b/gi)
    if (pronouns && pronouns.length > 2) {
      ambiguities.push({
        id: `ambiguity-pronoun-${Date.now()}`,
        type: 'semantic',
        description: 'Multiple pronouns with unclear referents',
        possibleInterpretations: ['Could refer to different entities mentioned'],
        confidence: 0.8,
        criticality: 'medium'
      })
    }

    // Detect vague quantifiers
    const vague = message.match(/\b(some|many|few|several|most|a lot)\b/gi)
    if (vague) {
      ambiguities.push({
        id: `ambiguity-quantifier-${Date.now()}`,
        type: 'semantic',
        description: 'Vague quantifiers used',
        possibleInterpretations: vague.map(v => `"${v}" could mean different amounts`),
        confidence: 0.7,
        criticality: 'medium'
      })
    }

    // Detect modal verbs indicating uncertainty
    const modals = message.match(/\b(might|could|should|would|may)\b/gi)
    if (modals && modals.length > 1) {
      ambiguities.push({
        id: `ambiguity-modal-${Date.now()}`,
        type: 'pragmatic',
        description: 'Multiple modal verbs indicating uncertainty',
        possibleInterpretations: ['Different levels of certainty or requirement'],
        confidence: 0.6,
        criticality: 'low'
      })
    }

    // Check surface intent confidence
    if (surfaceIntent.confidence < 0.8) {
      ambiguities.push({
        id: `ambiguity-intent-${Date.now()}`,
        type: 'semantic',
        description: 'Low confidence in intent classification',
        possibleInterpretations: ['Multiple possible intents'],
        confidence: 1 - surfaceIntent.confidence,
        criticality: 'high'
      })
    }

    return ambiguities
  }

  private calculateConfidence(
    surfaceIntent: ParsedIntent,
    semanticIntent: any,
    strategicIntent: any
  ): number {
    let confidence = surfaceIntent.confidence * 0.4 // 40% weight to surface
    
    // Reduce confidence based on ambiguities
    const highCriticalityAmbiguities = semanticIntent.ambiguities.filter(
      (a: Ambiguity) => a.criticality === 'high'
    ).length
    confidence -= highCriticalityAmbiguities * 0.2
    
    // Increase confidence if we have clear goals
    if (semanticIntent.goals.length > 0) {
      confidence += 0.1
    }
    
    // Increase confidence if we have business objectives
    if (strategicIntent.businessObjectives.length > 0) {
      confidence += 0.1
    }
    
    return Math.max(0, Math.min(1, confidence))
  }

  private createQuestionForAmbiguity(ambiguity: Ambiguity, index: number): Question | null {
    switch (ambiguity.type) {
      case 'semantic':
        if (ambiguity.description.includes('pronouns')) {
          return {
            id: `clarify-${ambiguity.id}`,
            text: 'I noticed some unclear references in your message. Could you be more specific about what "it" or "this" refers to?',
            type: 'open_ended',
            priority: 'medium',
            relatedAmbiguity: ambiguity.id
          }
        }
        break
        
      case 'pragmatic':
        return {
          id: `clarify-${ambiguity.id}`,
          text: 'I want to make sure I understand your requirements correctly. Is this a definite requirement or a preference?',
          type: 'multiple_choice',
          options: ['Definite requirement', 'Strong preference', 'Nice to have', 'Optional'],
          priority: 'medium',
          relatedAmbiguity: ambiguity.id
        }
        
      default:
        return {
          id: `clarify-${ambiguity.id}`,
          text: `Could you clarify: ${ambiguity.description}`,
          type: 'open_ended',
          priority: ambiguity.criticality === 'high' ? 'high' : 'medium',
          relatedAmbiguity: ambiguity.id
        }
    }
  }

  // Additional helper methods
  private inferPriority(match: string, fullMessage: string): 'low' | 'medium' | 'high' | 'critical' {
    if (match.includes('urgent') || match.includes('asap') || fullMessage.includes('critical')) {
      return 'critical'
    }
    if (match.includes('important') || match.includes('need')) {
      return 'high'
    }
    if (match.includes('want') || match.includes('would like')) {
      return 'medium'
    }
    return 'low'
  }

  private isMeasurable(goal: string): boolean {
    const measurableKeywords = ['number', 'count', 'percent', 'score', 'rating', 'time', 'date', 'amount']
    return measurableKeywords.some(keyword => goal.toLowerCase().includes(keyword))
  }

  private inferDomain(message: string, memory: ConversationMemory | null): string {
    // Check user's domain expertise from memory
    if (memory?.longTerm.domainExpertise.length > 0) {
      for (const domain of memory.longTerm.domainExpertise) {
        if (message.toLowerCase().includes(domain.toLowerCase())) {
          return domain
        }
      }
    }
    
    // Simple domain inference
    if (message.includes('data') || message.includes('analysis') || message.includes('chart')) {
      return 'data-analytics'
    }
    if (message.includes('reddit') || message.includes('social')) {
      return 'social-media'
    }
    if (message.includes('code') || message.includes('programming')) {
      return 'software-development'
    }
    
    return 'general'
  }

  private assessComplexity(message: string): 'simple' | 'moderate' | 'complex' | 'expert' {
    const words = message.split(' ').length
    const sentences = message.split(/[.!?]+/).length
    const technicalTerms = (message.match(/\b[A-Z]{2,}\b/g) || []).length
    
    if (words < 10 && sentences <= 1 && technicalTerms === 0) return 'simple'
    if (words < 30 && sentences <= 3 && technicalTerms <= 2) return 'moderate'
    if (words < 60 && sentences <= 5 && technicalTerms <= 5) return 'complex'
    return 'expert'
  }

  private determineUrgency(message: string): 'low' | 'normal' | 'high' | 'urgent' {
    const urgentKeywords = ['urgent', 'asap', 'immediately', 'now', 'critical']
    const highKeywords = ['soon', 'quickly', 'fast', 'priority']
    
    if (urgentKeywords.some(keyword => message.toLowerCase().includes(keyword))) return 'urgent'
    if (highKeywords.some(keyword => message.toLowerCase().includes(keyword))) return 'high'
    return 'normal'
  }

  private extractStakeholders(message: string): string[] {
    const stakeholders: string[] = []
    const patterns = [
      /for (.+team|.+group|.+department)/gi,
      /with (.+team|.+group|.+people)/gi,
      /@(\w+)/g
    ]
    
    patterns.forEach(pattern => {
      const matches = message.match(pattern)
      if (matches) {
        stakeholders.push(...matches.map(m => m.replace(pattern, '$1').trim()))
      }
    })
    
    return [...new Set(stakeholders)]
  }

  private extractTechnicalRequirements(message: string): string[] {
    const requirements: string[] = []
    
    // Look for technical specifications
    const techPatterns = [
      /using (.+)/gi,
      /with (.+api|.+framework|.+library)/gi,
      /format (.+)/gi,
      /type (.+)/gi
    ]
    
    techPatterns.forEach(pattern => {
      const matches = message.match(pattern)
      if (matches) {
        requirements.push(...matches.map(m => m.trim()))
      }
    })
    
    return [...new Set(requirements)]
  }

  private async storeUnderstanding(userId: UserId, understanding: CognitiveUnderstanding): Promise<void> {
    // Store understanding in working memory for future reference
    await this.memory.storeMessage(userId, {
      id: `understanding-${Date.now()}`,
      role: 'assistant',
      content: `Understanding processed: ${understanding.confidence.toFixed(2)} confidence`,
      metadata: {
        understanding: understanding,
        goals: understanding.semanticIntent.goals.length,
        ambiguities: understanding.semanticIntent.ambiguities.length
      }
    })
  }

  private async inferBusinessObjectives(
    userIntent: UserIntent,
    semanticIntent: any,
    memory: ConversationMemory | null
  ): Promise<string[]> {
    const objectives: string[] = []
    
    // Infer from goals
    semanticIntent.goals.forEach((goal: Goal) => {
      if (goal.description.includes('efficiency') || goal.description.includes('automate')) {
        objectives.push('Operational Efficiency')
      }
      if (goal.description.includes('analysis') || goal.description.includes('insight')) {
        objectives.push('Data-Driven Decision Making')
      }
      if (goal.description.includes('user') || goal.description.includes('customer')) {
        objectives.push('User Experience Enhancement')
      }
    })
    
    return [...new Set(objectives)]
  }

  private async defineSuccessCriteria(
    goals: Goal[],
    businessObjectives: string[]
  ): Promise<SuccessCriteria[]> {
    const criteria: SuccessCriteria[] = []
    
    goals.forEach(goal => {
      criteria.push({
        id: `criteria-${goal.id}`,
        description: `Successful completion of: ${goal.description}`,
        measurable: goal.measurable,
        threshold: goal.measurable ? 100 : undefined,
        unit: goal.measurable ? 'percent' : undefined
      })
    })
    
    return criteria
  }

  private async assessRiskFactors(
    userIntent: UserIntent,
    semanticIntent: any,
    memory: ConversationMemory | null
  ): Promise<RiskFactor[]> {
    const risks: RiskFactor[] = []
    
    // Assess based on complexity
    if (semanticIntent.context.complexity === 'expert') {
      risks.push({
        id: 'complexity-risk',
        description: 'High complexity may lead to longer execution time',
        probability: 0.7,
        impact: 'medium',
        mitigation: 'Break down into smaller, manageable tasks'
      })
    }
    
    // Assess based on ambiguities
    if (semanticIntent.ambiguities.length > 2) {
      risks.push({
        id: 'ambiguity-risk',
        description: 'Multiple ambiguities may lead to incorrect execution',
        probability: 0.8,
        impact: 'high',
        mitigation: 'Seek clarification before proceeding'
      })
    }
    
    return risks
  }

  private findQuestionById(questionId: string): Question | null {
    // In a real implementation, this would search through stored questions
    // For now, return null
    return null
  }

  private async applyFeedback(
    originalUnderstanding: CognitiveUnderstanding,
    feedback: UserFeedback,
    question: Question
  ): Promise<CognitiveUnderstanding> {
    // Create a copy of the original understanding
    const refined = JSON.parse(JSON.stringify(originalUnderstanding))
    
    // Apply feedback based on question type and related ambiguity
    if (question.relatedAmbiguity) {
      const ambiguityIndex = refined.semanticIntent.ambiguities.findIndex(
        (a: Ambiguity) => a.id === question.relatedAmbiguity
      )
      
      if (ambiguityIndex >= 0) {
        // Remove the resolved ambiguity
        refined.semanticIntent.ambiguities.splice(ambiguityIndex, 1)
        
        // Increase confidence
        refined.confidence = Math.min(refined.confidence + 0.2, 1.0)
        
        // Update requirement flag
        refined.requiresClarification = refined.semanticIntent.ambiguities.some(
          (a: Ambiguity) => a.criticality === 'high'
        )
      }
    }
    
    return refined
  }

  private assessFeedbackImpact(
    original: CognitiveUnderstanding,
    refined: CognitiveUnderstanding
  ): string {
    const confidenceImprovement = refined.confidence - original.confidence
    const ambiguitiesResolved = original.semanticIntent.ambiguities.length - refined.semanticIntent.ambiguities.length
    
    if (confidenceImprovement > 0.15 || ambiguitiesResolved > 1) {
      return 'High impact: Significantly improved understanding'
    } else if (confidenceImprovement > 0.05 || ambiguitiesResolved > 0) {
      return 'Medium impact: Improved clarity'
    } else {
      return 'Low impact: Minor refinement'
    }
  }

  private calculateAverageImpact(history: Array<{ impact: string }>): number {
    if (history.length === 0) return 0
    
    const impactScores = history.map(h => {
      if (h.impact.includes('High')) return 3
      if (h.impact.includes('Medium')) return 2
      return 1
    })
    
    return impactScores.reduce((sum, score) => sum + score, 0) / impactScores.length
  }

  private getTopAmbiguityTypes(history: Array<{ question: Question }>): string[] {
    const types = history
      .map(h => h.question.type)
      .reduce((acc, type) => {
        acc[type] = (acc[type] || 0) + 1
        return acc
      }, {} as Record<string, number>)
    
    return Object.entries(types)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([type]) => type)
  }

  private calculateSuccessRate(history: Array<{ impact: string }>): number {
    if (history.length === 0) return 0
    
    const successful = history.filter(h => 
      h.impact.includes('High') || h.impact.includes('Medium')
    ).length
    
    return successful / history.length
  }
} 