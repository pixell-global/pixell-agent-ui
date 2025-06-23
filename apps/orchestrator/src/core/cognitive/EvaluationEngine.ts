import { EventEmitter } from 'events'
import { Task, TaskId, UserId, TaskStatus } from '@pixell/protocols'
import { CognitiveUnderstanding } from './UnderstandingEngine'

export interface TaskEvaluationResult {
  taskId: TaskId
  status: 'success' | 'partial_success' | 'failure' | 'inconclusive'
  score: number // 0-1
  metrics: {
    completionRate: number
    qualityScore: number
    efficiency: number
    userSatisfaction?: number
  }
  feedback: string
  issues: TaskIssue[]
  lessons: string[]
  improvementSuggestions: string[]
  evaluatedAt: string
}

export interface TaskIssue {
  id: string
  type: 'performance' | 'quality' | 'resource' | 'process' | 'communication'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  impact: string
  rootCause?: string
  suggestedFix?: string
}

export interface PlanEffectivenessMetrics {
  planId: string
  overallScore: number // 0-1
  metrics: {
    accuracyScore: number // How well the plan matched actual needs
    adaptabilityScore: number // How well the plan adapted to changes
    resourceUtilization: number // Efficiency of resource usage
    timelinessScore: number // Whether timeline was met
    dependencyManagement: number // How well dependencies were handled
  }
  taskResults: TaskEvaluationResult[]
  planExecutionTime: number
  totalCost: number
  deviationsFromPlan: Array<{
    type: 'scope' | 'timeline' | 'resource' | 'dependency'
    description: string
    impact: string
  }>
}

export interface GoalAchievementAssessment {
  goalId: string
  achieved: boolean
  achievementScore: number // 0-1
  evidence: string[]
  gaps: string[]
  unexpectedOutcomes: string[]
  measuredResults?: {
    expected: number
    actual: number
    unit: string
  }
}

export interface LearningInsight {
  id: string
  category: 'pattern' | 'failure' | 'success' | 'optimization' | 'user_behavior'
  description: string
  context: {
    domain: string
    taskType: string
    userProfile: string
  }
  confidence: number
  applicability: string[] // Which scenarios this insight applies to
  actionable: boolean
  suggestedActions: string[]
  validatedCount: number // How many times this insight has been validated
}

export interface FeedbackData {
  source: 'user' | 'system' | 'agent' | 'metric'
  type: 'rating' | 'comment' | 'metric' | 'behavioral'
  content: any
  metadata: {
    timestamp: string
    context: Record<string, any>
    reliability: number // 0-1
  }
}

export interface FeedbackAnalysis {
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed'
  themes: Array<{
    theme: string
    frequency: number
    sentiment: 'positive' | 'negative' | 'neutral'
    examples: string[]
  }>
  patterns: Array<{
    pattern: string
    occurrence: number
    significance: number
  }>
  actionableInsights: string[]
  recommendations: string[]
}

export interface ImprovementActions {
  immediate: Array<{
    action: string
    priority: 'low' | 'medium' | 'high' | 'critical'
    estimatedImpact: number
    implementationCost: number
  }>
  shortTerm: Array<{
    action: string
    timeline: string
    resources: string[]
    expectedBenefit: string
  }>
  longTerm: Array<{
    action: string
    timeline: string
    strategicValue: string
    dependencies: string[]
  }>
}

export interface CognitiveEvaluation {
  taskResults: TaskEvaluationResult[]
  planEffectiveness: PlanEffectivenessMetrics
  goalAchievement: GoalAchievementAssessment
  learningInsights: LearningInsight[]
  
  // Overall evaluation metrics
  overallScore: number
  confidenceLevel: number
  recommendationStrength: 'weak' | 'moderate' | 'strong'
  
  // Evaluation metadata
  evaluatedAt: string
  evaluationDuration: number
  dataQuality: number
}

