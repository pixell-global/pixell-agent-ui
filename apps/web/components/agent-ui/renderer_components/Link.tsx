import React from 'react'

interface LinkProps {
	text?: string
	url?: string
}

export const Link: React.FC<LinkProps> = ({ text, url }) => {
	const label = text ?? ''
	const href = url ?? '#'
	return (
		<a href={href} target="_blank" rel="noreferrer noopener" className="text-blue-600 underline">
			{label}
		</a>
	)
} 