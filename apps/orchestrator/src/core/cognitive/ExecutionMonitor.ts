import { EventEmitter } from 'events'
import { v4 as uuidv4 } from 'uuid'
import { Task, TaskId, UserId } from '@pixell/protocols'
import { ExecutionPlan, MonitoringPoint } from './AdvancedPlanningEngine'

export interface ExecutionState {
  planId: string
  status: 'initializing' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'
  startTime: string
  endTime?: string
  currentPhase: string
  completedTasks: TaskId[]
  activeTasks: TaskId[]
  failedTasks: TaskId[]
  progress: number // 0-1
  resourceUsage: ResourceUsage
  performance: PerformanceMetrics
}

export interface ResourceUsage {
  cpu: number
  memory: number
  network: number
  cost: number
  timeElapsed: number
}

export interface PerformanceMetrics {
  tasksCompleted: number
  tasksRunning: number
  tasksFailed: number
  averageTaskDuration: number
  successRate: number
  throughput: number // tasks per minute
  errorRate: number
  bottlenecks: string[]
}

export interface Anomaly {
  id: string
  type: 'performance' | 'resource' | 'error' | 'pattern' | 'deviation'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  detectedAt: string
  affectedComponents: string[]
  metrics: Record<string, number>
  suggestedActions: string[]
  confidence: number
}

export interface ExecutionAlert {
  id: string
  type: 'threshold_exceeded' | 'anomaly_detected' | 'task_failed' | 'resource_exhausted' | 'deadline_risk'
  severity: 'info' | 'warning' | 'error' | 'critical'
  message: string
  timestamp: string
  context: Record<string, any>
  recommendedAction: string
  autoResolution?: {
    enabled: boolean
    action: string
    confidence: number
  }
}

export interface AdaptationTrigger {
  type: 'resource_constraint' | 'performance_degradation' | 'failure_pattern' | 'external_change'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  recommendedActions: AdaptationAction[]
  urgency: number // 0-1
  impact: number // 0-1
}

export interface AdaptationAction {
  type: 'scale_resources' | 'retry_task' | 'switch_agent' | 'modify_plan' | 'pause_execution'
  description: string
  estimatedImpact: string
  cost: number
  timeRequired: number
  confidence: number
}

export interface MonitoringConfig {
  monitoringInterval: number // milliseconds
  anomalyDetectionEnabled: boolean
  adaptationThreshold: number // 0-1
  alertingEnabled: boolean
  autoResolutionEnabled: boolean
  performanceHistorySize: number
  resourceThresholds: {
    cpu: number
    memory: number
    cost: number
    taskFailureRate: number
  }
}

/**
 * ExecutionMonitor - Real-time monitoring and adaptation during plan execution
 * 
 * Phase 2 Implementation Features:
 * - Real-time execution state tracking
 * - Anomaly detection using statistical methods
 * - Performance metrics collection and analysis
 * - Adaptive threshold-based alerting
 * - Automatic resolution suggestions
 * - Resource usage monitoring and optimization
 */
export class ExecutionMonitor extends EventEmitter {
  private config: MonitoringConfig
  private activeExecutions = new Map<string, ExecutionState>()
  private monitoringTimers = new Map<string, NodeJS.Timeout>()
  private performanceHistory: PerformanceMetrics[] = []
  private anomalyDetectors = new Map<string, AnomalyDetector>()
  private alertHistory: ExecutionAlert[] = []
  
  private metrics = {
    totalExecutionsMonitored: 0,
    anomaliesDetected: 0,
    alertsGenerated: 0,
    adaptationTriggersActivated: 0,
    averageExecutionTime: 0,
    uptime: Date.now()
  }

  constructor(config: MonitoringConfig) {
    super()
    this.config = config
    this.initializeAnomalyDetectors()
  }

