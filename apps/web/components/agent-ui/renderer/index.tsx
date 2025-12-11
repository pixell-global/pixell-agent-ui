import React from 'react'
import { createRoot, Root } from 'react-dom/client'
import { RenderEngine } from './RenderEngine'
import type { UISpecEnvelope, JsonPatchOp, RenderOptions } from './types'
import { applyJsonPatch } from './patch'

function isTestEnvironment(): boolean {
	// Detect Jest/node test envs
	if (typeof (globalThis as any).jest !== 'undefined') return true
	if (typeof process !== 'undefined' && process?.env?.NODE_ENV === 'test') return true
	return false
}

// Safe act import - try to get from react-dom/test-utils first, then fallback
function getAct(): ((callback: () => void) => void) | null {
	try {
		// Try React 18+ act from react-dom/test-utils
		const testUtils = eval('require')('react-dom/test-utils'); return testUtils.act
	} catch {
		// Fallback: no act available, just return null
		return null
	}
}

export function renderUISpec(container: HTMLElement, spec: UISpecEnvelope, options?: RenderOptions): { unmount: () => void } {
	// Reuse a single root per container to avoid createRoot collisions
	let root: Root | undefined = (container as any).__pafRoot as Root | undefined
	const inTest = isTestEnvironment()
	if (!root) {
		root = createRoot(container)
		;(container as any).__pafRoot = root
	}
	const act = getAct()
	if (inTest && act) {
		act(() => {
			root!.render(<RenderEngine container={container} spec={spec} options={options || {}} />)
		})
	} else {
		root.render(<RenderEngine container={container} spec={spec} options={options || {}} />)
	}
	const doUnmount = () => {
		const r = (container as any).__pafRoot as Root | undefined
		if (!r) return
		try { r.unmount() } catch {}
		delete (container as any).__pafRoot
	}
	return { unmount: doUnmount }
}

export function applyPatch(spec: UISpecEnvelope, ops: JsonPatchOp[]): UISpecEnvelope {
	return applyJsonPatch(spec, ops)
}

export type { UISpecEnvelope, JsonPatchOp, RenderOptions } from './types' 