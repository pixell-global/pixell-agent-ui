import React, { act } from 'react'
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

export function renderUISpec(container: HTMLElement, spec: UISpecEnvelope, options?: RenderOptions): { unmount: () => void } {
	const root: Root = createRoot(container)
	const inTest = isTestEnvironment()
	if (inTest && typeof act === 'function') {
		act(() => {
			root.render(<RenderEngine container={container} spec={spec} options={options || {}} />)
		})
	} else {
		root.render(<RenderEngine container={container} spec={spec} options={options || {}} />)
	}
	const doUnmount = () => {
		if (inTest && typeof act === 'function') {
			act(() => { root.unmount() })
		} else {
			// Defer to avoid unmounting during a concurrent render phase
			setTimeout(() => {
				try { root.unmount() } catch {}
			}, 0)
		}
	}
	return { unmount: doUnmount }
}

export function applyPatch(spec: UISpecEnvelope, ops: JsonPatchOp[]): UISpecEnvelope {
	return applyJsonPatch(spec, ops)
}

export type { UISpecEnvelope, JsonPatchOp, RenderOptions } from './types' 