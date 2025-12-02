/**
 * Comprehensive Mock Data for Pixell Agent Framework
 *
 * This file contains realistic mock data to demonstrate the capabilities
 * of the Pixell Agent Framework. Each section showcases different scenarios
 * and use cases that users might encounter.
 */

import type { FileNode } from '@/stores/workspace-store'
import type { Conversation } from '@/stores/history-store'
import type { Activity, ActivityStep, ActivityApprovalRequest } from '@/stores/workspace-store'

// ============================================================================
// FILE TREE MOCK DATA
// ============================================================================
// Demonstrates: Project organization, file types, nested folders, sizes

export const MOCK_FILE_TREE: FileNode[] = [
  {
    id: 'folder-projects',
    name: 'Projects',
    path: 'Projects',
    type: 'folder',
    lastModified: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    isExpanded: true,
    children: [
      {
        id: 'folder-ecommerce',
        name: 'E-Commerce Platform',
        path: 'Projects/E-Commerce Platform',
        type: 'folder',
        lastModified: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
        isExpanded: true,
        children: [
          {
            id: 'file-requirements',
            name: 'requirements.md',
            path: 'Projects/E-Commerce Platform/requirements.md',
            type: 'file',
            size: 15420,
            lastModified: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
          },
          {
            id: 'file-product-schema',
            name: 'product-schema.json',
            path: 'Projects/E-Commerce Platform/product-schema.json',
            type: 'file',
            size: 8234,
            lastModified: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
          },
          {
            id: 'file-api-spec',
            name: 'api-specification.yaml',
            path: 'Projects/E-Commerce Platform/api-specification.yaml',
            type: 'file',
            size: 24680,
            lastModified: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
          },
        ],
      },
      {
        id: 'folder-ml-model',
        name: 'Customer Churn Prediction',
        path: 'Projects/Customer Churn Prediction',
        type: 'folder',
        lastModified: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
        isExpanded: false,
        children: [
          {
            id: 'file-training-data',
            name: 'training_data.csv',
            path: 'Projects/Customer Churn Prediction/training_data.csv',
            type: 'file',
            size: 5242880, // 5MB
            lastModified: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
          },
          {
            id: 'file-model-notebook',
            name: 'model_training.ipynb',
            path: 'Projects/Customer Churn Prediction/model_training.ipynb',
            type: 'file',
            size: 156000,
            lastModified: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
          },
          {
            id: 'file-evaluation',
            name: 'evaluation_results.json',
            path: 'Projects/Customer Churn Prediction/evaluation_results.json',
            type: 'file',
            size: 4250,
            lastModified: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
          },
        ],
      },
    ],
  },
  {
    id: 'folder-datasets',
    name: 'Datasets',
    path: 'Datasets',
    type: 'folder',
    lastModified: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    isExpanded: true,
    children: [
      {
        id: 'file-sales-2024',
        name: 'sales_data_2024.csv',
        path: 'Datasets/sales_data_2024.csv',
        type: 'file',
        size: 12582912, // 12MB
        lastModified: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
      },
      {
        id: 'file-customer-segments',
        name: 'customer_segments.xlsx',
        path: 'Datasets/customer_segments.xlsx',
        type: 'file',
        size: 2097152, // 2MB
        lastModified: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
      },
      {
        id: 'file-product-catalog',
        name: 'product_catalog.json',
        path: 'Datasets/product_catalog.json',
        type: 'file',
        size: 524288, // 512KB
        lastModified: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
      },
    ],
  },
  {
    id: 'folder-reports',
    name: 'Reports',
    path: 'Reports',
    type: 'folder',
    lastModified: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    isExpanded: true,
    children: [
      {
        id: 'folder-weekly',
        name: 'Weekly Analysis',
        path: 'Reports/Weekly Analysis',
        type: 'folder',
        lastModified: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
        isExpanded: false,
        children: [
          {
            id: 'file-week-47',
            name: 'week_47_summary.md',
            path: 'Reports/Weekly Analysis/week_47_summary.md',
            type: 'file',
            size: 8450,
            lastModified: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
          },
          {
            id: 'file-week-46',
            name: 'week_46_summary.md',
            path: 'Reports/Weekly Analysis/week_46_summary.md',
            type: 'file',
            size: 7890,
            lastModified: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
          },
        ],
      },
      {
        id: 'file-q3-report',
        name: 'Q3_2024_Performance_Report.pdf',
        path: 'Reports/Q3_2024_Performance_Report.pdf',
        type: 'file',
        size: 3145728, // 3MB
        lastModified: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
      },
    ],
  },
  {
    id: 'folder-automation',
    name: 'Automation Scripts',
    path: 'Automation Scripts',
    type: 'folder',
    lastModified: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    isExpanded: false,
    children: [
      {
        id: 'file-data-sync',
        name: 'data_sync_pipeline.py',
        path: 'Automation Scripts/data_sync_pipeline.py',
        type: 'file',
        size: 12400,
        lastModified: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      },
      {
        id: 'file-report-gen',
        name: 'report_generator.ts',
        path: 'Automation Scripts/report_generator.ts',
        type: 'file',
        size: 8900,
        lastModified: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
      },
      {
        id: 'file-slack-notify',
        name: 'slack_notifier.js',
        path: 'Automation Scripts/slack_notifier.js',
        type: 'file',
        size: 3200,
        lastModified: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
      },
    ],
  },
  {
    id: 'file-workspace-config',
    name: 'workspace.config.json',
    path: 'workspace.config.json',
    type: 'file',
    size: 1240,
    lastModified: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString(),
  },
]

