'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function OrgsPickerPage() {
  const router = useRouter()

  useEffect(() => {
    // Organization selection is now automatic server-side
    // Redirect to main page
    router.replace('/')
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-lg">Redirecting...</div>
        <div className="text-sm text-gray-500 mt-2">Organization is now selected automatically</div>
      </div>
    </div>
  )
}


