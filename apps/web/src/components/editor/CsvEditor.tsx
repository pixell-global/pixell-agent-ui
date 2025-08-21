'use client'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useEditorStore } from '@/stores/editor-store'
import { EditorStatusBar } from './EditorStatusBar'
import { parseCsv as parseCsvUtil, sniffDelimiter } from '@/lib/csv'

interface Props { bufferId: string }

const parseCsv = (text: string, delimiter: string): string[][] => parseCsvUtil(text, delimiter as any)

function toCsv(rows: string[][], delimiter: string): string {
	return rows.map(r => r.join(delimiter)).join('\n')
}

function useTextMeasurer(font = '12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace') {
	const canvasRef = useRef<HTMLCanvasElement | null>(null)
	if (!canvasRef.current && typeof document !== 'undefined') {
		canvasRef.current = document.createElement('canvas')
	}
	const measure = (text: string): number => {
		const canvas = canvasRef.current
		if (!canvas) return text.length * 8
		const ctx = canvas.getContext('2d')!
		ctx.font = font
		return ctx.measureText(text || '').width
	}
	return measure
}

export const CsvEditor: React.FC<Props> = ({ bufferId }) => {
	const buffer = useEditorStore((s) => s.buffers[bufferId])
	const setContent = useEditorStore((s) => s.setContent)
	const [mode, setMode] = useState<'grid' | 'text'>('grid')
	const [delimiter, setDelimiter] = useState(',')
	const [rows, setRows] = useState<string[][]>([])
	const [colWidths, setColWidths] = useState<number[]>([])
	const measure = useTextMeasurer()

	useEffect(() => {
		if (!buffer) return
		const best = sniffDelimiter(buffer.content)
		setDelimiter(best as any)
		const parsed = parseCsv(buffer.content, best)
		setRows(parsed)
		// initialize widths based on header
		const header = parsed[0] || []
		const initial = header.map((h) => Math.max(180, Math.ceil(measure(h)) + 32))
		setColWidths(initial)
	}, [buffer?.id])

	const autosizeColumn = (idx: number) => {
		const header = rows[0] || []
		let max = Math.ceil(measure(header[idx] || ''))
		for (let r = 1; r < rows.length; r++) {
			max = Math.max(max, Math.ceil(measure(rows[r]?.[idx] || '')))
			// Lightweight cap to avoid extreme memory/time
			if (r > 1000) break
		}
		const next = colWidths.slice()
		next[idx] = Math.max(120, Math.min(max + 32, 800))
		setColWidths(next)
	}

	if (!buffer) return <div className="p-3 text-sm text-muted-foreground">Loading…</div>

	return (
		<div className="flex flex-col h-full">
			<div className="border-b px-3 py-1 text-xs flex items-center gap-3 bg-muted/30">
				<button className={mode==='grid'? 'font-medium' : 'opacity-70'} onClick={() => setMode('grid')}>Grid</button>
				<button className={mode==='text'? 'font-medium' : 'opacity-70'} onClick={() => setMode('text')}>Text</button>
				<label className="ml-2">Delimiter
					<select className="ml-2 border rounded px-1 py-0.5 text-xs" value={delimiter} onChange={(e) => { setDelimiter(e.target.value); const parsed = parseCsv(buffer.content, e.target.value); setRows(parsed) }}>
						<option value=",">Comma</option>
						<option value="\t">Tab</option>
						<option value=";">Semicolon</option>
					</select>
				</label>
			</div>
			{mode === 'grid' ? (
				<div className="flex-1 overflow-auto">
					<div className="min-w-max inline-block">
						<table className="text-xs border-separate border-spacing-0">
							<thead>
								<tr>
									{(rows[0] || []).map((h, i) => (
										<th key={i} className="border p-1 text-left font-medium relative whitespace-nowrap" style={{ width: colWidths[i] }}>
											<span>{h}</span>
											<span
												className="absolute right-0 top-0 h-full w-1 cursor-col-resize"
												onDoubleClick={() => autosizeColumn(i)}
											/>
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{rows.slice(1).map((r, i) => (
									<tr key={i}>
										{r.map((c, j) => (
											<td key={j} className="border p-1" style={{ width: colWidths[j] }}>
												<input className="w-full outline-none bg-transparent" value={c} onChange={(e) => {
													const nextRows = rows.map(row => row.slice())
													nextRows[i + 1][j] = e.target.value
													setRows(nextRows)
													setContent(bufferId, toCsv(nextRows, delimiter))
												}} />
											</td>
										))}
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			) : (
				<textarea className="w-full flex-1 p-3 font-mono text-xs outline-none resize-none bg-background" value={buffer.content} onChange={(e) => setContent(bufferId, e.target.value)} />
			)}
			<EditorStatusBar bufferId={bufferId} caret={{ line: 1, column: 1 }} />
		</div>
	)
}


