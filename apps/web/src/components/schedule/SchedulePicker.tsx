'use client'

import React, { useState, useEffect } from 'react'
import { Clock, Calendar, Repeat } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { ScheduleType, IntervalSpec, IntervalUnit } from '@pixell/protocols'

interface SchedulePickerProps {
  scheduleType: ScheduleType
  cronExpression?: string
  interval?: IntervalSpec
  oneTimeAt?: string
  timezone?: string
  onScheduleChange: (
    scheduleType: ScheduleType,
    data: {
      cronExpression?: string
      interval?: IntervalSpec
      oneTimeAt?: string
      timezone?: string
      scheduleDisplay?: string
    }
  ) => void
  className?: string
}

// Common cron presets
const CRON_PRESETS = [
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every day at 9am', value: '0 9 * * *' },
  { label: 'Every weekday at 9am', value: '0 9 * * 1-5' },
  { label: 'Every Monday at 9am', value: '0 9 * * 1' },
  { label: 'Every month on the 1st', value: '0 9 1 * *' },
  { label: 'Custom', value: 'custom' },
]

// Interval unit options
const INTERVAL_UNITS: { value: IntervalUnit; label: string }[] = [
  { value: 'minutes', label: 'Minutes' },
  { value: 'hours', label: 'Hours' },
  { value: 'days', label: 'Days' },
  { value: 'weeks', label: 'Weeks' },
]

// Comprehensive timezone options - exported for use in ScheduleProposalCard
export const TIMEZONES = [
  // UTC
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },

  // Americas - North America
  { value: 'America/New_York', label: 'Eastern Time (US & Canada)' },
  { value: 'America/Chicago', label: 'Central Time (US & Canada)' },
  { value: 'America/Denver', label: 'Mountain Time (US & Canada)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (US & Canada)' },
  { value: 'America/Anchorage', label: 'Alaska' },
  { value: 'Pacific/Honolulu', label: 'Hawaii' },
  { value: 'America/Phoenix', label: 'Arizona (no DST)' },
  { value: 'America/Toronto', label: 'Toronto' },
  { value: 'America/Vancouver', label: 'Vancouver' },
  { value: 'America/Edmonton', label: 'Edmonton' },
  { value: 'America/Winnipeg', label: 'Winnipeg' },
  { value: 'America/Halifax', label: 'Atlantic Time (Canada)' },
  { value: 'America/St_Johns', label: 'Newfoundland' },

  // Americas - Mexico & Central America
  { value: 'America/Mexico_City', label: 'Mexico City' },
  { value: 'America/Tijuana', label: 'Tijuana' },
  { value: 'America/Guatemala', label: 'Guatemala' },
  { value: 'America/Costa_Rica', label: 'Costa Rica' },
  { value: 'America/Panama', label: 'Panama' },

  // Americas - South America
  { value: 'America/Bogota', label: 'Bogota' },
  { value: 'America/Lima', label: 'Lima' },
  { value: 'America/Santiago', label: 'Santiago' },
  { value: 'America/Sao_Paulo', label: 'São Paulo' },
  { value: 'America/Buenos_Aires', label: 'Buenos Aires' },
  { value: 'America/Caracas', label: 'Caracas' },

  // Europe
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Dublin', label: 'Dublin' },
  { value: 'Europe/Paris', label: 'Paris (CET)' },
  { value: 'Europe/Berlin', label: 'Berlin' },
  { value: 'Europe/Amsterdam', label: 'Amsterdam' },
  { value: 'Europe/Brussels', label: 'Brussels' },
  { value: 'Europe/Madrid', label: 'Madrid' },
  { value: 'Europe/Rome', label: 'Rome' },
  { value: 'Europe/Zurich', label: 'Zurich' },
  { value: 'Europe/Vienna', label: 'Vienna' },
  { value: 'Europe/Stockholm', label: 'Stockholm' },
  { value: 'Europe/Oslo', label: 'Oslo' },
  { value: 'Europe/Copenhagen', label: 'Copenhagen' },
  { value: 'Europe/Helsinki', label: 'Helsinki' },
  { value: 'Europe/Warsaw', label: 'Warsaw' },
  { value: 'Europe/Prague', label: 'Prague' },
  { value: 'Europe/Budapest', label: 'Budapest' },
  { value: 'Europe/Athens', label: 'Athens' },
  { value: 'Europe/Bucharest', label: 'Bucharest' },
  { value: 'Europe/Kiev', label: 'Kyiv' },
  { value: 'Europe/Moscow', label: 'Moscow' },
  { value: 'Europe/Istanbul', label: 'Istanbul' },

  // Middle East
  { value: 'Asia/Dubai', label: 'Dubai' },
  { value: 'Asia/Riyadh', label: 'Riyadh' },
  { value: 'Asia/Jerusalem', label: 'Jerusalem' },
  { value: 'Asia/Tehran', label: 'Tehran' },
  { value: 'Asia/Kuwait', label: 'Kuwait' },
  { value: 'Asia/Qatar', label: 'Doha' },

  // Africa
  { value: 'Africa/Cairo', label: 'Cairo' },
  { value: 'Africa/Johannesburg', label: 'Johannesburg' },
  { value: 'Africa/Lagos', label: 'Lagos' },
  { value: 'Africa/Nairobi', label: 'Nairobi' },
  { value: 'Africa/Casablanca', label: 'Casablanca' },

  // Asia - South Asia
  { value: 'Asia/Kolkata', label: 'India (IST)' },
  { value: 'Asia/Karachi', label: 'Karachi' },
  { value: 'Asia/Dhaka', label: 'Dhaka' },
  { value: 'Asia/Colombo', label: 'Colombo' },
  { value: 'Asia/Kathmandu', label: 'Kathmandu' },

  // Asia - Southeast Asia
  { value: 'Asia/Bangkok', label: 'Bangkok' },
  { value: 'Asia/Singapore', label: 'Singapore' },
  { value: 'Asia/Jakarta', label: 'Jakarta' },
  { value: 'Asia/Manila', label: 'Manila' },
  { value: 'Asia/Ho_Chi_Minh', label: 'Ho Chi Minh City' },
  { value: 'Asia/Kuala_Lumpur', label: 'Kuala Lumpur' },

  // Asia - East Asia
  { value: 'Asia/Hong_Kong', label: 'Hong Kong' },
  { value: 'Asia/Shanghai', label: 'China (Beijing Time)' },
  { value: 'Asia/Taipei', label: 'Taipei' },
  { value: 'Asia/Seoul', label: 'Seoul' },
  { value: 'Asia/Tokyo', label: 'Tokyo' },

  // Oceania
  { value: 'Australia/Perth', label: 'Perth' },
  { value: 'Australia/Adelaide', label: 'Adelaide' },
  { value: 'Australia/Brisbane', label: 'Brisbane' },
  { value: 'Australia/Sydney', label: 'Sydney' },
  { value: 'Australia/Melbourne', label: 'Melbourne' },
  { value: 'Pacific/Auckland', label: 'Auckland' },
  { value: 'Pacific/Fiji', label: 'Fiji' },
  { value: 'Pacific/Guam', label: 'Guam' },
]

