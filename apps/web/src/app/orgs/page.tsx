'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

type Org = { id: string; name: string; role: string }

export default function OrgsPickerPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch('/api/orgs')
        if (!res.ok) throw new Error((await res.json()).error || 'Failed to load orgs')
        const data = await res.json()
        setOrgs(data)
      } catch (err: any) {
        setError(err?.message || 'Error')
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [])

  const choose = async (orgId: string) => {
    // Set cookie via serverless route or simple redirect with header is tricky; call a tiny route
    await fetch('/api/bootstrap', { method: 'GET', headers: { 'x-org-id': orgId } }).catch(() => {})
    document.cookie = `ORG=${orgId}; path=/; samesite=lax` // fallback client set
    router.push('/')
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-2xl mx-auto">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-poppins">Select organization</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-gray-500">Loading...</div>
            ) : error ? (
              <div className="text-sm text-red-600">{error}</div>
            ) : orgs.length === 0 ? (
              <div className="text-sm text-gray-500">No organizations found.</div>
            ) : (
              <div className="space-y-3">
                {orgs.map((o) => (
                  <div key={o.id} className="flex items-center justify-between border rounded-lg p-3">
                    <div>
                      <div className="font-medium">{o.name}</div>
                      <div className="text-xs text-gray-500">Role: {o.role}</div>
                    </div>
                    <Button onClick={() => choose(o.id)} className="btn-lime">Use</Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


