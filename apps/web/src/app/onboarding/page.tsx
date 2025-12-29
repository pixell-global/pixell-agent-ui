'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast-provider'
import { Button } from '@/components/ui/button'

export default function OnboardingOrgPage() {
  const [orgName, setOrgName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const { addToast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgName }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to create org')
      const { orgId } = await res.json()
      addToast({ type: 'success', title: 'Organization created', description: 'Proceed to select your plan.' })
      router.push(`/billing?orgId=${orgId}`)
    } catch (err: any) {
      setError(err?.message || 'Error')
      addToast({ type: 'error', title: 'Failed to create organization', description: err?.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center gradient-hero p-4">
      <div className="w-full max-w-md">
        <Card className="glass-card shadow-2xl">
          <CardHeader className="text-center pb-6">
            <CardTitle className="text-2xl font-poppins text-primary-text">Create your organization</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input name="orgName" placeholder="Organization name" value={orgName} onChange={(e) => setOrgName(e.target.value)} required className="h-12 text-lg font-inter" />
              {error && <p className="text-red-600 text-sm font-inter">{error}</p>}
              <Button type="submit" className="w-full h-12 btn-lime font-inter" disabled={loading}>
                {loading ? 'Creating...' : 'Continue'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


