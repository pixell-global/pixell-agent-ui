import { z } from 'zod'
import { 
  AgentIdSchema, 
  TaskIdSchema, 
  UserIdSchema, 
  AgentCardSchema, 
  TaskSchema,
  AgentCapabilitySchema 
} from '../shared/types'

// A2A Protocol Version
export const A2A_PROTOCOL_VERSION = '1.0.0'

// A2A Message Types
export const A2AMessageTypeSchema = z.enum([
  'discovery_request',
  'discovery_response', 
  'capability_request',
  'capability_response',
  'task_delegate',
  'task_update',
  'task_complete',
  'task_error',
  'heartbeat',
  'shutdown'
])
export type A2AMessageType = z.infer<typeof A2AMessageTypeSchema>

// Base A2A Message
export const A2AMessageSchema = z.object({
  id: z.string().uuid(),
  type: A2AMessageTypeSchema,
  version: z.string().default(A2A_PROTOCOL_VERSION),
  from: AgentIdSchema,
  to: AgentIdSchema.optional(), // Optional for broadcast messages
  timestamp: z.string().datetime(),
  payload: z.record(z.any())
})
export type A2AMessage = z.infer<typeof A2AMessageSchema>

// Discovery Messages
export const DiscoveryRequestSchema = z.object({
  requesterId: AgentIdSchema,
  domain: z.string().optional(), // Filter agents by domain
  capabilities: z.array(z.string()).optional() // Filter by capabilities
})
export type DiscoveryRequest = z.infer<typeof DiscoveryRequestSchema>

export const DiscoveryResponseSchema = z.object({
  agents: z.array(AgentCardSchema),
  responderId: AgentIdSchema
})
export type DiscoveryResponse = z.infer<typeof DiscoveryResponseSchema>

// Capability Messages
export const CapabilityRequestSchema = z.object({
  agentId: AgentIdSchema,
  capabilityName: z.string().optional() // Request specific capability
})
export type CapabilityRequest = z.infer<typeof CapabilityRequestSchema>

export const CapabilityResponseSchema = z.object({
  agentId: AgentIdSchema,
  capabilities: z.array(AgentCapabilitySchema)
})
export type CapabilityResponse = z.infer<typeof CapabilityResponseSchema>

// Task Delegation Messages
export const TaskDelegateSchema = z.object({
  taskId: TaskIdSchema,
  userId: UserIdSchema,
  agentId: AgentIdSchema,
  capabilityName: z.string(),
  input: z.record(z.any()),
  priority: z.number().int().min(1).max(10).default(5),
  timeout: z.number().int().min(1).max(3600).default(300),
  metadata: z.record(z.any()).optional()
})
export type TaskDelegate = z.infer<typeof TaskDelegateSchema>

export const TaskUpdateSchema = z.object({
  taskId: TaskIdSchema,
  progress: z.number().int().min(0).max(100),
  status: z.enum(['running', 'paused']),
  message: z.string().optional(),
  metadata: z.record(z.any()).optional()
})
export type TaskUpdate = z.infer<typeof TaskUpdateSchema>

export const TaskCompleteSchema = z.object({
  taskId: TaskIdSchema,
  output: z.record(z.any()),
  metadata: z.record(z.any()).optional()
})
export type TaskComplete = z.infer<typeof TaskCompleteSchema>

export const TaskErrorSchema = z.object({
  taskId: TaskIdSchema,
  error: z.string(),
  code: z.string(),
  retryable: z.boolean().default(true),
  metadata: z.record(z.any()).optional()
})
export type TaskError = z.infer<typeof TaskErrorSchema>

// Heartbeat for health monitoring
export const HeartbeatSchema = z.object({
  agentId: AgentIdSchema,
  status: z.enum(['idle', 'running', 'paused', 'error']),
  activeTasks: z.number().int().min(0),
  lastSeen: z.string().datetime(),
  metadata: z.record(z.any()).optional()
})
export type Heartbeat = z.infer<typeof HeartbeatSchema>

// Agent Interfaces
export interface A2AAgent {
  readonly card: import('../shared/types').AgentCard
  
  // Lifecycle
  initialize(): Promise<void>
  shutdown(): Promise<void>
  
  // Discovery
  discoverCapabilities(): Promise<import('../shared/types').AgentCard>
  getCapability(name: string): Promise<import('../shared/types').AgentCapability | null>
  
  // Task Execution
  delegateTask(request: TaskDelegate): Promise<void>
  cancelTask(taskId: import('../shared/types').TaskId): Promise<void>
  
  // Health
  getStatus(): Promise<Heartbeat>
  
  // Message Handling
  handleMessage(message: A2AMessage): Promise<void>
}

export interface A2ATransport {
  // Connection
  connect(agentId: import('../shared/types').AgentId): Promise<void>
  disconnect(): Promise<void>
  
  // Messaging
  send(message: A2AMessage): Promise<void>
  broadcast(message: A2AMessage): Promise<void>
  subscribe(handler: (message: A2AMessage) => Promise<void>): Promise<void>
  
  // Discovery
  discoverAgents(request?: DiscoveryRequest): Promise<DiscoveryResponse>
}

// Transport implementations can be WebSocket, HTTP, etc.
export type A2ATransportType = 'websocket' | 'http' | 'memory' 