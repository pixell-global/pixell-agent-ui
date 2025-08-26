'use client'
import React, { useEffect, useMemo, useState } from 'react'
import { useEditorStore } from '@/stores/editor-store'
import { useTabStore } from '@/stores/tab-store'
import { EditorStatusBar } from './EditorStatusBar'

interface Props {
	bufferId: string
}

export const TextEditor: React.FC<Props> = ({ bufferId }) => {
	const buffer = useEditorStore((s) => s.buffers[bufferId])
	const setContent = useEditorStore((s) => s.setContent)
	const markDirty = useTabStore((s) => s.markDirty)
  const save = useEditorStore((s) => s.save)

	const [value, setValue] = useState(buffer?.content || '')
  const [caret, setCaret] = useState({ line: 1, column: 1 })

	useEffect(() => { setValue(buffer?.content || '') }, [buffer?.content])

	useEffect(() => {
		if (!buffer) return
		markDirty(bufferId, value !== buffer.content)
	}, [value, buffer, bufferId, markDirty])

	if (!buffer) return <div className="p-3 text-sm text-muted-foreground">Loading…</div>

	return (
		<div className="flex flex-col h-full">
			<textarea
				className="w-full flex-1 p-3 font-mono text-sm outline-none resize-none bg-background"
				value={value}
				onChange={(e) => { setValue(e.target.value); setContent(bufferId, e.target.value) }}
				onKeyDown={(e) => {
					if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
						e.preventDefault()
						save(bufferId).catch(console.error)
					}
				}}
				onSelect={(e) => {
					const target = e.target as HTMLTextAreaElement
					const pos = target.selectionStart
					const lines = target.value.slice(0, pos).split('\n')
					setCaret({ line: lines.length, column: lines[lines.length - 1].length + 1 })
				}}
			/>
			<EditorStatusBar bufferId={bufferId} caret={caret} />
		</div>
	)
}


