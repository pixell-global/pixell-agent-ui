'use client'

import { Loader2, ChevronDown, ChevronRight, Search, ClipboardList, Zap, Target, CheckCircle2, XCircle } from 'lucide-react'
import { Activity, ActivitySubTask, UPEEPhase } from '@/stores/workspace-store'

interface RunningItemProps {
  activity: Activity
  size?: 'sm' | 'md'
  onToggleSubTasks?: () => void
}

// UPEE phase configuration
const UPEE_CONFIG: Record<UPEEPhase, { icon: typeof Search; color: string; bgColor: string }> = {
  understand: { icon: Search, color: 'text-blue-400', bgColor: 'bg-blue-400' },
  plan: { icon: ClipboardList, color: 'text-purple-400', bgColor: 'bg-purple-400' },
  execute: { icon: Zap, color: 'text-pixell-yellow', bgColor: 'bg-pixell-yellow' },
  evaluate: { icon: Target, color: 'text-green-400', bgColor: 'bg-green-400' },
}

export function RunningItem({ activity, size = 'sm', onToggleSubTasks }: RunningItemProps) {
  const iconSize = size === 'sm' ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'
  const smallIconSize = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5'
  const textSize = size === 'sm' ? 'text-[10px]' : 'text-xs'
  const smallTextSize = size === 'sm' ? 'text-[9px]' : 'text-[10px]'

  const hasSubTasks = activity.subTasks && activity.subTasks.length > 0
  const phase = activity.upeePhase || 'execute'
  const config = UPEE_CONFIG[phase]
  const PhaseIcon = config.icon

  // Determine the display message - prefer upeePhaseMessage over progressMessage
  const displayMessage = activity.upeePhaseMessage || activity.progressMessage

  return (
    <div className="space-y-1">
      {/* Main activity row */}
      <div className="flex items-center gap-1.5">
        {/* Sub-task toggle if applicable */}
        {hasSubTasks && (
          <button
            onClick={onToggleSubTasks}
            className="p-0.5 hover:bg-white/10 rounded transition-colors flex-shrink-0"
          >
            {activity.subTasksExpanded ? (
              <ChevronDown className={`${smallIconSize} text-white/40`} />
            ) : (
              <ChevronRight className={`${smallIconSize} text-white/40`} />
            )}
          </button>
        )}

        {/* Phase icon with animation */}
        <PhaseIcon
          className={`${iconSize} ${config.color} ${
            phase === 'execute' ? 'animate-pulse' : ''
          } flex-shrink-0`}
        />

        {/* Activity name */}
        <span className={`${textSize} text-white/80 truncate flex-1`}>
          {activity.name}
        </span>

        {/* UPEE Phase badge */}
        <span className={`${smallTextSize} ${config.color} capitalize flex-shrink-0 px-1.5 py-0.5 rounded bg-white/5`}>
          {phase}
        </span>
      </div>

      {/* Progress message */}
      {displayMessage && (
        <div className={`${hasSubTasks ? 'ml-6' : 'ml-4'} ${smallTextSize} text-white/40 truncate`}>
          {displayMessage}
        </div>
      )}

      {/* Progress bar */}
      <div className={`${hasSubTasks ? 'ml-6' : 'ml-4'} h-0.5 bg-white/10 rounded-full overflow-hidden`}>
        <div
          className={`h-full ${config.bgColor} transition-all duration-500 ease-out`}
          style={{ width: `${activity.progress}%` }}
        />
      </div>

      {/* Collapsible sub-tasks */}
      {hasSubTasks && activity.subTasksExpanded && (
        <div className="ml-6 mt-1.5 space-y-1 border-l border-white/10 pl-2">
          {activity.subTasks!.map((subTask) => (
            <SubTaskItem key={subTask.id} subTask={subTask} size={size} />
          ))}
        </div>
      )}
    </div>
  )
}

interface SubTaskItemProps {
  subTask: ActivitySubTask
  size: 'sm' | 'md'
}

function SubTaskItem({ subTask, size }: SubTaskItemProps) {
  const iconSize = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5'
  const textSize = size === 'sm' ? 'text-[9px]' : 'text-[10px]'

  const statusConfig = {
    pending: { color: 'text-white/30', icon: null },
    running: { color: 'text-pixell-yellow', icon: Loader2 },
    completed: { color: 'text-green-400', icon: CheckCircle2 },
    failed: { color: 'text-red-400', icon: XCircle },
  }

  const config = statusConfig[subTask.status]
  const StatusIcon = config.icon

  return (
    <div className={`flex items-center gap-1.5 ${textSize} ${config.color}`}>
      {StatusIcon ? (
        <StatusIcon className={`${iconSize} ${subTask.status === 'running' ? 'animate-spin' : ''}`} />
      ) : (
        <div className={`${iconSize} rounded-full border border-current`} />
      )}
      <span className="truncate">{subTask.name}</span>
    </div>
  )
}
