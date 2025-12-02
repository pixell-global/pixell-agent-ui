'use client'

import { useSupabase } from './use-supabase'
import { useEffect, useState } from 'react'
import type { KPIMetric } from '@/components/kpi/KPIWidget'
import type { JobData } from '@/components/kpi/JobsTable'

export interface KPIMetrics {
  activeJobs: number
  successRate: number
  averageRuntime: string
  queuedJobs: number
  totalJobsToday: number
  failedJobsToday: number
  systemUptime: string
  lastUpdated: string
}

export interface RealtimeKPIData {
  metrics: KPIMetrics
  recentJobs: JobData[]
  isLoading: boolean
  error: string | null
}

// Helper function to calculate success rate
const calculateSuccessRate = (jobs: JobData[]): number => {
  const completedJobs = jobs.filter(job => job.status === 'completed' || job.status === 'failed')
  if (completedJobs.length === 0) return 100
  
  const successfulJobs = completedJobs.filter(job => job.status === 'completed')
  return Math.round((successfulJobs.length / completedJobs.length) * 100)
}

// Helper function to calculate average runtime
const calculateAverageRuntime = (jobs: JobData[]): string => {
  const completedJobs = jobs.filter(job => 
    (job.status === 'completed' || job.status === 'failed') && job.endTime
  )
  
  if (completedJobs.length === 0) return '0m'
  
  const totalMs = completedJobs.reduce((sum, job) => {
    const start = new Date(job.startTime).getTime()
    const end = new Date(job.endTime!).getTime()
    return sum + (end - start)
  }, 0)
  
  const avgMs = totalMs / completedJobs.length
  const avgMinutes = Math.round(avgMs / (1000 * 60))
  
  if (avgMinutes >= 60) {
    const hours = Math.floor(avgMinutes / 60)
    const minutes = avgMinutes % 60
    return `${hours}h ${minutes}m`
  }
  
  return `${avgMinutes}m`
}

// Helper function to get jobs from today
const getJobsFromToday = (jobs: JobData[]): JobData[] => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  return jobs.filter(job => {
    const jobDate = new Date(job.startTime)
    return jobDate >= today
  })
}

