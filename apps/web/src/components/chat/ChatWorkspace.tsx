'use client'
import { useState } from 'react'
import { useUIStore } from '@/stores/ui-store'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { Card } from '@/components/ui/card'

export function ChatWorkspace() {
  const { isStreaming } = useUIStore()
  const [messages, setMessages] = useState<Array<{
    id: string
    role: 'user' | 'assistant' | 'system'
    content: string
    timestamp: Date
  }>>([])

  const handleSendMessage = (content: string) => {
    const newMessage = {
      id: crypto.randomUUID(),
      role: 'user' as const,
      content,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, newMessage])
    
    // TODO: Send to agent orchestrator in Phase 2
    console.log('Sending message to agents:', content)
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="border-b px-4 py-3">
        <h2 className="font-semibold">Agent Conversation</h2>
        <p className="text-sm text-muted-foreground">
          Chat with your AI agents and orchestrate multi-agent workflows
        </p>
      </div>
      
      <div className="flex-1 flex flex-col min-h-0">
        {messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <Card className="p-8 max-w-md text-center">
              <h3 className="text-lg font-semibold mb-2">Welcome to Pixell</h3>
              <p className="text-muted-foreground mb-4">
                Start a conversation with your AI agents. They&apos;ll coordinate automatically to complete complex tasks.
              </p>
              <div className="text-sm text-muted-foreground">
                <p>Try asking something like:</p>
                <ul className="mt-2 space-y-1">
                  <li>• &ldquo;Create a content strategy for my startup&rdquo;</li>
                  <li>• &ldquo;Research trending topics in my industry&rdquo;</li>
                  <li>• &ldquo;Analyze my social media performance&rdquo;</li>
                </ul>
              </div>
            </Card>
          </div>
        ) : (
          <MessageList messages={messages} isStreaming={isStreaming} />
        )}
        
        <ChatInput onSendMessage={handleSendMessage} disabled={isStreaming} />
      </div>
    </div>
  )
} 