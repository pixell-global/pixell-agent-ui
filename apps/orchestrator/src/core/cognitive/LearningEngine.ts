import { EventEmitter } from 'events'
import { v4 as uuidv4 } from 'uuid'
import { UserId, TaskId } from '@pixell/protocols'
import { CognitiveUnderstanding } from './UnderstandingEngine'
import { ExecutionPlan } from './AdvancedPlanningEngine'
import { ExecutionState } from './ExecutionMonitor'
import { TaskEvaluationResult } from './EvaluationEngine'
import { FeedbackCycle, Issue, AppliedRefinement } from './FeedbackLoopEngine'

export interface LearningExample {
  id: string
  type: 'success' | 'failure' | 'partial_success'
  timestamp: string
  userId: UserId
  sessionId: string
  
  // Context
  understanding: CognitiveUnderstanding
  plan: ExecutionPlan
  executionResults: ExecutionState
  evaluationResults: TaskEvaluationResult[]
  
  // Learning metadata
  domain: string
  complexity: 'low' | 'medium' | 'high'
  successFactors: string[]
  failureFactors: string[]
  lessonsLearned: string[]
  applicableScenarios: string[]
  confidence: number
  
  // Outcome metrics
  outcomeMetrics: {
    successRate: number
    efficiency: number
    resourceUtilization: number
    userSatisfaction?: number
    executionTime: number
    cost: number
  }
}

export interface LearningPattern {
  id: string
  name: string
  description: string
  category: 'planning' | 'execution' | 'understanding' | 'evaluation' | 'general'
  
  // Pattern characteristics
  conditions: Array<{
    field: string
    operator: 'eq' | 'gt' | 'lt' | 'contains' | 'matches'
    value: any
  }>
  
  // Pattern insights
  successFactors: Array<{
    factor: string
    importance: number
    confidence: number
    applicability: string[]
  }>
  
  failureIndicators: Array<{
    indicator: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    preventionStrategy: string
    earlyWarningSignals: string[]
  }>
  
  // Pattern statistics
  frequency: number
  successRate: number
  avgConfidenceImprovement: number
  applicableDomains: string[]
  lastSeen: string
  
  // Actionable insights
  recommendations: Array<{
    condition: string
    action: string
    expectedOutcome: string
    confidence: number
  }>
}

export interface KnowledgeBase {
  patterns: LearningPattern[]
  successStrategies: SuccessStrategy[]
  failureMitigations: FailureMitigation[]
  domainKnowledge: DomainKnowledge[]
  bestPractices: BestPractice[]
}

export interface SuccessStrategy {
  id: string
  name: string
  description: string
  applicableDomains: string[]
  successRate: number
  avgImprovement: number
  
  conditions: string[]
  steps: Array<{
    step: string
    description: string
    importance: number
  }>
  
  evidence: string[]
  confidence: number
  usageCount: number
  lastUsed: string
}

export interface FailureMitigation {
  id: string
  failureType: string
  description: string
  
  earlyWarningSignals: string[]
  preventionStrategies: string[]
  recoveryActions: string[]
  
  effectiveness: number
  applicability: string[]
  confidence: number
  
  examples: string[]
  lastUpdated: string
}

export interface DomainKnowledge {
  domain: string
  characteristics: Record<string, any>
  commonPatterns: string[]
  successFactors: string[]
  typicalChallenges: string[]
  bestPractices: string[]
  avgComplexity: number
  avgSuccessRate: number
  knowledgeConfidence: number
}

export interface BestPractice {
  id: string
  title: string
  description: string
  category: string
  applicableScenarios: string[]
  impact: 'low' | 'medium' | 'high'
  confidence: number
  evidenceCount: number
  lastValidated: string
}

export interface LearningInsight {
  id: string
  type: 'pattern_discovered' | 'strategy_validated' | 'improvement_identified' | 'risk_detected'
  title: string
  description: string
  confidence: number
  actionable: boolean
  priority: 'low' | 'medium' | 'high' | 'critical'
  
  evidence: string[]
  recommendations: string[]
  potentialImpact: string
  
  applicableTo: string[]
  validatedBy: string[]
  timestamp: string
}

export interface LearningConfig {
  enablePatternRecognition: boolean
  enableSuccessAnalysis: boolean
  enableFailureAnalysis: boolean
  minExamplesForPattern: number
  patternConfidenceThreshold: number
  learningRetentionDays: number
  knowledgeUpdateFrequency: 'realtime' | 'hourly' | 'daily'
  insightGenerationEnabled: boolean
  crossDomainLearningEnabled: boolean
}

