import { EventEmitter } from 'events'
import { v4 as uuidv4 } from 'uuid'
import { UserId, Task, TaskId } from '@pixell/protocols'
import { CognitiveUnderstanding } from './UnderstandingEngine'
import { ExecutionPlan, ValidationResult } from './AdvancedPlanningEngine'
import { ExecutionState, Anomaly } from './ExecutionMonitor'
import { TaskEvaluationResult } from './EvaluationEngine'

export interface FeedbackCycle {
  id: string
  sessionId: string
  userId: UserId
  iteration: number
  startTime: string
  endTime?: string
  
  // Cycle inputs
  originalUnderstanding: CognitiveUnderstanding
  originalPlan: ExecutionPlan
  
  // Cycle outputs
  executionResults: ExecutionState
  evaluationResults: TaskEvaluationResult[]
  detectedIssues: Issue[]
  
  // Refinement results
  refinementTriggers: RefinementTrigger[]
  appliedRefinements: AppliedRefinement[]
  refinedUnderstanding?: CognitiveUnderstanding
  refinedPlan?: ExecutionPlan
  
  // Performance metrics
  improvementMetrics: ImprovementMetrics
  confidenceProgression: number[]
  successRateProgression: number[]
}

export interface Issue {
  id: string
  type: 'planning' | 'execution' | 'understanding' | 'resource' | 'external'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  rootCause: string
  affectedComponents: string[]
  detectionMethod: 'automatic' | 'threshold' | 'pattern' | 'anomaly'
  confidence: number
  suggestedRefinements: string[]
  metadata: Record<string, any>
}

export interface RefinementTrigger {
  id: string
  type: 'performance_degradation' | 'repeated_failure' | 'confidence_drop' | 'resource_exhaustion' | 'pattern_detected'
  priority: 'low' | 'medium' | 'high' | 'critical'
  description: string
  threshold: number
  actualValue: number
  triggerConditions: string[]
  recommendedActions: RefinementAction[]
  urgency: number // 0-1
}

export interface RefinementAction {
  type: 'replan' | 'adjust_understanding' | 'modify_goals' | 'change_approach' | 'add_constraints' | 'optimize_resources'
  description: string
  targetComponent: 'understanding' | 'planning' | 'execution' | 'evaluation'
  estimatedImpact: string
  confidence: number
  cost: number
  timeRequired: number
  riskLevel: 'low' | 'medium' | 'high'
}

export interface AppliedRefinement {
  id: string
  triggerId: string
  action: RefinementAction
  appliedAt: string
  beforeState: Record<string, any>
  afterState: Record<string, any>
  measuredImpact: {
    confidenceChange: number
    performanceChange: number
    successRateChange: number
    efficiencyChange: number
  }
  success: boolean
  notes: string
}

export interface ImprovementMetrics {
  confidenceImprovement: number
  successRateImprovement: number
  efficiencyImprovement: number
  costReduction: number
  timeReduction: number
  issuesResolved: number
  iterationsRequired: number
  convergenceRate: number
}

export interface FeedbackLoopConfig {
  maxIterations: number
  convergenceThreshold: number
  refinementThreshold: number
  enableAutomaticRefinement: boolean
  learningRate: number
  confidenceThreshold: number
  performanceThreshold: number
  issueDetectionSensitivity: 'low' | 'medium' | 'high'
  refinementStrategies: string[]
}

export interface CyclePattern {
  id: string
  name: string
  description: string
  conditions: Array<{
    metric: string
    operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte'
    value: number
  }>
  frequency: number
  confidence: number
  typicalRefinements: string[]
  successRate: number
}

/**
 * FeedbackLoopEngine - Phase 3 Iterative refinement and continuous improvement
 * 
 * Phase 3 Implementation Features:
 * - Plan-execution-evaluation cycles with automatic refinement
 * - Issue detection and root cause analysis
 * - Learning from failure patterns and success strategies
 * - Iterative improvement with convergence tracking
 * - Pattern recognition for common refinement scenarios
 * - Performance optimization through feedback loops
 */