export interface EvaluationConfig {
  enableRealTimeEvaluation: boolean
  enableUserFeedbackCollection: boolean
  enableLearningInsights: boolean
  evaluationThresholds: {
    successThreshold: number
    qualityThreshold: number
    efficiencyThreshold: number
  }
  feedbackCollectionMethods: string[]
  learningInsightCategories: string[]
}

/**
 * EvaluationEngine - Comprehensive evaluation and learning system
 * 
 * Provides multi-dimensional evaluation of:
 * - Individual task performance and results
 * - Plan effectiveness and execution quality
 * - Goal achievement and success criteria
 * - Learning insights and improvement opportunities
 * - Continuous feedback collection and analysis
 */
export class EvaluationEngine extends EventEmitter {
  private config: EvaluationConfig
  private evaluationHistory = new Map<string, CognitiveEvaluation[]>()
  private learningInsights = new Map<string, LearningInsight[]>()
  private feedbackCollector: FeedbackCollector
  
  constructor(config: EvaluationConfig = {
    enableRealTimeEvaluation: true,
    enableUserFeedbackCollection: true,
    enableLearningInsights: true,
    evaluationThresholds: {
      successThreshold: 0.8,
      qualityThreshold: 0.7,
      efficiencyThreshold: 0.6
    },
    feedbackCollectionMethods: ['user_rating', 'system_metrics', 'behavioral_analysis'],
    learningInsightCategories: ['pattern', 'failure', 'success', 'optimization', 'user_behavior']
  }) {
    super()
    this.config = config
    this.feedbackCollector = new FeedbackCollector()
  }

  /**
   * Evaluate a completed task
   */
  async evaluateTask(
    task: Task,
    understanding: CognitiveUnderstanding,
    executionMetrics: Record<string, any> = {}
  ): Promise<TaskEvaluationResult> {
    console.log(`🔍 Evaluating task: ${task.name} (${task.id})`)
    
    try {
      // Calculate completion rate
      const completionRate = this.calculateCompletionRate(task, understanding)
      
      // Assess quality
      const qualityScore = await this.assessTaskQuality(task, understanding, executionMetrics)
      
      // Measure efficiency
      const efficiency = this.calculateEfficiency(task, executionMetrics)
      
      // Collect user satisfaction if available
      const userSatisfaction = await this.collectUserSatisfaction(task.userId, task.id)
      
      // Overall score calculation
      const score = this.calculateOverallTaskScore({
        completionRate,
        qualityScore,
        efficiency,
        userSatisfaction
      })
      
      // Determine task status
      const status = this.determineTaskStatus(score, task.status)
      
      // Identify issues
      const issues = await this.identifyTaskIssues(task, understanding, executionMetrics)
      
      // Extract lessons
      const lessons = this.extractLessons(task, understanding, issues)
      
      // Generate improvement suggestions
      const improvementSuggestions = this.generateImprovementSuggestions(task, issues, lessons)
      
      const evaluation: TaskEvaluationResult = {
        taskId: task.id,
        status,
        score,
        metrics: {
          completionRate,
          qualityScore,
          efficiency,
          userSatisfaction
        },
        feedback: this.generateTaskFeedback(task, score, issues),
        issues,
        lessons,
        improvementSuggestions,
        evaluatedAt: new Date().toISOString()
      }
      
      // Store evaluation
      await this.storeTaskEvaluation(task.userId, evaluation)
      
      this.emit('task:evaluated', task.id, evaluation)
      
      return evaluation
      
    } catch (error) {
      console.error(`❌ Task evaluation failed for ${task.id}:`, error)
      this.emit('evaluation:error', task.id, error)
      throw error
    }
  }