export function SchedulePicker({
  scheduleType,
  cronExpression = '',
  interval,
  oneTimeAt,
  timezone = 'UTC',
  onScheduleChange,
  className = '',
}: SchedulePickerProps) {
  const [activeTab, setActiveTab] = useState<string>(scheduleType)
  const [selectedPreset, setSelectedPreset] = useState<string>('custom')
  const [customCron, setCustomCron] = useState(cronExpression)
  const [intervalValue, setIntervalValue] = useState(interval?.value || 1)
  const [intervalUnit, setIntervalUnit] = useState<IntervalUnit>(
    interval?.unit || 'hours'
  )
  const [selectedTimezone, setSelectedTimezone] = useState(timezone)
  const [oneTimeDate, setOneTimeDate] = useState(oneTimeAt || '')

  // Initialize preset selection based on cronExpression
  useEffect(() => {
    const preset = CRON_PRESETS.find((p) => p.value === cronExpression)
    if (preset) {
      setSelectedPreset(preset.value)
    } else if (cronExpression) {
      setSelectedPreset('custom')
      setCustomCron(cronExpression)
    }
  }, [cronExpression])

  // Handle tab change
  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    const newType = tab as ScheduleType

    if (newType === 'cron') {
      const cron = selectedPreset === 'custom' ? customCron : selectedPreset
      onScheduleChange(newType, {
        cronExpression: cron,
        timezone: selectedTimezone,
        scheduleDisplay: generateCronDisplay(cron),
      })
    } else if (newType === 'interval') {
      onScheduleChange(newType, {
        interval: { value: intervalValue, unit: intervalUnit },
        timezone: selectedTimezone,
        scheduleDisplay: generateIntervalDisplay(intervalValue, intervalUnit),
      })
    } else if (newType === 'one_time') {
      onScheduleChange(newType, {
        oneTimeAt: oneTimeDate,
        timezone: selectedTimezone,
        scheduleDisplay: generateOneTimeDisplay(oneTimeDate),
      })
    }
  }

  // Handle cron preset change
  const handlePresetChange = (preset: string) => {
    setSelectedPreset(preset)
    if (preset !== 'custom') {
      setCustomCron(preset)
      onScheduleChange('cron', {
        cronExpression: preset,
        timezone: selectedTimezone,
        scheduleDisplay: generateCronDisplay(preset),
      })
    }
  }

  // Handle custom cron change
  const handleCustomCronChange = (value: string) => {
    setCustomCron(value)
    onScheduleChange('cron', {
      cronExpression: value,
      timezone: selectedTimezone,
      scheduleDisplay: generateCronDisplay(value),
    })
  }

  // Handle interval changes
  const handleIntervalChange = (value: number, unit: IntervalUnit) => {
    setIntervalValue(value)
    setIntervalUnit(unit)
    onScheduleChange('interval', {
      interval: { value, unit },
      timezone: selectedTimezone,
      scheduleDisplay: generateIntervalDisplay(value, unit),
    })
  }

  // Handle one-time date change
  const handleOneTimeDateChange = (date: string) => {
    setOneTimeDate(date)
    onScheduleChange('one_time', {
      oneTimeAt: date,
      timezone: selectedTimezone,
      scheduleDisplay: generateOneTimeDisplay(date),
    })
  }

  // Handle timezone change
  const handleTimezoneChange = (tz: string) => {
    setSelectedTimezone(tz)
    // Trigger update with new timezone
    if (activeTab === 'cron') {
      onScheduleChange('cron', {
        cronExpression: selectedPreset === 'custom' ? customCron : selectedPreset,
        timezone: tz,
        scheduleDisplay: generateCronDisplay(
          selectedPreset === 'custom' ? customCron : selectedPreset
        ),
      })
    } else if (activeTab === 'interval') {
      onScheduleChange('interval', {
        interval: { value: intervalValue, unit: intervalUnit },
        timezone: tz,
        scheduleDisplay: generateIntervalDisplay(intervalValue, intervalUnit),
      })
    } else if (activeTab === 'one_time') {
      onScheduleChange('one_time', {
        oneTimeAt: oneTimeDate,
        timezone: tz,
        scheduleDisplay: generateOneTimeDisplay(oneTimeDate),
      })
    }
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="cron" className="flex items-center gap-1.5">
            <Repeat size={14} />
            Recurring
          </TabsTrigger>
          <TabsTrigger value="interval" className="flex items-center gap-1.5">
            <Clock size={14} />
            Interval
          </TabsTrigger>
          <TabsTrigger value="one_time" className="flex items-center gap-1.5">
            <Calendar size={14} />
            One-time
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cron" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Schedule preset</Label>
            <Select value={selectedPreset} onValueChange={handlePresetChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select a schedule" />
              </SelectTrigger>
              <SelectContent>
                {CRON_PRESETS.map((preset) => (
                  <SelectItem key={preset.value} value={preset.value}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedPreset === 'custom' && (
            <div className="space-y-2">
              <Label>Cron expression</Label>
              <Input
                value={customCron}
                onChange={(e) => handleCustomCronChange(e.target.value)}
                placeholder="0 9 * * 1-5"
                className="font-mono"
              />
              <p className="text-xs text-white/50">
                Format: minute hour day-of-month month day-of-week
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="interval" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Run every</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                min={1}
                max={999}
                value={intervalValue}
                onChange={(e) =>
                  handleIntervalChange(
                    parseInt(e.target.value) || 1,
                    intervalUnit
                  )
                }
                className="w-24"
              />
              <Select
                value={intervalUnit}
                onValueChange={(unit: IntervalUnit) =>
                  handleIntervalChange(intervalValue, unit)
                }
              >
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERVAL_UNITS.map((unit) => (
                    <SelectItem key={unit.value} value={unit.value}>
                      {unit.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="one_time" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Date and time</Label>
            <Input
              type="datetime-local"
              value={oneTimeDate ? formatDateTimeLocal(oneTimeDate) : ''}
              onChange={(e) =>
                handleOneTimeDateChange(new Date(e.target.value).toISOString())
              }
              min={formatDateTimeLocal(new Date().toISOString())}
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* Timezone selector */}
      <div className="space-y-2 pt-2 border-t border-white/10">
        <Label>Timezone</Label>
        <Select value={selectedTimezone} onValueChange={handleTimezoneChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIMEZONES.map((tz) => (
              <SelectItem key={tz.value} value={tz.value}>
                {tz.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

// Helper functions for generating display strings
function generateCronDisplay(cron: string): string {
  const preset = CRON_PRESETS.find((p) => p.value === cron)
  if (preset && preset.value !== 'custom') {
    return preset.label
  }

  // Basic cron parsing for common patterns
  const parts = cron.split(' ')
  if (parts.length !== 5) return `Custom: ${cron}`

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts

  if (hour === '*' && minute === '0') return 'Every hour'
  if (dayOfWeek === '1-5' && hour !== '*')
    return `Every weekday at ${formatHour(hour)}`
  if (dayOfWeek === '*' && dayOfMonth === '*' && month === '*' && hour !== '*')
    return `Every day at ${formatHour(hour)}`

  return `Custom: ${cron}`
}

function generateIntervalDisplay(value: number, unit: IntervalUnit): string {
  const unitLabel = value === 1 ? unit.slice(0, -1) : unit
  return `Every ${value} ${unitLabel}`
}

function generateOneTimeDisplay(dateStr: string): string {
  if (!dateStr) return 'Not set'
  const date = new Date(dateStr)
  return `Once on ${date.toLocaleDateString()} at ${date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`
}

function formatHour(hour: string): string {
  const h = parseInt(hour)
  if (isNaN(h)) return hour
  const period = h >= 12 ? 'PM' : 'AM'
  const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${displayHour}:00 ${period}`
}

function formatDateTimeLocal(isoString: string): string {
  const date = new Date(isoString)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}
