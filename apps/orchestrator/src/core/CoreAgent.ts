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

export interface CoreAgentConfig {
  runtimeProvider: 'aws-strand' | 'langgraph' | 'openai'
  runtimeConfig: Record<string, any>
  maxConcurrentTasks: number
  defaultTimeout: number
}

export interface UserIntent {
  userId: UserId
  message: string
  context?: Record<string, any>
}

export interface TaskPlan {
  tasks: Task[]
  dependencies: Array<{ from: TaskId, to: TaskId }>
  estimatedCost: number
  estimatedDuration: number
}

/**
 * CoreAgent - The central orchestrator for the Pixell Agent Framework
 * 
 * Responsibilities:
 * - Parse user intent using pluggable runtime (AWS Strand, LangGraph, etc.)
 * - Create execution plans with task dependencies
 * - Delegate tasks to registered worker agents via A2A protocol
 * - Monitor task execution and provide real-time updates
 * - Handle errors and retry logic
 */
export class CoreAgent extends EventEmitter {
  private registry: AgentRegistry
  private runtime: AgentRuntimeAdapter
  private activeTasks = new Map<TaskId, Task>()
  private taskCallbacks = new Map<TaskId, (result: any) => void>()
  private isInitialized = false

  constructor(
    private config: CoreAgentConfig,
    registry?: AgentRegistry
  ) {
    super()
    
    this.registry = registry || new AgentRegistry()
    this.runtime = this.createRuntimeAdapter()
    
    // Listen to registry events
    this.setupRegistryEventHandlers()
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      console.log(`🚀 Initializing Core Agent with runtime: ${this.config.runtimeProvider}`)

      // Initialize the runtime adapter
      await this.runtime.initialize(this.config.runtimeConfig)

      // Initialize the agent registry
      await this.setupRegistry()

      this.isInitialized = true
      console.log(`✅ Core Agent initialized successfully`)

      this.emit('initialized')
    } catch (error) {
      throw new AgentError(
        `Failed to initialize Core Agent: ${error instanceof Error ? error.message : String(error)}`,
        'INIT_ERROR'
      )
    }
  }

  async shutdown(): Promise<void> {
    console.log(`🔌 Shutting down Core Agent...`)
    
    // Cancel all active tasks
    for (const [taskId, task] of this.activeTasks) {
      try {
        await this.cancelTask(taskId)
      } catch (error) {
        console.warn(`Warning: Failed to cancel task ${taskId}:`, error)
      }
    }

    // Shutdown runtime
    if (this.runtime) {
      await this.runtime.shutdown()
    }

    this.isInitialized = false
    console.log(`✅ Core Agent shutdown complete`)

    this.emit('shutdown')
  }

  /**
   * Process a user message and create an execution plan
   */
  async processUserMessage(
    userId: UserId,
    message: string,
    context?: Record<string, any>
  ): Promise<{ messageId: string; plan?: TaskPlan }> {
    if (!this.isInitialized) {
      throw new AgentError('Core Agent not initialized', 'NOT_INITIALIZED')
    }

    const messageId = uuidv4()
    
    try {
      console.log(`💬 Processing user message: "${message.substring(0, 50)}..."`)

      // 1. Parse user intent using runtime
      const intent = await this.runtime.parseIntent({
        userId,
        message,
        context
      })

      console.log(`🧠 Parsed intent:`, intent)

      // 2. If this is a simple query, respond directly
      if (intent.type === 'query' || intent.type === 'help') {
        const response = await this.runtime.generateResponse(intent)
        
        this.emit('message', {
          id: uuidv4(),
          role: 'assistant',
          content: response,
          messageType: 'text',
          userId,
          createdAt: new Date().toISOString()
        })

        return { messageId }
      }

      // 3. Create execution plan for complex intents
      const plan = await this.createExecutionPlan(userId, intent)
      
      if (plan.tasks.length > 0) {
        console.log(`📋 Created execution plan with ${plan.tasks.length} tasks`)
        
        // 4. Execute the plan
        await this.executePlan(plan)
      }

      return { messageId, plan }
    } catch (error) {
      console.error(`❌ Failed to process user message:`, error)
      
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
   * Create an execution plan from parsed intent
   */
  private async createExecutionPlan(userId: UserId, intent: any): Promise<TaskPlan> {
    const tasks: Task[] = []
    const dependencies: Array<{ from: TaskId, to: TaskId }> = []

    // Use the runtime's planning capabilities
    const planSuggestion = await this.runtime.createPlan(intent)
    
    for (const suggestion of planSuggestion.steps) {
      // Find appropriate agents for each step
      const candidates = await this.registry.findAgentsForTask({
        name: suggestion.action,
        userId,
        metadata: suggestion.parameters
      })

      if (candidates.length === 0) {
        console.warn(`⚠️  No agents found for action: ${suggestion.action}`)
        continue
      }

      // Select best agent (highest scored)
      const selectedAgent = candidates[0]

      const task: Task = {
        id: uuidv4(),
        name: suggestion.action,
        description: suggestion.description,
        status: 'queued',
        progress: 0,
        agentId: selectedAgent.agent.id,
        userId,
        input: suggestion.parameters,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      tasks.push(task)

      // Add dependencies based on plan
      if (suggestion.dependsOn && tasks.length > 1) {
        const depIndex = tasks.findIndex(t => t.name === suggestion.dependsOn)
        if (depIndex >= 0) {
          dependencies.push({
            from: tasks[depIndex].id,
            to: task.id
          })
        }
      }
    }

    return {
      tasks,
      dependencies,
      estimatedCost: this.calculateEstimatedCost(tasks),
      estimatedDuration: this.calculateEstimatedDuration(tasks, dependencies)
    }
  }

  /**
   * Execute a task plan
   */
  private async executePlan(plan: TaskPlan): Promise<void> {
    // Send plan message to UI
    this.emit('message', {
      id: uuidv4(),
      role: 'assistant',
      content: `I'll execute ${plan.tasks.length} tasks to complete your request.`,
      messageType: 'plan',
      userId: plan.tasks[0]?.userId,
      metadata: { plan },
      createdAt: new Date().toISOString()
    })

    // Execute tasks respecting dependencies
    const executed = new Set<TaskId>()
    const inProgress = new Set<TaskId>()

    while (executed.size < plan.tasks.length) {
      // Find tasks ready to execute (no dependencies or dependencies completed)
      const readyTasks = plan.tasks.filter(task => {
        if (executed.has(task.id) || inProgress.has(task.id)) return false
        
        const deps = plan.dependencies.filter(dep => dep.to === task.id)
        return deps.every(dep => executed.has(dep.from))
      })

      if (readyTasks.length === 0 && inProgress.size === 0) {
        throw new AgentError('Execution deadlock detected', 'DEADLOCK')
      }

      // Execute ready tasks (up to maxConcurrentTasks)
      const tasksToExecute = readyTasks.slice(0, this.config.maxConcurrentTasks - inProgress.size)
      
      const promises = tasksToExecute.map(async (task) => {
        inProgress.add(task.id)
        
        try {
          await this.executeTask(task)
          executed.add(task.id)
        } catch (error) {
          console.error(`Task ${task.id} failed:`, error)
          // For now, mark as executed to continue (could implement retry logic)
          executed.add(task.id)
        } finally {
          inProgress.delete(task.id)
        }
      })

      await Promise.all(promises)
    }

    console.log(`✅ Execution plan completed`)
  }

  /**
   * Execute a single task by delegating to an agent
   */
  private async executeTask(task: Task): Promise<void> {
    console.log(`🎯 Executing task: ${task.name} (${task.id})`)

    this.activeTasks.set(task.id, task)
    
    // Update task status
    task.status = 'running'
    task.updatedAt = new Date().toISOString()
    
    this.emit('task:updated', task)

    try {
      // Get agent instance
      const agent = this.registry.getAgentInstance(task.agentId)
      if (!agent) {
        throw new AgentError(`Agent ${task.agentId} not found`, 'AGENT_NOT_FOUND')
      }

      // Delegate task to agent
      await agent.delegateTask({
        taskId: task.id,
        userId: task.userId,
        agentId: task.agentId,
        capabilityName: task.name,
        input: task.input || {},
        priority: 5,
        timeout: this.config.defaultTimeout
      })

      // Task completion will be handled by agent callbacks
      task.status = 'succeeded'
      task.progress = 100
      task.updatedAt = new Date().toISOString()
      
      this.emit('task:completed', task)
      console.log(`✅ Task completed: ${task.name}`)

    } catch (error) {
      task.status = 'failed'
      task.error = error instanceof Error ? error.message : String(error)
      task.updatedAt = new Date().toISOString()
      
      this.emit('task:failed', task)
      console.error(`❌ Task failed: ${task.name} - ${error instanceof Error ? error.message : String(error)}`)
      
      throw error
    } finally {
      this.activeTasks.delete(task.id)
    }
  }

  /**
   * Cancel a running task
   */
  async cancelTask(taskId: TaskId): Promise<void> {
    const task = this.activeTasks.get(taskId)
    if (!task) return

    console.log(`🛑 Canceling task: ${taskId}`)

    const agent = this.registry.getAgentInstance(task.agentId)
    if (agent) {
      await agent.cancelTask(taskId)
    }

    task.status = 'paused'
    task.updatedAt = new Date().toISOString()
    
    this.activeTasks.delete(taskId)
    this.emit('task:cancelled', task)
  }

  /**
   * Get active tasks
   */
  getActiveTasks(): Task[] {
    return Array.from(this.activeTasks.values())
  }

  /**
   * Get registry statistics
   */
  getStats() {
    return {
      agents: this.registry.getStats(),
      tasks: {
        active: this.activeTasks.size,
        total: this.activeTasks.size // In production, this would track historical data
      },
      runtime: {
        provider: this.config.runtimeProvider,
        initialized: this.isInitialized
      }
    }
  }

  // Private helper methods
  private createRuntimeAdapter(): AgentRuntimeAdapter {
    switch (this.config.runtimeProvider) {
      case 'aws-strand':
        return new StrandAdapter()
      default:
        throw new AgentError(`Unsupported runtime provider: ${this.config.runtimeProvider}`, 'INVALID_RUNTIME')
    }
  }

  private async setupRegistry(): Promise<void> {
    // In production, this would load agents from configuration or discovery
    console.log(`📋 Setting up agent registry...`)
  }

  private setupRegistryEventHandlers(): void {
    this.registry.on('agent:registered', (agent: AgentCard) => {
      console.log(`🤖 Agent registered: ${agent.name}`)
      this.emit('agent:registered', agent)
    })

    this.registry.on('agent:unregistered', (agentId: AgentId) => {
      console.log(`🔌 Agent unregistered: ${agentId}`)
      this.emit('agent:unregistered', agentId)
    })

    this.registry.on('agent:offline', (agentId: AgentId) => {
      console.warn(`⚠️  Agent offline: ${agentId}`)
      this.emit('agent:offline', agentId)
    })
  }

  private calculateEstimatedCost(tasks: Task[]): number {
    // Simple cost estimation - in production this would be more sophisticated
    return tasks.length * 0.01
  }

  private calculateEstimatedDuration(tasks: Task[], dependencies: Array<{ from: TaskId, to: TaskId }>): number {
    // Simple duration estimation - in production this would analyze the dependency graph
    const maxDepth = this.calculateMaxDependencyDepth(tasks, dependencies)
    return maxDepth * 30 // 30 seconds per level
  }

  private calculateMaxDependencyDepth(tasks: Task[], dependencies: Array<{ from: TaskId, to: TaskId }>): number {
    // Calculate the longest dependency chain
    let maxDepth = 1
    
    for (const task of tasks) {
      const depth = this.getTaskDepth(task.id, dependencies, new Set())
      maxDepth = Math.max(maxDepth, depth)
    }
    
    return maxDepth
  }

  private getTaskDepth(taskId: TaskId, dependencies: Array<{ from: TaskId, to: TaskId }>, visited: Set<TaskId>): number {
    if (visited.has(taskId)) return 0 // Circular dependency protection
    
    visited.add(taskId)
    
    const parents = dependencies.filter(dep => dep.to === taskId)
    if (parents.length === 0) return 1
    
    let maxParentDepth = 0
    for (const parent of parents) {
      const parentDepth = this.getTaskDepth(parent.from, dependencies, new Set(visited))
      maxParentDepth = Math.max(maxParentDepth, parentDepth)
    }
    
    return maxParentDepth + 1
  }
} 