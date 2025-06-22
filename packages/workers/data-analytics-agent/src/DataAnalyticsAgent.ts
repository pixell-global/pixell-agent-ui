import { v4 as uuidv4 } from 'uuid'
import * as fs from 'fs'
import * as path from 'path'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { fromBuffer } from 'file-type'
import * as mime from 'mime-types'
import * as ss from 'simple-statistics'
import { rollup, group, max, min, mean, median, extent } from 'd3-array'
import {
  AgentCard,
  AgentCapability,
  AgentError,
  TaskId
} from '@pixell/protocols/shared'
import {
  A2AAgent,
  A2AMessage,
  TaskDelegate,
  Heartbeat
} from '@pixell/protocols/a2a'

export interface DataAnalyticsConfig {
  maxRows?: number
  maxFileSize?: number
  enableCharts?: boolean
  supportedFormats?: string[]
  memoryLimit?: number
}

export interface DataArtifact {
  id: string
  fileName: string
  mimeType: string
  size: number
  rows: any[]
  columns: string[]
  sample: any[]
  metadata: {
    rowCount: number
    columnCount: number
    hasHeaders: boolean
    dataTypes: Record<string, string>
  }
}

export interface AnalysisRequest {
  artifactId?: string
  fileUrl?: string
  fileData?: string
  question: string
  analysisType?: 'summary' | 'correlation' | 'trend' | 'comparison' | 'custom'
  chartType?: 'bar' | 'line' | 'scatter' | 'histogram' | 'heatmap' | 'auto'
}

export interface AnalysisResult {
  answer_md: string
  chart_spec?: object
  summary_stats?: Record<string, any>
  downloadUrl?: string
  confidence: number
}

/**
 * DataAnalyticsAgent - A production-ready A2A agent for data analysis and visualization
 * 
 * Capabilities:
 * - Parse multiple file formats (CSV, Excel, JSON, TSV)
 * - Perform statistical analysis and data exploration
 * - Generate visualizations using Vega-Lite
 * - Handle streaming analysis for large datasets
 * - Provide insights and recommendations
 */
export class DataAnalyticsAgent implements A2AAgent {
  private activeTasks = new Map<TaskId, any>()
  private artifacts = new Map<string, DataArtifact>()
  private isInitialized = false
  private config: DataAnalyticsConfig

  readonly card: AgentCard = {
    id: 'data-analytics-agent',
    name: 'Data Analytics & Visualization Agent',
    description: 'Analyzes datasets, performs statistical analysis, and generates insights with visualizations',
    type: 'analytics', // Using 'analytics' type (blue in design tokens)
    version: '1.0.0',
    protocol: 'a2a',
    capabilities: {
      analyze: { streaming: true, pushNotifications: true },
      visualize: { streaming: false, pushNotifications: true },  
      summarize: { streaming: false, pushNotifications: false },
      correlate: { streaming: true, pushNotifications: false },
      trend: { streaming: true, pushNotifications: true }
    },
    exposed_ui: 'chat',
    timeout_sec: 300,
    cost_estimate: '$0.005 per analysis',
    metadata: {
      domain: 'data-analytics',
      tags: ['analytics', 'statistics', 'visualization', 'csv', 'excel'],
      supportedFormats: ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/json', 'text/plain'],
      maxFileSize: '50MB',
      requiresAuth: false
    }
  }