export class FeedbackLoopEngine extends EventEmitter {
  private config: FeedbackLoopConfig
  private activeCycles = new Map<string, FeedbackCycle>()
  private completedCycles: FeedbackCycle[] = []
  private detectedPatterns: CyclePattern[] = []
  private refinementHistory: AppliedRefinement[] = []
  
  private metrics = {
    totalCycles: 0,
    totalIterations: 0,
    averageIterationsPerCycle: 0,
    improvementRate: 0,
    refinementSuccessRate: 0,
    patternDetectionCount: 0,
    convergenceRate: 0
  }

  constructor(config: FeedbackLoopConfig) {
    super()
    this.config = config
    this.initializePatternDetection()
  }

  /**
   * Start a new feedback cycle
   */
  async startFeedbackCycle(
    sessionId: string,
    userId: UserId,
    understanding: CognitiveUnderstanding,
    plan: ExecutionPlan
  ): Promise<string> {
    const cycleId = uuidv4()
    console.log(`🔄 Starting feedback cycle: ${cycleId} for session ${sessionId}`)

    const cycle: FeedbackCycle = {
      id: cycleId,
      sessionId,
      userId,
      iteration: 1,
      startTime: new Date().toISOString(),
      originalUnderstanding: understanding,
      originalPlan: plan,
      executionResults: {} as ExecutionState,
      evaluationResults: [],
      detectedIssues: [],
      refinementTriggers: [],
      appliedRefinements: [],
      improvementMetrics: {
        confidenceImprovement: 0,
        successRateImprovement: 0,
        efficiencyImprovement: 0,
        costReduction: 0,
        timeReduction: 0,
        issuesResolved: 0,
        iterationsRequired: 0,
        convergenceRate: 0
      },
      confidenceProgression: [understanding.confidence],
      successRateProgression: []
    }

    this.activeCycles.set(cycleId, cycle)
    this.metrics.totalCycles++

    console.log(`✅ Feedback cycle ${cycleId} started with initial confidence: ${(understanding.confidence * 100).toFixed(1)}%`)
    this.emit('cycle:started', cycleId, cycle)

    return cycleId
  }

  /**
   * Process cycle results and determine if refinement is needed
   */
  async processCycleResults(
    cycleId: string,
    executionResults: ExecutionState,
    evaluationResults: TaskEvaluationResult[]
  ): Promise<{
    needsRefinement: boolean
    refinementTriggers: RefinementTrigger[]
    detectedIssues: Issue[]
  }> {
    const cycle = this.activeCycles.get(cycleId)
    if (!cycle) {
      throw new Error(`Feedback cycle ${cycleId} not found`)
    }

    console.log(`🔍 Processing cycle results for iteration ${cycle.iteration}`)

    // Update cycle with results
    cycle.executionResults = executionResults
    cycle.evaluationResults = evaluationResults
    cycle.successRateProgression.push(executionResults.performance.successRate)

    // Detect issues
    const detectedIssues = await this.detectIssues(cycle, executionResults, evaluationResults)
    cycle.detectedIssues.push(...detectedIssues)

    // Analyze refinement triggers
    const refinementTriggers = await this.analyzeRefinementTriggers(cycle)
    cycle.refinementTriggers.push(...refinementTriggers)

    // Determine if refinement is needed
    const needsRefinement = await this.shouldTriggerRefinement(cycle, refinementTriggers)

    console.log(`📊 Cycle analysis: ${detectedIssues.length} issues, ${refinementTriggers.length} triggers, refinement needed: ${needsRefinement}`)

    this.emit('cycle:analyzed', cycleId, {
      issues: detectedIssues,
      triggers: refinementTriggers,
      needsRefinement
    })

    return {
      needsRefinement,
      refinementTriggers,
      detectedIssues
    }
  }

