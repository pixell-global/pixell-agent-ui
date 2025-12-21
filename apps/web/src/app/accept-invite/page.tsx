'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

function AcceptInviteContent() {
  const params = useSearchParams()
  const token = params.get('token')
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ orgName: string; role: string } | null>(null)

  useEffect(() => {
    const run = async () => {
      if (!token) return
      try {
        const res = await fetch('/api/invites/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
        if (!res.ok) throw new Error((await res.json()).error || 'Invalid invite')
        const data = await res.json()
        setPreview({ orgName: data.orgName, role: data.role })
      } catch (err: any) {
        setError(err?.message || 'Error')
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [token])

  const handleAccept = async () => {
    if (!token) return
    setAccepting(true)
    setError(null)
    try {
      const res = await fetch('/api/invites/accept', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to accept')
      router.push('/')
    } catch (err: any) {
      setError(err?.message || 'Error')
    } finally {
      setAccepting(false)
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center gradient-hero"><div className="text-white font-inter">Loading invite...</div></div>
  }

  if (error || !preview) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-hero p-4">
        <Card className="glass-card shadow-2xl">
          <CardContent className="py-8">
            <p className="font-inter text-red-700">{error || 'Invalid or expired invite.'}</p>
          </CardContent>
        </Card>
      </div>
    )
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
            <CardTitle className="text-2xl font-poppins text-primary-text">You've been invited!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="font-inter text-primary-text">Join <strong>{preview.orgName}</strong> as <strong>{preview.role}</strong>.</p>
            {error && <p className="text-red-600 text-sm font-inter">{error}</p>}
            <Button onClick={handleAccept} className="w-full h-12 btn-lime font-inter" disabled={accepting}>
              {accepting ? 'Accepting...' : 'Accept invite'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center gradient-hero"><div className="text-white font-inter">Loading...</div></div>}>
      <AcceptInviteContent />
    </Suspense>
  )
}