  /**
   * Evaluate plan effectiveness
   */
  async evaluatePlan(
    planId: string,
    tasks: Task[],
    understanding: CognitiveUnderstanding,
    executionMetrics: Record<string, any> = {}
  ): Promise<PlanEffectivenessMetrics> {
    console.log(`📊 Evaluating plan effectiveness: ${planId}`)
    
    try {
      // Evaluate all tasks in the plan
      const taskResults = await Promise.all(
        tasks.map(task => this.evaluateTask(task, understanding, executionMetrics))
      )
      
      // Calculate plan-level metrics
      const accuracyScore = this.calculatePlanAccuracy(tasks, understanding)
      const adaptabilityScore = this.calculatePlanAdaptability(tasks, executionMetrics)
      const resourceUtilization = this.calculateResourceUtilization(tasks, executionMetrics)
      const timelinessScore = this.calculateTimelinessScore(tasks)
      const dependencyManagement = this.calculateDependencyManagement(tasks)
      
      // Overall plan score
      const overallScore = this.calculateOverallPlanScore({
        accuracyScore,
        adaptabilityScore,
        resourceUtilization,
        timelinessScore,
        dependencyManagement
      })
      
      // Identify deviations from plan
      const deviationsFromPlan = this.identifyPlanDeviations(tasks, understanding)
      
      const evaluation: PlanEffectivenessMetrics = {
        planId,
        overallScore,
        metrics: {
          accuracyScore,
          adaptabilityScore,
          resourceUtilization,
          timelinessScore,
          dependencyManagement
        },
        taskResults,
        planExecutionTime: this.calculatePlanExecutionTime(tasks),
        totalCost: this.calculateTotalCost(tasks),
        deviationsFromPlan
      }
      
      this.emit('plan:evaluated', planId, evaluation)
      
      return evaluation
      
    } catch (error) {
      console.error(`❌ Plan evaluation failed for ${planId}:`, error)
      throw error
    }
  }

  /**
   * Assess goal achievement
   */
  async assessGoalAchievement(
    understanding: CognitiveUnderstanding,
    taskResults: TaskEvaluationResult[]
  ): Promise<GoalAchievementAssessment[]> {
    const assessments: GoalAchievementAssessment[] = []
    
    for (const goal of understanding.semanticIntent.goals) {
      const assessment = await this.evaluateGoal(goal, taskResults, understanding)
      assessments.push(assessment)
    }
    
    return assessments
  }

  /**
   * Collect and analyze feedback
   */
  async collectFeedback(
    userId: UserId,
    taskId: TaskId,
    feedbackData: Partial<FeedbackData>
  ): Promise<void> {
    const feedback: FeedbackData = {
      source: 'user',
      type: 'rating',
      content: {},
      metadata: {
        timestamp: new Date().toISOString(),
        context: { taskId, userId },
        reliability: 1.0
      },
      ...feedbackData
    }
    
    await this.feedbackCollector.collect(feedback)
    
    this.emit('feedback:collected', userId, taskId, feedback)
  }

  /**
   * Analyze collected feedback
   */
  async analyzeFeedback(
    userId: UserId,
    timeframe?: { start: string; end: string }
  ): Promise<FeedbackAnalysis> {
    const feedbackData = await this.feedbackCollector.getFeedback(userId, timeframe)
    
    const analysis: FeedbackAnalysis = {
      sentiment: this.analyzeSentiment(feedbackData),
      themes: this.extractThemes(feedbackData),
      patterns: this.identifyPatterns(feedbackData),
      actionableInsights: this.generateActionableInsights(feedbackData),
      recommendations: this.generateRecommendations(feedbackData)
    }
    
    this.emit('feedback:analyzed', userId, analysis)
    
    return analysis
  }

