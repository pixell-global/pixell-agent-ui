import React from 'react'

export const Unknown: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
	return <>{children ?? null}</>
}