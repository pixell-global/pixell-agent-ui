'use client'

import { useState, useCallback } from 'react'
import { getClientStorageManager, type FileUploadOptions, type FileUploadResult } from '@/lib/storage-client'
import { useCurrentUser } from '@/stores/user-store'
import { useNotificationStore } from '@/stores/notification-store'

export interface UploadProgress {
  filename: string
  progress: number
  status: 'pending' | 'uploading' | 'completed' | 'error'
  error?: string
}

export interface UseFileUploadResult {
  upload: (file: File, options?: FileUploadOptions) => Promise<FileUploadResult>
  uploadMultiple: (files: File[], options?: FileUploadOptions) => Promise<FileUploadResult[]>
  progress: Record<string, UploadProgress>
  isUploading: boolean
  clearProgress: () => void
}

// Helper function to determine if file content should be included inline
const shouldIncludeContent = (file: File): boolean => {
  const maxSize = 64 * 1024 // 64KB limit
  if (file.size > maxSize) return false
  
  // Include content for text-based files
  const textTypes = [
    'text/',
    'application/json',
    'application/javascript',
    'application/typescript',
    'application/xml'
  ]
  
  return textTypes.some(type => file.type.startsWith(type)) || 
         !!file.name.match(/\.(txt|md|json|js|ts|tsx|jsx|py|java|cpp|c|h|css|html|xml|yaml|yml|toml|ini|conf|log)$/i)
}

// Helper function to read file content as text
const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}

export const useFileUpload = (): UseFileUploadResult => {
  const [progress, setProgress] = useState<Record<string, UploadProgress>>({})
  const [isUploading, setIsUploading] = useState(false)
  const { user } = useCurrentUser()
  const { addEvent } = useNotificationStore()

  const updateProgress = useCallback((filename: string, updates: Partial<UploadProgress>) => {
    setProgress(prev => ({
      ...prev,
      [filename]: {
        ...prev[filename],
        ...updates,
      }
    }))
  }, [])

  const clearProgress = useCallback(() => {
    setProgress({})
  }, [])

  const upload = useCallback(async (
    file: File,
    options: FileUploadOptions = {}
  ): Promise<FileUploadResult> => {
    if (!user) {
      throw new Error('User must be authenticated to upload files')
    }

    const filename = file.name
    setIsUploading(true)
    
    // Initialize progress
    updateProgress(filename, {
      filename,
      progress: 0,
      status: 'pending',
    })

    try {
      // First, request a signed URL from our API
      const uploadResponse = await fetch('/api/files/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename,
          folder: options.folder || `users/${user.id}/uploads`,
          contentType: file.type,
        }),
      })

      if (!uploadResponse.ok) {
        const error = await uploadResponse.json()
        throw new Error(error.error || 'Failed to get upload URL')
      }

      const { signedUrl, path, token } = await uploadResponse.json()

      // Update progress
      updateProgress(filename, {
        progress: 10,
        status: 'uploading',
      })

      // Read file content for small text files
      let fileContent: string | undefined
      if (shouldIncludeContent(file)) {
        try {
          fileContent = await readFileAsText(file)
        } catch (error) {
          console.warn(`Failed to read content for ${filename}:`, error)
          // Continue without content - not a critical failure
        }
      }

      // Create storage manager and upload file
      const storageManager = getClientStorageManager()
      
      // Upload with progress tracking
      const result = await storageManager.uploadFileWithSignedUrl(file, signedUrl, options)
      
      // Update progress
      updateProgress(filename, {
        progress: 90,
        status: 'uploading',
      })

      if (result.success) {
        // Notify API of successful upload
        const completionResponse = await fetch('/api/files/upload', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            path,
            success: true,
          }),
        })

        if (completionResponse.ok) {
          const completionData = await completionResponse.json()
          result.publicUrl = completionData.publicUrl
        }

        // Update progress
        updateProgress(filename, {
          progress: 100,
          status: 'completed',
        })

        // Show success notification
        addEvent({
          type: 'data.ingest',
          title: 'File uploaded successfully',
          description: `${filename} has been uploaded`,
        })
        
        // Add file content to result if available
        if (fileContent) {
          result.content = fileContent
        }
      } else {
        throw new Error(result.error || 'Upload failed')
      }

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed'
      
      // Update progress with error
      updateProgress(filename, {
        progress: 0,
        status: 'error',
        error: errorMessage,
      })

      // Show error notification
      addEvent({
        type: 'job.error',
        title: 'File upload failed',
        description: `Failed to upload ${filename}: ${errorMessage}`,
      })

      return {
        success: false,
        error: errorMessage,
      }
    } finally {
      setIsUploading(false)
    }
  }, [user, updateProgress, addEvent])

  const uploadMultiple = useCallback(async (
    files: File[],
    options: FileUploadOptions = {}
  ): Promise<FileUploadResult[]> => {
    setIsUploading(true)
    
    try {
      const results: FileUploadResult[] = []
      
      // Upload files sequentially to avoid overwhelming the server
      for (const file of files) {
        const result = await upload(file, options)
        results.push(result)
      }

      return results
    } finally {
      setIsUploading(false)
    }
  }, [upload])

  return {
    upload,
    uploadMultiple,
    progress,
    isUploading,
    clearProgress,
  }
}

// Utility hook for drag and drop uploads
export const useDragAndDrop = (
  onFilesDropped: (files: File[]) => void,
  options: {
    allowedTypes?: string[]
    maxFiles?: number
    maxFileSize?: number // in MB
  } = {}
) => {
  const { allowedTypes = ['*'], maxFiles = 10, maxFileSize = 10 } = options
  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    
    // Filter files based on allowed types
    const validFiles = files.filter(file => {
      if (allowedTypes.includes('*')) return true
      return allowedTypes.some(type => {
        if (type.endsWith('/*')) {
          return file.type.startsWith(type.slice(0, -1))
        }
        return file.type === type
      })
    })

    // Check file count
    if (validFiles.length > maxFiles) {
      alert(`Maximum ${maxFiles} files allowed`)
      return
    }

    // Check file sizes
    const oversizedFiles = validFiles.filter(file => file.size > maxFileSize * 1024 * 1024)
    if (oversizedFiles.length > 0) {
      alert(`Files too large. Maximum size: ${maxFileSize}MB`)
      return
    }

    onFilesDropped(validFiles)
  }, [allowedTypes, maxFiles, maxFileSize, onFilesDropped])

  return {
    isDragging,
    dragHandlers: {
      onDragOver: handleDragOver,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop,
    },
  }
}