// ============================================================================
// CONVERSATION HISTORY MOCK DATA
// ============================================================================
// Demonstrates: Various AI-assisted tasks, different conversation types

const ORG_ID = 'org_demo_123'
const USER_ID = 'user_demo_456'

export const MOCK_MY_CONVERSATIONS: Conversation[] = [
  // Scenario 1: Data Analysis Session
  {
    id: 'conv-001',
    orgId: ORG_ID,
    userId: USER_ID,
    title: 'Q3 Sales Data Analysis',
    titleSource: 'user',
    isPublic: false,
    messageCount: 24,
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    lastMessagePreview: 'The analysis shows a 23% increase in revenue from the Northeast region. I\'ve generated the visualization you requested.',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    deletedAt: null,
  },
  // Scenario 2: Code Review
  {
    id: 'conv-002',
    orgId: ORG_ID,
    userId: USER_ID,
    title: 'API Authentication Refactor Review',
    titleSource: 'auto',
    isPublic: true,
    messageCount: 18,
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    lastMessagePreview: 'I\'ve identified 3 potential security vulnerabilities in the JWT implementation. Here are my recommendations for fixing them...',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    deletedAt: null,
  },
  // Scenario 3: Document Drafting
  {
    id: 'conv-003',
    orgId: ORG_ID,
    userId: USER_ID,
    title: 'Technical Specification Draft',
    titleSource: 'user',
    isPublic: false,
    messageCount: 31,
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    lastMessagePreview: 'I\'ve updated the microservices architecture section with the new service discovery patterns. The document now includes the complete deployment guide.',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    deletedAt: null,
  },
  // Scenario 4: Debugging Session
  {
    id: 'conv-004',
    orgId: ORG_ID,
    userId: USER_ID,
    title: 'Memory Leak Investigation - Payment Service',
    titleSource: 'auto',
    isPublic: false,
    messageCount: 42,
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    lastMessagePreview: 'The memory leak was caused by unclosed database connections in the retry logic. I\'ve prepared a patch that implements proper connection pooling.',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    deletedAt: null,
  },
  // Scenario 5: Content Generation
  {
    id: 'conv-005',
    orgId: ORG_ID,
    userId: USER_ID,
    title: 'Product Launch Email Campaign',
    titleSource: 'user',
    isPublic: true,
    messageCount: 15,
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    lastMessagePreview: 'Here\'s the final version of the email sequence. I\'ve included A/B testing variants for subject lines and optimized the CTAs for mobile devices.',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    deletedAt: null,
  },
  // Scenario 6: Data Pipeline Design
  {
    id: 'conv-006',
    orgId: ORG_ID,
    userId: USER_ID,
    title: 'Real-time Analytics Pipeline Architecture',
    titleSource: 'auto',
    isPublic: false,
    messageCount: 28,
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    lastMessagePreview: 'The Kafka + ClickHouse architecture will handle your 100K events/second requirement. I\'ve added the schema definitions and consumer configurations.',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    deletedAt: null,
  },
  // Scenario 7: Research Summary
  {
    id: 'conv-007',
    orgId: ORG_ID,
    userId: USER_ID,
    title: 'Competitor Analysis - AI Features',
    titleSource: 'user',
    isPublic: true,
    messageCount: 19,
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    lastMessagePreview: 'Based on my analysis, our main competitors are focusing on conversational AI and predictive analytics. Here\'s the feature comparison matrix...',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    deletedAt: null,
  },
  // Scenario 8: Test Planning
  {
    id: 'conv-008',
    orgId: ORG_ID,
    userId: USER_ID,
    title: 'E2E Test Suite for Checkout Flow',
    titleSource: 'auto',
    isPublic: false,
    messageCount: 22,
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(),
    lastMessagePreview: 'I\'ve generated 47 test cases covering all checkout scenarios including edge cases for international shipping and promo code combinations.',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(),
    deletedAt: null,
  },
]

