'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Activity, CheckCircle, Clock, Zap, TrendingUp, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface KPIMetric {
  id: string
  label: string
  value: number | string
  trend?: 'up' | 'down' | 'stable'
  trendValue?: number
  icon?: React.ComponentType<{ className?: string }>
  status?: 'success' | 'warning' | 'error' | 'info'
  subtitle?: string
}

interface KPIWidgetProps {
  metric: KPIMetric
  className?: string
}

const iconMap = {
  activity: Activity,
  checkCircle: CheckCircle,
  clock: Clock,
  zap: Zap,
  trendingUp: TrendingUp,
  alertTriangle: AlertTriangle,
}

const statusColors = {
  success: 'text-green-600 bg-green-50 border-green-200',
  warning: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  error: 'text-red-600 bg-red-50 border-red-200',
  info: 'text-blue-600 bg-blue-50 border-blue-200',
}

const trendColors = {
  up: 'text-green-600',
  down: 'text-red-600',
  stable: 'text-gray-600',
}

export const KPIWidget: React.FC<KPIWidgetProps> = ({ metric, className }) => {
  const IconComponent = metric.icon || Activity
  const status = metric.status || 'info'

  return (
    <Card className={cn("transition-all duration-300 hover:shadow-md", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {metric.label}
        </CardTitle>
        <IconComponent className={cn("h-4 w-4", statusColors[status].split(' ')[0])} />
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline justify-between">
          <div className="text-2xl font-bold">{metric.value}</div>
          {metric.trend && metric.trendValue && (
            <div className={cn("flex items-center text-xs", trendColors[metric.trend])}>
              <TrendingUp 
                className={cn(
                  "h-3 w-3 mr-1",
                  metric.trend === 'down' ? 'rotate-180' : '',
                  metric.trend === 'stable' ? 'rotate-90' : ''
                )} 
              />
              {metric.trendValue}%
            </div>
          )}
        </div>
        {metric.subtitle && (
          <p className="text-xs text-muted-foreground mt-1">
            {metric.subtitle}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// Pre-configured KPI widgets for common metrics
export const ActiveJobsKPI: React.FC<{ value: number; trend?: 'up' | 'down' | 'stable'; trendValue?: number }> = ({ 
  value, 
  trend, 
  trendValue 
}) => (
  <KPIWidget 
    metric={{
      id: 'active-jobs',
      label: 'Active Jobs',
      value,
      trend,
      trendValue,
      icon: Activity,
      status: value > 10 ? 'warning' : 'success',
      subtitle: `${value} jobs currently running`
    }}
  />
)

export const SuccessRateKPI: React.FC<{ value: number; trend?: 'up' | 'down' | 'stable'; trendValue?: number }> = ({ 
  value, 
  trend, 
  trendValue 
}) => (
  <KPIWidget 
    metric={{
      id: 'success-rate',
      label: 'Success Rate',
      value: `${value}%`,
      trend,
      trendValue,
      icon: CheckCircle,
      status: value >= 90 ? 'success' : value >= 70 ? 'warning' : 'error',
      subtitle: 'Job completion rate'
    }}
  />
)

export const AverageRuntimeKPI: React.FC<{ value: string; trend?: 'up' | 'down' | 'stable'; trendValue?: number }> = ({ 
  value, 
  trend, 
  trendValue 
}) => (
  <KPIWidget 
    metric={{
      id: 'avg-runtime',
      label: 'Avg Runtime',
      value,
      trend,
      trendValue,
      icon: Clock,
      status: 'info',
      subtitle: 'Average job duration'
    }}
  />
)

export const QueuedJobsKPI: React.FC<{ value: number; trend?: 'up' | 'down' | 'stable'; trendValue?: number }> = ({ 
  value, 
  trend, 
  trendValue 
}) => (
  <KPIWidget 
    metric={{
      id: 'queued-jobs',
      label: 'Queued Jobs',
      value,
      trend,
      trendValue,
      icon: Zap,
      status: value > 5 ? 'warning' : 'success',
      subtitle: `${value} jobs in queue`
    }}
  />
)