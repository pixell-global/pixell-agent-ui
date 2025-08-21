'use client'
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

export type EditorLanguage = 'text' | 'csv' | 'rtf'

export interface EditorBuffer {
	id: string
	path: string
	content: string
	language: EditorLanguage
	encoding: 'utf8' | 'utf16le' | 'latin1'
	eol: 'LF' | 'CRLF'
	version: number
	lastSavedVersion: number
	lastSavedAt?: string
	isSaving: boolean
	isReadOnly: boolean
}

interface EditorState {
	buffers: Record<string, EditorBuffer>
	getByPath: (path: string) => EditorBuffer | undefined
	openPath: (path: string) => Promise<EditorBuffer>
	setContent: (id: string, content: string) => void
	setEncoding?: (id: string, enc: 'utf8' | 'utf16le' | 'latin1') => void
	setEol?: (id: string, eol: 'LF' | 'CRLF') => void
	save: (id: string, opts?: { expectedVersion?: number }) => Promise<EditorBuffer>
	startAutosave?: () => void
}

function detectLanguage(path: string): EditorLanguage {
	const p = path.toLowerCase()
	if (p.endsWith('.csv')) return 'csv'
	if (p.endsWith('.rtf')) return 'rtf'
	return 'text'
}

function genId(): string {
	return typeof crypto !== 'undefined' && (crypto as any).randomUUID ? (crypto as any).randomUUID() : Math.random().toString(36).slice(2)
}

export const useEditorStore = create<EditorState>()(
	devtools((set, get) => ({
		buffers: {},
		getByPath: (path) => Object.values(get().buffers).find((b) => b.path === path),
		openPath: async (path) => {
			const existing = get().getByPath(path)
			if (existing) return existing
			const normalized = path.startsWith('/') ? path.slice(1) : path
			let data: any
			let ok = false
			// First try lightweight content endpoint
			try {
				const resp = await fetch(`/api/files/content?path=${encodeURIComponent(normalized)}`)
				ok = resp.ok
				if (resp.ok) {
					data = await resp.json()
					if (data && data.success !== false) ok = true
				}
			} catch {}
			// Fallback to storage manager route
			if (!ok) {
				const resp2 = await fetch(`/api/files?path=${encodeURIComponent(normalized)}&action=read`)
				if (!resp2.ok) {
					let msg = ''
					try { const j = await resp2.json(); msg = j?.error || '' } catch {}
					throw new Error(`Failed to read file: ${path}${msg ? ' — ' + msg : ''}`)
				}
				const d = await resp2.json()
				data = { content: d.content, lastModified: d.metadata?.lastModified }
			}
			const id = genId()
			const buf: EditorBuffer = {
				id,
				path,
				content: String(data.content ?? ''),
				language: detectLanguage(path),
				encoding: 'utf8',
				eol: 'LF',
				version: 1,
				lastSavedVersion: 1,
				lastSavedAt: data.lastModified,
				isSaving: false,
				isReadOnly: false,
			}
			set((state) => ({ buffers: { ...state.buffers, [id]: buf } }))
			return buf
		},
		setContent: (id, content) => set((state) => ({ buffers: { ...state.buffers, [id]: { ...state.buffers[id], content } } })),
		setEncoding: (id, enc) => set((state) => ({ buffers: { ...state.buffers, [id]: { ...state.buffers[id], encoding: enc } } })),
		setEol: (id, eol) => set((state) => ({ buffers: { ...state.buffers, [id]: { ...state.buffers[id], eol } } })),
		save: async (id, opts) => {
			const buf = get().buffers[id]
			if (!buf) throw new Error('Buffer not found')
			set((state) => ({ buffers: { ...state.buffers, [id]: { ...state.buffers[id], isSaving: true } } }))
			const body = { path: buf.path, content: buf.content, encoding: buf.encoding, eol: buf.eol, expectedVersion: opts?.expectedVersion ?? buf.version }
			const form = new FormData()
			form.set('action', 'write')
			form.set('path', buf.path)
			form.set('content', buf.content)
			const resp = await fetch('/api/files', { method: 'POST', body: form })
			if (!resp.ok) throw new Error('Save failed')
			const now = new Date().toISOString()
			const updated: EditorBuffer = { ...buf, lastSavedAt: now, lastSavedVersion: buf.version + 1, version: buf.version + 1, isSaving: false }
			set((state) => ({ buffers: { ...state.buffers, [id]: updated } }))
			return updated
		},
		startAutosave: () => {
			let timer: any
			const tick = () => {
				const state = get()
				Object.values(state.buffers).forEach((buf) => {
					if (buf.content != null && buf.content.length > 0 && buf.version === buf.lastSavedVersion) return
					// Save small files automatically (<5MB)
					const bytes = new Blob([buf.content || '']).size
					if (bytes <= 5 * 1024 * 1024) {
						state.save(buf.id).catch(() => {})
					}
				})
				timer = setTimeout(tick, 2000)
			}
			if (typeof window !== 'undefined') {
				if ((window as any).__editor_autosave_started) return
				;(window as any).__editor_autosave_started = true
				setTimeout(tick, 2000)
			}
		},
	}))
)