  /**
   * Start monitoring plan execution
   */
  async startMonitoring(
    plan: ExecutionPlan,
    monitoringPoints: MonitoringPoint[]
  ): Promise<void> {
    const planId = plan.id
    console.log(`📊 Starting execution monitoring for plan: ${planId}`)
    
    try {
      // Initialize execution state
      const executionState: ExecutionState = {
        planId,
        status: 'initializing',
        startTime: new Date().toISOString(),
        currentPhase: 'initialization',
        completedTasks: [],
        activeTasks: [],
        failedTasks: [],
        progress: 0,
        resourceUsage: {
          cpu: 0,
          memory: 0,
          network: 0,
          cost: 0,
          timeElapsed: 0
        },
        performance: {
          tasksCompleted: 0,
          tasksRunning: 0,
          tasksFailed: 0,
          averageTaskDuration: 0,
          successRate: 1,
          throughput: 0,
          errorRate: 0,
          bottlenecks: []
        }
      }
      
      this.activeExecutions.set(planId, executionState)
      
      // Configure monitoring points
      await this.configureMonitoringPoints(planId, monitoringPoints)
      
      // Start monitoring timer
      const timer = setInterval(
        () => this.performMonitoringCycle(planId),
        this.config.monitoringInterval
      )
      this.monitoringTimers.set(planId, timer)
      
      // Update status to running
      executionState.status = 'running'
      executionState.currentPhase = 'execution'
      
      this.metrics.totalExecutionsMonitored++
      
      console.log(`✅ Execution monitoring started for plan: ${planId}`)
      this.emit('monitoring:started', planId, executionState)
      
    } catch (error) {
      console.error(`❌ Failed to start monitoring for plan ${planId}:`, error)
      this.emit('monitoring:start:failed', planId, error)
      throw error
    }
  }

  /**
   * Stop monitoring plan execution
   */
  async stopMonitoring(planId: string): Promise<void> {
    console.log(`🛑 Stopping execution monitoring for plan: ${planId}`)
    
    const timer = this.monitoringTimers.get(planId)
    if (timer) {
      clearInterval(timer)
      this.monitoringTimers.delete(planId)
    }
    
    const executionState = this.activeExecutions.get(planId)
    if (executionState) {
      executionState.status = 'completed'
      executionState.endTime = new Date().toISOString()
      
      // Calculate final metrics
      const totalTime = Date.now() - new Date(executionState.startTime).getTime()
      executionState.resourceUsage.timeElapsed = totalTime / 1000
      
      // Store performance history
      this.storePerformanceHistory(executionState.performance)
      
      this.emit('monitoring:stopped', planId, executionState)
    }
    
    // Clean up anomaly detectors
    this.anomalyDetectors.delete(planId)
    
    console.log(`✅ Monitoring stopped for plan: ${planId}`)
  }

  /**
   * Update task status and trigger monitoring analysis
   */
  async updateTaskStatus(planId: string, task: Task): Promise<void> {
    const executionState = this.activeExecutions.get(planId)
    if (!executionState) {
      console.warn(`⚠️  No monitoring state found for plan: ${planId}`)
      return
    }
    
    // Update task lists
    const taskId = task.id
    
    switch (task.status) {
      case 'running':
        if (!executionState.activeTasks.includes(taskId)) {
          executionState.activeTasks.push(taskId)
          executionState.performance.tasksRunning++
        }
        break
        
      case 'succeeded':
        this.moveTaskToCompleted(executionState, taskId)
        executionState.performance.tasksCompleted++
        break
        
      case 'failed':
        this.moveTaskToFailed(executionState, taskId)
        executionState.performance.tasksFailed++
        
        // Trigger failure analysis
        await this.analyzeTaskFailure(planId, task)
        break
    }
    
    // Update progress
    const totalTasks = executionState.completedTasks.length + 
                     executionState.activeTasks.length + 
                     executionState.failedTasks.length
    
    if (totalTasks > 0) {
      executionState.progress = executionState.completedTasks.length / totalTasks
    }
    
    // Update performance metrics
    this.updatePerformanceMetrics(executionState)
    
    this.emit('task:status:updated', planId, task, executionState)
  }

  /**
   * Report resource usage update
   */
  async updateResourceUsage(planId: string, usage: Partial<ResourceUsage>): Promise<void> {
    const executionState = this.activeExecutions.get(planId)
    if (!executionState) return
    
    // Update resource usage
    Object.assign(executionState.resourceUsage, usage)
    
    // Check for resource threshold violations
    await this.checkResourceThresholds(planId, executionState)
    
    this.emit('resource:usage:updated', planId, executionState.resourceUsage)
  }

  /**
   * Get current execution state
   */
  getExecutionState(planId: string): ExecutionState | undefined {
    return this.activeExecutions.get(planId)
  }

  /**
   * Get recent anomalies for a plan
   */
  getRecentAnomalies(planId: string, limit: number = 10): Anomaly[] {
    const detector = this.anomalyDetectors.get(planId)
    return detector?.getRecentAnomalies(limit) || []
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(limit: number = 20): ExecutionAlert[] {
    return this.alertHistory
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit)
  }

