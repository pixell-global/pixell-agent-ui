'use client'

import React from 'react'
import { Copy, Check, User, Bot, AlertTriangle, FileText, Code2, Paperclip } from 'lucide-react'
import { ChatMessage } from '@/types'
import { ThinkingIndicator } from './ThinkingIndicator'
import { MessageContent } from './MessageContent'
import { FileAttachmentPreview } from './FileAttachmentPreview'
import { useChatStore } from '@/stores/chat-store'

interface MessageBubbleProps {
  message: ChatMessage
  isStreaming?: boolean
  className?: string
}

export function MessageBubble({ 
  message, 
  isStreaming = false,
  className = '' 
}: MessageBubbleProps) {
  const settings = useChatStore(state => state.settings)
  const [copiedCode, setCopiedCode] = React.useState<string | null>(null)

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedCode(id)
      setTimeout(() => setCopiedCode(null), 2000)
    } catch (error) {
      console.error('Failed to copy text:', error)
    }
  }

  const getMessageIcon = () => {
    switch (message.role) {
      case 'user':
        return <User size={16} className="text-blue-600" />
      case 'assistant':
        return <Bot size={16} className="text-green-600" />
      case 'system':
        return <AlertTriangle size={16} className="text-orange-600" />
      default:
        return null
    }
  }

  const getMessageTypeIcon = () => {
    switch (message.messageType) {
      case 'alert':
        return <AlertTriangle size={16} className="text-red-500" />
      case 'file_context':
        return <FileText size={16} className="text-blue-500" />
      case 'code':
        return <Code2 size={16} className="text-purple-500" />
      default:
        return null
    }
  }

  const renderContent = () => {
    // Use MessageContent component to handle mentions
    if (message.mentions && message.mentions.length > 0) {
      return (
        <MessageContent 
          content={message.content}
          mentions={message.mentions}
          className="break-words"
        />
      )
    }

    // For now, render as plain text with basic formatting
    // TODO: Add react-markdown and react-syntax-highlighter dependencies
    if (settings.markdownEnabled && message.messageType !== 'code') {
      // Basic markdown-like formatting
      const content = message.content
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code class="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>')
      
      return (
        <div 
          className="whitespace-pre-wrap break-words"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      )
    }

    return (
      <div className="whitespace-pre-wrap break-words">
        {message.content}
      </div>
    )
  }

  const isUser = message.role === 'user'
  const isAlert = message.messageType === 'alert'

  return (
    <div className={`message-bubble flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} ${className}`}>
      {/* Avatar */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
        isUser ? 'bg-blue-100' : isAlert ? 'bg-red-100' : 'bg-green-100'
      }`}>
        {getMessageIcon()}
      </div>

      {/* Message Content */}
      <div className={`flex-1 max-w-[85%] ${isUser ? 'text-right' : 'text-left'}`}>
        {/* Message Header */}
        <div className={`flex items-center gap-2 mb-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
          <span className="text-xs text-gray-500 font-medium">
            {message.role === 'user' ? 'You' : 'Assistant'}
          </span>
          
          {getMessageTypeIcon()}
          
          <span className="text-xs text-gray-400">
            {new Date(message.createdAt).toLocaleTimeString()}
          </span>
        </div>

        {/* Thinking Indicator (for assistant messages only) */}
        {!isUser && message.thinkingSteps && message.thinkingSteps.length > 0 && (
          <ThinkingIndicator
            messageId={message.id}
            steps={message.thinkingSteps}
            isStreamingActive={isStreaming && message.isThinking}
            className="mb-3"
          />
        )}

        {/* File Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mb-3">
            <FileAttachmentPreview
              attachments={message.attachments}
              onRemove={() => {}} // Read-only for sent messages
            />
          </div>
        )}

        {/* File Context Display - TODO: Implement */}
        {message.fileReferences && message.fileReferences.length > 0 && (
          <div className="mb-3 text-xs text-blue-600 flex items-center gap-1">
            <Paperclip size={12} />
            {message.fileReferences.length} file(s) referenced
          </div>
        )}

        {/* Message Content Bubble */}
        <div className={`
          inline-block max-w-full p-3 rounded-lg shadow-sm
          ${isUser 
            ? 'bg-blue-600 text-white' 
            : isAlert 
            ? 'bg-red-50 border border-red-200 text-red-800'
            : 'bg-white border border-gray-200 text-gray-900'
          }
          ${isUser ? 'rounded-br-sm' : 'rounded-bl-sm'}
        `}>
          {/* Content */}
          <div className={`
            prose prose-sm max-w-none
            ${isUser ? 'prose-invert' : ''}
            ${isAlert ? 'prose-red' : ''}
          `}>
            {renderContent()}
          </div>

          {/* Streaming Cursor */}
          {isStreaming && (
            <span className={`
              inline-block w-2 h-4 ml-1 animate-pulse
              ${isUser ? 'bg-blue-200' : 'bg-gray-400'}
            `} />
          )}
        </div>

        {/* Message Metadata */}
        {message.metadata && (
          <div className="mt-2 text-xs text-gray-500">
            {message.taskId && (
              <span className="bg-gray-100 px-2 py-1 rounded-full mr-2">
                Task: {message.taskId.slice(0, 8)}
              </span>
            )}
            {message.updatedAt && message.updatedAt !== message.createdAt && (
              <span>
                Updated: {new Date(message.updatedAt).toLocaleTimeString()}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
} 