import React from 'react'

interface PageProps {
	title?: string
	children?: React.ReactNode
}

export const Page: React.FC<PageProps> = ({ title, children }) => {
	return (
		<div>
			{title ? <h1>{title}</h1> : null}
			<div>{children}</div>
		</div>
	)
} 