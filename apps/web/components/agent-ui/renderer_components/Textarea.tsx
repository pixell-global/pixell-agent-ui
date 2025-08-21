import React from 'react'

interface TextareaProps {
  text?: string
  onChange?: (value: string) => void
}

export const Textarea: React.FC<TextareaProps> = ({ text, onChange }) => {
  const value = text ?? ''
  console.log('[Textarea] Rendering with value:', value)
  return (
    <textarea
      value={value}
      onChange={(e) => {
        console.log('[Textarea] onChange called with:', e.target.value)
        onChange && onChange(e.target.value)
      }}
      className="w-full min-h-[80px] border border-gray-300 rounded p-2"
    />
  )
}


