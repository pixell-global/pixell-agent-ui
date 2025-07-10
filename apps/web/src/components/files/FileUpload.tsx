'use client'

import React, { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useFileUpload, useDragAndDrop } from '@/hooks/use-file-upload'
import { formatFileSize, isFileTypeAllowed, isFileSizeValid } from '@/lib/storage-client'
import { 
  Upload, 
  File, 
  X, 
  CheckCircle, 
  AlertCircle,
  Cloud,
  Trash2
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileUploadProps {
  onFileUploaded?: (path: string, publicUrl: string, content?: string) => void
  onUploadComplete?: (results: any[]) => void
  allowedTypes?: string[]
  maxFiles?: number
  maxFileSize?: number // in MB
  folder?: string
  className?: string
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFileUploaded,
  onUploadComplete,
  allowedTypes = ['image/*', 'application/pdf', 'text/*'],
  maxFiles = 5,
  maxFileSize = 10,
  folder,
  className,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const { upload, uploadMultiple, progress, isUploading, clearProgress } = useFileUpload()

  const handleFilesDropped = (files: File[]) => {
    setSelectedFiles(prev => [...prev, ...files].slice(0, maxFiles))
  }

  const { isDragging, dragHandlers } = useDragAndDrop(handleFilesDropped, {
    allowedTypes,
    maxFiles,
    maxFileSize,
  })

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    handleFilesDropped(files)
  }

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return

    try {
      const results = await uploadMultiple(selectedFiles, { folder })
      
      // Call callbacks for successful uploads
      results.forEach(result => {
        if (result.success && result.path && result.publicUrl) {
          onFileUploaded?.(result.path, result.publicUrl, result.content)
        }
      })

      onUploadComplete?.(results)
      
      // Clear selected files after successful upload
      const successfulUploads = results.filter(r => r.success)
      if (successfulUploads.length > 0) {
        setSelectedFiles([])
      }
    } catch (error) {
      console.error('Upload error:', error)
    }
  }

  const clearAll = () => {
    setSelectedFiles([])
    clearProgress()
  }

  const getFileStatus = (filename: string) => {
    return progress[filename]?.status || 'pending'
  }

  const getFileProgress = (filename: string) => {
    return progress[filename]?.progress || 0
  }

  const getFileError = (filename: string) => {
    return progress[filename]?.error
  }

  return (
    <div className={cn('space-y-4', className)}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            File Upload
          </CardTitle>
          <CardDescription>
            Upload files to Supabase Storage. Max {maxFiles} files, {maxFileSize}MB each.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Drop Zone */}
          <div
            {...dragHandlers}
            className={cn(
              'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
              isDragging
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                : 'border-gray-300 hover:border-gray-400'
            )}
          >
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-lg font-medium mb-2">
              {isDragging ? 'Drop files here' : 'Drag & drop files here'}
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Supported types: {allowedTypes.join(', ')}
            </p>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              Choose Files
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={allowedTypes.join(',')}
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Selected Files */}
          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Selected Files ({selectedFiles.length})</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAll}
                  disabled={isUploading}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {selectedFiles.map((file, index) => {
                  const status = getFileStatus(file.name)
                  const progress = getFileProgress(file.name)
                  const error = getFileError(file.name)
                  
                  return (
                    <div
                      key={`${file.name}-${index}`}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                    >
                      <File className="h-5 w-5 text-gray-500 flex-shrink-0" />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">
                            {file.name}
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            {formatFileSize(file.size)}
                          </Badge>
                          
                          {/* Status Icon */}
                          {status === 'completed' && (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          )}
                          {status === 'error' && (
                            <AlertCircle className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                        
                        {/* Progress Bar */}
                        {status === 'uploading' && (
                          <div className="mt-2">
                            <Progress value={progress} className="h-2" />
                            <p className="text-xs text-gray-500 mt-1">
                              {progress}% uploaded
                            </p>
                          </div>
                        )}
                        
                        {/* Error Message */}
                        {error && (
                          <p className="text-xs text-red-500 mt-1">{error}</p>
                        )}
                        
                        {/* Validation Errors */}
                        {!isFileTypeAllowed(file, allowedTypes) && (
                          <p className="text-xs text-red-500 mt-1">
                            File type not allowed
                          </p>
                        )}
                        {!isFileSizeValid(file, maxFileSize) && (
                          <p className="text-xs text-red-500 mt-1">
                            File too large (max {maxFileSize}MB)
                          </p>
                        )}
                      </div>
                      
                      {/* Remove Button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                        disabled={isUploading}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Upload Button */}
          {selectedFiles.length > 0 && (
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={clearAll}
                disabled={isUploading}
              >
                Clear All
              </Button>
              <Button
                onClick={handleUpload}
                disabled={isUploading || selectedFiles.length === 0}
              >
                {isUploading ? 'Uploading...' : `Upload ${selectedFiles.length} File${selectedFiles.length === 1 ? '' : 's'}`}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}