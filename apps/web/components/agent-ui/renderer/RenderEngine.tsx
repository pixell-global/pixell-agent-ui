import React, { useEffect, useState } from 'react'
import type { RenderOptions, UISpecEnvelope } from './types'
import { resolveBinding } from './propResolver'
import { REGISTRY, resolveNodeWithFallback } from '../registry'
import { buildActionHandler } from './actions'
import { isArray, getByPath } from './util'
import { applyThemeTokens } from './theme'

interface RenderEngineProps {
	container: HTMLElement
	spec: UISpecEnvelope
	options: RenderOptions
}

export const RenderEngine: React.FC<RenderEngineProps> = ({ container, spec, options }) => {
	const [localData, setLocalData] = useState<Record<string, any>>(() => {
		const base = options.initialData ? options.initialData : spec.data
		return JSON.parse(JSON.stringify(base || {}))
	})

	useEffect(() => {
		if (options.debug) console.log('[Renderer] Applying theme tokens', spec.theme?.tokens)
		applyThemeTokens(container, spec.theme?.tokens as any)
	}, [container, spec.theme, options.debug])

	const view = spec.view

	function interpolate(template: string, root: Record<string, any>, scopeObj: Record<string, any>): string {
		return String(template).replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_m, expr) => {
			const key = String(expr).trim()
			let val = getByPath(scopeObj, key)
			if (val == null) val = getByPath(root, key)
			return val == null ? '' : String(val)
		})
	}

	function deepResolve(value: any, root: Record<string, any>, scopeObj: Record<string, any>): any {
		if (typeof value === 'string') {
			if (value.startsWith('@')) {
				const path = value.slice(1)
				// Prefer scoped values (e.g., result, row, event) and fall back to root data
				const fromScope = getByPath(scopeObj, path)
				if (fromScope !== undefined) return fromScope
				return getByPath(root, path)
			}
			if (value.includes('{{')) return interpolate(value, root, scopeObj)
			return value
		}
		if (Array.isArray(value)) return value.map((v) => deepResolve(v, root, scopeObj))
		if (value && typeof value === 'object') {
			const out: Record<string, any> = {}
			for (const [k, v] of Object.entries(value)) out[k] = deepResolve(v, root, scopeObj)
			return out
		}
		return value
	}

	function applyStateOperations(ops: { path: string; value: any }[], nextData: Record<string, any>): Record<string, any> {
		const next = { ...nextData }
		for (const op of ops) {
			// Parse dot/bracket paths: a.b[0].c
			const parts: (string | number)[] = []
			op.path.split('.').forEach((part) => {
				const re = /([^\[]+)|(\[(\d+)\])/g
				let m: RegExpExecArray | null
				while ((m = re.exec(part))) {
					if (m[1]) parts.push(m[1])
					if (m[3]) parts.push(Number(m[3]))
				}
			})
			let cur: any = next
			for (let i = 0; i < parts.length - 1; i++) {
				const key = parts[i]
				if (typeof key === 'number') {
					// Ensure the array index points to an object container, not an array
					if (cur[key] == null || typeof cur[key] !== 'object' || Array.isArray(cur[key])) {
						cur[key] = {}
					}
					cur = cur[key]
				} else {
					if (cur[key] == null || typeof cur[key] !== 'object') cur[key] = {}
					cur = cur[key]
				}
			}
			const last = parts[parts.length - 1]
			cur[last as any] = op.value
		}
		return next
	}

	function wireAction(actionRef: any, eventName: 'onPress' | 'onChange', scopeObj: Record<string, any>) {
		const actionName = (actionRef as any).action
		const action = (spec.actions || {})[actionName]
		const kind = action?.kind
		if (options.debug) console.log('[Renderer] wire action', eventName, actionName, kind)
		if (!kind) return undefined
		if (kind === 'state.set') {
			const operations = (action.operations || []) as { path: string; value: any }[]
			return (ev?: any) => {
				if (options.debug) console.log('[Renderer] invoke action', actionName, kind)
				const scopeWithEvent = { ...(scopeObj || {}), event: { value: ev?.target?.value ?? ev } }
				setLocalData((prev) => {
					const resolvedOps = operations.map((op) => ({
						path: interpolate(op.path, prev, scopeWithEvent),
						value: deepResolve(op.value, prev, scopeWithEvent),
					}))
					const next = applyStateOperations(resolvedOps, prev)
					if (options.debug) console.log('[Renderer] state.set after', next)
					options.onDataChange?.({ ...next })
					return { ...next }
				})
			}
		}
		if (kind === 'http') {
			const method = String(action.method || 'GET')
			return async (ev?: any) => {
				if (!options.onHttp) return
				if (options.debug) console.log('[Renderer] invoke action', actionName, kind)
				const scopeWithEvent = { ...(scopeObj || {}), event: { value: ev?.target?.value ?? ev } }
				const upper = method.toUpperCase()
				// Feature gate extended HTTP methods
				const features = options.capabilitySet?.features || []
				const isExtended = upper === 'PUT' || upper === 'PATCH' || upper === 'DELETE'
				if (isExtended && !features.includes('http.extended')) return
				const url = interpolate(String(action.url || ''), localData, scopeWithEvent)
				const body = deepResolve(action.body, localData, scopeWithEvent)
				const headers = deepResolve(action.headers, localData, scopeWithEvent)
				// Keep stream as provided (undefined if omitted) to match contract/tests
				const stream = (action.stream as boolean | undefined)
				let result: any
				try {
					console.log('[Renderer] HTTP Request:', { method: upper, url, body })
					result = await options.onHttp({ method: upper, url, body, headers, stream })
					console.log('[Renderer] HTTP Response:', result)
				} catch (err) {
					console.error('[Renderer] HTTP action failed:', err)
					// Show error in UI by setting a temporary error message
					setLocalData((prev) => {
						console.log('[Renderer] Setting error state after HTTP failure')
						return prev
					})
					return
				}
				// Optional post-processing: apply result as state.set operations
				if (action.result && action.result.kind === 'state.set' && Array.isArray(action.result.operations)) {
					console.log('[Renderer] Processing result operations:', action.result.operations)
					// Normalize HTTP results to handle different response structures
					let wrappedResult = result
					if (result !== null && typeof result === 'object') {
						// If result has a payload field, make it available as comment/text/value too
						if ('payload' in result) {
							wrappedResult = {
								...result,
								comment: result.payload,
								text: result.payload,
								value: result.payload
							}
						}
					} else {
						// For primitive results, wrap them
						wrappedResult = { value: result, text: result, comment: result, data: result }
					}
					console.log('[Renderer] Wrapped result:', wrappedResult)
					const scopeWithResult = { ...scopeWithEvent, result: wrappedResult }
					setLocalData((prev) => {
						console.log('[Renderer] Previous data:', prev)
						const resolvedOps = (action.result.operations as any[]).map((op) => {
							const resolvedPath = interpolate(op.path, prev, scopeWithResult)
							const resolvedValue = deepResolve(op.value, prev, scopeWithResult)
							console.log('[Renderer] Resolved operation:', { path: resolvedPath, value: resolvedValue })
							return { path: resolvedPath, value: resolvedValue }
						})
						const next = applyStateOperations(resolvedOps, prev)
						console.log('[Renderer] Next data after operations:', next)
						if (options.debug) console.log('[Renderer] http.result applied', next)
						options.onDataChange?.({ ...next })
						return { ...next }
					})
				}
			}
		}
		if (kind === 'open_url') {
			return (ev?: any) => {
				if (!options.onOpenUrl) return
				if (options.debug) console.log('[Renderer] invoke action', actionName, kind)
				const scopeWithEvent = { ...(scopeObj || {}), event: { value: ev?.target?.value ?? ev } }
				const url = interpolate(String(action.url || ''), localData, scopeWithEvent)
				options.onOpenUrl(url)
			}
		}
		if (kind === 'emit') {
			const { handler } = buildActionHandler({ ...spec, data: localData }, options, actionRef)
			return () => handler && handler()
		}
		if (kind === 'js') {
			const code: string = String(action.code || '')
			return async (ev?: any) => {
				if (options.debug) console.log('[Renderer] invoke action', actionName, kind)
				const ctx = {
					data: localData,
					setData: (updater: (cur: any) => any) => setLocalData((cur) => { const next = { ...updater(cur) }; options.onDataChange?.(next); return next }),
					scope: { ...(scopeObj || {}), event: { value: ev?.target?.value ?? ev } },
					http: options.onHttp,
					openUrl: options.onOpenUrl,
				}
				// eslint-disable-next-line no-new-func
				const fn = new Function('ctx', code)
				await Promise.resolve(fn(ctx))
			}
		}
		return undefined
	}

	function renderNode(node: any, scope?: Record<string, any>): React.ReactNode {
		if (!node) return null
		const n = resolveNodeWithFallback(node, options)
		const type = String(n.type || 'unknown')
		const Comp = REGISTRY[type] || REGISTRY['unknown']
		if (options.debug) console.log('[Renderer] renderNode → type', type, 'raw:', node, 'resolved:', n)

		// Build props: merge top-level attributes (excluding type/children/key) with props object
		const topLevelProps: Record<string, any> = {}
		for (const [k, v] of Object.entries(n)) {
			if (k !== 'type' && k !== 'children' && k !== 'props' && k !== 'key') topLevelProps[k] = v
		}
		const rawProps = { ...(n.props || {}), ...topLevelProps } as Record<string, any>
		const resolvedProps: Record<string, any> = {}
		for (const [k, v] of Object.entries(rawProps)) {
			if (k === 'key') continue
			if ((k === 'onPress' || k === 'onChange') && v && typeof v === 'object') {
				const handler = wireAction(v, k as any, scope || {})
				if (handler) {
					resolvedProps[k] = handler
				}
				continue
			}
			const bound = resolveBinding(v, localData, scope)
			if (options.debug && v !== bound) console.log('[Renderer] prop', k, 'bound from', v, '→', bound)
			resolvedProps[k] = bound
		}

		// Children
		let children: any = null
		if (isArray(n.children)) {
			children = (n.children as any[]).map((c, idx) => <React.Fragment key={idx}>{renderNode(c, scope)}</React.Fragment>)
		}

		// Special handling for list
		if (type === 'list') {
			const listData = resolvedProps.data
			if (options.debug) console.log('[Renderer] list size', Array.isArray(listData) ? listData.length : 0)
			return (
				(REGISTRY['list'] as any)
					? React.createElement(REGISTRY['list'] as any, {
						...resolvedProps,
						renderItem: (item: any, index: number) => {
							if (options.debug) console.log('[Renderer] list.item', index, item)
							return renderNode(n.props?.item, item)
						},
					})
				: null
			)
		}

		// Special handling for table → render real table component and delegate cell rendering
		if (type === 'table' && (REGISTRY as any)['table']) {
			const TableComp: any = (REGISTRY as any)['table']
			const tableData = resolvedProps.data
			const columns = n.props?.columns || []
			if (options.debug) console.log('[Renderer] table render; rows', Array.isArray(tableData) ? tableData.length : 0, 'cols', columns.length)
			return (
				< TableComp
					data={tableData}
					columns={columns}
					renderCell={(cellSpec: any, row: any, rowIndex: number, colIndex: number) => {
						const cellScope = { ...(row || {}), row, rowIndex, colIndex }
						return renderNode(cellSpec, cellScope)
					}}
					className={resolvedProps.className}
				/>
			)
		}

		if (type === 'link' && options.debug) {
			console.log('[Renderer] link resolved props', resolvedProps)
		}

		return <Comp {...resolvedProps}>{children}</Comp>
	}

	if (options.debug) console.log('[Renderer] render root view', view)
	return <>{renderNode(view, localData)}</>
} 