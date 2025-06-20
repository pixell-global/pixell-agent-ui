'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send } from 'lucide-react'

interface ChatInputProps {
  onSendMessage: (content: string) => void
  disabled?: boolean
}

export function ChatInput({ onSendMessage, disabled = false }: ChatInputProps) {
  const [input, setInput] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (input.trim() && !disabled) {
      onSendMessage(input.trim())
      setInput('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <div className="border-t bg-background p-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message to your agents..."
          className="min-h-[60px] resize-none"
          disabled={disabled}
        />
        <Button 
          type="submit" 
          disabled={!input.trim() || disabled}
          size="icon"
          className="self-end"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
      <p className="text-xs text-muted-foreground mt-2">
        Press Enter to send, Shift + Enter for new line
      </p>
    </div>
  )
} 