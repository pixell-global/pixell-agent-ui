import React from 'react'

interface LinkProps {
	text?: string
	url?: string
	onPress?: () => void
}

export const Link: React.FC<LinkProps> = ({ text, url, onPress }) => {
	const label = text ?? ''
	const href = url ?? '#'
	const handleClick: React.MouseEventHandler<HTMLAnchorElement> = (e) => {
		if (onPress) {
			e.preventDefault()
			onPress()
		}
	}
	return (
		<a href={href} onClick={handleClick} target={onPress ? undefined : '_blank'} rel={onPress ? undefined : 'noreferrer noopener'} className="text-blue-600 underline">
			{label}
		</a>
	)
}