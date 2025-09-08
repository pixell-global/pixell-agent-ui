'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast-provider'

export default function InvitesPage() {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'member' | 'viewer'>('member')
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { addToast } = useToast()

  const createInvite = async () => {
    setLoading(true)
    setError(null)
    setInviteUrl(null)
    try {
      const res = await fetch('/api/invites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, role }) })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed')
      const data = await res.json()
      setInviteUrl(data.inviteUrl)
      addToast({ type: 'success', title: 'Invite created', description: 'Copy and share the invite link.' })
    } catch (e: any) {
      setError(e?.message || 'Error')
      addToast({ type: 'error', title: 'Failed to create invite', description: e?.message })
    } finally {
      setLoading(false)
    }
  }

  const copy = async () => {
    if (!inviteUrl) return
    await navigator.clipboard.writeText(inviteUrl)
    addToast({ type: 'info', title: 'Copied', description: 'Invite link copied to clipboard.' })
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-xl mx-auto">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Invite users</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Input placeholder="Role (admin/member/viewer)" value={role} onChange={(e) => setRole(e.target.value as any)} />
              <Button onClick={createInvite} disabled={loading || !email}>Create</Button>
            </div>
            {error && <div className="text-sm text-red-600">{error}</div>}
            {!inviteUrl ? (
              <div className="text-sm text-gray-500">No invite created yet.</div>
            ) : (
              <div className="flex items-center justify-between border rounded-lg p-2">
                <div className="truncate text-sm">{inviteUrl}</div>
                <Button onClick={copy} variant="outline">Copy link</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


