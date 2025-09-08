'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast-provider'
import { apiFetch } from '@/lib/utils'

export default function BrandAccessPage() {
  const params = useParams() as { id: string }
  const brandId = params.id
  const [teamId, setTeamId] = useState('')
  const [role, setRole] = useState<'manager' | 'editor' | 'analyst' | 'viewer'>('viewer')
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const { addToast } = useToast()

  const grantTeam = async () => {
    setLoading(true)
    setMessage(null)
    try {
      const res = await apiFetch(`/api/brands/${brandId}/teams`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teamId, role }) })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed')
      setMessage('Team access granted')
      addToast({ type: 'success', title: 'Team access granted' })
    } catch (e: any) {
      setMessage(e?.message || 'Error')
      addToast({ type: 'error', title: 'Failed to grant team access', description: e?.message })
    } finally {
      setLoading(false)
    }
  }

  const grantUser = async () => {
    setLoading(true)
    setMessage(null)
    try {
      const res = await apiFetch(`/api/brands/${brandId}/users`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, role }) })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed')
      setMessage('User access granted')
      addToast({ type: 'success', title: 'User access granted' })
    } catch (e: any) {
      setMessage(e?.message || 'Error')
      addToast({ type: 'error', title: 'Failed to grant user access', description: e?.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-2xl mx-auto">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Manage Brand Access</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="text-sm font-medium">Grant team access</div>
              <Input placeholder="Team ID" value={teamId} onChange={(e) => setTeamId(e.target.value)} />
              <Select value={role} onValueChange={(v) => setRole(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="analyst">Analyst</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={grantTeam} disabled={loading || !teamId} className="btn-lime">Grant team access</Button>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Grant user access</div>
              <Input placeholder="User ID (email or uid)" value={userId} onChange={(e) => setUserId(e.target.value)} />
              <Button onClick={grantUser} disabled={loading || !userId} className="btn-lime">Grant user access</Button>
            </div>

            {message ? <div className="text-sm">{message}</div> : <div className="text-sm text-gray-500">No changes yet.</div>}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


