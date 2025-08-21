'use client'
import React from 'react'
import { useEditorStore } from '@/stores/editor-store'
import { useTabStore } from '@/stores/tab-store'
import { Button } from '@/components/ui/button'
import { Save } from 'lucide-react'

interface Props {
	bufferId: string
	caret: { line: number; column: number }
}

export const EditorStatusBar: React.FC<Props> = ({ bufferId, caret }) => {
	const buffer = useEditorStore((s) => s.buffers[bufferId])
	const setEncoding = useEditorStore((s: any) => (s as any).setEncoding)
	const setEol = useEditorStore((s: any) => (s as any).setEol)
	const save = useEditorStore((s) => s.save)
	const tab = useTabStore((s) => s.tabs.find((t) => t.bufferId === bufferId))

	if (!buffer) return null
	const sizeBytes = new Blob([buffer.content || '']).size

	return (
		<div className="h-10 border-t bg-muted/30 text-xs px-3 flex items-center gap-4 select-none">
			<span>{buffer.language.toUpperCase()}</span>
			<span>Ln {caret.line}, Col {caret.column}</span>
			<span>{buffer.encoding.toUpperCase()}</span>
			<button className="underline-offset-2 hover:underline" onClick={() => setEncoding && setEncoding(bufferId, buffer.encoding === 'utf8' ? 'utf16le' : 'utf8')}>Toggle Encoding</button>
			<span>{buffer.eol}</span>
			<button className="underline-offset-2 hover:underline" onClick={() => setEol && setEol(bufferId, buffer.eol === 'LF' ? 'CRLF' : 'LF')}>Toggle EOL</button>
			<span>{(sizeBytes / 1024).toFixed(1)} KB</span>
			{tab?.isDirty ? <span className="text-amber-600">• Unsaved</span> : <span className="text-muted-foreground">Saved</span>}
			<div className="ml-auto flex items-center gap-2">
				<Button
					variant="default"
					size="sm"
					className="h-8 px-3 rounded-md shadow-sm bg-[hsl(217_91%_60%)] hover:bg-[hsl(217_91%_55%)] text-white"
					onClick={() => save(bufferId).catch(console.error)}
					disabled={buffer.isSaving}
				>
					<Save className="h-4 w-4" />
					Save
				</Button>
			</div>
		</div>
	)
}


