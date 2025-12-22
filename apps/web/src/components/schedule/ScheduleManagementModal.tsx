'use client'

import React, { useState, useEffect } from 'react'
import {
  X,
  Save,
  Loader2,
  Calendar,
  Bot,
  Bell,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SchedulePicker } from './SchedulePicker'
import type {
  Schedule,
  ScheduleProposal,
  ScheduleType,
  IntervalSpec,
  NotificationSettings,
  RetryConfig,
} from '@pixell/protocols'

interface ScheduleFormData {
  name: string
  description: string
  prompt: string
  agentId: string
  scheduleType: ScheduleType
  cronExpression?: string
  interval?: IntervalSpec
  oneTimeAt?: string
  timezone: string
  scheduleDisplay: string
  notificationSettings: NotificationSettings
  retryConfig: RetryConfig
}

interface ScheduleManagementModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: ScheduleFormData) => Promise<void>
  schedule?: Schedule | null
  proposal?: ScheduleProposal | null
  agents?: { id: string; name: string }[]
  mode: 'create' | 'edit' | 'from-proposal'
}

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: true,
  channels: ['in_app'],
  triggers: ['on_failure'],
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  enabled: true,
  maxRetries: 3,
  retryDelayMs: 60000,
  backoffMultiplier: 2,
  retryOn: ['timeout', 'rate_limit', 'server_error'],
}

