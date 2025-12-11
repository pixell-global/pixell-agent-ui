'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

export default function OrganizationSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [brandAccessMode, setBrandAccessMode] = useState<'shared' | 'isolated'>('shared')
  const [requireBrandContext, setRequireBrandContext] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch('/api/settings/organization', { method: 'GET' })
        if (!res.ok) throw new Error((await res.json()).error || 'Failed to load')
        const data = await res.json()
        setBrandAccessMode(data.brandAccessMode)
        setRequireBrandContext(!!data.requireBrandContext)
      } catch (err: any) {
        setError(err?.message || 'Error')
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [])

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/settings/organization', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandAccessMode, requireBrandContext }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to save')
    } catch (err: any) {
      setError(err?.message || 'Error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-2xl mx-auto">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-poppins">Organization Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {loading ? (
              <div className="text-sm text-gray-500">Loading...</div>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Brand access mode</label>
                  <Select value={brandAccessMode} onValueChange={(v) => setBrandAccessMode(v as any)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="shared">Shared (multiple teams per brand)</SelectItem>
                      <SelectItem value="isolated">Isolated (one team per brand)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">Require brand context</div>
                    <div className="text-xs text-gray-500">Force selecting a brand for agent actions</div>
                  </div>
                  <Switch checked={requireBrandContext} onCheckedChange={(v) => setRequireBrandContext(!!v)} />
                </div>
                {error && <p className="text-red-600 text-sm">{error}</p>}
                <Button onClick={save} disabled={saving} className="btn-lime">
                  {saving ? 'Saving...' : 'Save changes'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


