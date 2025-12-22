'use client'

import React, { useState } from 'react'
import {
  ClipboardList,
  CheckCircle2,
  Circle,
  Loader2,
  XCircle,
  SkipForward,
  ChevronDown,
  ChevronRight,
  Play,
  X,
  MessageSquare
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import type {
  PlanProposed,
  PlanApproval,
  PlanStep,
  PlanStepStatus
} from '@pixell/protocols'

interface PlanViewerProps {
  plan: PlanProposed
  onApprove: (approval: PlanApproval) => void
  onReject: (approval: PlanApproval) => void
  onAddFeedback?: (planId: string, feedback: string) => void
  isExecuting?: boolean
  currentStepId?: string
  className?: string
}

const stepStatusConfig: Record<PlanStepStatus, { icon: React.ReactNode; color: string; bg: string }> = {
  pending: {
    icon: <Circle size={16} />,
    color: 'text-white/40',
    bg: 'bg-white/10'
  },
  in_progress: {
    icon: <Loader2 size={16} className="animate-spin" />,
    color: 'text-blue-400',
    bg: 'bg-blue-500/20'
  },
  completed: {
    icon: <CheckCircle2 size={16} />,
    color: 'text-green-400',
    bg: 'bg-green-500/20'
  },
  failed: {
    icon: <XCircle size={16} />,
    color: 'text-red-400',
    bg: 'bg-red-500/20'
  },
  skipped: {
    icon: <SkipForward size={16} />,
    color: 'text-orange-400',
    bg: 'bg-orange-500/20'
  }
}

export function PlanViewer({
  plan,
  onApprove,
  onReject,
  onAddFeedback,
  isExecuting = false,
  currentStepId,
  className = ''
}: PlanViewerProps) {
  const [expanded, setExpanded] = useState(true)
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedback, setFeedback] = useState('')

  const handleApprove = () => {
    onApprove({
      type: 'plan_approval',
      planId: plan.planId,
      approved: true,
    })
  }

  const handleReject = () => {
    onReject({
      type: 'plan_approval',
      planId: plan.planId,
      approved: false,
    })
  }

  const handleAddFeedback = () => {
    if (feedback.trim() && onAddFeedback) {
      onAddFeedback(plan.planId, feedback.trim())
      setFeedback('')
      setShowFeedback(false)
    }
  }

  const getProgress = () => {
    const completed = plan.steps.filter(s => s.status === 'completed').length
    return Math.round((completed / plan.steps.length) * 100)
  }

  const renderStepStatus = (step: PlanStep, index: number) => {
    const status = step.status || 'pending'
    const config = stepStatusConfig[status]
    const isCurrent = step.id === currentStepId

    return (
      <div
        key={step.id}
        className={`
          flex items-start gap-3 p-3 rounded-lg transition-all
          ${isCurrent ? 'bg-blue-500/20 border border-blue-500/30' : 'bg-white/[0.02] border border-white/10'}
          ${status === 'completed' ? 'opacity-75' : ''}
        `}
      >
        {/* Step Number & Status Icon */}
        <div className="flex flex-col items-center">
          <div className={`
            w-8 h-8 rounded-full flex items-center justify-center
            ${config.bg} ${config.color}
          `}>
            {config.icon}
          </div>
          {index < plan.steps.length - 1 && (
            <div className={`w-0.5 h-6 mt-1 ${status === 'completed' ? 'bg-green-500/30' : 'bg-white/10'}`} />
          )}
        </div>

        {/* Step Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-white/90">
              Step {index + 1}
            </span>
            {step.toolHint && (
              <Badge variant="outline" className="text-xs">
                {step.toolHint}
              </Badge>
            )}
            {step.estimatedDuration && (
              <span className="text-xs text-white/40">
                ~{step.estimatedDuration}
              </span>
            )}
          </div>
          <p className="text-sm text-white/60 mt-1 break-words">
            {step.description}
          </p>
          {step.dependencies && step.dependencies.length > 0 && (
            <div className="flex items-center gap-1 mt-1 text-xs text-white/40">
              <span>Depends on:</span>
              {step.dependencies.map((depId, i) => {
                const depIndex = plan.steps.findIndex(s => s.id === depId)
                return (
                  <Badge key={depId} variant="secondary" className="text-xs">
                    Step {depIndex + 1}
                  </Badge>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <Card className={`border-purple-500/30 bg-purple-500/10 ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <ClipboardList size={20} className="text-purple-400" />
            </div>
            <div>
              <CardTitle className="text-base text-white/90">{plan.title}</CardTitle>
              <p className="text-xs text-white/50 mt-0.5">
                {plan.steps.length} step{plan.steps.length !== 1 ? 's' : ''} planned
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isExecuting && (
              <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                <Loader2 size={12} className="mr-1 animate-spin" />
                Executing
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="h-8 w-8 p-0"
            >
              {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </Button>
          </div>
        </div>

        {/* Progress bar when executing */}
        {isExecuting && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-white/50 mb-1">
              <span>Progress</span>
              <span>{getProgress()}%</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-500 transition-all duration-300"
                style={{ width: `${getProgress()}%` }}
              />
            </div>
          </div>
        )}

        {plan.message && (
          <p className="text-sm text-white/60 mt-2">{plan.message}</p>
        )}
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-2 pt-0">
          {plan.steps.map((step, index) => renderStepStatus(step, index))}
        </CardContent>
      )}

      {/* Feedback input */}
      {showFeedback && !isExecuting && (
        <div className="px-6 pb-3">
          <Textarea
            placeholder="Provide feedback or modifications to the plan..."
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            className="min-h-[60px] text-sm"
          />
        </div>
      )}

      {/* Actions - only show if not executing and requires approval */}
      {plan.requiresApproval && !isExecuting && (
        <CardFooter className="flex justify-between items-center pt-2 border-t border-white/10">
          <div className="flex gap-2">
            {onAddFeedback && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFeedback(!showFeedback)}
                className="text-white/50"
              >
                <MessageSquare size={14} className="mr-1" />
                {showFeedback ? 'Cancel' : 'Add feedback'}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {showFeedback && feedback.trim() && (
              <Button
                variant="outline"
                onClick={handleAddFeedback}
              >
                Submit Feedback
              </Button>
            )}
            {!showFeedback && (
              <>
                <Button
                  variant="outline"
                  onClick={handleReject}
                  className="text-red-400 border-red-500/30 hover:bg-red-500/20"
                >
                  <X size={16} className="mr-1" />
                  Reject
                </Button>
                <Button
                  onClick={handleApprove}
                  className="bg-green-500 hover:bg-green-600 text-white"
                >
                  <Play size={16} className="mr-1" />
                  Approve & Execute
                </Button>
              </>
            )}
          </div>
        </CardFooter>
      )}

      {/* Auto-start indicator */}
      {plan.autoStartAfterMs && !isExecuting && !plan.requiresApproval && (
        <CardFooter className="pt-2 border-t border-white/10">
          <div className="flex items-center justify-between w-full text-sm text-white/50">
            <span>Auto-starting in {Math.round(plan.autoStartAfterMs / 1000)}s...</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReject}
              className="text-red-400 border-red-500/30 hover:bg-red-500/20"
            >
              <X size={14} className="mr-1" />
              Cancel
            </Button>
          </div>
        </CardFooter>
      )}
    </Card>
  )
}
