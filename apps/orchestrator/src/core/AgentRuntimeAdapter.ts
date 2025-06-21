import { UserId } from '@pixell/protocols'

export interface ParsedIntent {
  type: 'query' | 'action' | 'help' | 'complex'
  confidence: number
  action?: string
  parameters?: Record<string, any>
  context?: Record<string, any>
}

export interface PlanStep {
  action: string
  description: string
  parameters: Record<string, any>
  dependsOn?: string
  estimatedDuration?: number
  priority?: number
}

export interface ExecutionPlan {
  steps: PlanStep[]
  totalEstimatedDuration: number
  confidence: number
}

export interface UserIntent {
  userId: UserId
  message: string
  context?: Record<string, any>
}

/**
 * AgentRuntimeAdapter - Abstract interface for pluggable agent runtimes
 * 
 * This allows the Pixell Agent Framework to work with different AI/Agent
 * orchestration backends like AWS Strand, LangGraph, OpenAI Assistants, etc.
 */
export abstract class AgentRuntimeAdapter {
  /**
   * Initialize the runtime with configuration
   */
  abstract initialize(config: Record<string, any>): Promise<void>

  /**
   * Shutdown the runtime gracefully
   */
  abstract shutdown(): Promise<void>

  /**
   * Parse user intent from natural language
   */
  abstract parseIntent(intent: UserIntent): Promise<ParsedIntent>

  /**
   * Create an execution plan from parsed intent
   */
  abstract createPlan(intent: ParsedIntent): Promise<ExecutionPlan>

  /**
   * Generate a direct response (for simple queries)
   */
  abstract generateResponse(intent: ParsedIntent): Promise<string>

  /**
   * Validate that the runtime is properly configured
   */
  abstract isHealthy(): Promise<boolean>

  /**
   * Get runtime status and metadata
   */
  abstract getStatus(): Promise<{
    provider: string
    version: string
    status: 'healthy' | 'degraded' | 'error'
    lastCheck: string
    metadata?: Record<string, any>
  }>
} 