'use client'

import React, { useEffect, useState, useRef } from 'react'
import { Download, Printer, ZoomIn, ZoomOut, Maximize2, Minimize2, RefreshCw, Loader2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface HtmlViewerProps {
  path: string
  title?: string
  className?: string
}

export const HtmlViewer: React.FC<HtmlViewerProps> = ({ path, title, className = '' }) => {
  const [htmlContent, setHtmlContent] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [zoom, setZoom] = useState(100)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Fetch HTML content
  useEffect(() => {
    const fetchContent = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/files/content?path=${encodeURIComponent(path)}`)
        if (!response.ok) {
          throw new Error(`Failed to load file: ${response.statusText}`)
        }

        const data = await response.json()
        if (data.success && data.content) {
          setHtmlContent(data.content)
        } else {
          throw new Error(data.error || 'Failed to load file content')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load file')
      } finally {
        setIsLoading(false)
      }
    }

    if (path) {
      fetchContent()
    }
  }, [path])

  // Handle zoom
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 200))
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 50))
  const handleResetZoom = () => setZoom(100)

  // Handle fullscreen
  const toggleFullscreen = async () => {
    if (!containerRef.current) return

    if (!document.fullscreenElement) {
      await containerRef.current.requestFullscreen()
      setIsFullscreen(true)
    } else {
      await document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // Handle download
  const handleDownload = () => {
    if (!htmlContent) return

    const blob = new Blob([htmlContent], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = title || path.split('/').pop() || 'report.html'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Handle print
  const handlePrint = () => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.print()
    }
  }

  // Handle refresh
  const handleRefresh = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/files/content?path=${encodeURIComponent(path)}`)
      if (!response.ok) throw new Error('Failed to refresh')
      const data = await response.json()
      if (data.success && data.content) {
        setHtmlContent(data.content)
      }
    } catch {
      // Keep existing content on refresh failure
    } finally {
      setIsLoading(false)
    }
  }

  // Loading state
  if (isLoading && !htmlContent) {
    return (
      <div className="flex items-center justify-center h-full bg-surface">
        <div className="flex flex-col items-center gap-3 text-white/60">
          <Loader2 className="w-8 h-8 animate-spin" />
          <span className="text-sm">Loading report...</span>
        </div>
      </div>
    )
  }

  // Error state
  if (error && !htmlContent) {
    return (
      <div className="flex items-center justify-center h-full bg-surface">
        <div className="flex flex-col items-center gap-3 text-red-400">
          <AlertTriangle className="w-8 h-8" />
          <span className="text-sm">{error}</span>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className={`flex flex-col h-full bg-surface ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-surface">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white/80 truncate max-w-[200px]">
            {title || path.split('/').pop()}
          </span>
          {isLoading && <Loader2 className="w-4 h-4 animate-spin text-white/40" />}
        </div>

        <div className="flex items-center gap-1">
          {/* Zoom controls */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleZoomOut}
            disabled={zoom <= 50}
            className="h-8 px-2 text-white/60 hover:text-white hover:bg-white/10"
            title="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-xs text-white/50 w-12 text-center">{zoom}%</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleZoomIn}
            disabled={zoom >= 200}
            className="h-8 px-2 text-white/60 hover:text-white hover:bg-white/10"
            title="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>

          <div className="w-px h-4 bg-white/10 mx-1" />

          {/* Actions */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
            className="h-8 px-2 text-white/60 hover:text-white hover:bg-white/10"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrint}
            className="h-8 px-2 text-white/60 hover:text-white hover:bg-white/10"
            title="Print"
          >
            <Printer className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            className="h-8 px-2 text-white/60 hover:text-white hover:bg-white/10"
            title="Download"
          >
            <Download className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleFullscreen}
            className="h-8 px-2 text-white/60 hover:text-white hover:bg-white/10"
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {/* HTML Content in Sandboxed iframe */}
      <div className="flex-1 overflow-hidden bg-white">
        {htmlContent && (
          <iframe
            ref={iframeRef}
            srcDoc={htmlContent}
            sandbox="allow-same-origin"
            className="w-full h-full border-0"
            style={{
              transform: `scale(${zoom / 100})`,
              transformOrigin: 'top left',
              width: `${10000 / zoom}%`,
              height: `${10000 / zoom}%`,
            }}
            title={title || 'HTML Report'}
          />
        )}
      </div>
    </div>
  )
}
