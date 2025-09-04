'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast-provider'

export default function BillingPage() {
  const params = useSearchParams()
  const orgId = params.get('orgId')
  const { addToast } = useToast()
  const [loading, setLoading] = useState(false)

  const startCheckout = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/billing/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orgId }) })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to start checkout')
      const { url } = await res.json()
      window.location.href = url
    } catch (err: any) {
      addToast({ type: 'error', title: 'Billing error', description: err?.message || 'Failed to start checkout' })
    } finally {
      setLoading(false)
    }
  }

  const openPortal = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/billing/portal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orgId }) })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to open portal')
      const { url } = await res.json()
      window.location.href = url
    } catch (err: any) {
      addToast({ type: 'error', title: 'Billing error', description: err?.message || 'Failed to open portal' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-poppins">Activate your subscription</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-600">Subscribe to continue. You can manage billing in Stripe at any time.</p>
            <Button onClick={startCheckout} disabled={loading || !orgId} className="w-full">
              {loading ? 'Redirecting…' : 'Proceed to Checkout'}
            </Button>
            <Button variant="secondary" onClick={openPortal} disabled={loading || !orgId} className="w-full">
              Manage Billing
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