export const MOCK_ORG_CONVERSATIONS: Conversation[] = [
  // Shared organizational conversations from team members
  {
    id: 'conv-org-001',
    orgId: ORG_ID,
    userId: 'user_team_001',
    title: 'Infrastructure Cost Optimization',
    titleSource: 'user',
    isPublic: true,
    messageCount: 35,
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    lastMessagePreview: 'By switching to reserved instances and implementing auto-scaling, we can reduce AWS costs by approximately 40%. Here\'s the detailed breakdown...',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    deletedAt: null,
  },
  {
    id: 'conv-org-002',
    orgId: ORG_ID,
    userId: 'user_team_002',
    title: 'Mobile App Performance Audit',
    titleSource: 'auto',
    isPublic: true,
    messageCount: 27,
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    lastMessagePreview: 'The main performance bottlenecks are in the image loading pipeline and Redux state management. I recommend implementing lazy loading and memoization...',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    deletedAt: null,
  },
  {
    id: 'conv-org-003',
    orgId: ORG_ID,
    userId: 'user_team_003',
    title: 'Database Migration Strategy',
    titleSource: 'user',
    isPublic: true,
    messageCount: 41,
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    lastMessagePreview: 'The blue-green deployment approach with incremental data migration will minimize downtime. I\'ve prepared the rollback procedures...',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 6).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    deletedAt: null,
  },
  {
    id: 'conv-org-004',
    orgId: ORG_ID,
    userId: 'user_team_001',
    title: 'Security Compliance Checklist - SOC2',
    titleSource: 'user',
    isPublic: true,
    messageCount: 53,
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    lastMessagePreview: 'All 78 SOC2 Type II controls have been documented. There are 5 items requiring immediate attention before the audit...',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    deletedAt: null,
  },
  {
    id: 'conv-org-005',
    orgId: ORG_ID,
    userId: 'user_team_004',
    title: 'Customer Feedback Analysis - November',
    titleSource: 'auto',
    isPublic: true,
    messageCount: 16,
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    lastMessagePreview: 'Sentiment analysis reveals 3 key themes: users love the new dashboard but are requesting better mobile support and faster search...',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 8).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    deletedAt: null,
  },
]

// ============================================================================
// ACTIVITY MOCK DATA
// ============================================================================
// Demonstrates: Various activity types, statuses, progress states, approvals

