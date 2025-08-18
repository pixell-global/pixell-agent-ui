import React from 'react'
import { Text } from './renderer_components/Text'
import { Button } from './renderer_components/Button'
import { Page } from './renderer_components/Page'
import { List } from './renderer_components/List'
import { Unknown } from './renderer_components/Unknown'
import { Link } from './renderer_components/Link'
import type { RenderOptions } from './renderer/types'
import { Table } from './renderer_components/Table'

export const REGISTRY: Record<string, React.ComponentType<any>> = {
	page: Page,
	text: Text,
	button: Button,
	list: List,
	link: Link,
	table: Table,
	unknown: Unknown,
}

function componentsAllow(type: string, options?: RenderOptions): boolean {
	const allowed = options?.capabilitySet?.components
	if (!allowed || allowed.length === 0) return true
	if (type === 'table') return allowed.includes('table')
	return true
}

export function resolveNodeWithFallback(node: any, options?: RenderOptions): any {
	const type = String(node?.type || 'unknown')
	const hasComponent = Boolean((REGISTRY as any)[type])
	// If table is not supported by registry or capability, downgrade to list when possible
	if (type === 'table' && (!hasComponent || !componentsAllow('table', options))) {
		const allowed = options?.capabilitySet?.components
		const listSupported = !allowed || allowed.includes('list')
		if (listSupported) {
			const columns = node?.props?.columns || []
			let itemNode = columns[0]?.cell
			if (!itemNode) {
				itemNode = { type: 'text', props: { text: '{{ title }}' } }
			}
			if (options?.debug) console.log('[Registry] downgraded table → list (no table component or not allowed)', { itemNode })
			return {
				type: 'list',
				props: {
					data: node?.props?.data,
					item: itemNode,
				},
			}
		}
		if (options?.debug) console.log('[Registry] table not supported and no list fallback allowed')
	}
	return node
} 