  /**
   * Get monitoring statistics
   */
  getMonitoringStats(): Record<string, any> {
    const activeExecutionsCount = this.activeExecutions.size
    const recentPerformance = this.performanceHistory.slice(-10)
    
    return {
      ...this.metrics,
      activeExecutions: activeExecutionsCount,
      averageSuccessRate: recentPerformance.length > 0 
        ? recentPerformance.reduce((sum, p) => sum + p.successRate, 0) / recentPerformance.length
        : 0,
      averageThroughput: recentPerformance.length > 0
        ? recentPerformance.reduce((sum, p) => sum + p.throughput, 0) / recentPerformance.length
        : 0,
      recentAnomalies: Array.from(this.anomalyDetectors.values())
        .reduce((sum, detector) => sum + detector.getAnomalyCount(), 0),
      alertingEnabled: this.config.alertingEnabled,
      adaptationEnabled: this.config.autoResolutionEnabled
    }
  }

  /**
   * Manually trigger adaptation analysis
   */
  async triggerAdaptationAnalysis(planId: string): Promise<AdaptationTrigger[]> {
    console.log(`🔄 Triggering adaptation analysis for plan: ${planId}`)
    
    const executionState = this.activeExecutions.get(planId)
    if (!executionState) {
      throw new Error(`No execution state found for plan: ${planId}`)
    }
    
    return await this.analyzeAdaptationNeeds(planId, executionState)
  }

  // Private implementation methods

  private async performMonitoringCycle(planId: string): Promise<void> {
    const executionState = this.activeExecutions.get(planId)
    if (!executionState) return
    
    try {
      // Update resource usage tracking
      this.updateResourceTracking(executionState)
      
      // Detect anomalies
      if (this.config.anomalyDetectionEnabled) {
        await this.detectAnomalies(planId, executionState)
      }
      
      // Check for adaptation triggers
      const adaptationTriggers = await this.analyzeAdaptationNeeds(planId, executionState)
      
      if (adaptationTriggers.length > 0) {
        await this.handleAdaptationTriggers(planId, adaptationTriggers)
      }
      
      // Emit monitoring update
      this.emit('monitoring:cycle:completed', planId, executionState)
      
    } catch (error) {
      console.error(`❌ Monitoring cycle failed for plan ${planId}:`, error)
      this.emit('monitoring:cycle:failed', planId, error)
    }
  }

  private async configureMonitoringPoints(
    planId: string,
    monitoringPoints: MonitoringPoint[]
  ): Promise<void> {
    // Initialize anomaly detector for this plan
    const detector = new AnomalyDetector(planId, this.config)
    this.anomalyDetectors.set(planId, detector)
    
    // Configure monitoring thresholds based on monitoring points
    for (const point of monitoringPoints) {
      detector.configureMonitoringPoint(point)
    }
  }

  private moveTaskToCompleted(executionState: ExecutionState, taskId: TaskId): void {
    const activeIndex = executionState.activeTasks.indexOf(taskId)
    if (activeIndex > -1) {
      executionState.activeTasks.splice(activeIndex, 1)
      executionState.performance.tasksRunning--
    }
    
    if (!executionState.completedTasks.includes(taskId)) {
      executionState.completedTasks.push(taskId)
    }
  }

  private moveTaskToFailed(executionState: ExecutionState, taskId: TaskId): void {
    const activeIndex = executionState.activeTasks.indexOf(taskId)
    if (activeIndex > -1) {
      executionState.activeTasks.splice(activeIndex, 1)
      executionState.performance.tasksRunning--
    }
    
    if (!executionState.failedTasks.includes(taskId)) {
      executionState.failedTasks.push(taskId)
    }
  }

  private updatePerformanceMetrics(executionState: ExecutionState): void {
    const total = executionState.completedTasks.length + executionState.failedTasks.length
    
    if (total > 0) {
      executionState.performance.successRate = executionState.completedTasks.length / total
      executionState.performance.errorRate = executionState.failedTasks.length / total
      
      // Calculate throughput (tasks per minute)
      const timeElapsed = (Date.now() - new Date(executionState.startTime).getTime()) / 1000 / 60
      if (timeElapsed > 0) {
        executionState.performance.throughput = total / timeElapsed
      }
    }
  }

  private updateResourceTracking(executionState: ExecutionState): void {
    // Simulate resource usage updates
    const timeElapsed = (Date.now() - new Date(executionState.startTime).getTime()) / 1000
    executionState.resourceUsage.timeElapsed = timeElapsed
    
    // Add some realistic resource usage simulation
    executionState.resourceUsage.cpu = Math.min(1, 0.3 + Math.random() * 0.4)
    executionState.resourceUsage.memory = Math.min(1, 0.2 + Math.random() * 0.3)
    executionState.resourceUsage.network = Math.min(1, 0.1 + Math.random() * 0.2)
    executionState.resourceUsage.cost += 0.001 * executionState.activeTasks.length
  }