/**
 * LearningEngine - Phase 3 systematic learning from successes and failures
 * 
 * Phase 3 Implementation Features:
 * - Learning from successful and failed execution cycles
 * - Pattern recognition across different scenarios and domains
 * - Knowledge accumulation and retrieval for future improvements
 * - Success strategy identification and validation
 * - Failure mitigation strategy development
 * - Cross-domain learning and knowledge transfer
 * - Actionable insight generation for continuous improvement
 */
export class LearningEngine extends EventEmitter {
  private config: LearningConfig
  private learningExamples: LearningExample[] = []
  private knowledgeBase: KnowledgeBase = {
    patterns: [],
    successStrategies: [],
    failureMitigations: [],
    domainKnowledge: [],
    bestPractices: []
  }
  private recentInsights: LearningInsight[] = []
  
  private metrics = {
    totalExamples: 0,
    successExamples: 0,
    failureExamples: 0,
    patternsDiscovered: 0,
    strategiesValidated: 0,
    mitigationsDeveloped: 0,
    insightsGenerated: 0,
    knowledgeApplications: 0,
    avgLearningAccuracy: 0
  }

  constructor(config: LearningConfig) {
    super()
    this.config = config
    this.initializeLearningSystem()
  }

  /**
   * Learn from a completed feedback cycle
   */
  async learnFromCycle(
    cycle: FeedbackCycle,
    understanding: CognitiveUnderstanding,
    plan: ExecutionPlan,
    executionResults: ExecutionState,
    evaluationResults: TaskEvaluationResult[]
  ): Promise<LearningInsight[]> {
    console.log(`🧠 Learning from cycle: ${cycle.id}`)

    // Create learning example
    const example = await this.createLearningExample(
      cycle, understanding, plan, executionResults, evaluationResults
    )

    this.learningExamples.push(example)
    this.metrics.totalExamples++

    if (example.type === 'success') {
      this.metrics.successExamples++
    } else {
      this.metrics.failureExamples++
    }

    // Keep learning examples manageable
    if (this.learningExamples.length > 1000) {
      this.learningExamples = this.learningExamples.slice(-500)
    }

    const insights: LearningInsight[] = []

    // Pattern recognition
    if (this.config.enablePatternRecognition) {
      const patternInsights = await this.recognizePatterns(example)
      insights.push(...patternInsights)
    }

    // Success analysis
    if (this.config.enableSuccessAnalysis && example.type === 'success') {
      const successInsights = await this.analyzeSuccess(example)
      insights.push(...successInsights)
    }

    // Failure analysis
    if (this.config.enableFailureAnalysis && example.type === 'failure') {
      const failureInsights = await this.analyzeFailure(example)
      insights.push(...failureInsights)
    }

    // Update knowledge base
    await this.updateKnowledgeBase(example, insights)

    // Store insights
    this.recentInsights.push(...insights)
    this.metrics.insightsGenerated += insights.length

    // Keep recent insights manageable
    if (this.recentInsights.length > 100) {
      this.recentInsights = this.recentInsights.slice(-50)
    }

    console.log(`✅ Generated ${insights.length} learning insights from cycle ${cycle.id}`)
    this.emit('learning:completed', cycle.id, insights)

    return insights
  }

  /**
   * Get relevant knowledge for a new scenario
   */
  async getRelevantKnowledge(
    understanding: CognitiveUnderstanding,
    domain?: string
  ): Promise<{
    patterns: LearningPattern[]
    strategies: SuccessStrategy[]
    mitigations: FailureMitigation[]
    bestPractices: BestPractice[]
    recommendations: string[]
  }> {
    console.log(`🔍 Retrieving relevant knowledge for domain: ${domain || 'general'}`)

    const targetDomain = domain || understanding.semanticIntent.context.domain || 'general'
    const complexity = understanding.semanticIntent.context.complexity || 'medium'

    // Find relevant patterns
    const relevantPatterns = this.knowledgeBase.patterns.filter(pattern =>
      pattern.applicableDomains.includes(targetDomain) ||
      pattern.applicableDomains.includes('general')
    ).slice(0, 5)

    // Find applicable success strategies
    const relevantStrategies = this.knowledgeBase.successStrategies.filter(strategy =>
      strategy.applicableDomains.includes(targetDomain) ||
      strategy.applicableDomains.includes('general')
    ).sort((a, b) => b.successRate - a.successRate).slice(0, 3)

    // Find relevant failure mitigations
    const relevantMitigations = this.knowledgeBase.failureMitigations.filter(mitigation =>
      mitigation.applicability.includes(targetDomain) ||
      mitigation.applicability.includes('general')
    ).sort((a, b) => b.effectiveness - a.effectiveness).slice(0, 3)

    // Find applicable best practices
    const relevantBestPractices = this.knowledgeBase.bestPractices.filter(practice =>
      practice.applicableScenarios.some(scenario => 
        scenario.includes(targetDomain) || scenario.includes(complexity)
      )
    ).sort((a, b) => b.confidence - a.confidence).slice(0, 5)

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      understanding, relevantPatterns, relevantStrategies, relevantMitigations
    )

