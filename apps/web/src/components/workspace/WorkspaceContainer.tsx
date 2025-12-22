'use client'
import React, { useEffect, useMemo } from 'react'
import { useTabStore } from '@/stores/tab-store'
import { useEditorStore } from '@/stores/editor-store'
import { ChatWorkspace } from '@/components/chat/ChatWorkspace'
import { FileEditorContainer } from '@/components/editor/FileEditorContainer'
import { HtmlViewer } from '@/components/editor/HtmlViewer'

export const WorkspaceContainer: React.FC = () => {
	const { tabs, activeTabId } = useTabStore()
	const active = useMemo(() => tabs.find((t) => t.id === activeTabId), [tabs, activeTabId])
	const openPath = useEditorStore((s) => s.openPath)
	const updateBufferId = useTabStore((s) => s.updateBufferId)
  const startAutosave = useEditorStore((s) => (s as any).startAutosave)

	useEffect(() => { if (startAutosave) startAutosave() }, [startAutosave])
	useEffect(() => {
		if (active?.type === 'editor' && active.path && !active.bufferId) {
			openPath(active.path).then((buf) => updateBufferId(active.id, buf.id)).catch(console.error)
		}
	}, [active?.id, active?.type, active?.path, active?.bufferId, openPath, updateBufferId])

	if (!active) return null
	if (active.type === 'chat') return <ChatWorkspace />
	if (active.type === 'editor') return active.bufferId ? <FileEditorContainer bufferId={active.bufferId} /> : <div className="p-3">Loading…</div>
	if (active.type === 'viewer' && active.path) return <HtmlViewer path={active.path} title={active.title} />
	return null
}