export const MOCK_ACTIVITIES: Activity[] = [
  // Activity 1: Running Data Analysis Task
  {
    id: 'act-001',
    orgId: ORG_ID,
    userId: USER_ID,
    conversationId: 'conv-001',
    agentId: 'analytics-agent',
    name: 'Q3 Revenue Analysis & Forecasting',
    description: 'Analyzing Q3 sales data to identify trends and generate revenue forecasts for Q4. Processing 2.4M transaction records.',
    activityType: 'task',
    status: 'running',
    progress: 67,
    progressMessage: 'Generating visualization charts...',
    startedAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    estimatedDurationMs: 1000 * 60 * 20, // 20 minutes
    tags: ['analytics', 'revenue', 'q3-report'],
    priority: 1,
    createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 1).toISOString(),
    steps: [
      {
        id: 'step-001-1',
        activityId: 'act-001',
        stepOrder: 1,
        name: 'Load and validate data',
        status: 'completed',
        startedAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
        completedAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
        createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
      },
      {
        id: 'step-001-2',
        activityId: 'act-001',
        stepOrder: 2,
        name: 'Calculate regional metrics',
        status: 'completed',
        startedAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
        completedAt: new Date(Date.now() - 1000 * 60 * 6).toISOString(),
        createdAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
      },
      {
        id: 'step-001-3',
        activityId: 'act-001',
        stepOrder: 3,
        name: 'Generate visualizations',
        status: 'running',
        startedAt: new Date(Date.now() - 1000 * 60 * 6).toISOString(),
        createdAt: new Date(Date.now() - 1000 * 60 * 6).toISOString(),
      },
      {
        id: 'step-001-4',
        activityId: 'act-001',
        stepOrder: 4,
        name: 'Compile final report',
        status: 'pending',
        createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
      },
    ],
  },
  // Activity 2: Pending Approval - Social Media Post
  {
    id: 'act-002',
    orgId: ORG_ID,
    userId: USER_ID,
    agentId: 'content-agent',
    name: 'Product Launch Social Campaign',
    description: 'Creating and scheduling social media posts for the new feature launch across LinkedIn, Twitter, and Instagram.',
    activityType: 'task',
    status: 'paused',
    progress: 45,
    progressMessage: 'Waiting for content approval...',
    startedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    tags: ['marketing', 'social-media', 'launch'],
    priority: 2,
    createdAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
    approvalRequests: [
      {
        id: 'approval-001',
        activityId: 'act-002',
        requestType: 'confirmation',
        title: 'Review Social Media Content',
        description: 'Please review the generated social media posts before they are scheduled for publication. This includes 3 LinkedIn posts, 5 Twitter threads, and 2 Instagram carousels.',
        status: 'pending',
        createdAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
      },
    ],
  },
  // Activity 3: Scheduled Task - Daily Report
  {
    id: 'act-003',
    orgId: ORG_ID,
    userId: USER_ID,
    agentId: 'reporting-agent',
    name: 'Daily Sales Dashboard Update',
    description: 'Automatically updates the executive dashboard with the latest sales figures, conversion rates, and regional performance.',
    activityType: 'scheduled',
    status: 'completed',
    progress: 100,
    scheduleCron: '0 6 * * *',
    scheduleNextRun: new Date(Date.now() + 1000 * 60 * 60 * 14).toISOString(),
    scheduleLastRun: new Date(Date.now() - 1000 * 60 * 60 * 10).toISOString(),
    scheduleTimezone: 'America/New_York',
    startedAt: new Date(Date.now() - 1000 * 60 * 60 * 10 - 1000 * 60 * 5).toISOString(),
    completedAt: new Date(Date.now() - 1000 * 60 * 60 * 10).toISOString(),
    actualDurationMs: 1000 * 60 * 5, // 5 minutes
    tags: ['scheduled', 'dashboard', 'daily'],
    priority: 3,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 10).toISOString(),
  },
  // Activity 4: Failed Task - API Integration
  {
    id: 'act-004',
    orgId: ORG_ID,
    userId: USER_ID,
    agentId: 'integration-agent',
    name: 'Salesforce Data Sync',
    description: 'Synchronizing customer records between our CRM and Salesforce. Processing incremental updates from the last 24 hours.',
    activityType: 'task',
    status: 'failed',
    progress: 78,
    errorMessage: 'API rate limit exceeded (429). Retry scheduled.',
    errorCode: 'RATE_LIMIT_EXCEEDED',
    startedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    completedAt: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
    actualDurationMs: 1000 * 60 * 25,
    tags: ['integration', 'salesforce', 'crm'],
    priority: 2,
    createdAt: new Date(Date.now() - 1000 * 60 * 50).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
  },
  // Activity 5: Multi-step Workflow - Onboarding
  {
    id: 'act-005',
    orgId: ORG_ID,
    userId: USER_ID,
    agentId: 'workflow-agent',
    name: 'New Employee Onboarding - Sarah Chen',
    description: 'Automated onboarding workflow: provisioning accounts, sending welcome emails, scheduling orientation, and setting up equipment.',
    activityType: 'workflow',
    status: 'running',
    progress: 60,
    progressMessage: 'Setting up development environment...',
    startedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    estimatedDurationMs: 1000 * 60 * 60 * 4, // 4 hours
    tags: ['hr', 'onboarding', 'workflow'],
    priority: 1,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2 - 1000 * 60 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    steps: [
      {
        id: 'step-005-1',
        activityId: 'act-005',
        stepOrder: 1,
        name: 'Create Google Workspace account',
        status: 'completed',
        completedAt: new Date(Date.now() - 1000 * 60 * 60 * 1.5).toISOString(),
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      },
      {
        id: 'step-005-2',
        activityId: 'act-005',
        stepOrder: 2,
        name: 'Provision Slack access',
        status: 'completed',
        completedAt: new Date(Date.now() - 1000 * 60 * 60 * 1.3).toISOString(),
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 1.5).toISOString(),
      },
      {
        id: 'step-005-3',
        activityId: 'act-005',
        stepOrder: 3,
        name: 'Setup GitHub organization access',
        status: 'completed',
        completedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 1.3).toISOString(),
      },
      {
        id: 'step-005-4',
        activityId: 'act-005',
        stepOrder: 4,
        name: 'Configure development environment',
        status: 'running',
        startedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
        createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      },
      {
        id: 'step-005-5',
        activityId: 'act-005',
        stepOrder: 5,
        name: 'Send welcome package',
        status: 'pending',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      },
      {
        id: 'step-005-6',
        activityId: 'act-005',
        stepOrder: 6,
        name: 'Schedule orientation meeting',
        status: 'pending',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      },
    ],
  },
  // Activity 6: Pending Task - Document Processing
  {
    id: 'act-006',
    orgId: ORG_ID,
    userId: USER_ID,
    agentId: 'document-agent',
    name: 'Contract Analysis - Vendor Agreement',
    description: 'Analyzing the vendor contract for key terms, obligations, and potential risks. Extracting important dates and deliverables.',
    activityType: 'task',
    status: 'pending',
    progress: 0,
    tags: ['legal', 'contracts', 'analysis'],
    priority: 2,
    createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  },
  // Activity 7: Completed Code Review
  {
    id: 'act-007',
    orgId: ORG_ID,
    userId: USER_ID,
    conversationId: 'conv-002',
    agentId: 'code-agent',
    name: 'Pull Request Review - Auth Refactor',
    description: 'Comprehensive code review of authentication module refactoring including security analysis and performance assessment.',
    activityType: 'task',
    status: 'completed',
    progress: 100,
    startedAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
    completedAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    actualDurationMs: 1000 * 60 * 60, // 1 hour
    result: {
      linesReviewed: 1247,
      issuesFound: 3,
      suggestions: 8,
      securityNotes: 2,
    },
    tags: ['code-review', 'security', 'authentication'],
    priority: 1,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4 - 1000 * 60 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
  },
  // Activity 8: Scheduled Weekly Report
  {
    id: 'act-008',
    orgId: ORG_ID,
    userId: USER_ID,
    agentId: 'reporting-agent',
    name: 'Weekly Team Performance Summary',
    description: 'Compiles team metrics including sprint velocity, code quality scores, and deployment frequency into a comprehensive weekly report.',
    activityType: 'scheduled',
    status: 'pending',
    progress: 0,
    scheduleCron: '0 9 * * 1',
    scheduleNextRun: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString(),
    scheduleLastRun: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4).toISOString(),
    scheduleTimezone: 'America/New_York',
    tags: ['scheduled', 'weekly', 'metrics'],
    priority: 3,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4).toISOString(),
  },
  // Activity 9: Permission Request - External API
  {
    id: 'act-009',
    orgId: ORG_ID,
    userId: USER_ID,
    agentId: 'integration-agent',
    name: 'LinkedIn Profile Enrichment',
    description: 'Enriching contact database with LinkedIn profile information. Requires OAuth authorization to access LinkedIn API.',
    activityType: 'task',
    status: 'paused',
    progress: 15,
    progressMessage: 'Waiting for LinkedIn OAuth authorization...',
    startedAt: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
    tags: ['enrichment', 'linkedin', 'integration'],
    priority: 3,
    createdAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    approvalRequests: [
      {
        id: 'approval-002',
        activityId: 'act-009',
        requestType: 'permission',
        title: 'LinkedIn API Access Required',
        description: 'This task requires authorization to access LinkedIn API for profile data enrichment. The following scopes are needed:',
        requiredScopes: ['r_liteprofile', 'r_emailaddress', 'w_member_social'],
        status: 'pending',
        createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 48).toISOString(),
      },
    ],
  },
  // Activity 10: Cancelled Task
  {
    id: 'act-010',
    orgId: ORG_ID,
    userId: USER_ID,
    agentId: 'analytics-agent',
    name: 'Customer Cohort Analysis (Cancelled)',
    description: 'Analysis was cancelled as the data source was migrated to a new platform.',
    activityType: 'task',
    status: 'cancelled',
    progress: 35,
    startedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    completedAt: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
    actualDurationMs: 1000 * 60 * 60 * 4,
    tags: ['analytics', 'cancelled'],
    priority: 4,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 - 1000 * 60 * 10).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
  },
  // Activity 11: Data Pipeline Workflow
  {
    id: 'act-011',
    orgId: ORG_ID,
    userId: USER_ID,
    agentId: 'etl-agent',
    name: 'ETL Pipeline - Customer 360 View',
    description: 'Multi-source data integration workflow combining CRM, support tickets, and product usage data into unified customer profiles.',
    activityType: 'workflow',
    status: 'running',
    progress: 40,
    progressMessage: 'Transforming support ticket data...',
    startedAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    estimatedDurationMs: 1000 * 60 * 60 * 3,
    tags: ['etl', 'data-pipeline', 'customer-360'],
    priority: 1,
    createdAt: new Date(Date.now() - 1000 * 60 * 95).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
    steps: [
      {
        id: 'step-011-1',
        activityId: 'act-011',
        stepOrder: 1,
        name: 'Extract CRM data',
        status: 'completed',
        completedAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
        createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
      },
      {
        id: 'step-011-2',
        activityId: 'act-011',
        stepOrder: 2,
        name: 'Transform support tickets',
        status: 'running',
        startedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
      },
      {
        id: 'step-011-3',
        activityId: 'act-011',
        stepOrder: 3,
        name: 'Extract product usage metrics',
        status: 'pending',
        createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
      },
      {
        id: 'step-011-4',
        activityId: 'act-011',
        stepOrder: 4,
        name: 'Merge and deduplicate',
        status: 'pending',
        createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
      },
      {
        id: 'step-011-5',
        activityId: 'act-011',
        stepOrder: 5,
        name: 'Load to data warehouse',
        status: 'pending',
        createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
      },
    ],
  },
  // Activity 12: Archived Completed Task
  {
    id: 'act-012',
    orgId: ORG_ID,
    userId: USER_ID,
    agentId: 'document-agent',
    name: 'Meeting Notes Summarization',
    description: 'Generated executive summary and action items from the 2-hour product roadmap meeting recording.',
    activityType: 'task',
    status: 'completed',
    progress: 100,
    startedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
    completedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7 + 1000 * 60 * 15).toISOString(),
    actualDurationMs: 1000 * 60 * 15,
    result: {
      summaryLength: 450,
      actionItems: 12,
      attendees: 8,
    },
    tags: ['meeting', 'summary', 'archived'],
    priority: 4,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7 - 1000 * 60 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    archivedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
  },
]

