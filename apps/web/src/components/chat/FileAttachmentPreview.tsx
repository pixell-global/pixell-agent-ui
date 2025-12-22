'use client'

import React, { useState } from 'react'
import { X, File, Image, Download, Eye, AlertCircle, Loader2 } from 'lucide-react'
import { FileAttachment } from '@/types'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface FileAttachmentPreviewProps {
  attachments: FileAttachment[]
  onRemove: (id: string) => void
  className?: string
}

export function FileAttachmentPreview({ 
  attachments, 
  onRemove,
  className 
}: FileAttachmentPreviewProps) {
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null)

  if (attachments.length === 0) {
    return null
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const isImage = (type: string): boolean => {
    return type.startsWith('image/')
  }

  const getFileIcon = (attachment: FileAttachment) => {
    if (isImage(attachment.type)) {
      return <Image className="h-4 w-4 text-blue-400" />
    }
    return <File className="h-4 w-4 text-white/50" />
  }

  const getStatusColor = (status: FileAttachment['uploadStatus']) => {
    switch (status) {
      case 'pending':
        return 'text-white/50'
      case 'uploading':
        return 'text-blue-400'
      case 'completed':
        return 'text-green-400'
      case 'error':
        return 'text-red-400'
      default:
        return 'text-white/50'
    }
  }

  const getStatusIcon = (attachment: FileAttachment) => {
    switch (attachment.uploadStatus) {
      case 'pending':
        return <Eye className="h-4 w-4 text-white/50" />
      case 'uploading':
        return <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />
      case 'completed':
        return <Download className="h-4 w-4 text-green-400" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-400" />
      default:
        return <Eye className="h-4 w-4 text-white/50" />
    }
  }

  return (
    <>
      <div className={cn("space-y-2", className)}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-white/70">
            Attachments ({attachments.length})
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="relative border border-white/10 rounded-lg p-3 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/20 transition-all duration-200"
            >
              {/* Remove button */}
              <button
                onClick={() => onRemove(attachment.id)}
                className="absolute top-2 right-2 p-1 rounded-full hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors duration-200"
                aria-label={`Remove ${attachment.name}`}
              >
                <X className="h-3 w-3" />
              </button>

              <div className="flex items-start gap-3 pr-6">
                {/* File preview or icon */}
                <div className="flex-shrink-0">
                  {isImage(attachment.type) && attachment.preview ? (
                    <button
                      onClick={() => setEnlargedImage(attachment.preview!)}
                      className="block w-12 h-12 rounded border border-white/10 overflow-hidden hover:border-blue-500/30 transition-colors duration-200"
                    >
                      <img
                        src={attachment.preview}
                        alt={attachment.name}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ) : (
                    <div className="w-12 h-12 rounded border border-white/10 flex items-center justify-center bg-white/[0.04]">
                      {getFileIcon(attachment)}
                    </div>
                  )}
                </div>

                {/* File info */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-white/90 truncate">
                    {attachment.name}
                  </div>
                  <div className="text-xs text-white/50">
                    {formatFileSize(attachment.size)}
                  </div>

                  {/* Status */}
                  <div className={cn("flex items-center gap-1 mt-1 text-xs", getStatusColor(attachment.uploadStatus))}>
                    {getStatusIcon(attachment)}
                    <span className="capitalize">{attachment.uploadStatus}</span>
                    {attachment.error && (
                      <span className="text-red-400">- {attachment.error}</span>
                    )}
                  </div>

                  {/* Upload progress */}
                  {attachment.uploadStatus === 'uploading' && attachment.uploadProgress !== undefined && (
                    <div className="mt-2">
                      <Progress value={attachment.uploadProgress} className="h-1" />
                      <div className="text-xs text-white/50 mt-1">
                        {Math.round(attachment.uploadProgress)}% uploaded
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Image enlargement modal */}
      <Dialog open={!!enlargedImage} onOpenChange={() => setEnlargedImage(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-2">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle>Image Preview</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center p-4 overflow-auto">
            {enlargedImage && (
              <img
                src={enlargedImage}
                alt="Enlarged preview"
                className="max-w-full max-h-full object-contain rounded"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
} 