import React from 'react'
import { Skeleton } from './skeleton'

interface WithSkeletonProps {
  loading: boolean
  error?: string | null
  skeleton: React.ReactNode
  errorComponent?: React.ReactNode
  children: React.ReactNode
}

export function WithSkeleton({ 
  loading, 
  error, 
  skeleton, 
  errorComponent,
  children 
}: WithSkeletonProps) {
  if (loading) {
    return <>{skeleton}</>
  }

  if (error) {
    return errorComponent ? <>{errorComponent}</> : (
      <div className="flex items-center justify-center p-4 text-red-600">
        <span className="text-sm">Error: {error}</span>
      </div>
    )
  }

  return <>{children}</>
}

// Convenience wrapper for common patterns
export function withApiSkeleton<T extends object>(
  Component: React.ComponentType<T>,
  skeletonComponent: React.ReactNode,
  errorComponent?: React.ReactNode
) {
  return function WrappedComponent(props: T & { loading?: boolean; error?: string | null }) {
    const { loading, error, ...restProps } = props
    
    return (
      <WithSkeleton
        loading={loading || false}
        error={error}
        skeleton={skeletonComponent}
        errorComponent={errorComponent}
      >
        <Component {...(restProps as T)} />
      </WithSkeleton>
    )
  }
}