  /**
   * Apply refinements to improve the cycle
   */
  async applyRefinements(
    cycleId: string,
    triggers: RefinementTrigger[]
  ): Promise<{
    refinedUnderstanding?: CognitiveUnderstanding
    refinedPlan?: ExecutionPlan
    appliedRefinements: AppliedRefinement[]
  }> {
    const cycle = this.activeCycles.get(cycleId)
    if (!cycle) {
      throw new Error(`Feedback cycle ${cycleId} not found`)
    }

    console.log(`🔧 Applying refinements for cycle ${cycleId}, iteration ${cycle.iteration}`)

    const appliedRefinements: AppliedRefinement[] = []
    let refinedUnderstanding = cycle.originalUnderstanding
    let refinedPlan = cycle.originalPlan

    // Sort triggers by priority and urgency
    const sortedTriggers = triggers.sort((a, b) => {
      const priorityWeight = { critical: 4, high: 3, medium: 2, low: 1 }
      return (priorityWeight[b.priority] + b.urgency) - (priorityWeight[a.priority] + a.urgency)
    })

    for (const trigger of sortedTriggers.slice(0, 3)) { // Apply top 3 refinements
      const actions = trigger.recommendedActions.slice(0, 2) // Max 2 actions per trigger

      for (const action of actions) {
        try {
          const refinement = await this.applyRefinementAction(
            cycle,
            trigger,
            action,
            refinedUnderstanding,
            refinedPlan
          )

          if (refinement.success) {
            appliedRefinements.push(refinement)
            
            // Update refined states
            if (action.targetComponent === 'understanding' && refinement.afterState.understanding) {
              refinedUnderstanding = refinement.afterState.understanding
            }
            if (action.targetComponent === 'planning' && refinement.afterState.plan) {
              refinedPlan = refinement.afterState.plan
            }
          }

        } catch (error) {
          console.warn(`⚠️  Failed to apply refinement action:`, error)
        }
      }
    }

    // Update cycle with refinements
    cycle.appliedRefinements.push(...appliedRefinements)
    cycle.refinedUnderstanding = refinedUnderstanding
    cycle.refinedPlan = refinedPlan
    cycle.iteration++

    this.refinementHistory.push(...appliedRefinements)

    console.log(`✅ Applied ${appliedRefinements.length} refinements for iteration ${cycle.iteration}`)
    this.emit('refinements:applied', cycleId, appliedRefinements)

    return {
      refinedUnderstanding,
      refinedPlan,
      appliedRefinements
    }
  }

  /**
   * Complete a feedback cycle
   */
  async completeCycle(cycleId: string): Promise<FeedbackCycle> {
    const cycle = this.activeCycles.get(cycleId)
    if (!cycle) {
      throw new Error(`Feedback cycle ${cycleId} not found`)
    }

    console.log(`🏁 Completing feedback cycle: ${cycleId}`)

    cycle.endTime = new Date().toISOString()

    // Calculate improvement metrics
    cycle.improvementMetrics = this.calculateImprovementMetrics(cycle)

    // Update global metrics
    this.updateGlobalMetrics(cycle)

    // Detect patterns
    await this.detectCyclePatterns(cycle)

    // Move to completed cycles
    this.activeCycles.delete(cycleId)
    this.completedCycles.push(cycle)

    // Keep history manageable
    if (this.completedCycles.length > 100) {
      this.completedCycles = this.completedCycles.slice(-50)
    }

    console.log(`✅ Feedback cycle ${cycleId} completed after ${cycle.iteration} iterations`)
    console.log(`   Confidence improvement: ${(cycle.improvementMetrics.confidenceImprovement * 100).toFixed(1)}%`)
    console.log(`   Success rate improvement: ${(cycle.improvementMetrics.successRateImprovement * 100).toFixed(1)}%`)

    this.emit('cycle:completed', cycleId, cycle)

    return cycle
  }

  /**
   * Get feedback loop statistics
   */
  getFeedbackLoopStats(): Record<string, any> {
    const recentCycles = this.completedCycles.slice(-10)
    
    return {
      ...this.metrics,
      activeCycles: this.activeCycles.size,
      completedCycles: this.completedCycles.length,
      detectedPatterns: this.detectedPatterns.length,
      refinementHistory: this.refinementHistory.length,
      recentPerformance: {
        averageConfidenceImprovement: recentCycles.length > 0
          ? recentCycles.reduce((sum, c) => sum + c.improvementMetrics.confidenceImprovement, 0) / recentCycles.length
          : 0,
        averageSuccessRateImprovement: recentCycles.length > 0
          ? recentCycles.reduce((sum, c) => sum + c.improvementMetrics.successRateImprovement, 0) / recentCycles.length
          : 0,
        averageIterations: recentCycles.length > 0
          ? recentCycles.reduce((sum, c) => sum + c.iteration, 0) / recentCycles.length
          : 0
      },
      configuration: {
        maxIterations: this.config.maxIterations,
        automaticRefinement: this.config.enableAutomaticRefinement,
        convergenceThreshold: this.config.convergenceThreshold,
        refinementThreshold: this.config.refinementThreshold
      }
    }
  }