    this.metrics.knowledgeApplications++

    console.log(`✅ Retrieved knowledge: ${relevantPatterns.length} patterns, ${relevantStrategies.length} strategies, ${relevantMitigations.length} mitigations`)

    return {
      patterns: relevantPatterns,
      strategies: relevantStrategies,
      mitigations: relevantMitigations,
      bestPractices: relevantBestPractices,
      recommendations
    }
  }

  /**
   * Learn from task failure
   */
  async learnFromFailure(
    taskId: TaskId,
    understanding: CognitiveUnderstanding,
    plan: ExecutionPlan,
    failureReason: string,
    failureContext: Record<string, any>
  ): Promise<FailureMitigation[]> {
    console.log(`📚 Learning from task failure: ${taskId}`)

    const failureType = this.classifyFailureType(failureReason, failureContext)
    
    // Check if we have existing mitigation for this failure type
    let mitigation = this.knowledgeBase.failureMitigations.find(m => 
      m.failureType === failureType
    )

    if (mitigation) {
      // Update existing mitigation with new example
      mitigation.examples.push(`Task ${taskId}: ${failureReason}`)
      mitigation.lastUpdated = new Date().toISOString()
      mitigation.confidence = Math.min(1, mitigation.confidence + 0.05)
    } else {
      // Create new failure mitigation
      mitigation = {
        id: uuidv4(),
        failureType,
        description: `Mitigation strategy for ${failureType} failures`,
        earlyWarningSignals: this.identifyWarningSignals(failureReason, failureContext),
        preventionStrategies: this.generatePreventionStrategies(failureType, understanding),
        recoveryActions: this.generateRecoveryActions(failureType, plan),
        effectiveness: 0.7, // Initial estimate
        applicability: [understanding.semanticIntent.context.domain || 'general'],
        confidence: 0.6,
        examples: [`Task ${taskId}: ${failureReason}`],
        lastUpdated: new Date().toISOString()
      }

      this.knowledgeBase.failureMitigations.push(mitigation)
      this.metrics.mitigationsDeveloped++
    }

    console.log(`✅ Updated failure mitigation for ${failureType}`)
    this.emit('failure:learned', taskId, mitigation)

    return [mitigation]
  }

  /**
   * Validate and update success strategies
   */
  async validateSuccessStrategy(
    strategyId: string,
    outcome: {
      success: boolean
      improvement: number
      confidence: number
    }
  ): Promise<void> {
    const strategy = this.knowledgeBase.successStrategies.find(s => s.id === strategyId)
    if (!strategy) return

    console.log(`📊 Validating success strategy: ${strategy.name}`)

    strategy.usageCount++
    strategy.lastUsed = new Date().toISOString()

    if (outcome.success) {
      strategy.successRate = (strategy.successRate * (strategy.usageCount - 1) + 1) / strategy.usageCount
      strategy.avgImprovement = (strategy.avgImprovement * (strategy.usageCount - 1) + outcome.improvement) / strategy.usageCount
      strategy.confidence = Math.min(1, strategy.confidence + 0.02)
      
      this.metrics.strategiesValidated++
    } else {
      strategy.successRate = (strategy.successRate * (strategy.usageCount - 1)) / strategy.usageCount
      strategy.confidence = Math.max(0.1, strategy.confidence - 0.05)
    }

    console.log(`✅ Strategy ${strategy.name} validation: ${outcome.success ? 'SUCCESS' : 'FAILURE'}`)
    this.emit('strategy:validated', strategyId, outcome)
  }

  /**
   * Get learning insights and recommendations
   */
  getRecentInsights(limit: number = 10): LearningInsight[] {
    return this.recentInsights
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit)
  }

  /**
   * Get learning engine statistics
   */
  getLearningStats(): Record<string, any> {
    const domainStats = this.calculateDomainStats()
    const patternStats = this.calculatePatternStats()
    const knowledgeBaseStats = this.calculateKnowledgeBaseStats()

    return {
      ...this.metrics,
      knowledgeBase: knowledgeBaseStats,
      domains: domainStats,
      patterns: patternStats,
      recentInsights: this.recentInsights.length,
      learningAccuracy: this.calculateLearningAccuracy(),
      configuration: {
        patternRecognition: this.config.enablePatternRecognition,
        successAnalysis: this.config.enableSuccessAnalysis,
        failureAnalysis: this.config.enableFailureAnalysis,
        crossDomainLearning: this.config.crossDomainLearningEnabled
      }
    }
  }

  // Private implementation methods

  private async createLearningExample(
    cycle: FeedbackCycle,
    understanding: CognitiveUnderstanding,
    plan: ExecutionPlan,
    executionResults: ExecutionState,
    evaluationResults: TaskEvaluationResult[]
  ): Promise<LearningExample> {
    // Determine example type
    const successRate = executionResults.performance.successRate
    const type = successRate >= 0.8 ? 'success' : 
                 successRate >= 0.5 ? 'partial_success' : 'failure'

    // Extract success and failure factors
    const successFactors = this.extractSuccessFactors(cycle, understanding, plan, executionResults)
    const failureFactors = this.extractFailureFactors(cycle, understanding, plan, executionResults)

    // Generate lessons learned
    const lessonsLearned = this.generateLessonsLearned(cycle, type, successFactors, failureFactors)

    const example: LearningExample = {
      id: uuidv4(),
      type,
      timestamp: new Date().toISOString(),
      userId: cycle.userId,
      sessionId: cycle.sessionId,
      understanding,
      plan,
      executionResults,
      evaluationResults,
      domain: understanding.semanticIntent.context.domain || 'general',
      complexity: this.mapComplexity(understanding.semanticIntent.context.complexity || 'moderate'),
      successFactors,
      failureFactors,
      lessonsLearned,
      applicableScenarios: this.identifyApplicableScenarios(understanding, plan),
      confidence: understanding.confidence,
      outcomeMetrics: {
        successRate: executionResults.performance.successRate,
        efficiency: executionResults.performance.throughput,
        resourceUtilization: Math.max(executionResults.resourceUsage.cpu, executionResults.resourceUsage.memory),
        executionTime: executionResults.resourceUsage.timeElapsed,
        cost: executionResults.resourceUsage.cost
      }
    }

    return example
  }

  private extractSuccessFactors(
    cycle: FeedbackCycle,
    understanding: CognitiveUnderstanding,
    plan: ExecutionPlan,
    executionResults: ExecutionState
  ): string[] {
    const factors: string[] = []

    if (understanding.confidence > 0.8) {
      factors.push('high_understanding_confidence')
    }

    if (plan.confidence > 0.8) {
      factors.push('high_plan_confidence')
    }

    if (executionResults.performance.successRate > 0.9) {
      factors.push('excellent_execution_success_rate')
    }

    if (executionResults.performance.throughput > 1.0) {
      factors.push('high_throughput')
    }

    if (cycle.appliedRefinements.length > 0 && cycle.appliedRefinements.every(r => r.success)) {
      factors.push('successful_refinements')
    }

    if (executionResults.resourceUsage.cpu < 0.7 && executionResults.resourceUsage.memory < 0.7) {
      factors.push('efficient_resource_usage')
    }

    if (plan.riskLevel === 'low') {
      factors.push('low_risk_plan')
    }

    return factors
  }

  private extractFailureFactors(
    cycle: FeedbackCycle,
    understanding: CognitiveUnderstanding,
    plan: ExecutionPlan,
    executionResults: ExecutionState
  ): string[] {
    const factors: string[] = []

    if (understanding.confidence < 0.5) {
      factors.push('low_understanding_confidence')
    }

    if (plan.confidence < 0.5) {
      factors.push('low_plan_confidence')
    }

    if (executionResults.performance.successRate < 0.5) {
      factors.push('poor_execution_success_rate')
    }

    if (executionResults.performance.errorRate > 0.3) {
      factors.push('high_error_rate')
    }

    if (executionResults.resourceUsage.cpu > 0.9 || executionResults.resourceUsage.memory > 0.9) {
      factors.push('resource_exhaustion')
    }

    if (cycle.detectedIssues.some(i => i.severity === 'critical')) {
      factors.push('critical_issues_detected')
    }

    if (plan.riskLevel === 'high' || plan.riskLevel === 'critical') {
      factors.push('high_risk_plan')
    }

    if (cycle.iteration > 3) {
      factors.push('excessive_iterations_required')
    }

    return factors
  }

  private generateLessonsLearned(
    cycle: FeedbackCycle,
    type: string,
    successFactors: string[],
    failureFactors: string[]
  ): string[] {
    const lessons: string[] = []

    if (type === 'success') {
      if (successFactors.includes('high_understanding_confidence')) {
        lessons.push('Clear understanding leads to better execution outcomes')
      }
      if (successFactors.includes('successful_refinements')) {
        lessons.push('Iterative refinement can significantly improve results')
      }
      if (successFactors.includes('efficient_resource_usage')) {
        lessons.push('Efficient resource planning leads to better performance')
      }
    } else if (type === 'failure') {
      if (failureFactors.includes('low_understanding_confidence')) {
        lessons.push('Poor understanding requires more clarification before proceeding')
      }
      if (failureFactors.includes('resource_exhaustion')) {
        lessons.push('Resource constraints must be considered during planning')
      }
      if (failureFactors.includes('high_error_rate')) {
        lessons.push('High error rates indicate need for plan adjustment')
      }
    }

    return lessons
  }

  private identifyApplicableScenarios(understanding: CognitiveUnderstanding, plan: ExecutionPlan): string[] {
    const scenarios: string[] = []

    scenarios.push(understanding.semanticIntent.context.domain || 'general')
    scenarios.push(understanding.semanticIntent.context.complexity || 'medium')
    scenarios.push(plan.riskLevel)

    if (plan.nodes.length > 5) {
      scenarios.push('complex_multi_step')
    }

    if (understanding.semanticIntent.goals.length > 3) {
      scenarios.push('multi_goal')
    }

    return scenarios
  }

  private async recognizePatterns(example: LearningExample): Promise<LearningInsight[]> {
    const insights: LearningInsight[] = []

    // Find similar examples
    const similarExamples = this.findSimilarExamples(example)

    if (similarExamples.length >= this.config.minExamplesForPattern) {
      // Check if this forms a new pattern
      const patternInsight = this.analyzeForNewPattern(example, similarExamples)
      if (patternInsight) {
        insights.push(patternInsight)
        this.metrics.patternsDiscovered++
      }
    }

    return insights
  }

  private findSimilarExamples(example: LearningExample): LearningExample[] {
    return this.learningExamples.filter(ex => 
      ex.id !== example.id &&
      ex.domain === example.domain &&
      ex.complexity === example.complexity &&
      ex.type === example.type &&
      Math.abs(ex.confidence - example.confidence) < 0.2
    )
  }

  private analyzeForNewPattern(example: LearningExample, similarExamples: LearningExample[]): LearningInsight | null {
    const allExamples = [example, ...similarExamples]
    
    // Find common success factors
    const commonSuccessFactors = this.findCommonFactors(allExamples.map(e => e.successFactors))
    const commonFailureFactors = this.findCommonFactors(allExamples.map(e => e.failureFactors))

    if (commonSuccessFactors.length > 0 || commonFailureFactors.length > 0) {
      const pattern: LearningPattern = {
        id: uuidv4(),
        name: `Pattern-${this.knowledgeBase.patterns.length + 1}`,
        description: `Pattern for ${example.domain} domain with ${example.complexity} complexity`,
        category: 'general',
        conditions: [
          { field: 'domain', operator: 'eq', value: example.domain },
          { field: 'complexity', operator: 'eq', value: example.complexity }
        ],
        successFactors: commonSuccessFactors.map(factor => ({
          factor,
          importance: 0.8,
          confidence: 0.7,
          applicability: [example.domain]
        })),
        failureIndicators: commonFailureFactors.map(factor => ({
          indicator: factor,
          severity: 'medium' as const,
          preventionStrategy: `Avoid ${factor}`,
          earlyWarningSignals: [`Monitor for ${factor}`]
        })),
        frequency: allExamples.length,
        successRate: allExamples.filter(e => e.type === 'success').length / allExamples.length,
        avgConfidenceImprovement: allExamples.reduce((sum, e) => sum + e.confidence, 0) / allExamples.length,
        applicableDomains: [example.domain],
        lastSeen: new Date().toISOString(),
        recommendations: []
      }

      this.knowledgeBase.patterns.push(pattern)

      return {
        id: uuidv4(),
        type: 'pattern_discovered',
        title: `New Pattern Discovered: ${pattern.name}`,
        description: `Discovered pattern with ${allExamples.length} examples in ${example.domain} domain`,
        confidence: 0.8,
        actionable: true,
        priority: 'medium',
        evidence: allExamples.map(e => `Example ${e.id}: ${e.type}`),
        recommendations: [`Apply pattern for similar ${example.domain} scenarios`],
        potentialImpact: 'Improved success rate for similar scenarios',
        applicableTo: [example.domain],
        validatedBy: allExamples.map(e => e.id),
        timestamp: new Date().toISOString()
      }
    }

    return null
  }

  private findCommonFactors(factorLists: string[][]): string[] {
    const factorCounts = new Map<string, number>()
    
    factorLists.forEach(factors => {
      factors.forEach(factor => {
        factorCounts.set(factor, (factorCounts.get(factor) || 0) + 1)
      })
    })

    const threshold = Math.ceil(factorLists.length * 0.6) // 60% threshold
    
    return Array.from(factorCounts.entries())
      .filter(([factor, count]) => count >= threshold)
      .map(([factor]) => factor)
  }

  private async analyzeSuccess(example: LearningExample): Promise<LearningInsight[]> {
    const insights: LearningInsight[] = []

    // Check if this success validates a known strategy
    const validatedStrategies = this.knowledgeBase.successStrategies.filter(strategy =>
      strategy.applicableDomains.includes(example.domain) &&
      example.successFactors.some(factor => strategy.steps.some(step => step.step.includes(factor)))
    )

    for (const strategy of validatedStrategies) {
      await this.validateSuccessStrategy(strategy.id, {
        success: true,
        improvement: example.outcomeMetrics.successRate,
        confidence: example.confidence
      })

      insights.push({
        id: uuidv4(),
        type: 'strategy_validated',
        title: `Strategy Validated: ${strategy.name}`,
        description: `Success example validates the effectiveness of ${strategy.name}`,
        confidence: 0.8,
        actionable: true,
        priority: 'medium',
        evidence: [`Success rate: ${(example.outcomeMetrics.successRate * 100).toFixed(1)}%`],
        recommendations: [`Continue using ${strategy.name} for similar scenarios`],
        potentialImpact: 'Increased confidence in proven strategy',
        applicableTo: strategy.applicableDomains,
        validatedBy: [example.id],
        timestamp: new Date().toISOString()
      })
    }

    return insights
  }

  private async analyzeFailure(example: LearningExample): Promise<LearningInsight[]> {
    const insights: LearningInsight[] = []

    // Check if this failure identifies a new risk
    const riskFactors = example.failureFactors.filter(factor => 
      !this.knowledgeBase.failureMitigations.some(m => 
        m.earlyWarningSignals.includes(factor)
      )
    )

    if (riskFactors.length > 0) {
      insights.push({
        id: uuidv4(),
        type: 'risk_detected',
        title: `New Risk Factors Identified`,
        description: `Failure analysis identified ${riskFactors.length} new risk factors`,
        confidence: 0.7,
        actionable: true,
        priority: 'high',
        evidence: riskFactors,
        recommendations: riskFactors.map(factor => `Develop mitigation for ${factor}`),
        potentialImpact: 'Reduced future failure rates through proactive mitigation',
        applicableTo: [example.domain],
        validatedBy: [example.id],
        timestamp: new Date().toISOString()
      })
    }

    return insights
  }

  private classifyFailureType(failureReason: string, failureContext: Record<string, any>): string {
    const reason = failureReason.toLowerCase()
    
    if (reason.includes('timeout') || reason.includes('time')) return 'timeout'
    if (reason.includes('resource') || reason.includes('memory') || reason.includes('cpu')) return 'resource'
    if (reason.includes('permission') || reason.includes('auth')) return 'authorization'
    if (reason.includes('network') || reason.includes('connection')) return 'network'
    if (reason.includes('validation') || reason.includes('invalid')) return 'validation'
    if (reason.includes('dependency') || reason.includes('unavailable')) return 'dependency'
    
    return 'general'
  }

  private identifyWarningSignals(failureReason: string, failureContext: Record<string, any>): string[] {
    const signals: string[] = []
    
    if (failureReason.includes('timeout')) {
      signals.push('increasing_response_times', 'high_load_indicators')
    }
    
    if (failureReason.includes('resource')) {
      signals.push('resource_utilization_above_80%', 'memory_pressure_warnings')
    }
    
    if (failureReason.includes('network')) {
      signals.push('network_latency_spikes', 'connection_errors')
    }
    
    return signals
  }

  private generatePreventionStrategies(failureType: string, understanding: CognitiveUnderstanding): string[] {
    const strategies: string[] = []
    
    switch (failureType) {
      case 'timeout':
        strategies.push('implement_timeout_buffers', 'add_retry_mechanisms', 'optimize_execution_path')
        break
      case 'resource':
        strategies.push('implement_resource_monitoring', 'add_resource_limits', 'optimize_resource_usage')
        break
      case 'network':
        strategies.push('implement_circuit_breakers', 'add_network_redundancy', 'use_offline_fallbacks')
        break
      default:
        strategies.push('add_comprehensive_monitoring', 'implement_graceful_degradation')
        break
    }
    
    return strategies
  }

  private generateRecoveryActions(failureType: string, plan: ExecutionPlan): string[] {
    const actions: string[] = []
    
    switch (failureType) {
      case 'timeout':
        actions.push('retry_with_exponential_backoff', 'switch_to_faster_alternative', 'break_into_smaller_tasks')
        break
      case 'resource':
        actions.push('free_unused_resources', 'scale_resources_up', 'defer_non_critical_tasks')
        break
      case 'network':
        actions.push('switch_to_backup_connection', 'use_cached_data', 'retry_with_different_endpoint')
        break
      default:
        actions.push('rollback_to_last_known_good_state', 'escalate_to_manual_intervention')
        break
    }
    
    return actions
  }

  private generateRecommendations(
    understanding: CognitiveUnderstanding,
    patterns: LearningPattern[],
    strategies: SuccessStrategy[],
    mitigations: FailureMitigation[]
  ): string[] {
    const recommendations: string[] = []

    // Pattern-based recommendations
    patterns.forEach(pattern => {
      pattern.recommendations.forEach(rec => {
        if (this.evaluateCondition(rec.condition, understanding)) {
          recommendations.push(rec.action)
        }
      })
    })

    // Strategy recommendations
    strategies.slice(0, 2).forEach(strategy => {
      recommendations.push(`Consider applying strategy: ${strategy.name} (${(strategy.successRate * 100).toFixed(1)}% success rate)`)
    })

    // Risk mitigation recommendations
    mitigations.slice(0, 2).forEach(mitigation => {
      recommendations.push(`Monitor for ${mitigation.failureType} risks and apply prevention strategies`)
    })

    return recommendations.slice(0, 5) // Limit to top 5 recommendations
  }

  private evaluateCondition(condition: string, understanding: CognitiveUnderstanding): boolean {
    // Simple condition evaluation - in production this would be more sophisticated
    if (condition.includes('high_confidence') && understanding.confidence > 0.8) return true
    if (condition.includes('low_confidence') && understanding.confidence < 0.5) return true
    if (condition.includes('complex') && (understanding.semanticIntent.context.complexity === 'complex' || understanding.semanticIntent.context.complexity === 'expert')) return true
    
    return false
  }

  private async updateKnowledgeBase(example: LearningExample, insights: LearningInsight[]): Promise<void> {
    // Update domain knowledge
    let domainKnowledge = this.knowledgeBase.domainKnowledge.find(dk => dk.domain === example.domain)
    
    if (!domainKnowledge) {
      domainKnowledge = {
        domain: example.domain,
        characteristics: {},
        commonPatterns: [],
        successFactors: [],
        typicalChallenges: [],
        bestPractices: [],
        avgComplexity: 0,
        avgSuccessRate: 0,
        knowledgeConfidence: 0.5
      }
      this.knowledgeBase.domainKnowledge.push(domainKnowledge)
    }

    // Update domain statistics
    const domainExamples = this.learningExamples.filter(e => e.domain === example.domain)
    domainKnowledge.avgSuccessRate = domainExamples.filter(e => e.type === 'success').length / domainExamples.length
    domainKnowledge.knowledgeConfidence = Math.min(1, domainKnowledge.knowledgeConfidence + 0.01)

    // Add new success factors
    example.successFactors.forEach(factor => {
      if (!domainKnowledge!.successFactors.includes(factor)) {
        domainKnowledge!.successFactors.push(factor)
      }
    })

    // Add lessons as best practices
    example.lessonsLearned.forEach(lesson => {
      if (!domainKnowledge!.bestPractices.includes(lesson)) {
        domainKnowledge!.bestPractices.push(lesson)
        
        // Create formal best practice
        this.knowledgeBase.bestPractices.push({
          id: uuidv4(),
          title: lesson,
          description: `Best practice derived from learning example ${example.id}`,
          category: example.domain,
          applicableScenarios: example.applicableScenarios,
          impact: example.type === 'success' ? 'high' : 'medium',
          confidence: example.confidence,
          evidenceCount: 1,
          lastValidated: new Date().toISOString()
        })
      }
    })
  }

  private calculateDomainStats(): Record<string, any> {
    const domains = [...new Set(this.learningExamples.map(e => e.domain))]
    const stats: Record<string, any> = {}

    domains.forEach(domain => {
      const domainExamples = this.learningExamples.filter(e => e.domain === domain)
      stats[domain] = {
        totalExamples: domainExamples.length,
        successRate: domainExamples.filter(e => e.type === 'success').length / domainExamples.length,
        avgConfidence: domainExamples.reduce((sum, e) => sum + e.confidence, 0) / domainExamples.length,
        patterns: this.knowledgeBase.patterns.filter(p => p.applicableDomains.includes(domain)).length
      }
    })

    return stats
  }

  private calculatePatternStats(): Record<string, any> {
    return {
      totalPatterns: this.knowledgeBase.patterns.length,
      avgFrequency: this.knowledgeBase.patterns.reduce((sum, p) => sum + p.frequency, 0) / Math.max(1, this.knowledgeBase.patterns.length),
      avgSuccessRate: this.knowledgeBase.patterns.reduce((sum, p) => sum + p.successRate, 0) / Math.max(1, this.knowledgeBase.patterns.length),
      categories: {
        planning: this.knowledgeBase.patterns.filter(p => p.category === 'planning').length,
        execution: this.knowledgeBase.patterns.filter(p => p.category === 'execution').length,
        understanding: this.knowledgeBase.patterns.filter(p => p.category === 'understanding').length,
        evaluation: this.knowledgeBase.patterns.filter(p => p.category === 'evaluation').length,
        general: this.knowledgeBase.patterns.filter(p => p.category === 'general').length
      }
    }
  }

  private calculateKnowledgeBaseStats(): Record<string, any> {
    return {
      patterns: this.knowledgeBase.patterns.length,
      successStrategies: this.knowledgeBase.successStrategies.length,
      failureMitigations: this.knowledgeBase.failureMitigations.length,
      domainKnowledge: this.knowledgeBase.domainKnowledge.length,
      bestPractices: this.knowledgeBase.bestPractices.length,
      totalKnowledgeItems: 
        this.knowledgeBase.patterns.length +
        this.knowledgeBase.successStrategies.length +
        this.knowledgeBase.failureMitigations.length +
        this.knowledgeBase.domainKnowledge.length +
        this.knowledgeBase.bestPractices.length
    }
  }

  private calculateLearningAccuracy(): number {
    if (this.metrics.strategiesValidated === 0) return 0
    
    // Simplified accuracy calculation
    return this.metrics.strategiesValidated / Math.max(1, this.metrics.totalExamples)
  }

  private initializeLearningSystem(): void {
    console.log('🧠 Initializing learning system with pattern recognition and knowledge accumulation')
    
    // Initialize with some basic success strategies
    this.knowledgeBase.successStrategies.push({
      id: uuidv4(),
      name: 'High-Confidence Planning',
      description: 'Ensure high confidence in understanding before proceeding to planning',
      applicableDomains: ['general'],
      successRate: 0.85,
      avgImprovement: 0.2,
      conditions: ['understanding_confidence > 0.8'],
      steps: [
        { step: 'Validate understanding clarity', description: 'Ensure all ambiguities are resolved', importance: 0.9 },
        { step: 'Confirm goal alignment', description: 'Verify goals match user intentions', importance: 0.8 },
        { step: 'Assess constraint feasibility', description: 'Check if constraints are realistic', importance: 0.7 }
      ],
      evidence: ['Initial strategy based on cognitive architecture principles'],
      confidence: 0.7,
      usageCount: 0,
      lastUsed: new Date().toISOString()
    })
  }

  private mapComplexity(complexity: 'simple' | 'moderate' | 'complex' | 'expert'): 'low' | 'medium' | 'high' {
    switch (complexity) {
      case 'simple': return 'low'
      case 'moderate': return 'medium'
      case 'complex': return 'high'
      case 'expert': return 'high'
      default: return 'medium'
    }
  }
} 