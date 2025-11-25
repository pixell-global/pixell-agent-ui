'use client'

/**
 * Connect TikTok Button
 *
 * Opens TikAPI OAuth popup and handles the callback.
 * Loads the TikAPI JavaScript SDK dynamically.
 */

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

// TikAPI global interface
declare global {
  interface Window {
    TikAPI?: {
      popup: (config: { client_id: string; scope?: string[] }) => void
      onLogin: (callback: (data: TikAPILoginData) => void) => void
    }
  }
}

/**
 * TikAPI login callback data
 */
export interface TikAPILoginData {
  access_token: string
  type: 'success' | 'error'
  message: string
  scope?: string[]
  userInfo: {
    id: string
    username: string
    nickname: string
    avatar: string
    followerCount?: number
    verified?: boolean
  }
}

export interface ConnectedAccount {
  username: string
  displayName: string
  avatarUrl: string
}

interface ConnectTikTokButtonProps {
  onSuccess?: (account: ConnectedAccount) => void
  onError?: (error: string) => void
  variant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'destructive' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  className?: string
  children?: React.ReactNode
  disabled?: boolean
}

export function ConnectTikTokButton({
  onSuccess,
  onError,
  variant = 'default',
  size = 'default',
  className,
  children,
  disabled,
}: ConnectTikTokButtonProps) {
  const [isConnecting, setIsConnecting] = useState(false)
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const [scriptError, setScriptError] = useState(false)

  // Load TikAPI script on mount
  useEffect(() => {
    // Check if already loaded
    if (window.TikAPI) {
      setScriptLoaded(true)
      return
    }

    // Check if script tag already exists
    const existingScript = document.querySelector('script[src*="tikapi.io"]')
    if (existingScript) {
      setScriptLoaded(true)
      return
    }

    const script = document.createElement('script')
    script.src = 'https://tikapi.io/assets/js/popup.js'
    script.async = true

    script.onload = () => {
      setScriptLoaded(true)
      setScriptError(false)
    }

    script.onerror = () => {
      setScriptError(true)
      setScriptLoaded(false)
      onError?.('Failed to load TikTok SDK')
    }

    document.body.appendChild(script)

    // Cleanup not needed - script should persist
  }, [onError])

  const handleConnect = useCallback(async () => {
    if (!scriptLoaded || !window.TikAPI) {
      onError?.('TikTok SDK not loaded. Please refresh and try again.')
      return
    }

    setIsConnecting(true)

    // Open the TikAPI popup
    window.TikAPI.popup({
      client_id: process.env.NEXT_PUBLIC_TIKAPI_CLIENT_ID || 'c_0T1IRI43Y2',
    })

    // Handle login callback
    window.TikAPI.onLogin(async (data: TikAPILoginData) => {
      if (data.type === 'error') {
        setIsConnecting(false)
        const errorMsg = data.message || 'Authorization cancelled'
        onError?.(errorMsg)
        return
      }

      try {
        // Send callback data to our API
        const res = await fetch('/api/oauth/tiktok/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })

        const result = await res.json()

        if (!res.ok) {
          throw new Error(result.error || 'Failed to connect account')
        }

        onSuccess?.({
          username: result.account.username,
          displayName: result.account.displayName,
          avatarUrl: result.account.avatarUrl,
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Connection failed'
        onError?.(message)
      } finally {
        setIsConnecting(false)
      }
    })
  }, [scriptLoaded, onSuccess, onError])

  const isDisabled = disabled || isConnecting || !scriptLoaded || scriptError

  return (
    <Button
      onClick={handleConnect}
      disabled={isDisabled}
      variant={variant}
      size={size}
      className={className}
    >
      {isConnecting ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Connecting...
        </>
      ) : scriptError ? (
        'SDK Error'
      ) : !scriptLoaded ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading...
        </>
      ) : (
        children || 'Connect TikTok'
      )}
    </Button>
  )
}
