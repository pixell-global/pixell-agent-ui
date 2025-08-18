import React from 'react'

interface TextProps {
	text?: string
}

export const Text: React.FC<TextProps> = ({ text }) => {
	const content = text ?? ''
	return <span data-testid="paf-text">{content}</span>
} 