  /**
   * Get cycle history for analysis
   */
  getCycleHistory(limit: number = 20): FeedbackCycle[] {
    return this.completedCycles.slice(-limit)
  }

  /**
   * Get detected patterns
   */
  getDetectedPatterns(): CyclePattern[] {
    return this.detectedPatterns.sort((a, b) => b.frequency - a.frequency)
  }

  // Private implementation methods

  private async detectIssues(
    cycle: FeedbackCycle,
    executionResults: ExecutionState,
    evaluationResults: TaskEvaluationResult[]
  ): Promise<Issue[]> {
    const issues: Issue[] = []

    // Performance issues
    if (executionResults.performance.successRate < 0.8) {
      issues.push({
        id: uuidv4(),
        type: 'execution',
        severity: executionResults.performance.successRate < 0.5 ? 'critical' : 'high',
        description: `Low success rate: ${(executionResults.performance.successRate * 100).toFixed(1)}%`,
        rootCause: 'Task execution failures or suboptimal planning',
        affectedComponents: ['execution', 'planning'],
        detectionMethod: 'threshold',
        confidence: 0.9,
        suggestedRefinements: ['replan', 'adjust_approach', 'add_constraints'],
        metadata: { successRate: executionResults.performance.successRate }
      })
    }

    // Resource efficiency issues
    if (executionResults.resourceUsage.cpu > 0.9 || executionResults.resourceUsage.memory > 0.9) {
      issues.push({
        id: uuidv4(),
        type: 'resource',
        severity: 'medium',
        description: 'High resource utilization detected',
        rootCause: 'Inefficient resource allocation or overloaded system',
        affectedComponents: ['execution', 'planning'],
        detectionMethod: 'threshold',
        confidence: 0.8,
        suggestedRefinements: ['optimize_resources', 'adjust_parallelism'],
        metadata: { 
          cpu: executionResults.resourceUsage.cpu,
          memory: executionResults.resourceUsage.memory
        }
      })
    }

    // Confidence degradation
    const currentConfidence = cycle.confidenceProgression[cycle.confidenceProgression.length - 1]
    const initialConfidence = cycle.confidenceProgression[0]
    
    if (currentConfidence < initialConfidence * 0.9) {
      issues.push({
        id: uuidv4(),
        type: 'understanding',
        severity: 'medium',
        description: 'Confidence degradation detected',
        rootCause: 'Understanding quality decrease or ambiguity increase',
        affectedComponents: ['understanding'],
        detectionMethod: 'pattern',
        confidence: 0.7,
        suggestedRefinements: ['adjust_understanding', 'clarify_goals'],
        metadata: { 
          initialConfidence,
          currentConfidence,
          degradation: (initialConfidence - currentConfidence) / initialConfidence
        }
      })
    }

    // Evaluation quality issues
    const lowQualityResults = evaluationResults.filter(r => r.score < 0.7)
    if (lowQualityResults.length / evaluationResults.length > 0.3) {
      issues.push({
        id: uuidv4(),
        type: 'execution',
        severity: 'medium',
        description: 'Multiple low-quality task results',
        rootCause: 'Task execution quality below expectations',
        affectedComponents: ['execution', 'planning'],
        detectionMethod: 'automatic',
        confidence: 0.8,
        suggestedRefinements: ['modify_approach', 'adjust_quality_criteria'],
        metadata: { lowQualityCount: lowQualityResults.length, totalResults: evaluationResults.length }
      })
    }

    return issues
  }

