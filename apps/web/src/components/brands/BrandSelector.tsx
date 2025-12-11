'use client'

import { useEffect, useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SkeletonSelect } from '@/components/ui/skeleton'
import { useBrands } from '@/hooks/use-api-data'

type Brand = { id: string; name: string }

export function BrandSelector() {
  const { data: brands, loading, error } = useBrands()
  const [value, setValue] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (brands && brands.length > 0) {
      const cur = getCookie('BRAND')
      if (cur) setValue(cur)
    }
  }, [brands])

  function getCookie(name: string) {
    const m = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
    return m ? decodeURIComponent(m[2]) : null
  }

  const change = (id: string) => {
    setValue(id)
    document.cookie = `BRAND=${id}; path=/; samesite=lax`
    // Optionally trigger a refresh to propagate in middleware protected pages
  }

  if (loading) {
    return <SkeletonSelect className="w-56" />
  }

  if (error) {
    return (
      <div className="w-56 h-10 rounded-md border border-red-200 bg-red-50 flex items-center justify-center">
        <span className="text-sm text-red-600">Error loading brands</span>
      </div>
    )
  }

  return (
    <Select value={value} onValueChange={change}>
      <SelectTrigger className="w-56">
        <SelectValue placeholder="Select brand" />
      </SelectTrigger>
      <SelectContent>
        {brands?.map((b) => (
          <SelectItem key={b.id} value={b.id}>
            {b.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}


