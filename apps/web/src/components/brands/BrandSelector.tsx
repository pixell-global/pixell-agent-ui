'use client'

import { useEffect, useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type Brand = { id: string; name: string }

export function BrandSelector() {
  const [brands, setBrands] = useState<Brand[]>([])
  const [value, setValue] = useState<string | undefined>(undefined)

  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch('/api/brands')
        if (!res.ok) return
        const data = await res.json()
        setBrands(data)
        const cur = getCookie('BRAND')
        if (cur) setValue(cur)
      } catch {}
    }
    run()
  }, [])

  function getCookie(name: string) {
    const m = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
    return m ? decodeURIComponent(m[2]) : null
  }

  const change = (id: string) => {
    setValue(id)
    document.cookie = `BRAND=${id}; path=/; samesite=lax`
    // Optionally trigger a refresh to propagate in middleware protected pages
  }

  return (
    <Select value={value} onValueChange={change}>
      <SelectTrigger className="w-56">
        <SelectValue placeholder="Select brand" />
      </SelectTrigger>
      <SelectContent>
        {brands.map((b) => (
          <SelectItem key={b.id} value={b.id}>
            {b.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}


