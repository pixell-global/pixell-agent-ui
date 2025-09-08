'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function TeamMembersPage() {
  const params = useParams() as { id: string }
  const teamId = params.id
  const [members, setMembers] = useState<any[]>([])
  const [userId, setUserId] = useState('')
  const [role, setRole] = useState<'lead' | 'member' | 'viewer'>('member')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const run = async () => {
      const res = await fetch(`/api/teams/${teamId}/members`)
      if (res.ok) setMembers(await res.json())
    }
    run()
  }, [teamId])

  const add = async () => {
    setLoading(true)
    await fetch(`/api/teams/${teamId}/members`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, role }) })
    setUserId('')
    const res = await fetch(`/api/teams/${teamId}/members`)
    if (res.ok) setMembers(await res.json())
    setLoading(false)
  }

  const remove = async (uid: string) => {
    setLoading(true)
    await fetch(`/api/teams/${teamId}/members?userId=${encodeURIComponent(uid)}`, { method: 'DELETE' })
    const res = await fetch(`/api/teams/${teamId}/members`)
    if (res.ok) setMembers(await res.json())
    setLoading(false)
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-2xl mx-auto">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Team Members</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input placeholder="User ID" value={userId} onChange={(e) => setUserId(e.target.value)} />
              <Input placeholder="Role (lead/member/viewer)" value={role} onChange={(e) => setRole(e.target.value as any)} />
              <Button onClick={add} disabled={loading || !userId}>Add</Button>
            </div>
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.userId} className="flex items-center justify-between border rounded-lg p-2">
                  <div>
                    <div className="font-medium">{m.userId}</div>
                    <div className="text-xs text-gray-500">Role: {m.role}</div>
                  </div>
                  <Button variant="destructive" onClick={() => remove(m.userId)} disabled={loading}>Remove</Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


