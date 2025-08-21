'use client'
import React from 'react'
import { useEditorStore } from '@/stores/editor-store'
import { TextEditor } from './TextEditor'
import { CsvEditor } from './CsvEditor'
import { RtfEditor } from './RtfEditor'

interface Props {
	bufferId: string
}

export const FileEditorContainer: React.FC<Props> = ({ bufferId }) => {
	const buffer = useEditorStore((s) => s.buffers[bufferId])
	if (!buffer) return <div className="p-3 text-sm text-muted-foreground">Opening…</div>
	if (buffer.language === 'csv') return <CsvEditor bufferId={bufferId} />
	if (buffer.language === 'rtf') return <RtfEditor bufferId={bufferId} />
	if (buffer.language === 'text') return <TextEditor bufferId={bufferId} />
	return <div className="p-3">Unsupported file type</div>
}


