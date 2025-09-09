/// <reference path="./renderer.contract.d.ts" />

export type Json = Record<string, unknown> | Json[] | string | number | boolean | null

export interface UISpecEnvelope {
  manifest: Record<string, unknown>
  data: Record<string, unknown>
  view: Record<string, unknown>
  actions?: Record<string, unknown>
  theme?: { tokens?: Record<string, unknown> }
}

export type JsonPatchOp = { op: 'add' | 'replace' | 'remove' | 'move' | 'copy' | 'test'; path: string; value?: unknown; from?: string }

export interface IntentResult {
  status: 'ok' | 'error' | 'cancelled'
  message?: string
  details?: Record<string, unknown>
  patch?: JsonPatchOp[]
  traceId: string
}

export type IntentStreamEvent =
  | { type: 'progress'; percent?: number; note?: string }
  | { type: 'patch'; ops: JsonPatchOp[] }
  | { type: 'result'; result: IntentResult }

export interface IntentClient {
  invokeIntent(name: string, params?: Record<string, unknown>, opts?: { optimisticPatch?: JsonPatchOp[]; signal?: AbortSignal }): Promise<IntentResult>
  invokeIntentStream?(name: string, params?: Record<string, unknown>): AsyncIterable<IntentStreamEvent>
}

export interface RenderOptions {
  intentClient?: IntentClient
  onOpenUrl?: (url: string) => void
  onHttp?: (req: { method: string; url: string; body?: unknown; headers?: Record<string, string>; stream?: boolean }) => Promise<unknown>
  capabilitySet?: { components?: string[]; features?: string[] }
}

export function renderUISpec(container: HTMLElement, spec: UISpecEnvelope, options?: RenderOptions): { unmount: () => void }

export function applyPatch(spec: UISpecEnvelope, ops: JsonPatchOp[]): UISpecEnvelope

// Ambient module to satisfy TS in this repo; real client maps this alias to implementation.
declare module '@agent-ui/renderer' {
  export type Json = Record<string, unknown> | Json[] | string | number | boolean | null
  export type JsonPatchOp = { op: 'add' | 'replace' | 'remove' | 'move' | 'copy' | 'test'; path: string; value?: unknown; from?: string }
  export interface UISpecEnvelope {
    manifest: Record<string, unknown>
    data: Record<string, unknown>
    view: Record<string, unknown>
    actions?: Record<string, unknown>
    theme?: { tokens?: Record<string, unknown> }
  }
  export interface IntentResult {
    status: 'ok' | 'error' | 'cancelled'
    message?: string
    details?: Record<string, unknown>
    patch?: JsonPatchOp[]
    traceId: string
  }
  export type IntentStreamEvent =
    | { type: 'progress'; percent?: number; note?: string }
    | { type: 'patch'; ops: JsonPatchOp[] }
    | { type: 'result'; result: IntentResult }
  export interface IntentClient {
    invokeIntent(name: string, params?: Record<string, unknown>, opts?: { optimisticPatch?: JsonPatchOp[]; signal?: AbortSignal }): Promise<IntentResult>
    invokeIntentStream?(name: string, params?: Record<string, unknown>): AsyncIterable<IntentStreamEvent>
  }
  export interface RenderOptions {
    intentClient?: IntentClient
    onOpenUrl?: (url: string) => void
    onHttp?: (req: { method: string; url: string; body?: unknown; headers?: Record<string, string>; stream?: boolean }) => Promise<unknown>
    capabilitySet?: { components?: string[]; features?: string[] }
  }
  export function renderUISpec(container: HTMLElement, spec: UISpecEnvelope, options?: RenderOptions): { unmount: () => void }
  export function applyPatch(spec: UISpecEnvelope, ops: JsonPatchOp[]): UISpecEnvelope
} 