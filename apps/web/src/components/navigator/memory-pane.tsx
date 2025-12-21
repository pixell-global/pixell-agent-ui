'use client'

import React from 'react'
import { Brain } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MemoryPaneProps {
  className?: string
}

/**
 * Memory Pane
 * - Navigator의 "Memory" 탭에서 사용됩니다.
 * - 현재 프로젝트에서 메모리 데이터 소스/스토어가 정리되기 전까지는
 *   빌드가 깨지지 않도록 안전한 placeholder UI를 제공합니다.
 */
export const MemoryPane: React.FC<MemoryPaneProps> = ({ className }) => {
  return (
    <div className={cn('flex flex-col h-full', className)}>
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-white/60" />
          <span className="text-sm font-medium text-white/90">Memory</span>
        </div>
        <p className="mt-1 text-xs text-white/50">
          에이전트 메모리/컨텍스트 기능은 준비 중입니다.
        </p>
      </div>

      <div className="flex-1 p-4">
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
          <p className="text-sm text-white/70">
            아직 표시할 메모리 항목이 없습니다.
          </p>
          <p className="mt-1 text-xs text-white/40">
            향후 작업: 메모리 저장소(서버/스토어) 연결 및 검색/필터 UI 추가
          </p>
        </div>
      </div>
    </div>
  )
}


