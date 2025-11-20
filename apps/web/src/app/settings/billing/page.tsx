'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CreditCard, Zap, TrendingUp, AlertCircle, Settings } from 'lucide-react'
import { SUBSCRIPTION_PLANS, type SubscriptionTier } from '@/lib/billing/stripe-config'

interface SubscriptionData {
  id: string
  orgId: string
  planTier: SubscriptionTier
  status: string
  currentPeriodStart: string
  currentPeriodEnd: string
  trialEnd: string | null
  cancelAtPeriodEnd: boolean
  scheduledTier?: string | null
}

interface CreditBalance {
  orgId: string
  includedSmall: number
  includedMedium: number
  includedLarge: number
  includedXl: number
  usedSmall: number
  usedMedium: number
  usedLarge: number
  usedXl: number
  topupCredits: string
  topupCreditsUsed: string
  autoTopupEnabled: boolean
  autoTopupThreshold: number
  autoTopupAmount: number
}

export default function BillingSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null)
  const [balance, setBalance] = useState<CreditBalance | null>(null)
  const [usagePercentage, setUsagePercentage] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [noSubscription, setNoSubscription] = useState(false)
  const [processingCheckout, setProcessingCheckout] = useState(false)
  const [creatingFreePlan, setCreatingFreePlan] = useState(false)
  const [checkoutSuccess, setCheckoutSuccess] = useState(false)
  const [sessionExpired, setSessionExpired] = useState(false)
  const [showDowngradeConfirm, setShowDowngradeConfirm] = useState(false)
  const [downgradeTier, setDowngradeTier] = useState<SubscriptionTier | null>(null)

  useEffect(() => {
    // Check for success/canceled query params
    const params = new URLSearchParams(window.location.search)
    const success = params.get('success')
    const canceled = params.get('canceled')

    if (success === 'true') {
      setCheckoutSuccess(true)
      // Remove query param from URL
      window.history.replaceState({}, '', '/settings/billing')
    } else if (canceled === 'true') {
      setError('Checkout was canceled')
      // Remove query param from URL
      window.history.replaceState({}, '', '/settings/billing')
    }

    loadBillingData()
  }, [])

  const loadBillingData = async () => {
    try {
      setLoading(true)
      setError(null)
      setNoSubscription(false)

      const res = await fetch('/api/billing/subscription', {
        method: 'GET',
        credentials: 'include', // Include session cookie
      })

      if (!res.ok) {
        const errorData = await res.json()

        // Check if session has expired (401)
        if (res.status === 401) {
          setSessionExpired(true)
          setError('Your session has expired. Please refresh the page to sign in again.')
          return
        }

        // Check if this is a "no subscription found" error (404)
        if (res.status === 404 && errorData.message?.includes('No subscription found')) {
          setNoSubscription(true)
          setError('No subscription found')
          return
        }

        throw new Error(errorData.message || 'Failed to load billing data')
      }

      const data = await res.json()

      if (!data.success) {
        throw new Error(data.message || 'Failed to load billing data')
      }

      setSubscription(data.subscription)
      setBalance(data.creditBalance)
      setUsagePercentage(data.usagePercentage || 0)
    } catch (err: any) {
      console.error('Failed to load billing data:', err)
      setError(err?.message || 'Failed to load billing data')
    } finally {
      setLoading(false)
    }
  }

  const getTierOrder = (): SubscriptionTier[] => {
    return ['free', 'starter', 'pro', 'max']
  }

  const isUpgrade = (currentTier: SubscriptionTier, targetTier: SubscriptionTier): boolean => {
    const tierOrder = getTierOrder()
    const currentIndex = tierOrder.indexOf(currentTier)
    const targetIndex = tierOrder.indexOf(targetTier)
    return targetIndex > currentIndex
  }

  const handleUpgradePlan = async (targetTier: SubscriptionTier) => {
    try {
      setProcessingCheckout(true)

      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ tier: targetTier }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        const errorMessage = errorData.error || errorData.message || 'Failed to create checkout session'

        // Handle permission errors gracefully
        if (errorMessage.includes('Only organization owners and admins')) {
          setError('You need to be an organization owner or admin to manage billing. Please contact your organization owner to upgrade.')
          return
        }

        setError(errorMessage)
        return
      }

      const data = await res.json()

      if (data.upgraded) {
        // Subscription was upgraded without checkout - reload billing data
        console.log('Subscription upgraded successfully:', data.message)
        await loadBillingData()
        setCheckoutSuccess(true)
      } else if (data.url) {
        // Redirect to Stripe checkout for new subscription
        window.location.href = data.url
      } else {
        setError('No checkout URL received')
      }
    } catch (err: any) {
      console.error('Failed to create checkout:', err)
      setError(err?.message || 'Failed to start checkout process')
    } finally {
      setProcessingCheckout(false)
    }
  }

  const handleDowngradeClick = (targetTier: SubscriptionTier) => {
    setDowngradeTier(targetTier)
    setShowDowngradeConfirm(true)
  }

  const handleDowngradeConfirm = async () => {
    if (!downgradeTier) return

    try {
      setProcessingCheckout(true)
      setShowDowngradeConfirm(false)

      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ tier: downgradeTier, isDowngrade: true }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        const errorMessage = errorData.error || errorData.message || 'Failed to schedule downgrade'

        if (errorMessage.includes('Only organization owners and admins')) {
          setError('You need to be an organization owner or admin to manage billing.')
          return
        }

        setError(errorMessage)
        return
      }

      const data = await res.json()

      if (data.success) {
        await loadBillingData()
        alert(`Downgrade to ${SUBSCRIPTION_PLANS[downgradeTier].name} scheduled successfully! Your plan will change at the end of your current billing period.`)
      }
    } catch (err: any) {
      console.error('Failed to schedule downgrade:', err)
      setError(err?.message || 'Failed to schedule downgrade')
    } finally {
      setProcessingCheckout(false)
      setDowngradeTier(null)
    }
  }

  const handleCancelDowngrade = async () => {
    if (!subscription?.planTier) return

    try {
      setProcessingCheckout(true)

      // Upgrade to current tier to cancel the scheduled downgrade
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ tier: subscription.planTier, cancelDowngrade: true }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        setError(errorData.error || 'Failed to cancel downgrade')
        return
      }

      await loadBillingData()
      alert('Scheduled downgrade has been canceled successfully!')
    } catch (err: any) {
      console.error('Failed to cancel downgrade:', err)
      setError(err?.message || 'Failed to cancel downgrade')
    } finally {
      setProcessingCheckout(false)
    }
  }

  const handleManageBilling = async () => {
    try {
      setProcessingCheckout(true)

      const res = await fetch('/api/billing/portal', {
        method: 'POST',
        credentials: 'include',
      })

      if (!res.ok) {
        const errorData = await res.json()
        const errorMessage = errorData.error || errorData.message || 'Failed to open billing portal'

        // Handle permission errors gracefully
        if (errorMessage.includes('Only organization owners and admins')) {
          setError('You need to be an organization owner or admin to manage billing. Please contact your organization owner.')
          return
        }

        setError(errorMessage)
        return
      }

      const data = await res.json()

      if (data.url) {
        // Redirect to Stripe billing portal
        window.location.href = data.url
      } else {
        setError('No portal URL received')
      }
    } catch (err: any) {
      console.error('Failed to open billing portal:', err)
      setError(err?.message || 'Failed to open billing portal')
    } finally {
      setProcessingCheckout(false)
    }
  }

  const handleAutoTopupToggle = async (enabled: boolean) => {
    if (!balance) return

    try {
      const res = await fetch('/api/billing/auto-topup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          autoTopupEnabled: enabled,
          autoTopupThreshold: balance.autoTopupThreshold,
          autoTopupAmount: balance.autoTopupAmount,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to update auto top-up settings')
      }

      const data = await res.json()
      if (data.success) {
        setBalance({...balance, autoTopupEnabled: enabled })
        alert(enabled ? 'Auto top-up enabled successfully' : 'Auto top-up disabled successfully')
      }
    } catch (err: any) {
      console.error('Failed to update auto top-up:', err)
      alert(err?.message || 'Failed to update auto top-up settings')
    }
  }

  const handleThresholdChange = async (threshold: number) => {
    if (!balance) return

    try {
      const res = await fetch('/api/billing/auto-topup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          autoTopupEnabled: balance.autoTopupEnabled,
          autoTopupThreshold: threshold,
          autoTopupAmount: balance.autoTopupAmount,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to update auto top-up settings')
      }

      const data = await res.json()
      if (data.success) {
        setBalance({...balance, autoTopupThreshold: threshold })
      }
    } catch (err: any) {
      console.error('Failed to update auto top-up:', err)
      alert(err?.message || 'Failed to update auto top-up settings')
    }
  }

  const handleAmountChange = async (amount: number) => {
    if (!balance) return

    try {
      const res = await fetch('/api/billing/auto-topup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          autoTopupEnabled: balance.autoTopupEnabled,
          autoTopupThreshold: balance.autoTopupThreshold,
          autoTopupAmount: amount,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to update auto top-up settings')
      }

      const data = await res.json()
      if (data.success) {
        setBalance({...balance, autoTopupAmount: amount })
      }
    } catch (err: any) {
      console.error('Failed to update auto top-up:', err)
      alert(err?.message || 'Failed to update auto top-up settings')
    }
  }

  const handleCreateFreePlan = async () => {
    try {
      setCreatingFreePlan(true)
      setError(null)

      const res = await fetch('/api/billing/subscription/create-free', {
        method: 'POST',
        credentials: 'include',
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to create free plan')
      }

      const data = await res.json()

      if (data.success) {
        // Reload billing data to show the new subscription
        await loadBillingData()
        alert('Free plan created successfully!')
      } else {
        throw new Error(data.message || 'Failed to create free plan')
      }
    } catch (err: any) {
      console.error('Failed to create free plan:', err)
      setError(err?.message || 'Failed to create free plan')
    } finally {
      setCreatingFreePlan(false)
    }
  }

  const getNextTier = (currentTier: SubscriptionTier): SubscriptionTier => {
    const tierOrder: SubscriptionTier[] = ['free', 'starter', 'pro', 'max']
    const currentIndex = tierOrder.indexOf(currentTier)
    return currentIndex < tierOrder.length - 1 ? tierOrder[currentIndex + 1] : currentTier
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      active: 'default',
      trialing: 'secondary',
      past_due: 'destructive',
      canceled: 'outline',
    }

    return (
      <Badge variant={variants[status] || 'outline'}>
        {status === 'active' ? 'Active' : status === 'trialing' ? 'Trial' : status}
      </Badge>
    )
  }

  const getTierBadge = (tier: SubscriptionTier) => {
    const colors: Record<SubscriptionTier, string> = {
      free: 'bg-gray-100 text-gray-800',
      starter: 'bg-blue-100 text-blue-800',
      pro: 'bg-purple-100 text-purple-800',
      max: 'bg-yellow-100 text-yellow-800',
    }

    return (
      <Badge className={colors[tier]}>
        {SUBSCRIPTION_PLANS[tier].name}
      </Badge>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center text-gray-500">Loading billing information...</div>
        </div>
      </div>
    )
  }

  // Show success message after checkout
  if (checkoutSuccess && !loading) {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold font-poppins">Payment Successful!</h1>
            <p className="text-gray-600 mt-2">Your subscription has been activated</p>
          </div>

          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-8">
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="rounded-full bg-green-100 p-4">
                    <Zap className="h-12 w-12 text-green-600" />
                  </div>
                </div>

                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Thank You!</h2>
                  <p className="text-gray-600 mt-2">
                    Your payment was successful. Your subscription is now active and credits have been added to your account.
                  </p>
                </div>

                <Button
                  onClick={() => {
                    setCheckoutSuccess(false)
                    loadBillingData()
                  }}
                  className="mt-4"
                >
                  View Billing Details
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Handle session expired gracefully
  if (sessionExpired) {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold font-poppins">Session Expired</h1>
            <p className="text-gray-600 mt-2">Please refresh to continue</p>
          </div>

          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="p-8">
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="rounded-full bg-yellow-100 p-4">
                    <AlertCircle className="h-12 w-12 text-yellow-600" />
                  </div>
                </div>

                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Your session has expired</h2>
                  <p className="text-gray-600 mt-2">
                    For security, your session has timed out. Please refresh the page to sign in again.
                  </p>
                </div>

                <Button
                  onClick={() => window.location.reload()}
                  className="mt-4"
                >
                  Refresh Page
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (error && noSubscription) {
    // Graceful handling for users without subscriptions
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold font-poppins">Welcome to Billing</h1>
            <p className="text-gray-600 mt-2">Let's get you started with a free plan</p>
          </div>

          <Card className="border-lime-200 bg-lime-50">
            <CardContent className="p-8">
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="rounded-full bg-lime-100 p-4">
                    <CreditCard className="h-12 w-12 text-lime-600" />
                  </div>
                </div>

                <div>
                  <h2 className="text-2xl font-bold text-gray-900">No Subscription Found</h2>
                  <p className="text-gray-600 mt-2">
                    It looks like you don't have a subscription yet. Create a free plan to get started
                    with 10 small, 4 medium, 2 large, and 1 XL credit per month!
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 justify-center items-center pt-4">
                  <Button
                    className="btn-lime"
                    size="lg"
                    onClick={handleCreateFreePlan}
                    disabled={creatingFreePlan}
                  >
                    {creatingFreePlan ? 'Creating...' : 'Create Free Plan'}
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => window.location.reload()}
                  >
                    Refresh Page
                  </Button>
                </div>

                {error && error !== 'No subscription found' && (
                  <div className="text-sm text-red-600 mt-4">
                    {error}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>What's included in the Free Plan?</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                <li className="flex items-center gap-2">
                  <span className="text-lime-600">✓</span>
                  <span>10 small actions per month</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-lime-600">✓</span>
                  <span>4 medium actions per month</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-lime-600">✓</span>
                  <span>2 large actions per month</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-lime-600">✓</span>
                  <span>1 XL action per month</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-lime-600">✓</span>
                  <span>Community support</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-4xl mx-auto">
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 text-red-800">
                <AlertCircle className="h-5 w-5" />
                <span>{error}</span>
              </div>
              <div className="mt-4">
                <Button onClick={() => window.location.reload()} variant="outline">
                  Reload Page
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const currentPlan = subscription ? SUBSCRIPTION_PLANS[subscription.planTier] : null

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold font-poppins">Billing & Subscription</h1>
          <p className="text-gray-600 mt-2">Manage your subscription and monitor credit usage</p>
        </div>

        {/* Current Subscription */}
        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="font-poppins flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Current Subscription
                </CardTitle>
                <CardDescription>Your active plan and billing cycle</CardDescription>
              </div>
              {subscription && (
                <div className="flex items-center gap-2">
                  {getTierBadge(subscription.planTier)}
                  {getStatusBadge(subscription.status)}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentPlan && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-600">Plan</div>
                    <div className="text-lg font-semibold">{currentPlan.name}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Price</div>
                    <div className="text-lg font-semibold">
                      {currentPlan.price === 0 ? 'Free' : `$${currentPlan.price}/month`}
                    </div>
                  </div>
                </div>

                {subscription?.trialEnd && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-blue-800">
                      <Zap className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        Trial ends on {new Date(subscription.trialEnd).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                )}

                {subscription?.cancelAtPeriodEnd && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-yellow-800">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        Subscription will cancel on {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                )}

                {subscription?.scheduledTier && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-blue-800">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-sm font-medium">
                          Scheduled to downgrade to {SUBSCRIPTION_PLANS[subscription.scheduledTier as SubscriptionTier]?.name || subscription.scheduledTier} plan on {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCancelDowngrade}
                        disabled={processingCheckout}
                        className="text-blue-800 hover:text-blue-900 hover:bg-blue-100"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  {subscription && subscription.planTier !== 'max' && (
                    <Button
                      className="btn-lime"
                      onClick={() => handleUpgradePlan(getNextTier(subscription.planTier))}
                      disabled={processingCheckout}
                    >
                      <TrendingUp className="h-4 w-4 mr-2" />
                      {processingCheckout ? 'Processing...' : 'Upgrade Plan'}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={handleManageBilling}
                    disabled={processingCheckout}
                  >
                    {processingCheckout ? 'Loading...' : 'Manage Billing'}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Credit Balance */}
        {balance && (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="font-poppins flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Credit Balance
              </CardTitle>
              <CardDescription>Your usage this billing period</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Overall usage */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Overall Usage</span>
                  <span className="font-medium">{usagePercentage.toFixed(0)}%</span>
                </div>
                <Progress value={usagePercentage} className="h-2" />
              </div>

              {/* Credit breakdown */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <div className="text-xs text-gray-600 uppercase">Small</div>
                  <div className="text-2xl font-bold">
                    {balance.includedSmall - balance.usedSmall}
                  </div>
                  <div className="text-xs text-gray-500">
                    of {balance.includedSmall} remaining
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-xs text-gray-600 uppercase">Medium</div>
                  <div className="text-2xl font-bold">
                    {balance.includedMedium - balance.usedMedium}
                  </div>
                  <div className="text-xs text-gray-500">
                    of {balance.includedMedium} remaining
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-xs text-gray-600 uppercase">Large</div>
                  <div className="text-2xl font-bold">
                    {balance.includedLarge - balance.usedLarge}
                  </div>
                  <div className="text-xs text-gray-500">
                    of {balance.includedLarge} remaining
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-xs text-gray-600 uppercase">XL</div>
                  <div className="text-2xl font-bold">
                    {balance.includedXl - balance.usedXl}
                  </div>
                  <div className="text-xs text-gray-500">
                    of {balance.includedXl} remaining
                  </div>
                </div>
              </div>

              {/* Top-up credits */}
              {parseFloat(balance.topupCredits) > 0 && (
                <div className="bg-lime-50 border border-lime-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-lime-900">Top-up Credits</div>
                      <div className="text-xs text-lime-700">
                        {(parseFloat(balance.topupCredits) - parseFloat(balance.topupCreditsUsed)).toFixed(2)} remaining
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-lime-900">
                      {(parseFloat(balance.topupCredits) - parseFloat(balance.topupCreditsUsed)).toFixed(0)}
                    </div>
                  </div>
                </div>
              )}

              <Button
                variant="outline"
                className="w-full"
                onClick={handleManageBilling}
                disabled={processingCheckout}
              >
                {processingCheckout ? 'Loading...' : 'Purchase Additional Credits'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Auto Top-up Settings */}
        {balance && subscription && subscription.planTier !== 'free' && (
          <Card className="shadow-lg">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-lime-600" />
                <CardTitle className="font-poppins">Auto Top-up</CardTitle>
              </div>
              <CardDescription>
                Automatically purchase credits when your balance runs low
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Enable/Disable Toggle */}
              <div className="flex items-center justify-between space-x-4">
                <div className="flex-1">
                  <Label htmlFor="auto-topup-enabled" className="text-base font-medium">
                    Enable Auto Top-up
                  </Label>
                  <p className="text-sm text-gray-600 mt-1">
                    Automatically purchase credits when balance is low
                  </p>
                </div>
                <Switch
                  id="auto-topup-enabled"
                  checked={balance.autoTopupEnabled}
                  onCheckedChange={handleAutoTopupToggle}
                />
              </div>

              {/* Threshold and Amount Settings - Only show when enabled */}
              {balance.autoTopupEnabled && (
                <div className="space-y-4 pt-4 border-t">
                  {/* Trigger Threshold */}
                  <div className="space-y-2">
                    <Label htmlFor="auto-topup-threshold">
                      Trigger Threshold
                    </Label>
                    <Select
                      value={balance.autoTopupThreshold.toString()}
                      onValueChange={(value) => handleThresholdChange(Number(value))}
                    >
                      <SelectTrigger id="auto-topup-threshold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10 credits</SelectItem>
                        <SelectItem value="25">25 credits</SelectItem>
                        <SelectItem value="50">50 credits</SelectItem>
                        <SelectItem value="100">100 credits</SelectItem>
                        <SelectItem value="200">200 credits</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-600">
                      Purchase credits when your total balance falls below this amount
                    </p>
                  </div>

                  {/* Amount to Add */}
                  <div className="space-y-2">
                    <Label htmlFor="auto-topup-amount">
                      Amount to Add
                    </Label>
                    <Select
                      value={balance.autoTopupAmount.toString()}
                      onValueChange={(value) => handleAmountChange(Number(value))}
                    >
                      <SelectTrigger id="auto-topup-amount">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="100">100 credits ($4.00)</SelectItem>
                        <SelectItem value="250">250 credits ($10.00)</SelectItem>
                        <SelectItem value="500">500 credits ($20.00)</SelectItem>
                        <SelectItem value="1000">1000 credits ($40.00)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-600">
                      Number of credits to purchase when auto top-up triggers
                    </p>
                  </div>

                  {/* Summary Banner */}
                  <div className="bg-lime-50 border border-lime-200 rounded-lg p-4">
                    <div className="text-sm text-lime-900">
                      <span className="font-medium">Summary:</span> When your balance falls below{' '}
                      <span className="font-semibold">{balance.autoTopupThreshold} credits</span>, we'll
                      automatically add <span className="font-semibold">{balance.autoTopupAmount} credits</span>{' '}
                      (${(balance.autoTopupAmount * 0.04).toFixed(2)}) to your account.
                    </div>
                  </div>
                </div>
              )}

              {balance.autoTopupEnabled && (
                <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-blue-900">
                    Auto top-up requires a valid payment method on file. Credits will be charged to your
                    default payment method when the threshold is reached.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Available Plans */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-poppins">Available Plans</CardTitle>
            <CardDescription>Compare features and choose the right plan for you</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {(Object.keys(SUBSCRIPTION_PLANS) as SubscriptionTier[]).map((tier) => {
                const plan = SUBSCRIPTION_PLANS[tier]
                const isCurrent = subscription?.planTier === tier

                return (
                  <div
                    key={tier}
                    className={`border rounded-lg p-4 ${
                      isCurrent ? 'border-lime-500 bg-lime-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="space-y-3">
                      <div>
                        <div className="font-semibold text-lg">{plan.name}</div>
                        <div className="text-2xl font-bold mt-1">
                          {plan.price === 0 ? 'Free' : `$${plan.price}`}
                          {plan.price > 0 && <span className="text-sm text-gray-600">/mo</span>}
                        </div>
                      </div>

                      <div className="text-xs space-y-1">
                        <div className="font-medium text-gray-700">Monthly Credits:</div>
                        <div className="text-gray-600">{plan.credits.small} Small</div>
                        <div className="text-gray-600">{plan.credits.medium} Medium</div>
                        <div className="text-gray-600">{plan.credits.large} Large</div>
                        <div className="text-gray-600">{plan.credits.xl} XL</div>
                      </div>

                      {isCurrent ? (
                        <Badge className="w-full justify-center bg-lime-600 text-white">
                          Current Plan
                        </Badge>
                      ) : (
                        (() => {
                          const isUpgradeBtn = subscription ? isUpgrade(subscription.planTier, tier) : true
                          const buttonLabel = processingCheckout
                            ? 'Processing...'
                            : isUpgradeBtn
                            ? 'Upgrade'
                            : 'Downgrade'

                          return (
                            <Button
                              variant={tier === 'max' ? 'default' : 'outline'}
                              className={tier === 'max' ? 'w-full btn-lime' : 'w-full'}
                              size="sm"
                              onClick={() => {
                                if (isUpgradeBtn) {
                                  handleUpgradePlan(tier)
                                } else {
                                  handleDowngradeClick(tier)
                                }
                              }}
                              disabled={processingCheckout || tier === 'free'}
                            >
                              {buttonLabel}
                            </Button>
                          )
                        })()
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Downgrade Confirmation Dialog */}
        <Dialog open={showDowngradeConfirm} onOpenChange={setShowDowngradeConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Downgrade</DialogTitle>
              <DialogDescription>
                Are you sure you want to downgrade to the {downgradeTier && SUBSCRIPTION_PLANS[downgradeTier].name} plan?
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div className="text-sm text-yellow-800">
                    <p className="font-medium mb-2">What happens when you downgrade:</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>Your plan will change at the end of your current billing period ({subscription?.currentPeriodEnd && new Date(subscription.currentPeriodEnd).toLocaleDateString()})</li>
                      <li>You'll keep your current features until then</li>
                      <li>Your monthly credits will be reduced to the new plan's limits</li>
                      <li>No refund will be issued for the current period</li>
                    </ul>
                  </div>
                </div>
              </div>
              {downgradeTier && (
                <div className="border rounded-lg p-4">
                  <div className="font-medium text-sm mb-2">New plan credits:</div>
                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                    <div>{SUBSCRIPTION_PLANS[downgradeTier].credits.small} Small</div>
                    <div>{SUBSCRIPTION_PLANS[downgradeTier].credits.medium} Medium</div>
                    <div>{SUBSCRIPTION_PLANS[downgradeTier].credits.large} Large</div>
                    <div>{SUBSCRIPTION_PLANS[downgradeTier].credits.xl} XL</div>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowDowngradeConfirm(false)
                  setDowngradeTier(null)
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDowngradeConfirm}
                disabled={processingCheckout}
              >
                {processingCheckout ? 'Processing...' : 'Confirm Downgrade'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
