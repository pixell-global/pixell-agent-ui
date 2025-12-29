'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast-provider'
import { Check, Zap, Rocket, Crown, Gift } from 'lucide-react'
import { SUBSCRIPTION_PLANS, type SubscriptionTier } from '@/lib/billing/stripe-config'

const planIcons: Record<SubscriptionTier, React.ReactNode> = {
  free: <Gift className="w-6 h-6" />,
  starter: <Zap className="w-6 h-6" />,
  pro: <Rocket className="w-6 h-6" />,
  max: <Crown className="w-6 h-6" />,
}

const planDescriptions: Record<SubscriptionTier, string> = {
  free: 'Get started with basic features',
  starter: 'Perfect for individuals and small teams',
  pro: 'For growing teams and businesses',
  max: 'Unlimited power for enterprises',
}

function getPlanFeatures(tier: SubscriptionTier): string[] {
  const plan = SUBSCRIPTION_PLANS[tier]
  const features: string[] = []

  // Add quota-based features
  if (plan.quotas.research > 0) {
    features.push(`${plan.quotas.research} Research actions/month`)
  }
  if (plan.quotas.ideation > 0) {
    features.push(`${plan.quotas.ideation} Ideation runs/month`)
  }
  if (plan.quotas.autoPosting > 0) {
    features.push(`${plan.quotas.autoPosting} Auto-posts/month`)
  }
  if (plan.quotas.monitors > 0) {
    features.push(`${plan.quotas.monitors} Concurrent monitors`)
  }

  // Add tier-specific features
  if (tier === 'free') {
    features.push('Community support', 'Basic features')
  } else if (tier === 'starter') {
    features.push('Email support', 'Priority task queue')
  } else if (tier === 'pro') {
    features.push('Priority support', 'Advanced analytics', 'Team collaboration')
  } else if (tier === 'max') {
    features.push('Dedicated support', 'Custom SLA', 'API access')
  }

  return features
}

function BillingContent() {
  const params = useSearchParams()
  const orgId = params?.get('orgId')
  const returnTo = params?.get('returnTo') // Where to redirect after selecting plan
  const { addToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier | null>(null)

  const startCheckout = async (tier: SubscriptionTier) => {
    try {
      setLoading(true)
      setSelectedTier(tier)

      // Free tier doesn't need checkout
      if (tier === 'free') {
        const res = await fetch('/api/billing/subscription/create-free', {
          method: 'POST',
          credentials: 'include',
        })
        if (!res.ok) throw new Error((await res.json()).error || 'Failed to create free plan')

        // Redirect to return URL or app home after creating free plan
        window.location.href = returnTo || '/'
        return
      }

      // Paid tiers go through checkout
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tier })
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to start checkout')
      const { url } = await res.json()
      if (url) {
        window.location.href = url
      }
    } catch (err: any) {
      addToast({ type: 'error', title: 'Billing error', description: err?.message || 'Failed to start checkout' })
      setSelectedTier(null)
    } finally {
      setLoading(false)
    }
  }

  const tiers: SubscriptionTier[] = ['free', 'starter', 'pro', 'max']

  return (
    <div className="min-h-screen p-6">
      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-surface rounded-lg p-8 shadow-2xl text-center max-w-md border border-white/10">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-pixell-yellow mx-auto mb-4"></div>
            <h3 className="text-xl font-bold text-white mb-2">
              {selectedTier === 'free' ? 'Setting up your free account...' : 'Redirecting to checkout...'}
            </h3>
            <p className="text-white/60">
              {selectedTier === 'free' ? 'Creating your subscription and workspace' : 'Please wait while we prepare your payment'}
            </p>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold font-poppins text-white">Choose your plan</h1>
          <p className="text-white/60 mt-2">Select the perfect plan for your needs</p>
        </div>

        {/* Available Plans */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-white">Available Plans</CardTitle>
            <CardDescription className="text-white/50">Compare features and choose the right plan for you</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {tiers.map((tier) => {
                const plan = SUBSCRIPTION_PLANS[tier]
                const features = getPlanFeatures(tier)
                const isRecommended = tier === 'pro'

                return (
                  <div
                    key={tier}
                    className={`rounded-xl p-4 transition-all border ${
                      isRecommended
                        ? 'border-2 border-pixell-yellow bg-pixell-yellow/5'
                        : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/20'
                    }`}
                  >
                    {isRecommended && (
                      <div className="mb-3 -mt-2">
                        <Badge className="bg-pixell-yellow text-pixell-black font-medium text-xs">
                          RECOMMENDED
                        </Badge>
                      </div>
                    )}

                    <div className="space-y-3">
                      <div className="flex justify-center mb-4">
                        <div className={`p-3 rounded-full ${
                          tier === 'max' ? 'bg-yellow-100/10 text-yellow-400' :
                          tier === 'pro' ? 'bg-pixell-yellow/10 text-pixell-yellow' :
                          tier === 'starter' ? 'bg-blue-100/10 text-blue-400' :
                          'bg-gray-100/10 text-gray-400'
                        }`}>
                          {planIcons[tier]}
                        </div>
                      </div>

                      <div className="text-center">
                        <div className="font-semibold text-lg text-white">{plan.name}</div>
                        <div className="text-2xl font-bold mt-1 text-white">
                          {plan.price === 0 ? 'Free' : `$${plan.price}`}
                          {plan.price > 0 && <span className="text-sm text-white/50">/mo</span>}
                        </div>
                        <p className="text-white/50 mt-2 text-sm">{planDescriptions[tier]}</p>
                      </div>

                      <div className="text-xs space-y-1 py-4 border-y border-white/10">
                        <div className="font-medium text-white/70">Monthly Quotas:</div>
                        <div className="text-white/50">{plan.quotas.research} Research</div>
                        <div className="text-white/50">{plan.quotas.ideation} Ideation</div>
                        <div className="text-white/50">{plan.quotas.autoPosting} Auto-posts</div>
                        <div className="text-white/50">{plan.quotas.monitors} Monitors</div>
                      </div>

                      <ul className="space-y-2">
                        {features.slice(4).map((feature, index) => (
                          <li key={index} className="flex items-start text-xs">
                            <Check className="w-3 h-3 text-pixell-yellow mr-1.5 mt-0.5 flex-shrink-0" />
                            <span className="text-white/70">{feature}</span>
                          </li>
                        ))}
                      </ul>

                      <Button
                        onClick={() => startCheckout(tier)}
                        disabled={loading}
                        className={`w-full ${
                          tier === 'max' ? 'bg-yellow-600 hover:bg-yellow-700' :
                          tier === 'pro' ? 'btn-lime' :
                          'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                        } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {loading && selectedTier === tier ? 'Processing…' : `Choose ${plan.name}`}
                      </Button>
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

export default function BillingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="text-white font-inter">Loading...</div></div>}>
      <BillingContent />
    </Suspense>
  )
}