  private async detectAnomalies(planId: string, executionState: ExecutionState): Promise<void> {
    const detector = this.anomalyDetectors.get(planId)
    if (!detector) return
    
    // Feed current metrics to anomaly detector
    const currentMetrics = {
      cpu: executionState.resourceUsage.cpu,
      memory: executionState.resourceUsage.memory,
      successRate: executionState.performance.successRate,
      errorRate: executionState.performance.errorRate,
      throughput: executionState.performance.throughput,
      activeTasks: executionState.activeTasks.length
    }
    
    const anomalies = await detector.detectAnomalies(currentMetrics)
    
    for (const anomaly of anomalies) {
      this.metrics.anomaliesDetected++
      
      // Generate alert if anomaly is significant
      if (anomaly.severity === 'high' || anomaly.severity === 'critical') {
        await this.generateAlert(planId, {
          type: 'anomaly_detected',
          severity: anomaly.severity === 'critical' ? 'critical' : 'error',
          message: `Anomaly detected: ${anomaly.description}`,
          context: { anomaly, executionState: planId },
          recommendedAction: anomaly.suggestedActions[0] || 'Investigate anomaly'
        })
      }
      
      this.emit('anomaly:detected', planId, anomaly)
    }
  }

  private async checkResourceThresholds(planId: string, executionState: ExecutionState): Promise<void> {
    const thresholds = this.config.resourceThresholds
    const usage = executionState.resourceUsage
    const performance = executionState.performance
    
    // Check CPU threshold
    if (usage.cpu > thresholds.cpu) {
      await this.generateAlert(planId, {
        type: 'threshold_exceeded',
        severity: 'warning',
        message: `CPU usage (${(usage.cpu * 100).toFixed(1)}%) exceeds threshold (${(thresholds.cpu * 100).toFixed(1)}%)`,
        context: { metric: 'cpu', value: usage.cpu, threshold: thresholds.cpu },
        recommendedAction: 'Consider scaling resources or optimizing tasks'
      })
    }
    
    // Check memory threshold
    if (usage.memory > thresholds.memory) {
      await this.generateAlert(planId, {
        type: 'threshold_exceeded',
        severity: 'warning',
        message: `Memory usage (${(usage.memory * 100).toFixed(1)}%) exceeds threshold (${(thresholds.memory * 100).toFixed(1)}%)`,
        context: { metric: 'memory', value: usage.memory, threshold: thresholds.memory },
        recommendedAction: 'Monitor memory usage and consider optimization'
      })
    }
    
    // Check task failure rate
    if (performance.errorRate > thresholds.taskFailureRate) {
      await this.generateAlert(planId, {
        type: 'threshold_exceeded',
        severity: 'error',
        message: `Task failure rate (${(performance.errorRate * 100).toFixed(1)}%) exceeds threshold (${(thresholds.taskFailureRate * 100).toFixed(1)}%)`,
        context: { metric: 'errorRate', value: performance.errorRate, threshold: thresholds.taskFailureRate },
        recommendedAction: 'Investigate failing tasks and consider plan modification'
      })
    }
  }

  private async analyzeTaskFailure(planId: string, task: Task): Promise<void> {
    console.log(`🔍 Analyzing task failure: ${task.name} (${task.id})`)
    
    // Generate failure alert
    await this.generateAlert(planId, {
      type: 'task_failed',
      severity: 'error',
      message: `Task failed: ${task.name}`,
      context: { task },
      recommendedAction: 'Retry task or investigate root cause',
      autoResolution: {
        enabled: this.config.autoResolutionEnabled,
        action: 'retry_with_backoff',
        confidence: 0.7
      }
    })
    
    this.emit('task:failure:analyzed', planId, task)
  }

  private async analyzeAdaptationNeeds(
    planId: string,
    executionState: ExecutionState
  ): Promise<AdaptationTrigger[]> {
    const triggers: AdaptationTrigger[] = []
    
    // Check for performance degradation
    if (executionState.performance.successRate < 0.8) {
      triggers.push({
        type: 'performance_degradation',
        severity: 'high',
        description: `Success rate dropped to ${(executionState.performance.successRate * 100).toFixed(1)}%`,
        recommendedActions: [
          {
            type: 'modify_plan',
            description: 'Adjust plan to improve success rate',
            estimatedImpact: 'Improved reliability',
            cost: 0.05,
            timeRequired: 300,
            confidence: 0.8
          }
        ],
        urgency: 0.8,
        impact: 0.9
      })
    }
    
    // Check for resource constraints
    if (executionState.resourceUsage.cpu > 0.9 || executionState.resourceUsage.memory > 0.9) {
      triggers.push({
        type: 'resource_constraint',
        severity: 'medium',
        description: 'Resource utilization approaching limits',
        recommendedActions: [
          {
            type: 'scale_resources',
            description: 'Scale up available resources',
            estimatedImpact: 'Improved performance',
            cost: 0.1,
            timeRequired: 180,
            confidence: 0.9
          }
        ],
        urgency: 0.6,
        impact: 0.7
      })
    }
    
    return triggers
  }