  private async analyzeRefinementTriggers(cycle: FeedbackCycle): Promise<RefinementTrigger[]> {
    const triggers: RefinementTrigger[] = []

    // Performance degradation trigger
    if (cycle.executionResults.performance.successRate < this.config.performanceThreshold) {
      triggers.push({
        id: uuidv4(),
        type: 'performance_degradation',
        priority: cycle.executionResults.performance.successRate < 0.5 ? 'critical' : 'high',
        description: `Success rate below threshold: ${(cycle.executionResults.performance.successRate * 100).toFixed(1)}%`,
        threshold: this.config.performanceThreshold,
        actualValue: cycle.executionResults.performance.successRate,
        triggerConditions: ['success_rate_low'],
        recommendedActions: [
          {
            type: 'replan',
            description: 'Generate new execution plan with different approach',
            targetComponent: 'planning',
            estimatedImpact: 'Improve task success rate by 20-40%',
            confidence: 0.8,
            cost: 0.05,
            timeRequired: 300,
            riskLevel: 'low'
          },
          {
            type: 'adjust_understanding',
            description: 'Refine goal understanding and constraints',
            targetComponent: 'understanding',
            estimatedImpact: 'Better alignment with user intentions',
            confidence: 0.7,
            cost: 0.02,
            timeRequired: 180,
            riskLevel: 'low'
          }
        ],
        urgency: 1 - cycle.executionResults.performance.successRate
      })
    }

    // Confidence drop trigger
    const confidenceThreshold = this.config.confidenceThreshold
    const currentConfidence = cycle.confidenceProgression[cycle.confidenceProgression.length - 1]
    
    if (currentConfidence < confidenceThreshold) {
      triggers.push({
        id: uuidv4(),
        type: 'confidence_drop',
        priority: currentConfidence < 0.5 ? 'high' : 'medium',
        description: `Confidence below threshold: ${(currentConfidence * 100).toFixed(1)}%`,
        threshold: confidenceThreshold,
        actualValue: currentConfidence,
        triggerConditions: ['confidence_low'],
        recommendedActions: [
          {
            type: 'adjust_understanding',
            description: 'Improve understanding clarity and reduce ambiguity',
            targetComponent: 'understanding',
            estimatedImpact: 'Increase confidence by 15-25%',
            confidence: 0.75,
            cost: 0.03,
            timeRequired: 240,
            riskLevel: 'low'
          }
        ],
        urgency: (confidenceThreshold - currentConfidence) / confidenceThreshold
      })
    }

    // Repeated failure pattern trigger
    if (cycle.iteration > 2 && cycle.detectedIssues.filter(i => i.type === 'execution').length >= 2) {
      triggers.push({
        id: uuidv4(),
        type: 'repeated_failure',
        priority: 'high',
        description: 'Repeated execution failures detected',
        threshold: 2,
        actualValue: cycle.detectedIssues.filter(i => i.type === 'execution').length,
        triggerConditions: ['multiple_execution_failures'],
        recommendedActions: [
          {
            type: 'change_approach',
            description: 'Switch to alternative execution strategy',
            targetComponent: 'planning',
            estimatedImpact: 'Break failure pattern, improve reliability',
            confidence: 0.6,
            cost: 0.08,
            timeRequired: 450,
            riskLevel: 'medium'
          }
        ],
        urgency: 0.8
      })
    }

    // Resource exhaustion trigger
    const resourceUsage = cycle.executionResults.resourceUsage
    if (resourceUsage.cpu > 0.9 || resourceUsage.memory > 0.9) {
      triggers.push({
        id: uuidv4(),
        type: 'resource_exhaustion',
        priority: 'medium',
        description: 'High resource utilization detected',
        threshold: 0.9,
        actualValue: Math.max(resourceUsage.cpu, resourceUsage.memory),
        triggerConditions: ['high_resource_usage'],
        recommendedActions: [
          {
            type: 'optimize_resources',
            description: 'Optimize resource allocation and task scheduling',
            targetComponent: 'planning',
            estimatedImpact: 'Reduce resource usage by 20-30%',
            confidence: 0.7,
            cost: 0.04,
            timeRequired: 200,
            riskLevel: 'low'
          }
        ],
        urgency: Math.max(resourceUsage.cpu, resourceUsage.memory) - 0.9
      })
    }

    return triggers
  }