export function useRealtimeKPI(userId?: string) {
  const { client } = useSupabase()
  const [data, setData] = useState<RealtimeKPIData>({
    metrics: {
      activeJobs: 0,
      successRate: 100,
      averageRuntime: '0m',
      queuedJobs: 0,
      totalJobsToday: 0,
      failedJobsToday: 0,
      systemUptime: '0m',
      lastUpdated: new Date().toISOString()
    },
    recentJobs: [],
    isLoading: true,
    error: null
  })

  // Transform database job to JobData
  const transformJob = (dbJob: any): JobData => ({
    id: dbJob.id,
    name: dbJob.name || 'Unnamed Job',
    description: dbJob.description,
    status: dbJob.status,
    progress: dbJob.progress || 0,
    startTime: dbJob.created_at || dbJob.start_time,
    endTime: dbJob.end_time,
    agentId: dbJob.agent_id || 'unknown',
    agentName: dbJob.agent_name || dbJob.agent_id || 'Unknown Agent',
    priority: dbJob.priority || 'medium',
    tags: dbJob.tags || [],
    error: dbJob.error_message
  })

  // Calculate metrics from jobs data
  const calculateMetrics = (jobs: JobData[]): KPIMetrics => {
    const activeJobs = jobs.filter(job => job.status === 'running').length
    const queuedJobs = jobs.filter(job => job.status === 'queued').length
    const todayJobs = getJobsFromToday(jobs)
    const failedJobsToday = todayJobs.filter(job => job.status === 'failed').length
    
    return {
      activeJobs,
      successRate: calculateSuccessRate(jobs),
      averageRuntime: calculateAverageRuntime(jobs),
      queuedJobs,
      totalJobsToday: todayJobs.length,
      failedJobsToday,
      systemUptime: '24h 15m', // This would come from a system metrics API
      lastUpdated: new Date().toISOString()
    }
  }

  useEffect(() => {
    if (!userId || userId === 'demo-user') {
      // Demo mode - generate mock data
      const mockJobs: JobData[] = [
        {
          id: 'demo-1',
          name: 'Data Processing Pipeline',
          description: 'Processing customer data batch',
          status: 'running',
          progress: 75,
          startTime: new Date(Date.now() - 30000).toISOString(),
          agentId: 'agent-1',
          agentName: 'Data Processor',
          priority: 'high',
          tags: ['data', 'pipeline']
        },
        {
          id: 'demo-2',
          name: 'Model Training',
          description: 'Training ML model on latest dataset',
          status: 'queued',
          progress: 0,
          startTime: new Date().toISOString(),
          agentId: 'agent-2',
          agentName: 'ML Trainer',
          priority: 'medium',
          tags: ['ml', 'training']
        },
        {
          id: 'demo-3',
          name: 'Report Generation',
          status: 'completed',
          progress: 100,
          startTime: new Date(Date.now() - 600000).toISOString(),
          endTime: new Date(Date.now() - 300000).toISOString(),
          agentId: 'agent-3',
          agentName: 'Report Builder',
          priority: 'low',
          tags: ['reports']
        }
      ]

      setData({
        metrics: calculateMetrics(mockJobs),
        recentJobs: mockJobs,
        isLoading: false,
        error: null
      })
      return
    }

    // Initial fetch from database
    const fetchInitialData = async () => {
      setData(prev => ({ ...prev, isLoading: true, error: null }))
      
      try {
        // Fetch jobs from core.jobs table
        const { data: jobsData, error: jobsError } = await client
          .from('jobs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50) // Get last 50 jobs for metrics calculation

        if (jobsError) {
          console.error('Error fetching jobs:', jobsError)
          throw jobsError
        }

        const jobs = (jobsData || []).map(transformJob)
        const metrics = calculateMetrics(jobs)

        setData({
          metrics,
          recentJobs: jobs.slice(0, 20), // Show last 20 jobs in table
          isLoading: false,
          error: null
        })
      } catch (error) {
        console.error('Failed to fetch KPI data:', error)
        setData(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to fetch KPI data'
        }))
      }
    }

    fetchInitialData()

    // Subscribe to real-time changes on jobs table
    const subscription = client
      .channel('tenant-jobs')
      .on('postgres_changes',
        {
          event: '*',
          schema: 'core',
          table: 'jobs'
        },
        async (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => {
          const newData = payload.new as { name?: string } | null
          const oldData = payload.old as { name?: string } | null
          console.log('KPI: Received job update:', payload.eventType, newData?.name || oldData?.name)
          
          // Refetch all data to recalculate metrics
          // In production, you might want to incrementally update instead
          await fetchInitialData()
        }
      )
      .subscribe()

    return () => {
      client.removeChannel(subscription)
    }
  }, [client, userId])

  return data
}

// Helper hook to get formatted KPI widgets
export function useKPIWidgets(kpiData: RealtimeKPIData): KPIMetric[] {
  return [
    {
      id: 'active-jobs',
      label: 'Active Jobs',
      value: kpiData.metrics.activeJobs,
      icon: 'activity' as any,
      status: kpiData.metrics.activeJobs > 10 ? 'warning' : 'success',
      subtitle: `${kpiData.metrics.activeJobs} jobs currently running`
    },
    {
      id: 'success-rate',
      label: 'Success Rate',
      value: `${kpiData.metrics.successRate}%`,
      icon: 'checkCircle' as any,
      status: kpiData.metrics.successRate >= 90 ? 'success' : 
              kpiData.metrics.successRate >= 70 ? 'warning' : 'error',
      subtitle: 'Job completion rate'
    },
    {
      id: 'avg-runtime',
      label: 'Avg Runtime',
      value: kpiData.metrics.averageRuntime,
      icon: 'clock' as any,
      status: 'info',
      subtitle: 'Average job duration'
    },
    {
      id: 'queued-jobs',
      label: 'Queued Jobs', 
      value: kpiData.metrics.queuedJobs,
      icon: 'zap' as any,
      status: kpiData.metrics.queuedJobs > 5 ? 'warning' : 'success',
      subtitle: `${kpiData.metrics.queuedJobs} jobs in queue`
    }
  ]
}