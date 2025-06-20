'use client'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
}

interface MessageListProps {
  messages: Message[]
  isStreaming: boolean
}

export function MessageList({ messages, isStreaming }: MessageListProps) {
  return (
    <ScrollArea className="flex-1 px-4">
      <div className="space-y-4 py-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex items-start gap-3",
              message.role === 'user' && "flex-row-reverse"
            )}
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback>
                {message.role === 'user' ? 'U' : 'A'}
              </AvatarFallback>
            </Avatar>
            
            <Card className={cn(
              "max-w-[80%]",
              message.role === 'user' 
                ? "bg-primary text-primary-foreground" 
                : "bg-muted"
            )}>
              <CardContent className="p-3">
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                <span className="text-xs opacity-70 mt-2 block">
                  {message.timestamp.toLocaleTimeString()}
                </span>
              </CardContent>
            </Card>
          </div>
        ))}
        
        {isStreaming && (
          <div className="flex items-start gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback>A</AvatarFallback>
            </Avatar>
            <Card className="bg-muted">
              <CardContent className="p-3">
                <div className="flex items-center gap-1">
                  <div className="animate-pulse">●</div>
                  <div className="animate-pulse delay-100">●</div>
                  <div className="animate-pulse delay-200">●</div>
                  <span className="ml-2 text-sm text-muted-foreground">
                    Agent is thinking...
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </ScrollArea>
  )
} 