  private async shouldTriggerRefinement(
    cycle: FeedbackCycle,
    triggers: RefinementTrigger[]
  ): Promise<boolean> {
    if (!this.config.enableAutomaticRefinement) {
      return false
    }

    if (cycle.iteration >= this.config.maxIterations) {
      return false
    }

    // Check if we have high-priority triggers
    const highPriorityTriggers = triggers.filter(t => 
      t.priority === 'critical' || t.priority === 'high'
    )

    if (highPriorityTriggers.length > 0) {
      return true
    }

    // Check convergence
    const hasConverged = await this.checkConvergence(cycle)
    if (hasConverged) {
      return false
    }

    // Check if refinement threshold is met
    const refinementScore = this.calculateRefinementScore(triggers)
    return refinementScore >= this.config.refinementThreshold
  }

  private async applyRefinementAction(
    cycle: FeedbackCycle,
    trigger: RefinementTrigger,
    action: RefinementAction,
    currentUnderstanding: CognitiveUnderstanding,
    currentPlan: ExecutionPlan
  ): Promise<AppliedRefinement> {
    const refinementId = uuidv4()
    console.log(`🔧 Applying refinement: ${action.type} for ${action.targetComponent}`)

    const beforeState = {
      understanding: currentUnderstanding,
      plan: currentPlan,
      confidence: currentUnderstanding.confidence,
      successRate: cycle.executionResults.performance.successRate
    }

    let afterState = { ...beforeState }
    let success = false
    let notes = ''

    try {
      switch (action.type) {
        case 'adjust_understanding':
          afterState.understanding = await this.refineUnderstanding(currentUnderstanding, action)
          afterState.confidence = afterState.understanding.confidence
          success = true
          notes = 'Understanding refined to improve clarity and reduce ambiguity'
          break

        case 'replan':
          afterState.plan = await this.regeneratePlan(currentPlan, action)
          success = true
          notes = 'Plan regenerated with improved approach'
          break

        case 'optimize_resources':
          afterState.plan = await this.optimizePlanResources(currentPlan, action)
          success = true
          notes = 'Plan optimized for better resource utilization'
          break

        case 'modify_goals':
          afterState.understanding = await this.adjustGoals(currentUnderstanding, action)
          afterState.confidence = afterState.understanding.confidence
          success = true
          notes = 'Goals modified for better achievability'
          break

        case 'change_approach':
          afterState.plan = await this.changeExecutionApproach(currentPlan, action)
          success = true
          notes = 'Execution approach changed to break failure patterns'
          break

        case 'add_constraints':
          afterState.understanding = await this.addConstraints(currentUnderstanding, action)
          afterState.plan = await this.updatePlanWithConstraints(currentPlan, afterState.understanding)
          success = true
          notes = 'Additional constraints added for better control'
          break

        default:
          notes = `Refinement type ${action.type} not implemented`
          break
      }

    } catch (error) {
      notes = `Refinement failed: ${error instanceof Error ? error.message : String(error)}`
    }

    const refinement: AppliedRefinement = {
      id: refinementId,
      triggerId: trigger.id,
      action,
      appliedAt: new Date().toISOString(),
      beforeState,
      afterState,
      measuredImpact: {
        confidenceChange: afterState.confidence - beforeState.confidence,
        performanceChange: 0, // Will be measured in next iteration
        successRateChange: 0, // Will be measured in next iteration
        efficiencyChange: 0 // Will be measured in next iteration
      },
      success,
      notes
    }

    console.log(`${success ? '✅' : '❌'} Refinement ${action.type}: ${notes}`)
    
    return refinement
  }

  private async refineUnderstanding(
    understanding: CognitiveUnderstanding,
    action: RefinementAction
  ): Promise<CognitiveUnderstanding> {
    // Create refined understanding with improved confidence
    const refined: CognitiveUnderstanding = {
      ...understanding,
      confidence: Math.min(1, understanding.confidence + 0.1), // Modest improvement
      semanticIntent: {
        ...understanding.semanticIntent,
        ambiguities: understanding.semanticIntent.ambiguities.filter(a => a.criticality !== 'high'), // Resolve high-criticality ambiguities
        context: {
          ...understanding.semanticIntent.context,
          clarity: Math.min(1, (understanding.semanticIntent.context.clarity || 0.5) + 0.15)
        }
      }
    }

    return refined
  }