export function ScheduleManagementModal({
  isOpen,
  onClose,
  onSubmit,
  schedule,
  proposal,
  agents = [],
  mode,
}: ScheduleManagementModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState('basic')
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Form state
  const [formData, setFormData] = useState<ScheduleFormData>({
    name: '',
    description: '',
    prompt: '',
    agentId: '',
    scheduleType: 'cron',
    cronExpression: '0 9 * * *',
    timezone: 'UTC',
    scheduleDisplay: 'Every day at 9:00 AM',
    notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
    retryConfig: DEFAULT_RETRY_CONFIG,
  })

  // Initialize form from schedule or proposal
  useEffect(() => {
    if (schedule) {
      setFormData({
        name: schedule.name,
        description: schedule.description || '',
        prompt: schedule.prompt,
        agentId: schedule.agentId,
        scheduleType: schedule.scheduleType,
        cronExpression: schedule.cron,
        interval: schedule.interval,
        oneTimeAt: schedule.oneTimeAt,
        timezone: schedule.timezone,
        scheduleDisplay: schedule.scheduleDisplay || '',
        notificationSettings:
          schedule.notificationSettings || DEFAULT_NOTIFICATION_SETTINGS,
        retryConfig: schedule.retryConfig || DEFAULT_RETRY_CONFIG,
      })
    } else if (proposal) {
      setFormData({
        name: proposal.name,
        description: proposal.description || '',
        prompt: proposal.prompt,
        agentId: proposal.agentId,
        scheduleType: proposal.scheduleType,
        cronExpression: proposal.cron,
        interval: proposal.interval,
        oneTimeAt: proposal.oneTimeAt,
        timezone: proposal.timezone,
        scheduleDisplay: proposal.scheduleDisplay,
        notificationSettings:
          proposal.suggestedNotifications || DEFAULT_NOTIFICATION_SETTINGS,
        retryConfig: proposal.suggestedRetryConfig || DEFAULT_RETRY_CONFIG,
      })
    }
  }, [schedule, proposal])

  // Handle schedule picker changes
  const handleScheduleChange = (
    scheduleType: ScheduleType,
    data: {
      cronExpression?: string
      interval?: IntervalSpec
      oneTimeAt?: string
      timezone?: string
      scheduleDisplay?: string
    }
  ) => {
    setFormData((prev) => ({
      ...prev,
      scheduleType,
      cronExpression: data.cronExpression,
      interval: data.interval,
      oneTimeAt: data.oneTimeAt,
      timezone: data.timezone || prev.timezone,
      scheduleDisplay: data.scheduleDisplay || prev.scheduleDisplay,
    }))
  }

  // Validate form
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required'
    }

    if (!formData.prompt.trim()) {
      newErrors.prompt = 'Task prompt is required'
    }

    if (!formData.agentId) {
      newErrors.agentId = 'Please select an agent'
    }

    if (formData.scheduleType === 'cron' && !formData.cronExpression) {
      newErrors.schedule = 'Please select a schedule'
    }

    if (formData.scheduleType === 'interval' && !formData.interval) {
      newErrors.schedule = 'Please set an interval'
    }

    if (formData.scheduleType === 'one_time' && !formData.oneTimeAt) {
      newErrors.schedule = 'Please select a date and time'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Handle submit
  const handleSubmit = async () => {
    if (!validate()) {
      setActiveTab('basic')
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit(formData)
      onClose()
    } catch (error) {
      console.error('Failed to save schedule:', error)
      setErrors({
        submit:
          error instanceof Error ? error.message : 'Failed to save schedule',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const getTitle = () => {
    switch (mode) {
      case 'create':
        return 'Create Schedule'
      case 'edit':
        return 'Edit Schedule'
      case 'from-proposal':
        return 'Configure Schedule'
      default:
        return 'Schedule'
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar size={20} className="text-purple-400" />
            {getTitle()}
          </DialogTitle>
          <DialogDescription>
            {mode === 'from-proposal'
              ? 'Review and customize the proposed schedule before confirming.'
              : mode === 'edit'
                ? 'Update the schedule configuration.'
                : 'Create a new scheduled task to run automatically.'}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">Basic</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4 mt-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">
                Name <span className="text-red-400">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Daily marketing report"
              />
              {errors.name && (
                <p className="text-xs text-red-400">{errors.name}</p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Generate and analyze daily marketing metrics"
              />
            </div>

            {/* Agent selector */}
            <div className="space-y-2">
              <Label>
                Agent <span className="text-red-400">*</span>
              </Label>
              <Select
                value={formData.agentId}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, agentId: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an agent" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      <div className="flex items-center gap-2">
                        <Bot size={14} />
                        {agent.name}
                      </div>
                    </SelectItem>
                  ))}
                  {agents.length === 0 && (
                    <SelectItem value="_none" disabled>
                      No agents available
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              {errors.agentId && (
                <p className="text-xs text-red-400">{errors.agentId}</p>
              )}
            </div>

            {/* Task prompt */}
            <div className="space-y-2">
              <Label htmlFor="prompt">
                Task Prompt <span className="text-red-400">*</span>
              </Label>
              <Textarea
                id="prompt"
                value={formData.prompt}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, prompt: e.target.value }))
                }
                placeholder="Describe what the agent should do when this schedule runs..."
                rows={4}
              />
              {errors.prompt && (
                <p className="text-xs text-red-400">{errors.prompt}</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="schedule" className="space-y-4 mt-4">
            <SchedulePicker
              scheduleType={formData.scheduleType}
              cronExpression={formData.cronExpression}
              interval={formData.interval}
              oneTimeAt={formData.oneTimeAt}
              timezone={formData.timezone}
              onScheduleChange={handleScheduleChange}
            />
            {errors.schedule && (
              <p className="text-xs text-red-400">{errors.schedule}</p>
            )}

            {/* Schedule preview */}
            {formData.scheduleDisplay && (
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
                <p className="text-sm text-white/70">
                  <span className="text-white/50">Schedule:</span>{' '}
                  <span className="font-medium text-purple-300">
                    {formData.scheduleDisplay}
                  </span>
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="advanced" className="space-y-6 mt-4">
            {/* Notifications */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell size={16} className="text-white/60" />
                  <Label>Notifications</Label>
                </div>
                <Switch
                  checked={formData.notificationSettings.enabled}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({
                      ...prev,
                      notificationSettings: {
                        ...prev.notificationSettings,
                        enabled: checked,
                      },
                    }))
                  }
                />
              </div>

              {formData.notificationSettings.enabled && (
                <div className="pl-6 space-y-3">
                  <div className="space-y-2">
                    <Label className="text-sm text-white/60">Notify on</Label>
                    <div className="flex flex-wrap gap-2">
                      {(['on_start', 'on_success', 'on_failure'] as const).map(
                        (trigger) => (
                          <label
                            key={trigger}
                            className={`
                            flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer text-sm
                            ${
                              formData.notificationSettings.triggers?.includes(
                                trigger
                              )
                                ? 'border-purple-500/50 bg-purple-500/20'
                                : 'border-white/10 hover:border-white/20'
                            }
                          `}
                          >
                            <input
                              type="checkbox"
                              checked={
                                formData.notificationSettings.triggers?.includes(
                                  trigger
                                ) || false
                              }
                              onChange={(e) => {
                                const triggers =
                                  formData.notificationSettings.triggers || []
                                const newTriggers = e.target.checked
                                  ? [...triggers, trigger]
                                  : triggers.filter((t) => t !== trigger)
                                setFormData((prev) => ({
                                  ...prev,
                                  notificationSettings: {
                                    ...prev.notificationSettings,
                                    triggers: newTriggers,
                                  },
                                }))
                              }}
                              className="hidden"
                            />
                            {trigger.replace('on_', '').replace('_', ' ')}
                          </label>
                        )
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Retry configuration */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RefreshCw size={16} className="text-white/60" />
                  <Label>Auto-retry on failure</Label>
                </div>
                <Switch
                  checked={formData.retryConfig.enabled}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({
                      ...prev,
                      retryConfig: {
                        ...prev.retryConfig,
                        enabled: checked,
                      },
                    }))
                  }
                />
              </div>

              {formData.retryConfig.enabled && (
                <div className="pl-6 space-y-3">
                  <div className="space-y-2">
                    <Label className="text-sm text-white/60">Max retries</Label>
                    <Select
                      value={String(formData.retryConfig.maxRetries)}
                      onValueChange={(value) =>
                        setFormData((prev) => ({
                          ...prev,
                          retryConfig: {
                            ...prev.retryConfig,
                            maxRetries: parseInt(value),
                          },
                        }))
                      }
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n} {n === 1 ? 'retry' : 'retries'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Error display */}
        {errors.submit && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-sm">
            <AlertTriangle size={16} />
            {errors.submit}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-purple-500 hover:bg-purple-600"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save size={16} className="mr-2" />
                {mode === 'from-proposal' ? 'Confirm Schedule' : 'Save Schedule'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
