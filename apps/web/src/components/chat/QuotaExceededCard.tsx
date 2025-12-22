'use client'

import React from 'react'
import { Sparkles, ArrowUpRight, Lock, Zap } from 'lucide-react'
import Link from 'next/link'

export interface QuotaError {
  error: string
  message: string
  featureAvailable: boolean
  limit: number | null
  used: number
  remaining: number
}

interface QuotaExceededCardProps {
  quotaError: QuotaError
  onDismiss?: () => void
}

export function QuotaExceededCard({ quotaError, onDismiss }: QuotaExceededCardProps) {
  const isFeatureUnavailable = !quotaError.featureAvailable
  const isQuotaExhausted = quotaError.featureAvailable && quotaError.remaining === 0

  return (
    <div className="glass-card p-5 max-w-xl w-full animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className={isFeatureUnavailable ? "icon-container-purple" : "icon-container-orange"}>
          {isFeatureUnavailable ? (
            <Lock className="h-4 w-4" />
          ) : (
            <Zap className="h-4 w-4" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white mb-1">
            {isFeatureUnavailable ? 'Feature Not Available' : 'Usage Limit Reached'}
          </h3>
          <p className="text-xs text-pixell-grey leading-relaxed">
            {quotaError.message}
          </p>
        </div>
      </div>

      {/* Usage Stats (only show if feature is available but exhausted) */}
      {isQuotaExhausted && quotaError.limit !== null && (
        <div className="mb-4 p-3 rounded-lg bg-white/[0.02] border border-white/5">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-pixell-grey">Usage this period</span>
            <span className="text-white font-medium">
              {quotaError.used} / {quotaError.limit}
            </span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-pixell-orange to-pixell-yellow rounded-full transition-all duration-500"
              style={{ width: '100%' }}
            />
          </div>
        </div>
      )}

      {/* Upgrade Benefits */}
      <div className="mb-5 space-y-2">
        <p className="text-xs text-pixell-grey mb-2">
          {isFeatureUnavailable
            ? 'Upgrade to unlock this feature and more:'
            : 'Upgrade for higher limits:'
          }
        </p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { icon: Sparkles, text: 'More research tasks' },
            { icon: Zap, text: 'Auto-posting actions' },
          ].map((benefit, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 text-xs text-white/70 p-2 rounded-lg bg-white/[0.02]"
            >
              <benefit.icon className="h-3 w-3 text-pixell-yellow shrink-0" />
              <span>{benefit.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-3 border-t border-white/10">
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-xs text-white/50 hover:text-white/70 transition-colors"
          >
            Maybe later
          </button>
        )}
        <Link
          href="/settings/billing"
          className="ml-auto inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-gradient-to-r from-pixell-yellow to-pixell-yellow/90 text-pixell-black hover:from-pixell-yellow/90 hover:to-pixell-yellow rounded-lg transition-all duration-200 group"
        >
          <Sparkles className="h-3 w-3" />
          View Plans
          <ArrowUpRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
      </div>
    </div>
  )
}
