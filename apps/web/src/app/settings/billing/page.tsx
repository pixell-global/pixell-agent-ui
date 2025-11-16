'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { CreditCard, Zap, TrendingUp, AlertCircle } from 'lucide-react'
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
}

export default function BillingSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null)
  const [balance, setBalance] = useState<CreditBalance | null>(null)
  const [usagePercentage, setUsagePercentage] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadBillingData()
  }, [])

  const loadBillingData = async () => {
    try {
      setLoading(true)
      // TODO: Replace with actual API call once user authentication is implemented
      // const res = await fetch('/api/billing/subscription')
      // if (!res.ok) throw new Error('Failed to load billing data')
      // const data = await res.json()
      // setSubscription(data.subscription)
      // setBalance(data.creditBalance)
      // setUsagePercentage(data.usagePercentage || 0)

      // Mock data for now
      setSubscription({
        id: '1',
        orgId: 'org-1',
        planTier: 'free',
        status: 'active',
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        trialEnd: null,
        cancelAtPeriodEnd: false,
      })

      setBalance({
        orgId: 'org-1',
        includedSmall: 10,
        includedMedium: 4,
        includedLarge: 2,
        includedXl: 1,
        usedSmall: 3,
        usedMedium: 1,
        usedLarge: 0,
        usedXl: 0,
        topupCredits: '0',
        topupCreditsUsed: '0',
      })

      setUsagePercentage(25)
    } catch (err: any) {
      setError(err?.message || 'Failed to load billing data')
    } finally {
      setLoading(false)
    }
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

                {subscription.trialEnd && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-blue-800">
                      <Zap className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        Trial ends on {new Date(subscription.trialEnd).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                )}

                {subscription.cancelAtPeriodEnd && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-yellow-800">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        Subscription will cancel on {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  {subscription.planTier !== 'max' && (
                    <Button className="btn-lime">
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Upgrade Plan
                    </Button>
                  )}
                  <Button variant="outline">
                    Manage Billing
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

              <Button variant="outline" className="w-full">
                Purchase Additional Credits
              </Button>
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
                        <Button
                          variant={tier === 'max' ? 'default' : 'outline'}
                          className={tier === 'max' ? 'w-full btn-lime' : 'w-full'}
                          size="sm"
                        >
                          {subscription && tier > subscription.planTier ? 'Upgrade' : 'Select'}
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
