'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
  const features = [
    `${plan.credits.small} Small credits/month`,
    `${plan.credits.medium} Medium credits/month`,
    `${plan.credits.large} Large credits/month`,
    `${plan.credits.xl} XL credits/month`,
  ]

  // Add tier-specific features
  if (tier === 'free') {
    features.push('Basic support', 'Community access')
  } else if (tier === 'starter') {
    features.push('Email support', 'Basic integrations', 'API access')
  } else if (tier === 'pro') {
    features.push('Priority support', 'Advanced integrations', 'API access', 'Team collaboration')
  } else if (tier === 'max') {
    features.push('24/7 Premium support', 'All integrations', 'API access', 'Dedicated account manager', 'Custom SLA')
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
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50 relative">
      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-8 shadow-2xl text-center max-w-md">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-lime-600 mx-auto mb-4"></div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {selectedTier === 'free' ? 'Setting up your free account...' : 'Redirecting to checkout...'}
            </h3>
            <p className="text-gray-600">
              {selectedTier === 'free' ? 'Creating your subscription and workspace' : 'Please wait while we prepare your payment'}
            </p>
          </div>
        </div>
      )}

      <div className="w-full max-w-7xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Choose your plan</h1>
          <p className="text-gray-600">Select the perfect plan for your needs</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {tiers.map((tier) => {
            const plan = SUBSCRIPTION_PLANS[tier]
            const features = getPlanFeatures(tier)
            const isRecommended = tier === 'pro'

            return (
              <Card
                key={tier}
                className={`relative shadow-lg transition-all duration-200 hover:shadow-xl flex flex-col h-full ${
                  isRecommended ? 'border-2 border-lime-500' : ''
                }`}
              >
                {isRecommended && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-lime-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                      RECOMMENDED
                    </span>
                  </div>
                )}

                <CardHeader className="text-center pb-4 flex-shrink-0">
                  <div className="flex justify-center mb-4">
                    <div className={`p-3 rounded-full ${
                      tier === 'max' ? 'bg-yellow-100 text-yellow-600' :
                      tier === 'pro' ? 'bg-lime-100 text-lime-600' :
                      tier === 'starter' ? 'bg-blue-100 text-blue-600' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {planIcons[tier]}
                    </div>
                  </div>
                  <CardTitle className="text-2xl font-bold text-gray-900">{plan.name}</CardTitle>
                  <div className="mt-2">
                    <div className="flex items-baseline justify-center">
                      {plan.price === 0 ? (
                        <span className="text-4xl font-bold text-gray-900">Free</span>
                      ) : (
                        <>
                          <span className="text-4xl font-bold text-gray-900">${plan.price}</span>
                          <span className="text-gray-600 ml-1">/month</span>
                        </>
                      )}
                    </div>
                  </div>
                  <p className="text-gray-600 mt-2 text-sm">{planDescriptions[tier]}</p>
                </CardHeader>

                <CardContent className="flex flex-col flex-grow">
                  <ul className="space-y-2 flex-grow">
                    {features.map((feature, index) => (
                      <li key={index} className="flex items-start">
                        <Check className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-700 text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    onClick={() => startCheckout(tier)}
                    disabled={loading}
                    className={`w-full mt-6 ${
                      tier === 'max' ? 'bg-yellow-600 hover:bg-yellow-700' :
                      tier === 'pro' ? 'bg-lime-600 hover:bg-lime-700' :
                      'bg-gray-900 hover:bg-gray-800'
                    } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {loading && selectedTier === tier ? 'Processing…' : `Choose ${plan.name}`}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function BillingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <BillingContent />
    </Suspense>
  )
}