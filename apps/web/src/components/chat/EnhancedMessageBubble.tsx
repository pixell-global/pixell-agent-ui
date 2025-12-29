'use client'

import React from 'react'
import { User, Bot, AlertTriangle, FileText, Code2, Paperclip, Copy, Check } from 'lucide-react'
import { ChatMessage } from '@/types'
import { HybridStreamingRenderer } from '@pixell/renderer'
import { ThinkingIndicator } from './ThinkingIndicator'
import { FileAttachmentPreview } from './FileAttachmentPreview'
import { MemoryUsedSection } from './MemoryUsedSection'
import { FileOutputCard } from './FileOutputCard'
import { useChatStore } from '@/stores/chat-store'
import { useTabStore } from '@/stores/tab-store'

interface EnhancedMessageBubbleProps {
  message: ChatMessage
  isStreaming?: boolean
  className?: string
}

export function EnhancedMessageBubble({
  message,
  isStreaming = false,
  className = ''
}: EnhancedMessageBubbleProps) {
  const [copied, setCopied] = React.useState(false)
  const openViewerTab = useTabStore(state => state.openViewerTab)

  // Don't render empty messages at all, unless they have thinking steps or file outputs (for streaming progress)
  const hasThinkingSteps = message.thinkingSteps && message.thinkingSteps.length > 0
  const hasOutputs = message.outputs && message.outputs.length > 0
  if (!message.content.trim() && !hasThinkingSteps && !hasOutputs && !isStreaming) {
    return null;
  }

  // const settings = useChatStore(state => state.settings) // Unused for now

  // Handle opening file in viewer tab
  const handleOpenFile = (path: string) => {
    const fileName = path.split('/').pop() || 'file'
    if (openViewerTab) {
      openViewerTab({ path, title: fileName })
    }
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy message:', error)
    }
  }

  const getMessageIcon = () => {
    switch (message.role) {
      case 'user':
        return <User size={20} className="text-white" />
      case 'assistant':
        return <Bot size={20} className="text-white" />
      case 'system':
        return <AlertTriangle size={20} className="text-white" />
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

  const isUser = message.role === 'user'
  const isAlert = message.messageType === 'alert'

  return (
    <div className={`group w-full text-white/90 ${isUser ? 'bg-white/[0.02]' : 'bg-transparent'} ${className}`}>
      <div className="flex gap-4 mx-auto p-4">
        {/* Avatar */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
          isUser ? 'bg-pixell-yellow/20 border border-pixell-yellow/30' : isAlert ? 'bg-red-500/20 border border-red-500/30' : 'bg-blue-500/20 border border-blue-500/30'
        }`}>
          {getMessageIcon()}
        </div>

        {/* Message Content */}
        <div className="flex-1 space-y-2 relative">
          {/* Copy Button - Only show for assistant messages */}
          {!isUser && (
            <button
              onClick={copyToClipboard}
              className="absolute top-0 right-0 p-1.5 rounded-md text-white/40 hover:text-white/80 hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10"
              title="Copy message"
            >
              {copied ? (
                <Check size={16} className="text-green-400" />
              ) : (
                <Copy size={16} />
              )}
            </button>
          )}

          {/* Message Header - Only show for system messages or when there are attachments */}
          {(message.messageType && message.messageType !== 'text') ||
           (message.attachments && message.attachments.length > 0) ||
           (message.fileReferences && message.fileReferences.length > 0) ? (
            <div className="flex items-center gap-2 text-sm text-white/60">
              {getMessageTypeIcon()}
              {message.messageType === 'alert' && <span>System Alert</span>}
              {message.messageType === 'file_context' && <span>File Context</span>}
              {message.messageType === 'code' && <span>Code</span>}
              <span className="text-xs text-white/40">
                {new Date(message.createdAt).toLocaleTimeString()}
              </span>
            </div>
          ) : null}

          {/* Thinking Indicator */}
          {!isUser && message.thinkingSteps && message.thinkingSteps.length > 0 && (
            <ThinkingIndicator
              messageId={message.id}
              steps={message.thinkingSteps}
              isStreamingActive={isStreaming && message.isThinking}
              className="mb-4"
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

          {/* File Context Display */}
          {message.fileReferences && message.fileReferences.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {message.fileReferences.map((file, index) => (
                <span
                  key={file.id || index}
                  className="inline-flex items-center gap-1 text-xs bg-blue-500/20 border border-blue-500/30 px-2 py-1 rounded-md"
                >
                  <Paperclip size={10} className="text-blue-400" />
                  <span className="text-blue-400 font-medium font-mono">@{file.name}</span>
                </span>
              ))}
            </div>
          )}

          {/* Message Content */}
          <div className="max-w-none overflow-x-auto custom-scrollbar">
            {isUser ? (
              // Direct rendering for user messages with @ mention highlighting
              <div className="text-white/90 whitespace-pre-wrap break-words">
                {message.content.split(/(@[\w\-\.]+\.\w+)/g).map((part, i) =>
                  /^@[\w\-\.]+\.\w+$/.test(part) ? (
                    <span key={i} className="file-mention">{part}</span>
                  ) : (
                    <span key={i}>{part}</span>
                  )
                )}
              </div>
            ) : (
              // Use renderer for assistant messages (needs markdown, code blocks, etc.)
              <HybridStreamingRenderer
                content={message.content}
                isStreaming={isStreaming}
                messageId={message.id}
                className=""
              />
            )}
          </div>

          {/* File Outputs (agent-generated reports, exports, etc.) */}
          {!isUser && message.outputs && message.outputs.length > 0 && (
            <div className="mt-3 space-y-2">
              {message.outputs.map((output, index) => (
                <FileOutputCard
                  key={`${output.path}-${index}`}
                  output={output}
                  onOpen={handleOpenFile}
                />
              ))}
            </div>
          )}

          {/* Message Metadata */}
          {message.metadata && (
            <div className="mt-2 text-xs text-white/40 flex items-center gap-2">
              {message.taskId && (
                <span className="bg-white/10 border border-white/10 px-2 py-1 rounded-full">
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

          {/* Memory Used Section - Only for assistant messages */}
          {!isUser && message.memoriesUsed && message.memoriesUsed.length > 0 && (
            <MemoryUsedSection memoriesUsed={message.memoriesUsed} />
          )}
        </div>
      </div>
    </div>
  )
} 