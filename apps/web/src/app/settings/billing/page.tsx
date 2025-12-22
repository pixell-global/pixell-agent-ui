'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CreditCard, Zap, TrendingUp, AlertCircle, Search, Lightbulb, Send, Eye, Lock, Activity } from 'lucide-react'
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

interface QuotaStatus {
  tier: string
  billingPeriodStart: string
  billingPeriodEnd: string
  features: {
    research: { available: boolean; limit: number; used: number; remaining: number }
    ideation: { available: boolean; limit: number; used: number; remaining: number }
    autoPosting: { available: boolean; limit: number; used: number; remaining: number }
    monitors: { available: boolean; limit: number; active: number; remaining: number }
  }
}

export default function BillingSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null)
  const [quotaStatus, setQuotaStatus] = useState<QuotaStatus | null>(null)
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

      // Fetch subscription data
      const res = await fetch('/api/billing/subscription', {
        method: 'GET',
        credentials: 'include',
      })

      if (!res.ok) {
        const errorData = await res.json()

        if (res.status === 401) {
          setSessionExpired(true)
          setError('Your session has expired. Please refresh the page to sign in again.')
          return
        }

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

      // Fetch quota status
      const quotaRes = await fetch('/api/billing/quotas', {
        method: 'GET',
        credentials: 'include',
      })

      if (quotaRes.ok) {
        const quotaData = await quotaRes.json()
        if (quotaData.success && quotaData.quotas) {
          setQuotaStatus(quotaData.quotas)
        }
      }
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

        if (errorMessage.includes('Only organization owners and admins')) {
          setError('You need to be an organization owner or admin to manage billing. Please contact your organization owner to upgrade.')
          return
        }

        setError(errorMessage)
        return
      }

      const data = await res.json()

      if (data.upgraded) {
        console.log('Subscription upgraded successfully:', data.message)
        await loadBillingData()
        setCheckoutSuccess(true)
      } else if (data.url) {
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

        if (errorMessage.includes('Only organization owners and admins')) {
          setError('You need to be an organization owner or admin to manage billing. Please contact your organization owner.')
          return
        }

        setError(errorMessage)
        return
      }

      const data = await res.json()

      if (data.url) {
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
    const variants: Record<string, string> = {
      active: 'bg-pixell-yellow/20 text-pixell-yellow border border-pixell-yellow/30',
      trialing: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
      past_due: 'bg-red-500/20 text-red-400 border border-red-500/30',
      canceled: 'bg-white/10 text-white/60 border border-white/20',
    }

    return (
      <Badge className={variants[status] || 'bg-white/10 text-white/60 border border-white/20'}>
        {status === 'active' ? 'Active' : status === 'trialing' ? 'Trial' : status}
      </Badge>
    )
  }

  const getTierBadge = (tier: SubscriptionTier) => {
    const colors: Record<SubscriptionTier, string> = {
      free: 'bg-white/10 text-white border border-white/20',
      starter: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
      pro: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
      max: 'bg-pixell-yellow/20 text-pixell-yellow border border-pixell-yellow/30',
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
          <div className="text-center text-white/50">Loading billing information...</div>
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
            <h1 className="text-3xl font-bold font-poppins text-white">Payment Successful!</h1>
            <p className="text-white/60 mt-2">Your subscription has been activated</p>
          </div>

          <Card className="glass-card border-pixell-yellow/30 bg-pixell-yellow/5">
            <CardContent className="p-8">
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="icon-container-yellow">
                    <Zap className="h-12 w-12" />
                  </div>
                </div>

                <div>
                  <h2 className="text-2xl font-bold text-white">Thank You!</h2>
                  <p className="text-white/60 mt-2">
                    Your payment was successful. Your subscription is now active.
                  </p>
                </div>

                <Button
                  onClick={() => {
                    setCheckoutSuccess(false)
                    loadBillingData()
                  }}
                  className="mt-4 btn-lime"
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
            <h1 className="text-3xl font-bold font-poppins text-white">Session Expired</h1>
            <p className="text-white/60 mt-2">Please refresh to continue</p>
          </div>

          <Card className="glass-card border-pixell-orange/30 bg-pixell-orange/5">
            <CardContent className="p-8">
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="icon-container-orange">
                    <AlertCircle className="h-12 w-12" />
                  </div>
                </div>

                <div>
                  <h2 className="text-2xl font-bold text-white">Your session has expired</h2>
                  <p className="text-white/60 mt-2">
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
            <h1 className="text-3xl font-bold font-poppins text-white">Welcome to Billing</h1>
            <p className="text-white/60 mt-2">Let's get you started with a free plan</p>
          </div>

          <Card className="glass-card border-pixell-yellow/30 bg-pixell-yellow/5">
            <CardContent className="p-8">
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="icon-container-yellow">
                    <CreditCard className="h-12 w-12" />
                  </div>
                </div>

                <div>
                  <h2 className="text-2xl font-bold text-white">No Subscription Found</h2>
                  <p className="text-white/60 mt-2">
                    It looks like you don't have a subscription yet. Create a free plan to get started!
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
                    className="border-white/20 text-white hover:bg-white/10"
                  >
                    Refresh Page
                  </Button>
                </div>

                {error && error !== 'No subscription found' && (
                  <div className="text-sm text-red-400 mt-4">
                    {error}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-white">What's included in the Free Plan?</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-white/80">
                  <span className="text-pixell-yellow">✓</span>
                  <span>2 Research tasks per month</span>
                </li>
                <li className="flex items-center gap-2 text-white/80">
                  <span className="text-pixell-yellow">✓</span>
                  <span>10 Ideation sessions per month</span>
                </li>
                <li className="flex items-center gap-2 text-white/80">
                  <span className="text-pixell-yellow">✓</span>
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
          <Card className="glass-card border-red-500/30 bg-red-500/5">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 text-red-400">
                <AlertCircle className="h-5 w-5" />
                <span>{error}</span>
              </div>
              <div className="mt-4">
                <Button onClick={() => window.location.reload()} variant="outline" className="border-white/20 text-white hover:bg-white/10">
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
          <h1 className="text-3xl font-bold font-poppins text-white">Billing & Subscription</h1>
          <p className="text-white/60 mt-2">Manage your subscription and monitor feature usage</p>
        </div>

        {/* Current Subscription */}
        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="icon-container-yellow">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-white">Current Subscription</CardTitle>
                  <CardDescription className="text-white/50">Your active plan and billing cycle</CardDescription>
                </div>
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
                    <div className="text-sm text-white/50">Plan</div>
                    <div className="text-lg font-semibold text-white">{currentPlan.name}</div>
                  </div>
                  <div>
                    <div className="text-sm text-white/50">Price</div>
                    <div className="text-lg font-semibold text-white">
                      {currentPlan.price === 0 ? 'Free' : `$${currentPlan.price}/month`}
                    </div>
                  </div>
                </div>

                {subscription?.trialEnd && (
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-blue-400">
                      <Zap className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        Trial ends on {new Date(subscription.trialEnd).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                )}

                {subscription?.cancelAtPeriodEnd && (
                  <div className="bg-pixell-orange/10 border border-pixell-orange/20 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-pixell-orange">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        Subscription will cancel on {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                )}

                {subscription?.scheduledTier && (
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-blue-400">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-sm font-medium">
                          Scheduled to downgrade to {SUBSCRIPTION_PLANS[subscription.scheduledTier as SubscriptionTier]?.name || subscription.scheduledTier} on {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCancelDowngrade}
                        disabled={processingCheckout}
                        className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
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
                    className="border-white/20 text-white hover:bg-white/10"
                  >
                    {processingCheckout ? 'Loading...' : 'Manage Billing'}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Feature Quota Usage */}
        {quotaStatus && (
          <Card className="glass-card">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="icon-container-yellow">
                  <Activity className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-white">Feature Usage</CardTitle>
                  <CardDescription className="text-white/50">
                    Resets on {new Date(quotaStatus.billingPeriodEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Research */}
              <FeatureQuotaRow
                name="Research Tasks"
                icon={<Search className="h-4 w-4" />}
                available={quotaStatus.features.research.available}
                used={quotaStatus.features.research.used}
                limit={quotaStatus.features.research.limit}
              />

              {/* Ideation */}
              <FeatureQuotaRow
                name="Ideation Sessions"
                icon={<Lightbulb className="h-4 w-4" />}
                available={quotaStatus.features.ideation.available}
                used={quotaStatus.features.ideation.used}
                limit={quotaStatus.features.ideation.limit}
              />

              {/* Auto-posting */}
              <FeatureQuotaRow
                name="Auto-posting Actions"
                icon={<Send className="h-4 w-4" />}
                available={quotaStatus.features.autoPosting.available}
                used={quotaStatus.features.autoPosting.used}
                limit={quotaStatus.features.autoPosting.limit}
                lockedTier="Pro"
              />

              {/* Monitors */}
              <FeatureQuotaRow
                name="Active Monitors"
                icon={<Eye className="h-4 w-4" />}
                available={quotaStatus.features.monitors.available}
                used={quotaStatus.features.monitors.active}
                limit={quotaStatus.features.monitors.limit}
                lockedTier="Pro"
                isActiveCount
              />
            </CardContent>
          </Card>
        )}

        {/* Available Plans */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-white">Available Plans</CardTitle>
            <CardDescription className="text-white/50">Compare features and choose the right plan for you</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {(Object.keys(SUBSCRIPTION_PLANS) as SubscriptionTier[]).map((tier) => {
                const plan = SUBSCRIPTION_PLANS[tier]
                const isCurrent = subscription?.planTier === tier

                return (
                  <div
                    key={tier}
                    className={`rounded-xl p-4 transition-all ${
                      isCurrent
                        ? 'border-2 border-pixell-yellow bg-pixell-yellow/5'
                        : 'border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/20'
                    }`}
                  >
                    <div className="space-y-3">
                      <div>
                        <div className="font-semibold text-lg text-white">{plan.name}</div>
                        <div className="text-2xl font-bold mt-1 text-white">
                          {plan.price === 0 ? 'Free' : `$${plan.price}`}
                          {plan.price > 0 && <span className="text-sm text-white/50">/mo</span>}
                        </div>
                      </div>

                      <div className="text-xs space-y-1">
                        <div className="font-medium text-white/70">Monthly Quotas:</div>
                        <div className="text-white/50">{plan.quotas.research} Research</div>
                        <div className="text-white/50">{plan.quotas.ideation} Ideation</div>
                        <div className="text-white/50">{plan.quotas.autoPosting} Auto-posts</div>
                        <div className="text-white/50">{plan.quotas.monitors} Monitors</div>
                      </div>

                      {isCurrent ? (
                        <Badge className="w-full justify-center bg-pixell-yellow text-pixell-black font-medium">
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
                              className={tier === 'max' ? 'w-full btn-lime' : 'w-full border-white/20 text-white hover:bg-white/10'}
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
          <DialogContent className="bg-surface border-white/10">
            <DialogHeader>
              <DialogTitle className="text-white">Confirm Downgrade</DialogTitle>
              <DialogDescription className="text-white/60">
                Are you sure you want to downgrade to the {downgradeTier && SUBSCRIPTION_PLANS[downgradeTier].name} plan?
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="bg-pixell-orange/10 border border-pixell-orange/20 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-pixell-orange mt-0.5" />
                  <div className="text-sm text-pixell-orange">
                    <p className="font-medium mb-2">What happens when you downgrade:</p>
                    <ul className="list-disc list-inside space-y-1 ml-2 text-pixell-orange/80">
                      <li>Your plan will change at the end of your current billing period ({subscription?.currentPeriodEnd && new Date(subscription.currentPeriodEnd).toLocaleDateString()})</li>
                      <li>You'll keep your current features until then</li>
                      <li>Your monthly quotas will be reduced to the new plan's limits</li>
                      <li>No refund will be issued for the current period</li>
                    </ul>
                  </div>
                </div>
              </div>
              {downgradeTier && (
                <div className="border border-white/10 rounded-lg p-4">
                  <div className="font-medium text-sm mb-2 text-white">New plan quotas:</div>
                  <div className="grid grid-cols-2 gap-2 text-sm text-white/60">
                    <div>{SUBSCRIPTION_PLANS[downgradeTier].quotas.research} Research</div>
                    <div>{SUBSCRIPTION_PLANS[downgradeTier].quotas.ideation} Ideation</div>
                    <div>{SUBSCRIPTION_PLANS[downgradeTier].quotas.autoPosting} Auto-posts</div>
                    <div>{SUBSCRIPTION_PLANS[downgradeTier].quotas.monitors} Monitors</div>
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
                className="border-white/20 text-white hover:bg-white/10"
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

// Feature Quota Row Component
function FeatureQuotaRow({
  name,
  icon,
  available,
  used,
  limit,
  lockedTier,
  isActiveCount,
}: {
  name: string
  icon: React.ReactNode
  available: boolean
  used: number
  limit: number
  lockedTier?: string
  isActiveCount?: boolean
}) {
  const percentage = limit > 0 ? (used / limit) * 100 : 0
  const remaining = limit - used

  // Locked feature (not available on tier)
  if (!available) {
    return (
      <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
        <div className="flex items-center gap-3">
          <Lock className="h-4 w-4 text-white/30" />
          <span className="text-white/40">{name}</span>
        </div>
        <Badge variant="outline" className="text-xs border-pixell-orange/30 text-pixell-orange bg-pixell-orange/10">
          {lockedTier ? `Upgrade to ${lockedTier}` : 'Not available'}
        </Badge>
      </div>
    )
  }

  // Available feature with usage
  return (
    <div className="space-y-3 py-3 border-b border-white/5 last:border-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-white/80">
          {icon}
          <span>{name}</span>
        </div>
        <span className="text-white font-medium tabular-nums">
          {used} / {limit}
        </span>
      </div>
      <Progress
        value={percentage}
        className="h-2"
      />
      <div className="flex justify-between text-xs text-white/50">
        <span>{percentage.toFixed(0)}% used</span>
        <span>{remaining} {isActiveCount ? 'slots' : 'remaining'}</span>
      </div>
    </div>
  )
}
