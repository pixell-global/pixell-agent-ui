'use client'
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

export type WorkspaceTabType = 'chat' | 'editor'

export interface WorkspaceTab {
	id: string
	type: WorkspaceTabType
	title: string
	icon?: string
	isPinned?: boolean
	isDirty?: boolean
	path?: string
	bufferId?: string
}

interface TabState {
	tabs: WorkspaceTab[]
	activeTabId: string
	openChatTab: (title?: string) => string
	openEditorTab: (args: { path: string; title?: string; bufferId?: string }) => string
	closeTab: (id: string) => void
	setActiveTab: (id: string) => void
	markDirty: (id: string, dirty: boolean) => void
	updateBufferId: (id: string, bufferId: string) => void
}

function generateId(): string {
	return typeof crypto !== 'undefined' && (crypto as any).randomUUID ? (crypto as any).randomUUID() : Math.random().toString(36).slice(2)
}

export const useTabStore = create<TabState>()(
	devtools((set, get) => ({
		tabs: [
			{ id: 'chat-1', type: 'chat', title: 'Chat' },
		],
		activeTabId: 'chat-1',
		openChatTab: (title?: string) => {
			const id = generateId()
			set((state) => ({ tabs: [...state.tabs, { id, type: 'chat', title: title || 'Chat' }], activeTabId: id }))
			return id
		},
		openEditorTab: ({ path, title, bufferId }) => {
			// Focus if already open
			const existing = get().tabs.find((t) => t.type === 'editor' && t.path === path)
			if (existing) {
				set({ activeTabId: existing.id })
				return existing.id
			}
			const id = generateId()
			const tab: WorkspaceTab = { id, type: 'editor', title: title || path.split('/').pop() || 'Untitled', path, bufferId }
			set((state) => ({ tabs: [...state.tabs, tab], activeTabId: id }))
			return id
		},
		closeTab: (id) => set((state) => {
			const tabs = state.tabs.filter((t) => t.id !== id)
			let activeTabId = state.activeTabId
			if (state.activeTabId === id && tabs.length > 0) {
				activeTabId = tabs[tabs.length - 1].id
			}
			return { tabs, activeTabId }
		}),
		setActiveTab: (id) => set({ activeTabId: id }),
		markDirty: (id, dirty) => set((state) => ({ tabs: state.tabs.map((t) => (t.id === id ? { ...t, isDirty: dirty } : t)) })),
		updateBufferId: (id, bufferId) => set((state) => ({ tabs: state.tabs.map((t) => (t.id === id ? { ...t, bufferId } : t)) })),
	}))
)


