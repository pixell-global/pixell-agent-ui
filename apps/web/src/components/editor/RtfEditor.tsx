'use client'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useEditorStore } from '@/stores/editor-store'
import { EditorStatusBar } from './EditorStatusBar'

interface Props { bufferId: string }

function escapeHtml(s: string): string {
	return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

function rtfToPlain(rtf: string): string {
	// Very naive: strip {\rtf...} groups and control words, keep text
	return rtf
		.replace(/\{\\rtf1[\s\S]*?\{/,'{')
		.replace(/\\[a-z]+-?\d* ?/gi, '')
		.replace(/[{}]/g, '')
		.replace(/\r?\n/g, '\n')
}

function rtfToHtml(rtf: string): string {
	const plain = rtfToPlain(rtf)
	return `<p>${escapeHtml(plain).replace(/\n/g, '<br/>')}</p>`
}

function htmlToRtf(html: string): string {
	// Naive HTML → RTF wrapper; preserves plain text lines
	const tmp = html.replace(/<br\s*\/>/gi, '\n').replace(/<[^>]+>/g, '')
	const escaped = tmp.replace(/\\/g, '\\\\').replace(/{/g, '\\{').replace(/}/g, '\\}')
	return `{\\rtf1\\ansi ${escaped}}`
}

export const RtfEditor: React.FC<Props> = ({ bufferId }) => {
	const buffer = useEditorStore((s) => s.buffers[bufferId])
	const setContent = useEditorStore((s) => s.setContent)
	const [mode, setMode] = useState<'rich' | 'raw'>('rich')
	const [html, setHtml] = useState('')
	const ref = useRef<HTMLDivElement>(null)

	useEffect(() => {
		if (!buffer) return
		try {
			setHtml(rtfToHtml(buffer.content || ''))
			setMode('rich')
		} catch {
			setMode('raw')
		}
	}, [buffer?.id])

	if (!buffer) return <div className="p-3 text-sm text-muted-foreground">Loading…</div>

	return (
		<div className="flex flex-col h-full">
			<div className="border-b px-3 py-1 text-xs flex items-center gap-3 bg-muted/30">
				<button className={mode==='rich'? 'font-medium' : 'opacity-70'} onClick={() => setMode('rich')}>Rich</button>
				<button className={mode==='raw'? 'font-medium' : 'opacity-70'} onClick={() => setMode('raw')}>Raw</button>
				{mode==='rich' && <span className="text-muted-foreground">(conversion is best-effort)</span>}
			</div>
			{mode === 'rich' ? (
				<div
					ref={ref}
					className="flex-1 p-3 prose prose-sm max-w-none outline-none"
					contentEditable
					dangerouslySetInnerHTML={{ __html: html }}
					onInput={(e) => {
						const cur = (e.target as HTMLDivElement).innerHTML
						setHtml(cur)
						try {
							const rtf = htmlToRtf(cur)
							setContent(bufferId, rtf)
						} catch {
							// fallback silently
						}
					}}
				/>
			) : (
				<textarea className="w-full flex-1 p-3 font-mono text-xs outline-none resize-none bg-background" value={buffer.content} onChange={(e) => setContent(bufferId, e.target.value)} />
			)}
			<EditorStatusBar bufferId={bufferId} caret={{ line: 1, column: 1 }} />
		</div>
	)
}


