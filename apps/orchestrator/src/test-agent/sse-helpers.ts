/**
 * SSE Helper Functions for Test Agent
 *
 * Provides utilities for emitting A2A-compliant SSE events.
 */

import { Response } from 'express'

export interface SSEContext {
  res: Response
  sessionId?: string
  workflowId?: string
}

/**
 * Initialize SSE response headers
 */
export function initSSE(res: Response): void {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  })
}

/**
 * Send a raw SSE event
 */
export function sendSSE(res: Response, data: unknown): void {
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}

/**
 * Send a status update (working state)
 */
export function sendStatus(ctx: SSEContext, message: string): void {
  sendSSE(ctx.res, {
    kind: 'status-update',
    status: {
      state: 'working',
      message: {
        parts: [{ text: message }],
      },
      sessionId: ctx.sessionId,
    },
    sessionId: ctx.sessionId,
  })
}

/**
 * Send content (text response)
 */
export function sendContent(ctx: SSEContext, text: string): void {
  sendSSE(ctx.res, {
    kind: 'message',
    parts: [{ text }],
    sessionId: ctx.sessionId,
  })
}

/**
 * Send a file output event
 */
export function sendFileOutput(
  ctx: SSEContext,
  file: {
    type: string
    name: string
    content: string
    format?: string
    size?: number
    url?: string
  }
): void {
  sendSSE(ctx.res, {
    type: 'file_output',
    state: 'working',
    name: file.name,
    fileType: file.type,
    format: file.format || 'html',
    size: file.size || file.content.length,
    content: file.content,
    url: file.url,
    workflowId: ctx.workflowId,
    sessionId: ctx.sessionId,
  })
}

/**
 * Send a scheduled post event
 */
export function sendScheduledPost(
  ctx: SSEContext,
  post: {
    platform: string
    content: string
    scheduledTime: string
    postId?: string
  }
): void {
  sendSSE(ctx.res, {
    type: 'scheduled_post',
    state: 'working',
    platform: post.platform,
    content: post.content,
    scheduledTime: post.scheduledTime,
    postId: post.postId || `post_${Date.now()}`,
    workflowId: ctx.workflowId,
    sessionId: ctx.sessionId,
  })
}

/**
 * Send a monitor created event
 */
export function sendMonitorCreated(
  ctx: SSEContext,
  monitor: {
    monitorId: string
    name: string
    type: string
    config?: Record<string, unknown>
  }
): void {
  sendSSE(ctx.res, {
    type: 'monitor_created',
    state: 'working',
    monitorId: monitor.monitorId,
    name: monitor.name,
    monitorType: monitor.type,
    config: monitor.config,
    workflowId: ctx.workflowId,
    sessionId: ctx.sessionId,
  })
}

/**
 * Send a billing event (SDK billing declaration)
 */
export function sendBillingEvent(
  ctx: SSEContext,
  billing: {
    type: 'research' | 'ideation' | 'auto_posting' | 'monitors'
    action: 'start' | 'complete'
    tier?: 'small' | 'medium' | 'large' | 'xl'
    metadata?: Record<string, unknown>
  }
): void {
  sendSSE(ctx.res, {
    type: 'billing_event',
    billing: {
      type: billing.type,
      action: billing.action,
      tier: billing.tier,
      metadata: billing.metadata,
    },
    workflowId: ctx.workflowId,
    sessionId: ctx.sessionId,
  })
}

/**
 * Send completion event
 */
export function sendComplete(ctx: SSEContext, message?: string): void {
  // Send completed status
  sendSSE(ctx.res, {
    state: 'completed',
    message: message
      ? { parts: [{ text: message }] }
      : undefined,
    workflowId: ctx.workflowId,
    sessionId: ctx.sessionId,
  })

  // End stream
  ctx.res.write('data: [DONE]\n\n')
  ctx.res.end()
}

/**
 * Send error event
 */
export function sendError(ctx: SSEContext, error: string): void {
  sendSSE(ctx.res, {
    state: 'failed',
    message: error,
    workflowId: ctx.workflowId,
    sessionId: ctx.sessionId,
  })

  ctx.res.write('data: [DONE]\n\n')
  ctx.res.end()
}

/**
 * Create SSE context from request
 */
export function createSSEContext(req: any, res: Response): SSEContext {
  const body = req.body || {}
  return {
    res,
    sessionId: body.params?.sessionId || `test_session_${Date.now()}`,
    workflowId: body.params?.workflowId || `test_workflow_${Date.now()}`,
  }
}

/**
 * Sleep helper for simulating processing time
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