  /**
   * Generate improvement actions
   */
  async generateImprovementActions(
    userId: UserId,
    evaluations: CognitiveEvaluation[],
    feedbackAnalysis: FeedbackAnalysis
  ): Promise<ImprovementActions> {
    const actions: ImprovementActions = {
      immediate: [],
      shortTerm: [],
      longTerm: []
    }
    
    // Analyze evaluations for improvement opportunities
    const issues = evaluations.flatMap(e => e.taskResults.flatMap(t => t.issues))
    const patterns = this.identifyIssuePatterns(issues)
    
    // Generate immediate actions for critical issues
    const criticalIssues = issues.filter(issue => issue.severity === 'critical')
    criticalIssues.forEach(issue => {
      if (issue.suggestedFix) {
        actions.immediate.push({
          action: issue.suggestedFix,
          priority: 'critical',
          estimatedImpact: 0.8,
          implementationCost: 0.3
        })
      }
    })
    
    // Generate short-term actions from feedback themes
    feedbackAnalysis.themes
      .filter(theme => theme.sentiment === 'negative' && theme.frequency > 2)
      .forEach(theme => {
        actions.shortTerm.push({
          action: `Address recurring issue: ${theme.theme}`,
          timeline: '1-2 weeks',
          resources: ['development', 'testing'],
          expectedBenefit: `Improve user satisfaction for ${theme.theme}`
        })
      })
    
    // Generate long-term strategic actions
    patterns.forEach(pattern => {
      if (pattern.significance > 0.7) {
        actions.longTerm.push({
          action: `Systematic improvement for pattern: ${pattern.pattern}`,
          timeline: '1-3 months',
          strategicValue: 'Enhanced overall system capability',
          dependencies: ['analysis', 'design', 'implementation']
        })
      }
    })
    
    this.emit('improvements:generated', userId, actions)
    
    return actions
  }

  /**
   * Update models based on learnings
   */
  async updateModels(improvements: ImprovementActions): Promise<void> {
    // In production, this would update ML models, configuration, etc.
    console.log(`🔄 Updating models with ${improvements.immediate.length + improvements.shortTerm.length + improvements.longTerm.length} improvements`)
    
    this.emit('models:updated', improvements)
  }