// ============================================================================
// ACTIVITY COUNTS
// ============================================================================

export const MOCK_ACTIVITY_COUNTS = {
  total: MOCK_ACTIVITIES.filter(a => !a.archivedAt).length,
  archived: MOCK_ACTIVITIES.filter(a => a.archivedAt).length,
  byStatus: {
    pending: MOCK_ACTIVITIES.filter(a => a.status === 'pending' && !a.archivedAt).length,
    running: MOCK_ACTIVITIES.filter(a => a.status === 'running' && !a.archivedAt).length,
    paused: MOCK_ACTIVITIES.filter(a => a.status === 'paused' && !a.archivedAt).length,
    completed: MOCK_ACTIVITIES.filter(a => a.status === 'completed' && !a.archivedAt).length,
    failed: MOCK_ACTIVITIES.filter(a => a.status === 'failed' && !a.archivedAt).length,
    cancelled: MOCK_ACTIVITIES.filter(a => a.status === 'cancelled' && !a.archivedAt).length,
  },
  byType: {
    task: MOCK_ACTIVITIES.filter(a => a.activityType === 'task' && !a.archivedAt).length,
    scheduled: MOCK_ACTIVITIES.filter(a => a.activityType === 'scheduled' && !a.archivedAt).length,
    workflow: MOCK_ACTIVITIES.filter(a => a.activityType === 'workflow' && !a.archivedAt).length,
  },
  byAgent: {
    'analytics-agent': MOCK_ACTIVITIES.filter(a => a.agentId === 'analytics-agent' && !a.archivedAt).length,
    'content-agent': MOCK_ACTIVITIES.filter(a => a.agentId === 'content-agent' && !a.archivedAt).length,
    'reporting-agent': MOCK_ACTIVITIES.filter(a => a.agentId === 'reporting-agent' && !a.archivedAt).length,
    'integration-agent': MOCK_ACTIVITIES.filter(a => a.agentId === 'integration-agent' && !a.archivedAt).length,
    'workflow-agent': MOCK_ACTIVITIES.filter(a => a.agentId === 'workflow-agent' && !a.archivedAt).length,
    'document-agent': MOCK_ACTIVITIES.filter(a => a.agentId === 'document-agent' && !a.archivedAt).length,
    'code-agent': MOCK_ACTIVITIES.filter(a => a.agentId === 'code-agent' && !a.archivedAt).length,
    'etl-agent': MOCK_ACTIVITIES.filter(a => a.agentId === 'etl-agent' && !a.archivedAt).length,
  },
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getMockActivitiesFiltered(
  filters: { status?: string[]; type?: string[]; agent?: string[]; search?: string; archived?: boolean },
  cursor?: string,
  limit = 20
): { activities: Activity[]; cursor: string | null; hasMore: boolean } {
  let filtered = [...MOCK_ACTIVITIES]

  // Filter by archived status
  if (filters.archived) {
    filtered = filtered.filter(a => a.archivedAt)
  } else {
    filtered = filtered.filter(a => !a.archivedAt)
  }

  // Filter by status
  if (filters.status && filters.status.length > 0) {
    filtered = filtered.filter(a => filters.status!.includes(a.status))
  }

  // Filter by type
  if (filters.type && filters.type.length > 0) {
    filtered = filtered.filter(a => filters.type!.includes(a.activityType))
  }

  // Filter by agent
  if (filters.agent && filters.agent.length > 0) {
    filtered = filtered.filter(a => a.agentId && filters.agent!.includes(a.agentId))
  }

  // Search
  if (filters.search) {
    const search = filters.search.toLowerCase()
    filtered = filtered.filter(
      a =>
        a.name.toLowerCase().includes(search) ||
        a.description?.toLowerCase().includes(search) ||
        a.tags?.some(t => t.toLowerCase().includes(search))
    )
  }

  // Sort by createdAt descending
  filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  // Pagination
  let startIndex = 0
  if (cursor) {
    const cursorIndex = filtered.findIndex(a => a.id === cursor)
    if (cursorIndex >= 0) {
      startIndex = cursorIndex + 1
    }
  }

  const paged = filtered.slice(startIndex, startIndex + limit)
  const hasMore = startIndex + limit < filtered.length
  const nextCursor = hasMore ? paged[paged.length - 1]?.id : null

  return {
    activities: paged,
    cursor: nextCursor,
    hasMore,
  }
}

export function getMockConversationsFiltered(
  tab: 'my-chats' | 'organization',
  search?: string,
  limit = 50,
  offset = 0
): { conversations: Conversation[]; hasMore: boolean } {
  let conversations = tab === 'my-chats' ? [...MOCK_MY_CONVERSATIONS] : [...MOCK_ORG_CONVERSATIONS]

  if (search) {
    const searchLower = search.toLowerCase()
    conversations = conversations.filter(
      c =>
        c.title?.toLowerCase().includes(searchLower) ||
        c.lastMessagePreview?.toLowerCase().includes(searchLower)
    )
  }

  // Sort by lastMessageAt descending
  conversations.sort((a, b) => {
    const dateA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0
    const dateB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0
    return dateB - dateA
  })

  const paged = conversations.slice(offset, offset + limit)
  const hasMore = offset + limit < conversations.length

  return {
    conversations: paged,
    hasMore,
  }
}
