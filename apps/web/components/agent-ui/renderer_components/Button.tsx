import React from 'react'

interface ButtonProps {
	text?: string
	onPress?: () => void
}

export const Button: React.FC<ButtonProps> = ({ text, onPress }) => {
	return (
		<button type="button" onClick={onPress}>
			{text ?? ''}
		</button>
	)
} 