'use client'

export const dynamic = 'force-dynamic'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div>
      <h1>Something went wrong!</h1>
      <p>An unexpected error occurred.</p>
      <button onClick={reset}>Try again</button>
    </div>
  )
}
