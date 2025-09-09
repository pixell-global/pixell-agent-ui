'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast-provider'
import { Check, Zap } from 'lucide-react'

type PlanType = 'starter'

interface Plan {
  id: PlanType
  name: string
  price: number
  originalPrice?: number
  description: string
  features: string[]
  icon: React.ReactNode
  recommended?: boolean
}

const plans: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 99,
    originalPrice: 199,
    description: 'Perfect for individuals and small teams',
    icon: <Zap className="w-6 h-6" />,
    features: [
      'Advanced AI agents',
      'Multi-agent workflows',
      'Basic integrations',
      'Standard support',
      'Up to 5 team members',
      '10GB storage',
      'API access',
      'Basic analytics'
    ]
  }
]

function BillingContent() {
  const params = useSearchParams()
  const orgId = params.get('orgId')
  const { addToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('starter')

  const startCheckout = async (planId: PlanType) => {
    try {
      setLoading(true)
      const res = await fetch('/api/billing/checkout', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ orgId, planId }) 
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to start checkout')
      const { url } = await res.json()
      window.location.href = url
    } catch (err: any) {
      addToast({ type: 'error', title: 'Billing error', description: err?.message || 'Failed to start checkout' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Choose your plan</h1>
          <p className="text-gray-600">Select the perfect plan for your needs</p>
        </div>
        
        <div className="flex justify-center mb-8">
          <div className="w-full max-w-md">
            {plans.map((plan) => (
              <Card 
                key={plan.id} 
                className="relative shadow-lg transition-all duration-200 hover:shadow-xl"
              >
                <CardHeader className="text-center pb-4">
                  <div className="flex justify-center mb-4">
                    <div className="p-3 rounded-full bg-gray-100 text-gray-600">
                      {plan.icon}
                    </div>
                  </div>
                  <CardTitle className="text-2xl font-bold text-gray-900">{plan.name}</CardTitle>
                  <div className="mt-2">
                    {plan.originalPrice && (
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <span className="text-lg text-gray-500 line-through">${plan.originalPrice}</span>
                        <span className="bg-red-100 text-red-800 text-xs font-medium px-2 py-1 rounded-full">
                          {Math.round(((plan.originalPrice - plan.price) / plan.originalPrice) * 100)}% OFF
                        </span>
                      </div>
                    )}
                    <div className="flex items-baseline justify-center">
                      <span className="text-4xl font-bold text-gray-900">${plan.price}</span>
                      <span className="text-gray-600 ml-1">USD / month</span>
                    </div>
                  </div>
                  <p className="text-gray-600 mt-2">{plan.description}</p>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <ul className="space-y-3">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start">
                        <Check className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <Button 
                    onClick={() => startCheckout(plan.id)}
                    disabled={loading || !orgId}
                    className="w-full mt-6 bg-gray-900 hover:bg-gray-800"
                  >
                    {loading ? 'Redirecting…' : `Choose ${plan.name}`}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
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


