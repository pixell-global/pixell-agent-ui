/**
 * Mock data for the Activity Pane empty state preview
 * Shows realistic examples of what activities will look like
 */

export interface MockActivityData {
  id: string
  name: string
  description?: string
  status: 'running' | 'completed' | 'failed'
  progress: number
  progressMessage?: string
  agentName: string
  timestamp: string
  duration?: string
}

export interface MockOutputData {
  id: string
  name: string
  type: 'csv' | 'excel' | 'pdf' | 'json'
  size: string
  activityName: string
}

/**
 * Mock activities showing different states
 */
export const MOCK_ACTIVITIES: MockActivityData[] = [
  {
    id: 'mock-running',
    name: 'Market Research Analysis',
    status: 'running',
    progress: 67,
    progressMessage: 'Analyzing trends...',
    agentName: 'Analytics Agent',
    timestamp: 'Started 2 min ago',
  },
  {
    id: 'mock-completed-1',
    name: 'Customer Sentiment Report',
    status: 'completed',
    progress: 100,
    agentName: 'Analytics Agent',
    timestamp: '5 min ago',
    duration: '3m 24s',
  },
  {
    id: 'mock-completed-2',
    name: 'Competitor Pricing Update',
    status: 'completed',
    progress: 100,
    agentName: 'Data Agent',
    timestamp: '12 min ago',
    duration: '1m 58s',
  },
]

/**
 * Mock output files
 */
export const MOCK_OUTPUTS: MockOutputData[] = [
  {
    id: 'mock-output-1',
    name: 'sentiment_report.pdf',
    type: 'pdf',
    size: '2.4 MB',
    activityName: 'Customer Sentiment Report',
  },
  {
    id: 'mock-output-2',
    name: 'pricing_analysis.xlsx',
    type: 'excel',
    size: '847 KB',
    activityName: 'Competitor Pricing Update',
  },
]

/**
 * Get the file icon type based on file extension
 */
export function getFileIconType(
  type: MockOutputData['type']
): 'pdf' | 'excel' | 'csv' | 'json' {
  return type
}
