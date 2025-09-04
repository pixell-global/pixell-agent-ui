import { cookies as nextCookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { AgentWorkspaceLayout } from '@/components/layout/AgentWorkspaceLayout'

export default async function HomePage() {
  const cookieName = process.env.SESSION_COOKIE_NAME || 'session'
  const cookieStore = await nextCookies()
  const session = cookieStore.get(cookieName)?.value

  if (!session) {
    redirect('/signin')
  }

  // With a valid session cookie present, consult onboarding status to route correctly
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/onboarding/status`, { cache: 'no-store', headers: { cookie: `${cookieName}=${session}` } })
    if (res.ok) {
      const { step, orgId } = await res.json()
      if (step === 'need_org') redirect('/onboarding')
      if (step === 'need_brand') redirect(`/onboarding/brand${orgId ? `?orgId=${orgId}` : ''}`)
      if (step === 'need_subscription') redirect(`/billing${orgId ? `?orgId=${orgId}` : ''}`)
    }
  } catch {}

  // Auth OK → render app at root
  return <AgentWorkspaceLayout />
}
