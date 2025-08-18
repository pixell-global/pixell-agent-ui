import React from 'react'

interface ListProps {
	data?: any
	item?: any
	renderItem?: (item: any, index: number) => React.ReactNode
}

export const List: React.FC<ListProps> = ({ data, renderItem }) => {
	const arr = Array.isArray(data) ? data : []
	if (arr.length === 0) {
		return <div role="list" aria-label="empty-list">No items</div>
	}
	return (
		<ul>
			{arr.map((it, idx) => (
				<li key={idx}>{renderItem ? renderItem(it, idx) : null}</li>
			))}
		</ul>
	)
} 