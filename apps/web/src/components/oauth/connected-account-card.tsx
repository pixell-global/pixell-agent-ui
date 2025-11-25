'use client'

/**
 * Connected Account Card
 *
 * Displays a connected external account with controls for
 * setting default, toggling auto-approve, and disconnecting.
 */

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Trash2, Star, AlertCircle, RefreshCw, Loader2 } from 'lucide-react'
import type { ExternalAccountPublic, OAuthProvider } from '@/lib/oauth/providers/types'

interface ConnectedAccountCardProps {
  account: ExternalAccountPublic
  onSetDefault?: (accountId: string) => Promise<void>
  onAutoApproveChange?: (accountId: string, enabled: boolean) => Promise<void>
  onDisconnect?: (accountId: string) => Promise<void>
  onReconnect?: (provider: OAuthProvider) => void
}

// Provider display info
const providerInfo: Record<OAuthProvider, { name: string; color: string }> = {
  tiktok: { name: 'TikTok', color: 'bg-black' },
  instagram: { name: 'Instagram', color: 'bg-gradient-to-r from-purple-500 to-pink-500' },
  google: { name: 'Google', color: 'bg-blue-500' },
  reddit: { name: 'Reddit', color: 'bg-orange-500' },
}

export function ConnectedAccountCard({
  account,
  onSetDefault,
  onAutoApproveChange,
  onDisconnect,
  onReconnect,
}: ConnectedAccountCardProps) {
  const [isUpdating, setIsUpdating] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)

  const provider = providerInfo[account.provider]
  const hasError = !!account.lastError

  const handleSetDefault = async () => {
    if (!onSetDefault || account.isDefault) return
    setIsUpdating(true)
    try {
      await onSetDefault(account.id)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleAutoApproveChange = async (enabled: boolean) => {
    if (!onAutoApproveChange) return
    setIsUpdating(true)
    try {
      await onAutoApproveChange(account.id, enabled)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDisconnect = async () => {
    if (!onDisconnect) return

    const confirmMessage = `Disconnect @${account.providerUsername || 'this account'}? You'll need to reconnect to use it again.`
    if (!window.confirm(confirmMessage)) return

    setIsDisconnecting(true)
    try {
      await onDisconnect(account.id)
    } finally {
      setIsDisconnecting(false)
    }
  }

  const handleReconnect = () => {
    onReconnect?.(account.provider)
  }

  return (
    <Card className={hasError ? 'border-destructive' : ''}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          {/* Account Info */}
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12">
              {account.avatarUrl && (
                <AvatarImage src={account.avatarUrl} alt={account.displayName || ''} />
              )}
              <AvatarFallback className={provider.color}>
                {(account.providerUsername || account.displayName || '?')[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {account.displayName || account.providerUsername || 'Unknown'}
                </span>
                {account.isDefault && (
                  <Badge variant="secondary" className="text-xs">
                    <Star className="mr-1 h-3 w-3" />
                    Default
                  </Badge>
                )}
              </div>
              {account.providerUsername && (
                <p className="text-sm text-muted-foreground">@{account.providerUsername}</p>
              )}
              <Badge variant="outline" className="mt-1 text-xs">
                {provider.name}
              </Badge>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {!account.isDefault && onSetDefault && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSetDefault}
                disabled={isUpdating}
                title="Set as default"
              >
                <Star className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDisconnect}
              disabled={isDisconnecting}
              title="Disconnect account"
            >
              {isDisconnecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 text-destructive" />
              )}
            </Button>
          </div>
        </div>

        {/* Error State */}
        {hasError && (
          <div className="mt-4 flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-destructive">Connection Issue</p>
              <p className="text-muted-foreground">{account.lastError}</p>
            </div>
            {onReconnect && (
              <Button variant="outline" size="sm" onClick={handleReconnect}>
                <RefreshCw className="mr-2 h-3 w-3" />
                Reconnect
              </Button>
            )}
          </div>
        )}

        {/* Auto-Approve Setting */}
        {onAutoApproveChange && (
          <div className="mt-4 flex items-center justify-between border-t pt-4">
            <div>
              <Label htmlFor={`auto-approve-${account.id}`} className="text-sm font-medium">
                Auto-approve actions
              </Label>
              <p className="text-xs text-muted-foreground">
                Allow agent to perform actions without asking for approval
              </p>
            </div>
            <Switch
              id={`auto-approve-${account.id}`}
              checked={account.autoApprove}
              onCheckedChange={handleAutoApproveChange}
              disabled={isUpdating}
            />
          </div>
        )}

        {/* Last Used */}
        {account.lastUsedAt && (
          <p className="mt-3 text-xs text-muted-foreground">
            Last used: {new Date(account.lastUsedAt).toLocaleDateString()}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
