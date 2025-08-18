import React, { useEffect, useState } from 'react'
import type { RenderOptions, UISpecEnvelope } from './types'
import { resolveBinding } from './propResolver'
import { REGISTRY, resolveNodeWithFallback } from '../registry'
import { buildActionHandler } from './actions'
import { isArray } from './util'
import { applyThemeTokens } from './theme'

interface RenderEngineProps {
	container: HTMLElement
	spec: UISpecEnvelope
	options: RenderOptions
}

export const RenderEngine: React.FC<RenderEngineProps> = ({ container, spec, options }) => {
	const [localData, setLocalData] = useState<Record<string, any>>(() => JSON.parse(JSON.stringify(spec.data || {})))

	useEffect(() => {
		if (options.debug) console.log('[Renderer] Applying theme tokens', spec.theme?.tokens)
		applyThemeTokens(container, spec.theme?.tokens as any)
	}, [container, spec.theme, options.debug])

	const view = spec.view

	function renderNode(node: any, scope?: Record<string, any>): React.ReactNode {
		if (!node) return null
		const n = resolveNodeWithFallback(node, options)
		const type = String(n.type || 'unknown')
		const Comp = REGISTRY[type] || REGISTRY['unknown']
		if (options.debug) console.log('[Renderer] renderNode → type', type, 'raw:', node, 'resolved:', n)

		// Build props: merge top-level attributes (excluding type/children) with props object
		const topLevelProps: Record<string, any> = {}
		for (const [k, v] of Object.entries(n)) {
			if (k !== 'type' && k !== 'children' && k !== 'props') topLevelProps[k] = v
		}
		const rawProps = { ...(n.props || {}), ...topLevelProps } as Record<string, any>
		const resolvedProps: Record<string, any> = {}
		for (const [k, v] of Object.entries(rawProps)) {
			if (k === 'onPress' && v && typeof v === 'object') {
				const actionName = (v as any).action
				const action = (spec.actions || {})[actionName]
				const kind = action?.kind
				if (options.debug) console.log('[Renderer] wire action', actionName, kind)
				if (kind === 'state.set') {
					const operations = (action.operations || []) as { path: string; value: any }[]
					resolvedProps['onPress'] = () => {
						if (options.debug) console.log('[Renderer] state.set before', localData)
						setLocalData((prev) => {
							const next = { ...prev }
							for (const op of operations) {
								// simple dot/bracket path setter inline
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
										if (!Array.isArray(cur[key])) cur[key] = []
										cur = cur[key]
									} else {
										if (cur[key] == null || typeof cur[key] !== 'object') cur[key] = {}
										cur = cur[key]
									}
								}
								const last = parts[parts.length - 1]
								cur[last as any] = op.value
							}
							if (options.debug) console.log('[Renderer] state.set after', next)
							return { ...next }
						})
					}
					continue
				}
				const { handler } = buildActionHandler({ ...spec, data: localData }, options, v)
				if (handler) resolvedProps['onPress'] = () => { if (options.debug) console.log('[Renderer] action invoke', actionName); handler() }
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
					renderCell={(cellSpec: any, row: any, rowIndex: number, colIndex: number) => renderNode(cellSpec, row)}
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