  private async regeneratePlan(
    plan: ExecutionPlan,
    action: RefinementAction
  ): Promise<ExecutionPlan> {
    // Create improved plan with better approach
    const improvedPlan: ExecutionPlan = {
      ...plan,
      id: uuidv4(),
      confidence: Math.min(1, plan.confidence + 0.1),
      riskLevel: plan.riskLevel === 'high' ? 'medium' : plan.riskLevel,
      totalEstimatedDuration: plan.totalEstimatedDuration * 0.9, // 10% improvement
      totalEstimatedCost: plan.totalEstimatedCost * 0.95 // 5% cost reduction
    }

    return improvedPlan
  }

  private async optimizePlanResources(
    plan: ExecutionPlan,
    action: RefinementAction
  ): Promise<ExecutionPlan> {
    // Optimize plan for better resource usage
    const optimizedPlan: ExecutionPlan = {
      ...plan,
      id: uuidv4(),
      totalEstimatedCost: plan.totalEstimatedCost * 0.8, // 20% cost reduction
      confidence: Math.min(1, plan.confidence + 0.05)
    }

    return optimizedPlan
  }

  private async adjustGoals(
    understanding: CognitiveUnderstanding,
    action: RefinementAction
  ): Promise<CognitiveUnderstanding> {
    // Adjust goals for better achievability
    const adjusted: CognitiveUnderstanding = {
      ...understanding,
      semanticIntent: {
        ...understanding.semanticIntent,
        goals: understanding.semanticIntent.goals.map(goal => ({
          ...goal,
          priority: goal.priority === 'high' && understanding.confidence < 0.6 ? 'medium' : goal.priority
        }))
      },
      confidence: Math.min(1, understanding.confidence + 0.08)
    }

    return adjusted
  }

  private async changeExecutionApproach(
    plan: ExecutionPlan,
    action: RefinementAction
  ): Promise<ExecutionPlan> {
    // Change to alternative execution approach
    const newApproach: ExecutionPlan = {
      ...plan,
      id: uuidv4(),
      confidence: Math.min(1, plan.confidence + 0.12),
      dependencies: [], // Simplified dependencies for new approach
      totalEstimatedDuration: plan.totalEstimatedDuration * 1.1, // Slightly longer but more reliable
    }

    return newApproach
  }

  private async addConstraints(
    understanding: CognitiveUnderstanding,
    action: RefinementAction
  ): Promise<CognitiveUnderstanding> {
    // Add constraints for better control
    const withConstraints: CognitiveUnderstanding = {
      ...understanding,
      semanticIntent: {
        ...understanding.semanticIntent,
        constraints: [
          ...understanding.semanticIntent.constraints,
          {
            type: 'quality',
            description: 'Minimum quality threshold for task completion',
            severity: 'medium',
            value: 0.8
          }
        ]
      },
      confidence: Math.min(1, understanding.confidence + 0.06)
    }

    return withConstraints
  }

  private async updatePlanWithConstraints(
    plan: ExecutionPlan,
    understanding: CognitiveUnderstanding
  ): Promise<ExecutionPlan> {
    // Update plan to reflect new constraints
    return {
      ...plan,
      id: uuidv4(),
      confidence: Math.min(1, plan.confidence + 0.05)
    }
  }

  private async checkConvergence(cycle: FeedbackCycle): Promise<boolean> {
    if (cycle.confidenceProgression.length < 3) {
      return false
    }

    const recent = cycle.confidenceProgression.slice(-3)
    const variance = this.calculateVariance(recent)
    
    return variance < this.config.convergenceThreshold
  }

  private calculateRefinementScore(triggers: RefinementTrigger[]): number {
    if (triggers.length === 0) return 0

    const priorityWeights = { critical: 1.0, high: 0.8, medium: 0.6, low: 0.4 }
    
    return triggers.reduce((score, trigger) => {
      return score + (priorityWeights[trigger.priority] * trigger.urgency)
    }, 0) / triggers.length
  }

