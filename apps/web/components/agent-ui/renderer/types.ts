export type Json = Record<string, unknown> | Json[] | string | number | boolean | null

export interface UISpecEnvelope {
	manifest: Record<string, unknown>
	data: Record<string, unknown>
	view: any
	actions?: Record<string, any>
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
	debug?: boolean
	/** Optional seed for renderer local state; if provided, overrides spec.data at mount */
	initialData?: Record<string, any>
	/** Called whenever renderer local data mutates (state.set, http.result, js setData) */
	onDataChange?: (data: Record<string, any>) => void
} 