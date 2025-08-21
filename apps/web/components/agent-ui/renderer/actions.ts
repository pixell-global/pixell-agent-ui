import type { RenderOptions, UISpecEnvelope } from './types'

type AnyRecord = Record<string, any>

function setByPath(obj: AnyRecord, path: string, value: any): void {
	const parts: (string | number)[] = []
	path.split('.').forEach((part) => {
		const re = /([^\[]+)|(\[(\d+)\])/g
		let m: RegExpExecArray | null
		while ((m = re.exec(part))) {
			if (m[1]) parts.push(m[1])
			if (m[3]) parts.push(Number(m[3]))
		}
	})
	let cur: any = obj
	for (let i = 0; i < parts.length - 1; i++) {
		const key = parts[i]
		if (typeof key === 'number') {
			if (!Array.isArray(cur[key])) cur[key] = []
			cur = cur[key]
		} else {
			if (cur[key] == null || typeof cur[key] !== 'object') cur[key] = {}
			cur = cur[key]
		}
	}
	const last = parts[parts.length - 1]
	cur[last as any] = value
}

export type ActionHandler = () => Promise<void> | void

export function buildActionHandler(spec: UISpecEnvelope, options: RenderOptions, actionRef?: { action?: string }): { handler?: ActionHandler } {
	if (!actionRef?.action) return {}
	const actionName = actionRef.action
	const action = (spec.actions || {})[actionName] as AnyRecord | undefined
	if (!action) return {}

	const kind = action.kind as string
	if (kind === 'open_url') {
		const url = action.url as string
		return {
			handler: () => {
				if (options.onOpenUrl) {
					options.onOpenUrl(url)
				}
			},
		}
	}
	if (kind === 'http') {
		const method = String(action.method || 'GET')
		const url = String(action.url || '')
		const body = action.body
		const headers = action.headers as Record<string, string> | undefined
		const stream = action.stream as boolean | undefined
		const features = options.capabilitySet?.features || []
		const extendedAllowed = features.includes('http.extended')
		const upper = method.toUpperCase()
		const isExtended = upper === 'PUT' || upper === 'PATCH' || upper === 'DELETE'
		return {
			handler: async () => {
				if (isExtended && !extendedAllowed) return
				if (options.onHttp) {
					await options.onHttp({ method: upper, url, body, headers, stream })
				}
			},
		}
	}
	if (kind === 'js') {
		const code = String((action as AnyRecord).code || '')
		return {
			handler: async () => {
				// Minimal JS action runner; pass basic helpers
				const ctx = {
					data: spec.data,
					http: options.onHttp,
					openUrl: options.onOpenUrl,
				}
				// eslint-disable-next-line no-new-func
				const fn = new Function('ctx', code)
				await Promise.resolve(fn(ctx))
			},
		}
	}
	if (kind === 'state.set') {
		const operations = (action.operations || []) as { path: string; value: any }[]
		return {
			handler: () => {
				// Mutate spec.data in place (renderer will have cloned state it controls)
				for (const op of operations) {
					setByPath(spec.data as AnyRecord, op.path, op.value)
				}
			},
		}
	}
	if (kind === 'emit') {
		const event = String(action.event || '')
		const payload = (action.payload || {}) as AnyRecord
		return {
			handler: async () => {
				if (options.intentClient?.invokeIntent) {
					await options.intentClient.invokeIntent(event, payload, { })
				}
			},
		}
	}
	return {}
} 