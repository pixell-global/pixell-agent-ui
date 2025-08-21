import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface TableColumn {
	header?: string
	cell?: any // node spec for a cell (already resolved upstream to be rendered by RenderEngine)
}

interface TableProps {
	data?: any
	columns?: TableColumn[]
	renderCell?: (cellSpec: any, row: any, rowIndex: number, colIndex: number) => React.ReactNode
	className?: string
}

// Lightweight modal used to show full cell content when truncated
function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: React.ReactNode }) {
	const [mounted, setMounted] = useState(false)
	useEffect(() => { setMounted(true) }, [])
	if (!open || !mounted) return null
	const modal = (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
			<div className="absolute inset-0 bg-black/50" onClick={onClose} />
			<div className="relative bg-white rounded-lg shadow-xl w-full max-w-[520px] max-h-[60vh] overflow-auto p-4">
				<div className="flex items-center justify-between mb-2">
					<h3 className="text-sm font-medium text-gray-700">{title || 'Details'}</h3>
					<button className="text-gray-400 hover:text-gray-600" onClick={onClose} aria-label="Close">✕</button>
				</div>
				<div className="text-sm whitespace-pre-wrap break-words">
					{children}
				</div>
			</div>
		</div>
	)
	return typeof document !== 'undefined' ? createPortal(modal, document.body) : null
}

function TruncatingCell({ children, maxWidthPx = 240, modalTitle }: { children: React.ReactNode; maxWidthPx?: number; modalTitle?: string }) {
	const wrapperRef = useRef<HTMLDivElement | null>(null)
	const [isTruncated, setIsTruncated] = useState(false)
	const [open, setOpen] = useState(false)

	// Cache the full text lazily when needed
	const fullText = useMemo(() => {
		if (!wrapperRef.current) return ''
		return wrapperRef.current.innerText || ''
	}, [open])

	useEffect(() => {
		const el = wrapperRef.current
		if (!el) return
		const check = () => {
			const truncated = el.scrollWidth > el.clientWidth
			setIsTruncated(truncated)
		}
		check()
		// Re-check on window resize as widths may change
		window.addEventListener('resize', check)
		return () => window.removeEventListener('resize', check)
	}, [])

	return (
		<>
			<div
				ref={wrapperRef}
				className="overflow-hidden text-ellipsis whitespace-nowrap"
				style={{ maxWidth: `${maxWidthPx}px`, cursor: isTruncated ? 'pointer' : 'default' }}
				title={isTruncated ? 'Click to view full content' : undefined}
				onClick={() => { if (isTruncated) setOpen(true) }}
			>
				{children}
			</div>
			<Modal open={open} onClose={() => setOpen(false)} title={modalTitle}>
				{fullText}
			</Modal>
		</>
	)
}

export const Table: React.FC<TableProps> = ({ data, columns = [], renderCell, className = '' }) => {
	const rows = Array.isArray(data) ? data : []
	const cols = Array.isArray(columns) ? columns : []
	
	console.log('[Table] Rendering with data:', rows)
	console.log('[Table] Columns:', cols)

	if (rows.length === 0 || cols.length === 0) {
		return <div role="table" aria-label="empty-table">No data</div>
	}

	return (
		<div className={className}>
			<div className="overflow-x-auto">
				<table className="min-w-max divide-y divide-gray-200 border border-gray-200 rounded-lg table-fixed">
					<thead className="bg-gray-50">
						<tr>
							{cols.map((c, i) => (
								<th key={i} className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wide">
									{c.header || ''}
								</th>
							))}
						</tr>
					</thead>
					<tbody className="bg-white divide-y divide-gray-100">
						{rows.map((row, rIdx) => (
							<tr key={rIdx} className="hover:bg-gray-50">
								{cols.map((c, cIdx) => {
									const cellSpec: any = c.cell || {}
									const cellType = String(cellSpec.type || '').toLowerCase()
									const isInteractive = cellType === 'button' || cellType === 'textarea' || cellType === 'input' || cellType === 'select'
									return (
										<td key={cIdx} className="px-4 py-2 text-sm text-gray-800 align-top">
											{isInteractive ? (
												renderCell ? renderCell(cellSpec, row, rIdx, cIdx) : null
											) : (
												<TruncatingCell modalTitle={c.header}>
													{renderCell ? renderCell(cellSpec, row, rIdx, cIdx) : null}
												</TruncatingCell>
											)}
										</td>
									)
								})}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	)
} 