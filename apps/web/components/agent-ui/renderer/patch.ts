import type { UISpecEnvelope, JsonPatchOp } from './types'

function clone<T>(v: T): T {
	return JSON.parse(JSON.stringify(v))
}

function pointerToSegments(pointer: string): (string | number)[] {
	if (!pointer.startsWith('/')) return []
	const parts = pointer.split('/').slice(1)
	return parts.map((p) => p.replace(/~1/g, '/').replace(/~0/g, '~')).map((seg) => {
		// array index detection
		if (/^\d+$/.test(seg)) return Number(seg)
		return seg
	})
}

function setAtPath(target: any, segments: (string | number)[], value: any): void {
	let current = target
	for (let i = 0; i < segments.length - 1; i++) {
		const key = segments[i]
		if (typeof key === 'number') {
			if (!Array.isArray(current)) throw new Error('Path expects array')
			if (!current[key]) current[key] = {}
			current = current[key]
		} else {
			if (!(key in current) || current[key] === null || typeof current[key] !== 'object') current[key] = {}
			current = current[key]
		}
	}
	const last = segments[segments.length - 1]
	if (typeof last === 'number') {
		if (!Array.isArray(current)) current = []
		current[last] = value
	} else {
		current[last] = value
	}
}

function removeAtPath(target: any, segments: (string | number)[]): void {
	let current = target
	for (let i = 0; i < segments.length - 1; i++) {
		current = current[segments[i] as any]
		if (current == null) return
	}
	const last = segments[segments.length - 1]
	if (Array.isArray(current) && typeof last === 'number') {
		current.splice(last, 1)
	} else if (current && typeof current === 'object') {
		delete current[last as any]
	}
}

export function applyJsonPatch(spec: UISpecEnvelope, ops: JsonPatchOp[]): UISpecEnvelope {
	const next = clone(spec)
	for (const op of ops) {
		if (!op.path.startsWith('/data') && !op.path.startsWith('/view')) continue
		const segments = pointerToSegments(op.path)
		if (segments.length === 0) continue
		switch (op.op) {
			case 'add':
				setAtPath(next as any, segments, op.value)
				break
			case 'replace':
				setAtPath(next as any, segments, op.value)
				break
			case 'remove':
				removeAtPath(next as any, segments)
				break
			default:
				// Minimal support for tests
				break
		}
	}
	return next
} 