  /**
   * Generate learning insights from evaluation history
   */
  async generateLearningInsights(
    userId: UserId,
    evaluations: CognitiveEvaluation[]
  ): Promise<LearningInsight[]> {
    const insights: LearningInsight[] = []
    
    // Pattern-based insights
    const patterns = this.identifySuccessPatterns(evaluations)
    patterns.forEach(pattern => {
      insights.push({
        id: `pattern-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        category: 'pattern',
        description: pattern.description,
        context: pattern.context,
        confidence: pattern.confidence,
        applicability: pattern.applicability,
        actionable: true,
        suggestedActions: pattern.suggestedActions,
        validatedCount: 1
      })
    })
    
    // Failure analysis insights
    const failures = evaluations.flatMap(e => 
      e.taskResults.filter(t => t.status === 'failure')
    )
    
    if (failures.length > 0) {
      const failureInsight = this.analyzeFailures(failures)
      if (failureInsight) {
        insights.push(failureInsight)
      }
    }
    
    // Store insights
    const existingInsights = this.learningInsights.get(userId) || []
    this.learningInsights.set(userId, [...existingInsights, ...insights])
    
    this.emit('insights:generated', userId, insights)
    
    return insights
  }

  /**
   * Get evaluation statistics
   */
  getEvaluationStats(userId: UserId): Record<string, any> {
    const evaluations = this.evaluationHistory.get(userId) || []
    const insights = this.learningInsights.get(userId) || []
    
    if (evaluations.length === 0) {
      return { evaluations: 0, insights: 0 }
    }
    
    const allTasks = evaluations.flatMap(e => e.taskResults)
    const successRate = allTasks.filter(t => t.status === 'success').length / allTasks.length
    const averageScore = allTasks.reduce((sum, t) => sum + t.score, 0) / allTasks.length
    
    return {
      totalEvaluations: evaluations.length,
      totalTasks: allTasks.length,
      successRate,
      averageScore,
      totalInsights: insights.length,
      averageConfidence: evaluations.reduce((sum, e) => sum + e.confidenceLevel, 0) / evaluations.length,
      topIssueTypes: this.getTopIssueTypes(allTasks),
      improvementTrend: this.calculateImprovementTrend(evaluations)
    }
  }

  // Private helper methods

  private calculateCompletionRate(task: Task, understanding: CognitiveUnderstanding): number {
    // Simple completion rate based on task status
    switch (task.status) {
      case 'succeeded': return 1.0
      case 'failed': return 0.0
      case 'paused': return task.progress / 100
      default: return task.progress / 100
    }
  }

  private async assessTaskQuality(
    task: Task,
    understanding: CognitiveUnderstanding,
    executionMetrics: Record<string, any>
  ): Promise<number> {
    let qualityScore = 0.5 // Base score
    
    // Assess based on task completion
    if (task.status === 'succeeded') {
      qualityScore += 0.3
    }
    
    // Assess based on error rate
    const errorRate = executionMetrics.errorRate || 0
    qualityScore += (1 - errorRate) * 0.2
    
    return Math.min(1.0, qualityScore)
  }

  private calculateEfficiency(task: Task, executionMetrics: Record<string, any>): number {
    const actualDuration = executionMetrics.duration || 0
    const estimatedDuration = executionMetrics.estimatedDuration || actualDuration
    
    if (estimatedDuration === 0) return 0.5 // Default if no estimate
    
    const efficiency = Math.min(1.0, estimatedDuration / actualDuration)
    return efficiency
  }

  private async collectUserSatisfaction(userId: UserId, taskId: TaskId): Promise<number | undefined> {
    // In production, this would collect user ratings
    // For now, return undefined
    return undefined
  }

  private calculateOverallTaskScore(metrics: {
    completionRate: number
    qualityScore: number
    efficiency: number
    userSatisfaction?: number
  }): number {
    let score = metrics.completionRate * 0.4 + metrics.qualityScore * 0.3 + metrics.efficiency * 0.2
    
    if (metrics.userSatisfaction !== undefined) {
      score = score * 0.9 + metrics.userSatisfaction * 0.1
    }
    
    return Math.min(1.0, score)
  }

  private determineTaskStatus(score: number, currentStatus: TaskStatus): 'success' | 'partial_success' | 'failure' | 'inconclusive' {
    if (currentStatus === 'failed' || score < 0.3) return 'failure'
    if (score >= this.config.evaluationThresholds.successThreshold) return 'success'
    if (score >= 0.5) return 'partial_success'
    return 'inconclusive'
  }

  private async identifyTaskIssues(
    task: Task,
    understanding: CognitiveUnderstanding,
    executionMetrics: Record<string, any>
  ): Promise<TaskIssue[]> {
    const issues: TaskIssue[] = []
    
    // Check for performance issues
    if (executionMetrics.duration > (executionMetrics.estimatedDuration * 1.5)) {
      issues.push({
        id: `perf-${task.id}`,
        type: 'performance',
        severity: 'medium',
        description: 'Task took longer than expected',
        impact: 'Delayed overall completion',
        suggestedFix: 'Optimize task execution or improve time estimation'
      })
    }
    
    // Check for quality issues
    if (executionMetrics.errorRate > 0.1) {
      issues.push({
        id: `qual-${task.id}`,
        type: 'quality',
        severity: 'high',
        description: 'High error rate during execution',
        impact: 'Reduced output quality',
        suggestedFix: 'Improve error handling and validation'
      })
    }
    
    return issues
  }

  private extractLessons(
    task: Task,
    understanding: CognitiveUnderstanding,
    issues: TaskIssue[]
  ): string[] {
    const lessons: string[] = []
    
    if (task.status === 'succeeded') {
      lessons.push(`Successfully completed ${task.name} using ${understanding.semanticIntent.context.domain} domain knowledge`)
    }
    
    issues.forEach(issue => {
      if (issue.rootCause) {
        lessons.push(`Root cause identified: ${issue.rootCause}`)
      }
    })
    
    return lessons
  }

  private generateImprovementSuggestions(
    task: Task,
    issues: TaskIssue[],
    lessons: string[]
  ): string[] {
    const suggestions: string[] = []
    
    issues.forEach(issue => {
      if (issue.suggestedFix) {
        suggestions.push(issue.suggestedFix)
      }
    })
    
    if (suggestions.length === 0) {
      suggestions.push('Continue with current approach')
    }
    
    return suggestions
  }

  private generateTaskFeedback(task: Task, score: number, issues: TaskIssue[]): string {
    let feedback = `Task "${task.name}" completed with a score of ${(score * 100).toFixed(1)}%.`
    
    if (score >= 0.8) {
      feedback += " Excellent performance!"
    } else if (score >= 0.6) {
      feedback += " Good performance with room for improvement."
    } else {
      feedback += " Performance needs improvement."
    }
    
    if (issues.length > 0) {
      feedback += ` Identified ${issues.length} issue(s) for attention.`
    }
    
    return feedback
  }

  private async storeTaskEvaluation(userId: UserId, evaluation: TaskEvaluationResult): Promise<void> {
    // In production, store in database
    // For now, store in memory
  }

  // Additional helper methods for plan evaluation
  
  private calculatePlanAccuracy(tasks: Task[], understanding: CognitiveUnderstanding): number {
    // Simple accuracy based on task completion rate
    const completedTasks = tasks.filter(t => t.status === 'succeeded').length
    return completedTasks / Math.max(tasks.length, 1)
  }

  private calculatePlanAdaptability(tasks: Task[], executionMetrics: Record<string, any>): number {
    // Placeholder - in production, this would measure how well the plan adapted to changes
    return 0.7
  }

  private calculateResourceUtilization(tasks: Task[], executionMetrics: Record<string, any>): number {
    // Placeholder - in production, this would measure resource efficiency
    return 0.8
  }

  private calculateTimelinessScore(tasks: Task[]): number {
    // Simple timeliness based on task completion
    const onTimeTasks = tasks.filter(t => t.status === 'succeeded').length
    return onTimeTasks / Math.max(tasks.length, 1)
  }

  private calculateDependencyManagement(tasks: Task[]): number {
    // Placeholder - in production, this would analyze dependency handling
    return 0.75
  }

  private calculateOverallPlanScore(metrics: {
    accuracyScore: number
    adaptabilityScore: number
    resourceUtilization: number
    timelinessScore: number
    dependencyManagement: number
  }): number {
    return (
      metrics.accuracyScore * 0.3 +
      metrics.adaptabilityScore * 0.2 +
      metrics.resourceUtilization * 0.2 +
      metrics.timelinessScore * 0.2 +
      metrics.dependencyManagement * 0.1
    )
  }

  private identifyPlanDeviations(tasks: Task[], understanding: CognitiveUnderstanding): Array<{ type: 'scope' | 'timeline' | 'resource' | 'dependency'; description: string; impact: string }> {
    const deviations: Array<{ type: 'scope' | 'timeline' | 'resource' | 'dependency'; description: string; impact: string }> = []
    
    // Check for timeline deviations
    const delayedTasks = tasks.filter(t => t.status === 'failed' || t.status === 'paused')
    if (delayedTasks.length > 0) {
      deviations.push({
        type: 'timeline',
        description: `${delayedTasks.length} tasks delayed or failed`,
        impact: 'Overall plan timeline affected'
      })
    }
    
    return deviations
  }

  private calculatePlanExecutionTime(tasks: Task[]): number {
    // Simple calculation based on task creation/completion times
    if (tasks.length === 0) return 0
    
    const startTimes = tasks.map(t => new Date(t.createdAt).getTime())
    const endTimes = tasks.map(t => new Date(t.updatedAt).getTime())
    
    const startTime = Math.min(...startTimes)
    const endTime = Math.max(...endTimes)
    
    return endTime - startTime
  }

  private calculateTotalCost(tasks: Task[]): number {
    // Placeholder cost calculation
    return tasks.length * 0.01 // $0.01 per task
  }

  private async evaluateGoal(
    goal: any,
    taskResults: TaskEvaluationResult[],
    understanding: CognitiveUnderstanding
  ): Promise<GoalAchievementAssessment> {
    const relatedTasks = taskResults.filter(tr => 
      tr.feedback.toLowerCase().includes(goal.description.toLowerCase().substring(0, 10))
    )
    
    const achieved = relatedTasks.length > 0 && relatedTasks.every(tr => tr.status === 'success')
    const achievementScore = achieved ? 1.0 : (relatedTasks.filter(tr => tr.status === 'success').length / Math.max(relatedTasks.length, 1))
    
    return {
      goalId: goal.id,
      achieved,
      achievementScore,
      evidence: relatedTasks.map(tr => tr.feedback),
      gaps: achieved ? [] : ['Goal not fully achieved through task execution'],
      unexpectedOutcomes: []
    }
  }

  // Feedback analysis methods
  
  private analyzeSentiment(feedbackData: FeedbackData[]): 'positive' | 'negative' | 'neutral' | 'mixed' {
    // Simple sentiment analysis - in production, use NLP libraries
    const positive = feedbackData.filter(f => 
      typeof f.content === 'string' && (f.content.includes('good') || f.content.includes('great'))
    ).length
    const negative = feedbackData.filter(f => 
      typeof f.content === 'string' && (f.content.includes('bad') || f.content.includes('poor'))
    ).length
    
    if (positive > negative * 1.5) return 'positive'
    if (negative > positive * 1.5) return 'negative'
    if (positive > 0 && negative > 0) return 'mixed'
    return 'neutral'
  }

  private extractThemes(feedbackData: FeedbackData[]): Array<{ theme: string; frequency: number; sentiment: 'positive' | 'negative' | 'neutral'; examples: string[] }> {
    // Simple theme extraction - in production, use topic modeling
    const themes = new Map<string, { count: number; examples: string[]; sentiments: string[] }>()
    
    feedbackData.forEach(feedback => {
      if (typeof feedback.content === 'string') {
        // Extract simple themes
        const words = feedback.content.toLowerCase().split(' ')
        words.forEach(word => {
          if (word.length > 4) { // Simple filter for meaningful words
            const existing = themes.get(word) || { count: 0, examples: [], sentiments: [] }
            existing.count++
            existing.examples.push(feedback.content)
            themes.set(word, existing)
          }
        })
      }
    })
    
    return Array.from(themes.entries())
      .sort(([,a], [,b]) => b.count - a.count)
      .slice(0, 5)
      .map(([theme, data]) => ({
        theme,
        frequency: data.count,
        sentiment: 'neutral' as const, // Simplified
        examples: data.examples.slice(0, 3)
      }))
  }

  private identifyPatterns(feedbackData: FeedbackData[]): Array<{ pattern: string; occurrence: number; significance: number }> {
    // Simple pattern identification
    return [
      {
        pattern: 'Feedback frequency pattern',
        occurrence: feedbackData.length,
        significance: feedbackData.length > 10 ? 0.8 : 0.4
      }
    ]
  }

  private generateActionableInsights(feedbackData: FeedbackData[]): string[] {
    const insights: string[] = []
    
    if (feedbackData.length > 5) {
      insights.push('Sufficient feedback collected for trend analysis')
    }
    
    if (feedbackData.filter(f => f.source === 'user').length > 0) {
      insights.push('User feedback available for quality assessment')
    }
    
    return insights
  }

  private generateRecommendations(feedbackData: FeedbackData[]): string[] {
    const recommendations: string[] = []
    
    if (feedbackData.length < 3) {
      recommendations.push('Collect more feedback to improve evaluation accuracy')
    }
    
    recommendations.push('Continue monitoring user satisfaction trends')
    
    return recommendations
  }

  private identifyIssuePatterns(issues: TaskIssue[]): Array<{ pattern: string; occurrence: number; significance: number }> {
    const patterns = new Map<string, number>()
    
    issues.forEach(issue => {
      const key = `${issue.type}-${issue.severity}`
      patterns.set(key, (patterns.get(key) || 0) + 1)
    })
    
    return Array.from(patterns.entries()).map(([pattern, occurrence]) => ({
      pattern,
      occurrence,
      significance: occurrence > 2 ? 0.8 : 0.4
    }))
  }

  private identifySuccessPatterns(evaluations: CognitiveEvaluation[]): Array<{
    description: string
    context: any
    confidence: number
    applicability: string[]
    suggestedActions: string[]
  }> {
    const patterns: Array<{
      description: string
      context: any
      confidence: number
      applicability: string[]
      suggestedActions: string[]
    }> = []
    
    const successfulTasks = evaluations.flatMap(e => 
      e.taskResults.filter(t => t.status === 'success')
    )
    
    if (successfulTasks.length > 3) {
      patterns.push({
        description: 'High success rate pattern identified',
        context: {
          domain: 'general',
          taskType: 'multiple',
          userProfile: 'active'
        },
        confidence: 0.8,
        applicability: ['similar task types'],
        suggestedActions: ['Continue current approach', 'Scale successful patterns']
      })
    }
    
    return patterns
  }

  private analyzeFailures(failures: TaskEvaluationResult[]): LearningInsight | null {
    if (failures.length === 0) return null
    
    const commonIssues = failures.flatMap(f => f.issues)
      .reduce((acc, issue) => {
        acc[issue.type] = (acc[issue.type] || 0) + 1
        return acc
      }, {} as Record<string, number>)
    
    const topIssue = Object.entries(commonIssues)
      .sort(([,a], [,b]) => b - a)[0]
    
    if (!topIssue) return null
    
    return {
      id: `failure-analysis-${Date.now()}`,
      category: 'failure',
      description: `Common failure pattern: ${topIssue[0]} issues`,
      context: {
        domain: 'general',
        taskType: 'multiple',
        userProfile: 'active'
      },
      confidence: topIssue[1] / failures.length,
      applicability: ['similar failure scenarios'],
      actionable: true,
      suggestedActions: [`Address ${topIssue[0]} issues systematically`],
      validatedCount: 1
    }
  }

  private getTopIssueTypes(tasks: TaskEvaluationResult[]): string[] {
    const issueTypes = new Map<string, number>()
    
    tasks.forEach(task => {
      task.issues.forEach(issue => {
        issueTypes.set(issue.type, (issueTypes.get(issue.type) || 0) + 1)
      })
    })
    
    return Array.from(issueTypes.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([type]) => type)
  }

  private calculateImprovementTrend(evaluations: CognitiveEvaluation[]): 'improving' | 'stable' | 'declining' {
    if (evaluations.length < 2) return 'stable'
    
    const recentScore = evaluations[evaluations.length - 1].overallScore
    const earlierScore = evaluations[0].overallScore
    
    if (recentScore > earlierScore + 0.1) return 'improving'
    if (recentScore < earlierScore - 0.1) return 'declining'
    return 'stable'
  }
}

/**
 * FeedbackCollector - Handles collection and storage of feedback data
 */
class FeedbackCollector {
  private feedbackStore = new Map<string, FeedbackData[]>()
  
  async collect(feedback: FeedbackData): Promise<void> {
    const userId = feedback.metadata.context.userId as string
    const existing = this.feedbackStore.get(userId) || []
    existing.push(feedback)
    this.feedbackStore.set(userId, existing)
  }
  
  async getFeedback(
    userId: string,
    timeframe?: { start: string; end: string }
  ): Promise<FeedbackData[]> {
    const feedback = this.feedbackStore.get(userId) || []
    
    if (!timeframe) return feedback
    
    const startTime = new Date(timeframe.start).getTime()
    const endTime = new Date(timeframe.end).getTime()
    
    return feedback.filter(f => {
      const feedbackTime = new Date(f.metadata.timestamp).getTime()
      return feedbackTime >= startTime && feedbackTime <= endTime
    })
  }
} 