import React, { useState } from 'react'
import { History, Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface ChatSession {
  id: string
  name: string
  lastMessage: string
  messageCount: number
  createdAt: string
  updatedAt: string
}

interface HistoryPaneProps {
  className?: string
}

export const HistoryPane: React.FC<HistoryPaneProps> = ({ className }) => {
  const [searchQuery, setSearchQuery] = useState('')
  
  // Mock chat sessions - in real implementation, this would come from store/API
  const [chatSessions] = useState<ChatSession[]>([
    {
      id: '1',
      name: 'Reddit Analysis Project',
      lastMessage: 'Great! The analysis is complete...',
      messageCount: 15,
      createdAt: '2024-01-15T10:30:00Z',
      updatedAt: '2024-01-15T14:20:00Z'
    },
    {
      id: '2', 
      name: 'File Processing Task',
      lastMessage: 'Files uploaded successfully',
      messageCount: 8,
      createdAt: '2024-01-14T16:45:00Z',
      updatedAt: '2024-01-14T17:15:00Z'
    },
    {
      id: '3',
      name: 'Data Migration Script',
      lastMessage: 'Script execution completed',
      messageCount: 12,
      createdAt: '2024-01-13T09:15:00Z',
      updatedAt: '2024-01-13T11:30:00Z'
    },
    {
      id: '4',
      name: 'UI Component Design',
      lastMessage: 'Components are ready for review',
      messageCount: 23,
      createdAt: '2024-01-12T14:00:00Z',
      updatedAt: '2024-01-12T16:45:00Z'
    }
  ])

  const filteredSessions = chatSessions.filter(session =>
    session.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    session.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else if (diffDays === 1) {
      return 'Yesterday'
    } else if (diffDays < 7) {
      return `${diffDays} days ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Search Bar */}
      <div className="p-4 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-sm"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchQuery('')}
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* History List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-3">
          {filteredSessions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm font-medium mb-1">
                {searchQuery ? 'No conversations found' : 'No conversation history'}
              </p>
              <p className="text-xs">
                {searchQuery ? 'Try adjusting your search terms' : 'Start a conversation to see it here'}
              </p>
            </div>
          ) : (
            filteredSessions.map((session) => (
              <div
                key={session.id}
                className="group p-4 rounded-lg border hover:bg-accent cursor-pointer transition-colors"
                onClick={() => {
                  console.log('Load session:', session.id)
                  // In real implementation: navigate to session or load messages
                }}
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="text-sm font-medium truncate flex-1 pr-2">
                    {session.name}
                  </h4>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatTime(session.updatedAt)}
                  </span>
                </div>
                
                <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                  {session.lastMessage}
                </p>
                
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {session.messageCount} messages
                  </span>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="sm" className="h-6 text-xs">
                      Open
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
} 