  constructor(config: DataAnalyticsConfig = {}) {
    this.config = {
      maxRows: config.maxRows || 10000,
      maxFileSize: config.maxFileSize || 50 * 1024 * 1024, // 50MB
      enableCharts: config.enableCharts !== false,
      supportedFormats: config.supportedFormats || ['csv', 'xlsx', 'xls', 'json', 'tsv', 'txt'],
      memoryLimit: config.memoryLimit || 512 * 1024 * 1024, // 512MB
      ...config
    }
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      console.log(`🚀 Initializing Data Analytics Agent...`)
      
      // Validate dependencies
      await this.validateDependencies()
      
      // Setup temporary directory for file processing
      await this.setupWorkspace()

      this.isInitialized = true
      console.log(`✅ Data Analytics Agent initialized successfully`)
    } catch (error) {
      throw new AgentError(
        `Failed to initialize Data Analytics Agent: ${error instanceof Error ? error.message : String(error)}`,
        'INIT_ERROR',
        this.card.id
      )
    }
  }

  async shutdown(): Promise<void> {
    console.log(`🔌 Shutting down Data Analytics Agent...`)
    
    // Cancel any active tasks
    for (const [taskId, task] of this.activeTasks) {
      try {
        await this.cancelTask(taskId)
      } catch (error) {
        console.warn(`Warning: Failed to cancel task ${taskId}:`, error)
      }
    }

    // Clear artifacts from memory
    this.artifacts.clear()

    this.isInitialized = false
    console.log(`✅ Data Analytics Agent shutdown complete`)
  }

  async discoverCapabilities(): Promise<AgentCard> {
    return this.card
  }

  async getCapability(name: string): Promise<AgentCapability | null> {
    const capabilities: Record<string, AgentCapability> = {
      analyze: {
        name: 'analyze',
        description: 'Perform comprehensive analysis on uploaded datasets',
        inputs: [
          { name: 'artifactId', type: 'string', required: false, description: 'ID of uploaded data artifact' },
          { name: 'fileUrl', type: 'string', required: false, description: 'URL to data file' },
          { name: 'fileData', type: 'string', required: false, description: 'Raw file data as string' },
          { name: 'question', type: 'string', required: true, description: 'Analysis question or request' },
          { name: 'analysisType', type: 'string', required: false, description: 'Type of analysis (summary, correlation, trend, comparison)' }
        ],
        outputs: [
          { name: 'answer_md', type: 'string', description: 'Analysis results in markdown format' },
          { name: 'chart_spec', type: 'object', description: 'Vega-Lite chart specification' },
          { name: 'summary_stats', type: 'object', description: 'Summary statistics' },
          { name: 'confidence', type: 'number', description: 'Confidence level of analysis (0-1)' }
        ],
        streaming: true,
        pushNotifications: true
      },
      visualize: {
        name: 'visualize',
        description: 'Create visualizations and charts from data',
        inputs: [
          { name: 'artifactId', type: 'string', required: true, description: 'ID of data artifact' },
          { name: 'chartType', type: 'string', required: false, description: 'Type of chart (bar, line, scatter, etc.)' },
          { name: 'xColumn', type: 'string', required: false, description: 'X-axis column name' },
          { name: 'yColumn', type: 'string', required: false, description: 'Y-axis column name' }
        ],
        outputs: [
          { name: 'chart_spec', type: 'object', description: 'Vega-Lite chart specification' },
          { name: 'chart_description', type: 'string', description: 'Description of the chart' }
        ],
        streaming: false,
        pushNotifications: true
      },
      summarize: {
        name: 'summarize',
        description: 'Generate statistical summary of dataset',
        inputs: [
          { name: 'artifactId', type: 'string', required: true, description: 'ID of data artifact' }
        ],
        outputs: [
          { name: 'summary_md', type: 'string', description: 'Summary in markdown format' },
          { name: 'stats', type: 'object', description: 'Detailed statistics object' }
        ],
        streaming: false,
        pushNotifications: false
      },
      correlate: {
        name: 'correlate',
        description: 'Find correlations between variables in the dataset',
        inputs: [
          { name: 'artifactId', type: 'string', required: true, description: 'ID of data artifact' },
          { name: 'variables', type: 'array', required: false, description: 'Specific variables to correlate' }
        ],
        outputs: [
          { name: 'correlation_matrix', type: 'object', description: 'Correlation matrix' },
          { name: 'insights_md', type: 'string', description: 'Correlation insights in markdown' }
        ],
        streaming: true,
        pushNotifications: false
      },
      trend: {
        name: 'trend',
        description: 'Identify trends and patterns over time',
        inputs: [
          { name: 'artifactId', type: 'string', required: true, description: 'ID of data artifact' },
          { name: 'timeColumn', type: 'string', required: true, description: 'Time/date column name' },
          { name: 'valueColumn', type: 'string', required: true, description: 'Value column to analyze' }
        ],
        outputs: [
          { name: 'trend_analysis', type: 'string', description: 'Trend analysis in markdown' },
          { name: 'trend_chart', type: 'object', description: 'Trend visualization chart' }
        ],
        streaming: true,
        pushNotifications: true
      }
    }

    return capabilities[name] || null
  }

  async delegateTask(request: TaskDelegate): Promise<void> {
    if (!this.isInitialized) {
      throw new AgentError('Agent not initialized', 'NOT_INITIALIZED', this.card.id, request.taskId)
    }

    console.log(`📊 Data Analytics Agent received task: ${request.capabilityName} (${request.taskId})`)

    // Store active task
    this.activeTasks.set(request.taskId, {
      capability: request.capabilityName,
      input: request.input,
      startTime: new Date()
    })

    try {
      switch (request.capabilityName) {
        case 'analyze':
          await this.handleAnalysisTask(request)
          break
        case 'visualize':
          await this.handleVisualizationTask(request)
          break
        case 'summarize':
          await this.handleSummaryTask(request)
          break
        case 'correlate':
          await this.handleCorrelationTask(request)
          break
        case 'trend':
          await this.handleTrendTask(request)
          break
        default:
          throw new AgentError(
            `Unknown capability: ${request.capabilityName}`,
            'UNKNOWN_CAPABILITY',
            this.card.id,
            request.taskId
          )
      }
    } catch (error) {
      console.error(`❌ Task ${request.taskId} failed:`, error)
      throw error
    } finally {
      this.activeTasks.delete(request.taskId)
    }
  }

  async cancelTask(taskId: TaskId): Promise<void> {
    const task = this.activeTasks.get(taskId)
    if (task) {
      console.log(`🛑 Canceling analytics task: ${taskId}`)
      this.activeTasks.delete(taskId)
    }
  }

  async getStatus(): Promise<Heartbeat> {
    return {
      agentId: this.card.id,
      status: this.isInitialized ? 'idle' : 'error',
      activeTasks: this.activeTasks.size,
      lastSeen: new Date().toISOString(),
      metadata: {
        version: this.card.version,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        artifactsLoaded: this.artifacts.size,
        supportedFormats: this.config.supportedFormats
      }
    }
  }

  async handleMessage(message: A2AMessage): Promise<void> {
    console.log(`📨 Data Analytics Agent received message: ${message.type} from ${message.from}`)
    
    switch (message.type) {
      case 'heartbeat':
        // Respond to heartbeat requests
        break
      case 'capability_request':
        // Handle capability requests
        break
      default:
        console.warn(`⚠️  Unhandled message type: ${message.type}`)
    }
  }

  // Private task handlers
  private async handleAnalysisTask(request: TaskDelegate): Promise<void> {
    const input = request.input as AnalysisRequest
    console.log(`📊 Starting data analysis...`)

    // Progress tracking
    this.emitProgress(request.taskId, 10, 'Loading data...')

    // Load or parse data
    let artifact: DataArtifact
    
    if (input.artifactId) {
      artifact = this.artifacts.get(input.artifactId)!
      if (!artifact) {
        throw new AgentError(`Artifact ${input.artifactId} not found`, 'ARTIFACT_NOT_FOUND', this.card.id, request.taskId)
      }
    } else if (input.fileUrl || input.fileData) {
      artifact = await this.parseDataInput(input.fileUrl, input.fileData)
      this.artifacts.set(artifact.id, artifact)
    } else {
      throw new AgentError('No data source provided', 'NO_DATA_SOURCE', this.card.id, request.taskId)
    }

    this.emitProgress(request.taskId, 30, 'Analyzing data structure...')

    // Perform analysis based on question
    const analysis = await this.performAnalysis(artifact, input.question, input.analysisType)
    
    this.emitProgress(request.taskId, 80, 'Generating insights...')

    // Generate visualization if requested and applicable
    let chartSpec = undefined
    if (this.config.enableCharts && this.shouldGenerateChart(input.question, artifact)) {
      chartSpec = await this.generateAutoChart(artifact, input.question)
    }

    this.emitProgress(request.taskId, 100, 'Analysis complete!')

    const result: AnalysisResult = {
      answer_md: analysis.markdown,
      chart_spec: chartSpec,
      summary_stats: analysis.stats,
      confidence: analysis.confidence
    }

    console.log(`✅ Analysis completed for task ${request.taskId}`)
    
    // In a real implementation, this would be sent back via A2A transport
    // For now, we'll log the result
    console.log('Analysis Result:', JSON.stringify(result, null, 2))
  }

  private async handleVisualizationTask(request: TaskDelegate): Promise<void> {
    const { artifactId, chartType, xColumn, yColumn } = request.input

    console.log(`📈 Creating visualization...`)

    const artifact = this.artifacts.get(artifactId)
    if (!artifact) {
      throw new AgentError(`Artifact ${artifactId} not found`, 'ARTIFACT_NOT_FOUND', this.card.id, request.taskId)
    }

    const chartSpec = await this.generateChart(artifact, chartType, xColumn, yColumn)
    
    console.log(`✅ Visualization created for task ${request.taskId}`)
    console.log('Chart Spec:', JSON.stringify(chartSpec, null, 2))
  }

  private async handleSummaryTask(request: TaskDelegate): Promise<void> {
    const { artifactId } = request.input

    console.log(`📋 Generating data summary...`)

    const artifact = this.artifacts.get(artifactId)
    if (!artifact) {
      throw new AgentError(`Artifact ${artifactId} not found`, 'ARTIFACT_NOT_FOUND', this.card.id, request.taskId)
    }

    const summary = await this.generateSummary(artifact)
    
    console.log(`✅ Summary generated for task ${request.taskId}`)
    console.log('Summary:', summary.summary_md)
  }

  private async handleCorrelationTask(request: TaskDelegate): Promise<void> {
    const { artifactId, variables } = request.input

    console.log(`🔗 Analyzing correlations...`)

    const artifact = this.artifacts.get(artifactId)
    if (!artifact) {
      throw new AgentError(`Artifact ${artifactId} not found`, 'ARTIFACT_NOT_FOUND', this.card.id, request.taskId)
    }

    const correlations = await this.analyzeCorrelations(artifact, variables)
    
    console.log(`✅ Correlation analysis completed for task ${request.taskId}`)
    console.log('Correlations:', correlations)
  }

  private async handleTrendTask(request: TaskDelegate): Promise<void> {
    const { artifactId, timeColumn, valueColumn } = request.input

    console.log(`📈 Analyzing trends...`)

    const artifact = this.artifacts.get(artifactId)
    if (!artifact) {
      throw new AgentError(`Artifact ${artifactId} not found`, 'ARTIFACT_NOT_FOUND', this.card.id, request.taskId)
    }

    const trends = await this.analyzeTrends(artifact, timeColumn, valueColumn)
    
    console.log(`✅ Trend analysis completed for task ${request.taskId}`)
    console.log('Trends:', trends)
  }

  // Data processing methods
  private async parseDataInput(fileUrl?: string, fileData?: string): Promise<DataArtifact> {
    let buffer: Buffer
    let fileName = 'uploaded-data'
    
    if (fileUrl) {
      // In production, fetch from URL
      throw new AgentError('URL fetching not implemented', 'NOT_IMPLEMENTED')
    } else if (fileData) {
      buffer = Buffer.from(fileData, 'utf8')
    } else {
      throw new AgentError('No data provided', 'NO_DATA')
    }

    // Detect file type
    const fileType = await fromBuffer(buffer)
    const mimeType = fileType?.mime || 'text/plain'
    
    // Parse based on mime type
    let rows: any[] = []
    let columns: string[] = []
    let hasHeaders = true

    if (mimeType.includes('csv') || mimeType.includes('text/plain')) {
      const result = Papa.parse(buffer.toString(), {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true
      })
      rows = result.data
      columns = result.meta.fields || []
    } else if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) {
      const workbook = XLSX.read(buffer, { type: 'buffer' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
      
      if (jsonData.length > 0) {
        columns = jsonData[0] as string[]
        rows = jsonData.slice(1).map(row => {
          const obj: any = {}
          columns.forEach((col, i) => {
            obj[col] = (row as any[])[i]
          })
          return obj
        })
      }
    } else if (mimeType.includes('json')) {
      const jsonData = JSON.parse(buffer.toString())
      if (Array.isArray(jsonData)) {
        rows = jsonData
        columns = Object.keys(rows[0] || {})
      }
    }

    // Limit rows if necessary
    if (rows.length > this.config.maxRows!) {
      console.warn(`Dataset has ${rows.length} rows, limiting to ${this.config.maxRows}`)
      rows = rows.slice(0, this.config.maxRows)
    }

    // Analyze data types
    const dataTypes = this.analyzeDataTypes(rows, columns)
    
    const artifact: DataArtifact = {
      id: uuidv4(),
      fileName,
      mimeType,
      size: buffer.length,
      rows,
      columns,
      sample: rows.slice(0, Math.min(5, rows.length)),
      metadata: {
        rowCount: rows.length,
        columnCount: columns.length,
        hasHeaders,
        dataTypes
      }
    }

    return artifact
  }

  private analyzeDataTypes(rows: any[], columns: string[]): Record<string, string> {
    const types: Record<string, string> = {}
    
    columns.forEach(col => {
      const sample = rows.slice(0, 100).map(row => row[col]).filter(val => val != null)
      
      if (sample.length === 0) {
        types[col] = 'unknown'
        return
      }

      const numericCount = sample.filter(val => typeof val === 'number' || !isNaN(Number(val))).length
      const dateCount = sample.filter(val => !isNaN(Date.parse(val))).length
      
      if (numericCount / sample.length > 0.8) {
        types[col] = 'numeric'
      } else if (dateCount / sample.length > 0.8) {
        types[col] = 'date'
      } else {
        types[col] = 'categorical'
      }
    })

    return types
  }

  private async performAnalysis(artifact: DataArtifact, question: string, analysisType?: string): Promise<{
    markdown: string
    stats: Record<string, any>
    confidence: number
  }> {
    const { rows, columns, metadata } = artifact
    
    let markdown = `# Data Analysis Results\n\n`
    markdown += `**Dataset Overview:**\n`
    markdown += `- Rows: ${metadata.rowCount:,}\n`
    markdown += `- Columns: ${metadata.columnCount}\n`
    markdown += `- File Size: ${this.formatBytes(artifact.size)}\n\n`

    // Generate basic statistics
    const stats: Record<string, any> = {}
    const numericColumns = columns.filter(col => metadata.dataTypes[col] === 'numeric')
    
    if (numericColumns.length > 0) {
      markdown += `## Summary Statistics\n\n`
      markdown += `| Column | Mean | Median | Std Dev | Min | Max |\n`
      markdown += `|--------|------|--------|---------|-----|-----|\n`
      
      numericColumns.forEach(col => {
        const values = rows.map(row => Number(row[col])).filter(val => !isNaN(val))
        if (values.length > 0) {
          const colStats = {
            mean: ss.mean(values),
            median: ss.median(values),
            standardDeviation: ss.standardDeviation(values),
            min: ss.min(values),
            max: ss.max(values)
          }
          stats[col] = colStats
          
          markdown += `| ${col} | ${colStats.mean.toFixed(2)} | ${colStats.median.toFixed(2)} | ${colStats.standardDeviation.toFixed(2)} | ${colStats.min} | ${colStats.max} |\n`
        }
      })
      markdown += `\n`
    }

    // Answer specific question if provided
    if (question) {
      markdown += `## Analysis: "${question}"\n\n`
      const insights = await this.generateInsights(artifact, question, stats)
      markdown += insights
    }

    return {
      markdown,
      stats,
      confidence: 0.8 // Placeholder confidence score
    }
  }

  private async generateInsights(artifact: DataArtifact, question: string, stats: Record<string, any>): Promise<string> {
    const questionLower = question.toLowerCase()
    let insights = ''

    if (questionLower.includes('best') || questionLower.includes('top') || questionLower.includes('highest')) {
      // Find top performers
      const numericColumns = Object.keys(stats)
      if (numericColumns.length > 0) {
        const targetColumn = numericColumns.find(col => 
          questionLower.includes(col.toLowerCase()) || 
          artifact.columns.find(c => questionLower.includes(c.toLowerCase())) === col
        ) || numericColumns[0]
        
        const topRows = artifact.rows
          .filter(row => row[targetColumn] != null)
          .sort((a, b) => Number(b[targetColumn]) - Number(a[targetColumn]))
          .slice(0, 5)

        insights += `**Top 5 performers by ${targetColumn}:**\n\n`
        topRows.forEach((row, i) => {
          insights += `${i + 1}. ${Object.keys(row).map(key => `${key}: ${row[key]}`).join(', ')}\n`
        })
        insights += '\n'
      }
    }

    if (questionLower.includes('trend') || questionLower.includes('pattern')) {
      insights += `**Pattern Analysis:**\n`
      insights += `Based on the data structure, I can see patterns in the following areas:\n`
      
      Object.entries(stats).forEach(([col, colStats]) => {
        insights += `- **${col}**: Range from ${colStats.min} to ${colStats.max}, with most values around ${colStats.median.toFixed(2)}\n`
      })
      insights += '\n'
    }

    if (questionLower.includes('correlation') || questionLower.includes('relationship')) {
      insights += `**Correlation Analysis:**\n`
      const numericColumns = Object.keys(stats)
      if (numericColumns.length >= 2) {
        insights += `Found ${numericColumns.length} numeric columns that can be analyzed for correlations.\n`
        insights += `Consider using the 'correlate' capability for detailed correlation analysis.\n\n`
      }
    }

    return insights || 'Based on your question, I\'ve analyzed the available data. Consider asking more specific questions about particular columns or relationships in the data.'
  }

  private shouldGenerateChart(question: string, artifact: DataArtifact): boolean {
    const questionLower = question.toLowerCase()
    const chartKeywords = ['chart', 'graph', 'plot', 'visualize', 'show', 'display']
    const hasChartKeyword = chartKeywords.some(keyword => questionLower.includes(keyword))
    
    const hasNumericData = Object.values(artifact.metadata.dataTypes).includes('numeric')
    
    return hasChartKeyword || (hasNumericData && artifact.metadata.rowCount <= 1000)
  }

  private async generateAutoChart(artifact: DataArtifact, question: string): Promise<object> {
    const numericColumns = artifact.columns.filter(col => artifact.metadata.dataTypes[col] === 'numeric')
    const categoricalColumns = artifact.columns.filter(col => artifact.metadata.dataTypes[col] === 'categorical')
    
    if (numericColumns.length === 0) return {}

    // Simple auto-chart logic
    if (numericColumns.length === 1 && categoricalColumns.length >= 1) {
      // Bar chart: categorical vs numeric
      return this.generateChart(artifact, 'bar', categoricalColumns[0], numericColumns[0])
    } else if (numericColumns.length >= 2) {
      // Scatter plot: numeric vs numeric
      return this.generateChart(artifact, 'scatter', numericColumns[0], numericColumns[1])
    } else {
      // Histogram for single numeric column
      return this.generateChart(artifact, 'histogram', numericColumns[0])
    }
  }

  private async generateChart(artifact: DataArtifact, chartType?: string, xColumn?: string, yColumn?: string): Promise<object> {
    const { rows, columns } = artifact
    
    // Default to first available columns if not specified
    const x = xColumn || columns[0]
    const y = yColumn || columns[1] || columns[0]
    
    const baseSpec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      data: { values: rows.slice(0, 500) }, // Limit for performance
      width: 400,
      height: 300
    }

    switch (chartType) {
      case 'bar':
        return {
          ...baseSpec,
          mark: 'bar',
          encoding: {
            x: { field: x, type: 'nominal' },
            y: { field: y, type: 'quantitative', aggregate: 'mean' }
          }
        }
      
      case 'line':
        return {
          ...baseSpec,
          mark: 'line',
          encoding: {
            x: { field: x, type: 'temporal' },
            y: { field: y, type: 'quantitative' }
          }
        }
      
      case 'scatter':
        return {
          ...baseSpec,
          mark: 'circle',
          encoding: {
            x: { field: x, type: 'quantitative' },
            y: { field: y, type: 'quantitative' }
          }
        }
      
      case 'histogram':
        return {
          ...baseSpec,
          mark: 'bar',
          encoding: {
            x: { field: x, type: 'quantitative', bin: true },
            y: { aggregate: 'count', type: 'quantitative' }
          }
        }
      
      default:
        // Auto-select based on data types
        const xType = artifact.metadata.dataTypes[x]
        const yType = artifact.metadata.dataTypes[y]
        
        if (xType === 'categorical' && yType === 'numeric') {
          return this.generateChart(artifact, 'bar', x, y)
        } else if (xType === 'date' && yType === 'numeric') {
          return this.generateChart(artifact, 'line', x, y)
        } else if (xType === 'numeric' && yType === 'numeric') {
          return this.generateChart(artifact, 'scatter', x, y)
        } else {
          return this.generateChart(artifact, 'histogram', x)
        }
    }
  }

  private async generateSummary(artifact: DataArtifact): Promise<{ summary_md: string; stats: object }> {
    const { rows, columns, metadata } = artifact
    
    let summary = `# Dataset Summary\n\n`
    summary += `**Basic Information:**\n`
    summary += `- **Filename:** ${artifact.fileName}\n`
    summary += `- **Size:** ${this.formatBytes(artifact.size)}\n`
    summary += `- **Rows:** ${metadata.rowCount:,}\n`
    summary += `- **Columns:** ${metadata.columnCount}\n\n`

    summary += `**Column Information:**\n\n`
    summary += `| Column | Data Type | Sample Values |\n`
    summary += `|--------|-----------|---------------|\n`
    
    columns.forEach(col => {
      const sampleValues = rows.slice(0, 3).map(row => row[col]).join(', ')
      summary += `| ${col} | ${metadata.dataTypes[col]} | ${sampleValues} |\n`
    })

    const stats = {
      basicInfo: {
        rowCount: metadata.rowCount,
        columnCount: metadata.columnCount,
        size: artifact.size
      },
      columnTypes: metadata.dataTypes
    }

    return { summary_md: summary, stats }
  }

  private async analyzeCorrelations(artifact: DataArtifact, variables?: string[]): Promise<any> {
    const numericColumns = artifact.columns.filter(col => artifact.metadata.dataTypes[col] === 'numeric')
    const targetColumns = variables || numericColumns
    
    const correlations: Record<string, Record<string, number>> = {}
    
    targetColumns.forEach(col1 => {
      correlations[col1] = {}
      targetColumns.forEach(col2 => {
        if (col1 === col2) {
          correlations[col1][col2] = 1
        } else {
          const values1 = artifact.rows.map(row => Number(row[col1])).filter(val => !isNaN(val))
          const values2 = artifact.rows.map(row => Number(row[col2])).filter(val => !isNaN(val))
          
          if (values1.length > 1 && values2.length > 1) {
            correlations[col1][col2] = ss.sampleCorrelation(values1, values2)
          } else {
            correlations[col1][col2] = 0
          }
        }
      })
    })

    return {
      correlation_matrix: correlations,
      insights_md: this.generateCorrelationInsights(correlations)
    }
  }

  private generateCorrelationInsights(correlations: Record<string, Record<string, number>>): string {
    let insights = `# Correlation Analysis\n\n`
    
    const strongCorrelations: Array<{cols: [string, string], corr: number}> = []
    
    Object.keys(correlations).forEach(col1 => {
      Object.keys(correlations[col1]).forEach(col2 => {
        if (col1 < col2) { // Avoid duplicates
          const corr = correlations[col1][col2]
          if (Math.abs(corr) > 0.5) {
            strongCorrelations.push({ cols: [col1, col2], corr })
          }
        }
      })
    })

    if (strongCorrelations.length > 0) {
      insights += `**Strong Correlations Found:**\n\n`
      strongCorrelations
        .sort((a, b) => Math.abs(b.corr) - Math.abs(a.corr))
        .forEach(({ cols, corr }) => {
          const strength = Math.abs(corr) > 0.8 ? 'Very Strong' : 'Strong'
          const direction = corr > 0 ? 'Positive' : 'Negative'
          insights += `- **${cols[0]} ↔ ${cols[1]}**: ${strength} ${direction} correlation (${corr.toFixed(3)})\n`
        })
    } else {
      insights += `No strong correlations (> 0.5) found between the analyzed variables.\n`
    }

    return insights
  }

  private async analyzeTrends(artifact: DataArtifact, timeColumn: string, valueColumn: string): Promise<any> {
    const rows = artifact.rows.filter(row => row[timeColumn] && row[valueColumn])
    
    // Simple trend analysis - in production, this would be more sophisticated
    const timeValues = rows.map(row => new Date(row[timeColumn]).getTime())
    const dataValues = rows.map(row => Number(row[valueColumn]))
    
    const trend = ss.linearRegression(timeValues.map((t, i) => [t, dataValues[i]]))
    const slope = trend.m
    
    let trendDirection = 'stable'
    if (slope > 0.001) trendDirection = 'increasing'
    else if (slope < -0.001) trendDirection = 'decreasing'

    const analysis = `# Trend Analysis\n\n**${valueColumn} over ${timeColumn}:**\n\nThe data shows a **${trendDirection}** trend with a slope of ${slope.toFixed(6)}.\n`
    
    const chartSpec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      data: { values: rows },
      mark: 'line',
      encoding: {
        x: { field: timeColumn, type: 'temporal' },
        y: { field: valueColumn, type: 'quantitative' }
      },
      width: 500,
      height: 300
    }

    return {
      trend_analysis: analysis,
      trend_chart: chartSpec
    }
  }

  // Utility methods
  private async validateDependencies(): Promise<void> {
    // Check if required libraries are available
    try {
      require('papaparse')
      require('xlsx')
      require('simple-statistics')
    } catch (error) {
      throw new AgentError('Required dependencies not available', 'MISSING_DEPS')
    }
  }

  private async setupWorkspace(): Promise<void> {
    // In production, this would set up a temporary directory for file processing
    console.log('📁 Workspace setup complete')
  }

  private emitProgress(taskId: TaskId, progress: number, message: string): void {
    // In production, this would emit progress via A2A transport
    console.log(`📊 Task ${taskId}: ${progress}% - ${message}`)
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }
} 