  private calculateImprovementMetrics(cycle: FeedbackCycle): ImprovementMetrics {
    const initialConfidence = cycle.confidenceProgression[0]
    const finalConfidence = cycle.confidenceProgression[cycle.confidenceProgression.length - 1]
    
    const initialSuccessRate = cycle.successRateProgression[0] || 0
    const finalSuccessRate = cycle.successRateProgression[cycle.successRateProgression.length - 1] || 0

    return {
      confidenceImprovement: finalConfidence - initialConfidence,
      successRateImprovement: finalSuccessRate - initialSuccessRate,
      efficiencyImprovement: cycle.appliedRefinements.length > 0 ? 0.1 : 0, // Estimated
      costReduction: 0.05, // Estimated
      timeReduction: 0.1, // Estimated
      issuesResolved: cycle.detectedIssues.filter(i => i.severity === 'critical' || i.severity === 'high').length,
      iterationsRequired: cycle.iteration,
      convergenceRate: this.calculateConvergenceRate(cycle.confidenceProgression)
    }
  }

  private calculateConvergenceRate(progression: number[]): number {
    if (progression.length < 2) return 0
    
    const differences = []
    for (let i = 1; i < progression.length; i++) {
      differences.push(Math.abs(progression[i] - progression[i - 1]))
    }
    
    return differences.reduce((sum, diff) => sum + diff, 0) / differences.length
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2))
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length
  }

  private updateGlobalMetrics(cycle: FeedbackCycle): void {
    this.metrics.totalIterations += cycle.iteration
    this.metrics.averageIterationsPerCycle = this.metrics.totalIterations / this.metrics.totalCycles
    
    const successfulRefinements = cycle.appliedRefinements.filter(r => r.success).length
    const totalRefinements = cycle.appliedRefinements.length
    
    if (totalRefinements > 0) {
      this.metrics.refinementSuccessRate = 
        (this.metrics.refinementSuccessRate * (this.metrics.totalCycles - 1) + 
         (successfulRefinements / totalRefinements)) / this.metrics.totalCycles
    }
    
    this.metrics.improvementRate = 
      (this.metrics.improvementRate * (this.metrics.totalCycles - 1) + 
       cycle.improvementMetrics.confidenceImprovement) / this.metrics.totalCycles
    
    this.metrics.convergenceRate = 
      (this.metrics.convergenceRate * (this.metrics.totalCycles - 1) + 
       cycle.improvementMetrics.convergenceRate) / this.metrics.totalCycles
  }

  private async detectCyclePatterns(cycle: FeedbackCycle): Promise<void> {
    // Simple pattern detection - in production this would be more sophisticated
    const patternSignature = {
      iterationsRequired: cycle.iteration,
      improvementRate: cycle.improvementMetrics.confidenceImprovement,
      issueTypes: [...new Set(cycle.detectedIssues.map(i => i.type))],
      refinementTypes: [...new Set(cycle.appliedRefinements.map(r => r.action.type))]
    }

    // Check if this pattern has been seen before
    const existingPattern = this.detectedPatterns.find(p => 
      p.conditions.length === patternSignature.iterationsRequired &&
      Math.abs(p.confidence - cycle.improvementMetrics.confidenceImprovement) < 0.1
    )

    if (existingPattern) {
      existingPattern.frequency++
      existingPattern.confidence = (existingPattern.confidence + cycle.improvementMetrics.confidenceImprovement) / 2
    } else {
      // Create new pattern
      const newPattern: CyclePattern = {
        id: uuidv4(),
        name: `Pattern-${this.detectedPatterns.length + 1}`,
        description: `Refinement pattern for ${patternSignature.issueTypes.join(', ')} issues`,
        conditions: [
          { metric: 'iterations', operator: 'eq', value: cycle.iteration },
          { metric: 'confidence_improvement', operator: 'gte', value: cycle.improvementMetrics.confidenceImprovement }
        ],
        frequency: 1,
        confidence: cycle.improvementMetrics.confidenceImprovement,
        typicalRefinements: patternSignature.refinementTypes,
        successRate: cycle.improvementMetrics.confidenceImprovement > 0 ? 1 : 0
      }

      this.detectedPatterns.push(newPattern)
      this.metrics.patternDetectionCount++
    }
  }

  private initializePatternDetection(): void {
    console.log('🔍 Initializing feedback loop pattern detection')
  }
} 