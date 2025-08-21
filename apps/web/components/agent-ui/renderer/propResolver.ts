import { getByPath } from './util'

type AnyRecord = Record<string, any>

export function resolveBinding(value: any, rootData: AnyRecord, localScope?: AnyRecord): any {
	if (typeof value === 'string') {
		if (value.startsWith('@')) {
			const path = value.slice(1)
			return getByPath(rootData, path)
		}
		if (value.includes('{{')) {
			return interpolateWithFallback(value, rootData, localScope || {})
		}
	}
	return value
}

function interpolateWithFallback(template: string, root: AnyRecord, scope: AnyRecord): string {
	return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_m, expr) => {
		const key = String(expr).trim()
		let val = getByPath(scope, key)
		if (val == null) val = getByPath(root, key)
		return val == null ? '' : String(val)
	})
} 