  private async handleAdaptationTriggers(
    planId: string,
    triggers: AdaptationTrigger[]
  ): Promise<void> {
    console.log(`🔄 Handling ${triggers.length} adaptation triggers for plan: ${planId}`)
    
    for (const trigger of triggers) {
      if (trigger.urgency > this.config.adaptationThreshold) {
        this.metrics.adaptationTriggersActivated++
        
        // Generate high-priority alert
        await this.generateAlert(planId, {
          type: 'resource_exhausted',
          severity: trigger.severity === 'critical' ? 'critical' : 'warning',
          message: `Adaptation needed: ${trigger.description}`,
          context: { trigger },
          recommendedAction: trigger.recommendedActions[0]?.description || 'Manual intervention required'
        })
        
        this.emit('adaptation:triggered', planId, trigger)
      }
    }
  }

  private async generateAlert(planId: string, alertData: Omit<ExecutionAlert, 'id' | 'timestamp'>): Promise<void> {
    if (!this.config.alertingEnabled) return
    
    const alert: ExecutionAlert = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      ...alertData
    }
    
    this.alertHistory.push(alert)
    
    // Keep alert history manageable
    if (this.alertHistory.length > 1000) {
      this.alertHistory = this.alertHistory.slice(-500)
    }
    
    this.metrics.alertsGenerated++
    
    console.log(`🚨 Alert generated: ${alert.message}`)
    this.emit('alert:generated', planId, alert)
  }

  private storePerformanceHistory(performance: PerformanceMetrics): void {
    this.performanceHistory.push({ ...performance })
    
    // Keep history size manageable
    if (this.performanceHistory.length > this.config.performanceHistorySize) {
      this.performanceHistory = this.performanceHistory.slice(-this.config.performanceHistorySize)
    }
  }

  private initializeAnomalyDetectors(): void {
    // Initialize global anomaly detection systems
    console.log('🔍 Initializing anomaly detection systems')
  }
}

/**
 * AnomalyDetector - Statistical anomaly detection for execution monitoring
 */
class AnomalyDetector {
  private planId: string
  private config: MonitoringConfig
  private metricHistory: Map<string, number[]> = new Map()
  private detectedAnomalies: Anomaly[] = []
  private monitoringPoints: MonitoringPoint[] = []

  constructor(planId: string, config: MonitoringConfig) {
    this.planId = planId
    this.config = config
  }

  configureMonitoringPoint(point: MonitoringPoint): void {
    this.monitoringPoints.push(point)
  }

  async detectAnomalies(currentMetrics: Record<string, number>): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = []
    
    for (const [metric, value] of Object.entries(currentMetrics)) {
      const history = this.metricHistory.get(metric) || []
      history.push(value)
      
      // Keep reasonable history size
      if (history.length > 100) {
        history.shift()
      }
      
      this.metricHistory.set(metric, history)
      
      // Statistical anomaly detection (simple z-score method)
      if (history.length >= 10) {
        const mean = history.reduce((sum, val) => sum + val, 0) / history.length
        const variance = history.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / history.length
        const stdDev = Math.sqrt(variance)
        
        if (stdDev > 0) {
          const zScore = Math.abs((value - mean) / stdDev)
          
          if (zScore > 3) { // 3-sigma rule
            const anomaly: Anomaly = {
              id: uuidv4(),
              type: 'deviation',
              severity: zScore > 4 ? 'critical' : 'high',
              description: `${metric} value ${value.toFixed(3)} deviates significantly from normal (z-score: ${zScore.toFixed(2)})`,
              detectedAt: new Date().toISOString(),
              affectedComponents: [this.planId],
              metrics: { [metric]: value, zScore, mean, stdDev },
              suggestedActions: [`Investigate ${metric} anomaly`, 'Check system resources', 'Review recent changes'],
              confidence: Math.min(0.95, zScore / 5)
            }
            
            anomalies.push(anomaly)
            this.detectedAnomalies.push(anomaly)
          }
        }
      }
    }
    
    return anomalies
  }

  getRecentAnomalies(limit: number): Anomaly[] {
    return this.detectedAnomalies
      .sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime())
      .slice(0, limit)
  }

  getAnomalyCount(): number {
    return this.detectedAnomalies.length
  }
} 