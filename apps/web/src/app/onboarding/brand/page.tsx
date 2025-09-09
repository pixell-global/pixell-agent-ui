'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useState, Suspense } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast-provider'
import { apiFetch } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

function OnboardingBrandContent() {
  const params = useSearchParams()
  const orgId = params.get('orgId')
  const router = useRouter()
  const [name, setName] = useState('')
  const [accessMode, setAccessMode] = useState<'shared' | 'isolated'>('shared')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { addToast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch('/api/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, metadata: { accessMode } }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to create brand')
      addToast({ type: 'success', title: 'Brand created', description: 'Proceed to billing'} )
      router.push(`/billing?orgId=${orgId}`)
    } catch (err: any) {
      setError(err?.message || 'Error')
      addToast({ type: 'error', title: 'Failed to create brand', description: err?.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center gradient-hero p-4">
      <div className="w-full max-w-md">
        <Card className="glass-card shadow-2xl">
          <CardHeader className="text-center pb-6">
            <div className="mb-4">
              <pre className="ascii-art">
{`  ___  _  _  ___  ___  ___  _  _ 
 |_ _|| \| || __|| __|| __|| || |
  | | | .\` || _| | _| | _| | __ |
 |___||_|\\_||___||___||___||_||_|`}
              </pre>
            </div>
            <CardTitle className="text-2xl font-poppins text-primary-text">Create your first brand</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input name="brandName" placeholder="Brand name" value={name} onChange={(e) => setName(e.target.value)} required className="h-12 text-lg font-inter" />
              {/* Brand code removed */}
              <Select value={accessMode} onValueChange={(v) => setAccessMode(v as any)}>
                <SelectTrigger className="h-12 text-lg font-inter">
                  <SelectValue placeholder="Access mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="shared">Shared (multiple teams per brand)</SelectItem>
                  <SelectItem value="isolated">Isolated (one team per brand)</SelectItem>
                </SelectContent>
              </Select>
              {error && <p className="text-red-600 text-sm font-inter">{error}</p>}
              <Button type="submit" className="w-full h-12 btn-lime font-inter" disabled={loading}>
                {loading ? 'Creating...' : 'Finish'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function OnboardingBrandPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center gradient-hero"><div className="text-white font-inter">Loading...</div></div>}>
      <OnboardingBrandContent />
    </Suspense>
  )
}


