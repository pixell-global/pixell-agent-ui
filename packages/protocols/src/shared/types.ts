import { z } from 'zod'

// Base Agent Identity
export const AgentIdSchema = z.string().min(1).max(64).regex(/^[a-z0-9_-]+$/)
export type AgentId = z.infer<typeof AgentIdSchema>

export const UserIdSchema = z.string().uuid()
export type UserId = z.infer<typeof UserIdSchema>

export const TaskIdSchema = z.string().uuid()
export type TaskId = z.infer<typeof TaskIdSchema>

// Agent Types - from PRD design tokens
export const AgentTypeSchema = z.enum(['creator', 'keyword', 'analytics', 'custom'])
export type AgentType = z.infer<typeof AgentTypeSchema>

// Task Status - aligned with database schema
export const TaskStatusSchema = z.enum(['queued', 'running', 'succeeded', 'failed', 'paused'])
export type TaskStatus = z.infer<typeof TaskStatusSchema>

// Agent Status
export const AgentStatusSchema = z.enum(['idle', 'running', 'paused', 'error', 'offline'])
export type AgentStatus = z.infer<typeof AgentStatusSchema>

// Core Agent Card - what agents expose about themselves
export const AgentCardSchema = z.object({
  id: AgentIdSchema,
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  type: AgentTypeSchema,
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  protocol: z.enum(['a2a', 'mcp']),
  capabilities: z.record(z.any()).optional(),
  exposed_ui: z.enum(['chat', 'activity', 'none']).default('none'),
  timeout_sec: z.number().int().min(1).max(3600).default(300),
  cost_estimate: z.string().optional(),
  metadata: z.record(z.any()).optional()
})
export type AgentCard = z.infer<typeof AgentCardSchema>

// Task Definition
export const TaskSchema = z.object({
  id: TaskIdSchema,
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  status: TaskStatusSchema,
  progress: z.number().int().min(0).max(100).default(0),
  agentId: AgentIdSchema,
  userId: UserIdSchema,
  parentTaskId: TaskIdSchema.optional(),
  input: z.record(z.any()).optional(),
  output: z.record(z.any()).optional(),
  error: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
})
export type Task = z.infer<typeof TaskSchema>

// Task Input/Output Schema
export const TaskIOSchema = z.object({
  name: z.string(),
  type: z.enum(['string', 'number', 'boolean', 'object', 'array']),
  description: z.string().optional(),
  required: z.boolean().default(false),
  schema: z.record(z.any()).optional()
})
export type TaskIO = z.infer<typeof TaskIOSchema>

// Agent Capability Definition
export const AgentCapabilitySchema = z.object({
  name: z.string(),
  description: z.string(),
  inputs: z.array(TaskIOSchema),
  outputs: z.array(TaskIOSchema),
  streaming: z.boolean().default(false),
  pushNotifications: z.boolean().default(false)
})
export type AgentCapability = z.infer<typeof AgentCapabilitySchema>

// Message types for chat interface
export const MessageRoleSchema = z.enum(['user', 'assistant', 'system'])
export type MessageRole = z.infer<typeof MessageRoleSchema>

export const MessageTypeSchema = z.enum(['text', 'plan', 'progress', 'alert', 'agent'])
export type MessageType = z.infer<typeof MessageTypeSchema>

export const MessageSchema = z.object({
  id: z.string().uuid(),
  role: MessageRoleSchema,
  content: z.string(),
  messageType: MessageTypeSchema.default('text'),
  taskId: TaskIdSchema.optional(),
  userId: UserIdSchema,
  agentId: AgentIdSchema.optional(),
  metadata: z.record(z.any()).optional(),
  createdAt: z.string().datetime()
})
export type Message = z.infer<typeof MessageSchema>

// Runtime configuration
export const RuntimeConfigSchema = z.object({
  provider: z.string(),
  config: z.record(z.any()),
  maxConcurrentTasks: z.number().int().min(1).max(100).default(10),
  defaultTimeout: z.number().int().min(1).max(3600).default(300),
  retryAttempts: z.number().int().min(0).max(5).default(3)
})
export type RuntimeConfig = z.infer<typeof RuntimeConfigSchema>

// Error types
export class AgentError extends Error {
  constructor(
    message: string,
    public code: string,
    public agentId?: AgentId,
    public taskId?: TaskId
  ) {
    super(message)
    this.name = 'AgentError'
  }
}

export class ProtocolError extends Error {
  constructor(
    message: string,
    public code: string,
    public protocol: string
  ) {
    super(message)
    this.name = 'ProtocolError'
  }
} 