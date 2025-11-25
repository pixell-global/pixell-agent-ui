'use client'

/**
 * Connected Accounts Settings Page
 *
 * Allows users to manage their connected external accounts
 * (TikTok, Instagram, etc.) for agent actions.
 */

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, Link2, Plus, Loader2 } from 'lucide-react'
import { ConnectTikTokButton } from '@/components/oauth/connect-tiktok-button'
import { ConnectedAccountCard } from '@/components/oauth/connected-account-card'
import type { ExternalAccountPublic, OAuthProvider } from '@/lib/oauth/providers/types'

// Provider configuration
const AVAILABLE_PROVIDERS: {
  provider: OAuthProvider
  name: string
  description: string
  available: boolean
  requiredPlan?: 'pro' | 'max'
}[] = [
  {
    provider: 'tiktok',
    name: 'TikTok',
    description: 'Connect your TikTok account to enable automated posting, commenting, and engagement.',
    available: true,
    requiredPlan: 'pro',
  },
  {
    provider: 'instagram',
    name: 'Instagram',
    description: 'Connect your Instagram account for automated content publishing.',
    available: false,
    requiredPlan: 'pro',
  },
  {
    provider: 'google',
    name: 'Google',
    description: 'Connect your Google account for YouTube and Google services integration.',
    available: false,
    requiredPlan: 'pro',
  },
  {
    provider: 'reddit',
    name: 'Reddit',
    description: 'Connect your Reddit account for automated posting and engagement.',
    available: false,
    requiredPlan: 'pro',
  },
]

interface AccountsByProvider {
  [key: string]: ExternalAccountPublic[]
}

export default function ConnectionsSettingsPage() {
  const [accounts, setAccounts] = useState<ExternalAccountPublic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Fetch connected accounts
  const fetchAccounts = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const res = await fetch('/api/oauth/accounts', {
        credentials: 'include',
      })

      if (!res.ok) {
        if (res.status === 401) {
          setError('Session expired. Please refresh the page.')
          return
        }
        const data = await res.json()
        throw new Error(data.error || 'Failed to load accounts')
      }

      const data = await res.json()
      setAccounts(data.accounts || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load accounts')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  // Group accounts by provider
  const accountsByProvider: AccountsByProvider = accounts.reduce((acc, account) => {
    if (!acc[account.provider]) {
      acc[account.provider] = []
    }
    acc[account.provider].push(account)
    return acc
  }, {} as AccountsByProvider)

  // Handle setting default account
  const handleSetDefault = async (accountId: string) => {
    setActionLoading(accountId)
    try {
      const res = await fetch('/api/oauth/accounts/default', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ accountId }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to set default')
      }

      await fetchAccounts()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to set default account')
    } finally {
      setActionLoading(null)
    }
  }

  // Handle auto-approve toggle
  const handleAutoApproveChange = async (accountId: string, enabled: boolean) => {
    setActionLoading(accountId)
    try {
      const res = await fetch('/api/oauth/accounts/auto-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ accountId, autoApprove: enabled }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update setting')
      }

      await fetchAccounts()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update auto-approve setting')
    } finally {
      setActionLoading(null)
    }
  }

  // Handle disconnect
  const handleDisconnect = async (accountId: string) => {
    setActionLoading(accountId)
    try {
      const res = await fetch(`/api/oauth/accounts?accountId=${accountId}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to disconnect')
      }

      await fetchAccounts()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to disconnect account')
    } finally {
      setActionLoading(null)
    }
  }

  // Handle reconnect (re-initiate OAuth)
  const handleReconnect = (provider: OAuthProvider) => {
    // For TikTok, we need to click the connect button
    // For now, just refresh to clear error state
    fetchAccounts()
  }

  // Handle successful connection
  const handleConnectSuccess = () => {
    fetchAccounts()
  }

  // Handle connection error
  const handleConnectError = (error: string) => {
    alert(`Connection failed: ${error}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold font-poppins">Connected Accounts</h1>
          <p className="text-gray-600 mt-2">
            Manage your connected social media accounts for agent actions
          </p>
        </div>

        {/* Error State */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-red-800">
                <AlertCircle className="h-5 w-5" />
                <span>{error}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={fetchAccounts}
              >
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Connected Accounts by Provider */}
        {AVAILABLE_PROVIDERS.map((providerConfig) => {
          const providerAccounts = accountsByProvider[providerConfig.provider] || []
          const hasAccounts = providerAccounts.length > 0

          return (
            <Card key={providerConfig.provider} className="shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center">
                      <Link2 className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <CardTitle className="font-poppins flex items-center gap-2">
                        {providerConfig.name}
                        {!providerConfig.available && (
                          <Badge variant="secondary" className="text-xs">
                            Coming Soon
                          </Badge>
                        )}
                        {providerConfig.requiredPlan && (
                          <Badge variant="outline" className="text-xs">
                            {providerConfig.requiredPlan.toUpperCase()}+
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription>{providerConfig.description}</CardDescription>
                    </div>
                  </div>

                  {/* Connect Button */}
                  {providerConfig.available && providerConfig.provider === 'tiktok' && (
                    <ConnectTikTokButton
                      onSuccess={handleConnectSuccess}
                      onError={handleConnectError}
                      variant="outline"
                      size="sm"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Account
                    </ConnectTikTokButton>
                  )}

                  {!providerConfig.available && (
                    <Button variant="ghost" size="sm" disabled>
                      Coming Soon
                    </Button>
                  )}
                </div>
              </CardHeader>

              {hasAccounts && (
                <CardContent className="space-y-4">
                  {providerAccounts.map((account) => (
                    <ConnectedAccountCard
                      key={account.id}
                      account={account}
                      onSetDefault={handleSetDefault}
                      onAutoApproveChange={handleAutoApproveChange}
                      onDisconnect={handleDisconnect}
                      onReconnect={handleReconnect}
                    />
                  ))}
                </CardContent>
              )}

              {!hasAccounts && providerConfig.available && (
                <CardContent>
                  <div className="text-center py-6 text-gray-500">
                    <p className="text-sm">No accounts connected</p>
                    <p className="text-xs mt-1">
                      Click "Add Account" to connect your {providerConfig.name} account
                    </p>
                  </div>
                </CardContent>
              )}
            </Card>
          )
        })}

        {/* Security Notice */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900">
                <p className="font-medium">About Connected Accounts</p>
                <ul className="mt-2 space-y-1 text-blue-800">
                  <li>
                    • Your account credentials are encrypted and stored securely
                  </li>
                  <li>
                    • The agent will ask for approval before performing actions (unless auto-approve is enabled)
                  </li>
                  <li>
                    • You can disconnect accounts at any time
                  </li>
                  <li>
                    • Connected accounts require a Pro or Max subscription plan
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
