import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { streamChatHandler, healthHandler, statusHandler, modelsHandler, respondHandler, clarificationsHandler, a2aStreamHandler, agentsHandler } from './api/chat';
import {
  listMemoriesHandler,
  getMemoryHandler,
  createMemoryHandler,
  updateMemoryHandler,
  deleteMemoryHandler,
  deleteAllMemoriesHandler,
  getMemoryContextHandler,
  getSettingsHandler,
  updateSettingsHandler,
  triggerExtractionHandler,
  recordUsageHandler,
} from './api/memories';
import {
  listSchedulesHandler,
  getScheduleHandler,
  createScheduleHandler,
  createFromProposalHandler,
  updateScheduleHandler,
  deleteScheduleHandler,
  approveScheduleHandler,
  pauseScheduleHandler,
  resumeScheduleHandler,
  runScheduleHandler,
  listExecutionsHandler,
  getExecutionHandler,
  cancelExecutionHandler,
  getStatsHandler,
} from './api/schedules';
import { SchedulerService } from './services/scheduler-service';
import { startExtractionProcessor } from './services/memory-extraction';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from project root .env.local
config({ path: resolve(__dirname, '../../../.env.local') });

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Create HTTP server for both Express and WebSocket
const server = createServer(app);

// Store SSE connections for real-time streaming
let sseClients: Array<{ res: express.Response; id: string }> = [];

// Connection throttling to prevent rapid reconnections
const connectionAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_CONNECTIONS_PER_IP = 5;
const THROTTLE_WINDOW = 1000; // 1 second

// Store WebSocket connections
let wsClients: Array<{ ws: any; id: string }> = [];

// Store demo state for API access
let demoTasks: any[] = [];
let demoStats = {
  agents: { total: 2, online: 2, offline: 0, byType: { keyword: 1, analytics: 1 } },
  tasks: { active: 0, total: 0, recentCompletions: 0 },
  runtime: { provider: 'aws-strand', status: 'healthy', uptime: 0 }
};

// Broadcast updates to all clients (SSE and WebSocket)
export const broadcastUpdate = (data: any) => {
  // SSE clients
  const sseMessage = `data: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(client => {
    try {
      client.res.write(sseMessage);
    } catch (error) {
      console.error('SSE write error:', error);
    }
  });
  
  // WebSocket clients
  const wsMessage = JSON.stringify({
    ...data,
    timestamp: new Date().toISOString()
  });
  wsClients.forEach(client => {
    try {
      if (client.ws.readyState === 1) { // WebSocket.OPEN
        client.ws.send(wsMessage);
      }
    } catch (error) {
      console.error('WebSocket send error:', error);
    }
  });
};

// Update stats when tasks change
const updateStats = () => {
  const now = Date.now();
  const running = demoTasks.filter(t => t.status === 'running').length;
  const succeeded = demoTasks.filter(t => t.status === 'succeeded').length;
  
  demoStats.tasks = {
    active: running,
    total: demoTasks.length,
    recentCompletions: succeeded
  };
  demoStats.runtime.uptime = Math.floor((now - startTime) / 1000);
  
  // Broadcast stats update
  broadcastUpdate({
    type: 'stats',
    data: demoStats
  });
};

const startTime = Date.now();

// Server-Sent Events endpoint for real-time updates
app.get('/stream', (req, res) => {
  // Get client IP for throttling
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  
  // Check connection throttling
  const attempts = connectionAttempts.get(clientIP) || { count: 0, lastAttempt: 0 };
  
  if (now - attempts.lastAttempt < THROTTLE_WINDOW) {
    attempts.count++;
    if (attempts.count > MAX_CONNECTIONS_PER_IP) {
      console.log(`🚨 Connection throttled for IP ${clientIP} (${attempts.count} attempts)`);
      res.status(429).json({ error: 'Too many connection attempts' });
      return;
    }
  } else {
    attempts.count = 1;
  }
  
  attempts.lastAttempt = now;
  connectionAttempts.set(clientIP, attempts);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  sseClients.push({ res, id: clientId });
  
  console.log(`📡 SSE client connected: ${clientId} (${sseClients.length} total)`);
  
  // Send initial data
  res.write(`data: ${JSON.stringify({
    type: 'connected',
    clientId,
    initialData: {
      tasks: demoTasks.slice(-10),
      stats: demoStats
    }
  })}\n\n`);

  // Handle client disconnect
  req.on('close', () => {
    sseClients = sseClients.filter(client => client.id !== clientId);
    console.log(`📡 SSE client disconnected: ${clientId} (${sseClients.length} remaining)`);
  });
});

// WebSocket server for Phase 1 integration
const wss = new WebSocketServer({ 
  server,
  path: '/ws'
});

wss.on('connection', (ws, req) => {
  const clientId = `ws_client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  wsClients.push({ ws, id: clientId });
  
  console.log(`🔌 WebSocket client connected: ${clientId} (${wsClients.length} total)`);
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connected',
    data: { clientId },
    timestamp: new Date().toISOString()
  }));
  
  // Send initial data
  ws.send(JSON.stringify({
    type: 'live_metrics',
    data: { metrics: demoStats },
    timestamp: new Date().toISOString()
  }));
  
  // Handle incoming messages
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log(`📨 WebSocket message from ${clientId}:`, message.type);
      
      // Handle different message types
      switch (message.type) {
        case 'ping':
          ws.send(JSON.stringify({
            type: 'pong',
            data: {},
            timestamp: new Date().toISOString()
          }));
          break;
          
        case 'chat_message':
          console.log(`💬 Chat message: ${message.data.message}`);
          // Echo back as an assistant response (for demo)
          setTimeout(() => {
            broadcastUpdate({
              type: 'message_token',
              data: {
                messageId: `msg_${Date.now()}`,
                token: 'Hello! This is a demo response from the orchestrator. '
              }
            });
          }, 500);
          break;
          
        case 'request_live_metrics':
          updateStats();
          ws.send(JSON.stringify({
            type: 'live_metrics',
            data: { metrics: demoStats },
            timestamp: new Date().toISOString()
          }));
          break;
          
        case 'request_task_update':
          if (message.data.taskId) {
            const task = demoTasks.find(t => t.id === message.data.taskId);
            if (task) {
              ws.send(JSON.stringify({
                type: 'task_updated',
                data: { task },
                timestamp: new Date().toISOString()
              }));
            }
          }
          break;
          
        default:
          console.warn(`Unknown WebSocket message type: ${message.type}`);
      }
    } catch (error) {
      console.error('WebSocket message parse error:', error);
    }
  });
  
  // Handle client disconnect
  ws.on('close', () => {
    wsClients = wsClients.filter(client => client.id !== clientId);
    console.log(`🔌 WebSocket client disconnected: ${clientId} (${wsClients.length} remaining)`);
  });
  
  // Handle errors
  ws.on('error', (error) => {
    console.error(`WebSocket error for ${clientId}:`, error);
    wsClients = wsClients.filter(client => client.id !== clientId);
  });
});

// API Routes
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Pixell Agent Framework Phase 2',
    phase: 'Phase 2 - Multi-Agent Orchestration',
    features: [
      'Agent Registry & Discovery',
      'Task Planning & Dependencies', 
      'Real-time Progress Tracking',
      'A2A Protocol Communication',
      'Pluggable Runtime Architecture'
    ]
  });
});

app.get('/agents', (req, res) => {
  res.json({
    agents: [
      {
        id: 'reddit-agent',
        name: 'Reddit Automation Agent',
        description: 'Automates Reddit posting, commenting, and analysis with brand voice consistency',
        type: 'keyword',
        status: 'idle',
        capabilities: ['analyze_subreddit', 'post_comment', 'monitor_keywords']
      },
      {
        id: 'analytics-agent', 
        name: 'Data Analytics Agent',
        description: 'Performs data analysis, trend identification, and metric calculation',
        type: 'analytics',
        status: 'idle',
        capabilities: ['analyze_data', 'generate_report', 'track_metrics']
      }
    ],
    stats: demoStats.agents
  });
});

app.get('/tasks', (req, res) => {
  updateStats();
  res.json({
    recentTasks: demoTasks.slice(-10), // Last 10 tasks
    activeTasks: demoStats.tasks.active,
    statusCounts: {
      running: demoTasks.filter(t => t.status === 'running').length,
      succeeded: demoTasks.filter(t => t.status === 'succeeded').length,
      failed: demoTasks.filter(t => t.status === 'failed').length,
      queued: demoTasks.filter(t => t.status === 'queued').length
    }
  });
});

app.get('/stats', (req, res) => {
  updateStats();
  res.json(demoStats);
});

// Phase 3: Chat API endpoints
app.post('/api/chat/stream', async (req, res) => {
  try {
    await streamChatHandler(req, res);
  } catch (error) {
    console.error('Chat stream error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

app.get('/api/health', async (req, res) => {
  try {
    await healthHandler(req, res);
  } catch (error) {
    // Only log if it's not a connection refused error (expected when PAF Core Agent is down)
    if (!error.message?.includes('ECONNREFUSED') && !error.message?.includes('fetch failed')) {
      console.error('Health check error:', error);
    }
    if (!res.headersSent) {
      res.status(500).json({ 
        status: 'error',
        error: 'PAF Core Agent unavailable',
        runtime: { provider: 'unknown', configured: false, connected: false }
      });
    }
  }
});

app.get('/api/chat/status', async (req, res) => {
  try {
    await statusHandler(req, res);
  } catch (error) {
    console.error('Status check error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Status check failed' });
    }
  }
});

app.get('/api/chat/models', async (req, res) => {
  try {
    await modelsHandler(req, res);
  } catch (error) {
    console.error('Models check error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Models check failed' });
    }
  }
});

// Plan Mode: Clarification response endpoint
app.post('/api/chat/respond', async (req, res) => {
  try {
    await respondHandler(req, res);
  } catch (error) {
    console.error('Respond handler error:', error);
    if (!res.headersSent) {
      res.status(500).json({ ok: false, error: 'Respond handler failed' });
    }
  }
});

// Plan Mode: Get pending clarifications status
app.get('/api/chat/clarifications', async (req, res) => {
  try {
    await clarificationsHandler(req, res);
  } catch (error) {
    console.error('Clarifications status error:', error);
    if (!res.headersSent) {
      res.status(500).json({ ok: false, error: 'Clarifications status failed' });
    }
  }
});

// A2A Protocol: Stream from external agents
app.post('/api/chat/a2a/stream', async (req, res) => {
  try {
    await a2aStreamHandler(req, res);
  } catch (error) {
    console.error('A2A stream error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'A2A stream failed' });
    }
  }
});

// Agent Configuration: Get available agents
app.get('/api/agents', async (req, res) => {
  try {
    await agentsHandler(req, res);
  } catch (error) {
    console.error('Agents handler error:', error);
    if (!res.headersSent) {
      res.status(500).json({ ok: false, error: 'Failed to get agents' });
    }
  }
});

// =========================================================================
// Memory System API Endpoints
// =========================================================================

// List memories with filters
app.get('/api/memories', async (req, res) => {
  try {
    await listMemoriesHandler(req, res);
  } catch (error) {
    console.error('List memories error:', error);
    if (!res.headersSent) {
      res.status(500).json({ ok: false, error: 'Failed to list memories' });
    }
  }
});

// Get memory context for injection
app.get('/api/memories/context', async (req, res) => {
  try {
    await getMemoryContextHandler(req, res);
  } catch (error) {
    console.error('Get memory context error:', error);
    if (!res.headersSent) {
      res.status(500).json({ ok: false, error: 'Failed to get memory context' });
    }
  }
});

// Get user memory settings
app.get('/api/memories/settings', async (req, res) => {
  try {
    await getSettingsHandler(req, res);
  } catch (error) {
    console.error('Get settings error:', error);
    if (!res.headersSent) {
      res.status(500).json({ ok: false, error: 'Failed to get settings' });
    }
  }
});

// Update user memory settings
app.patch('/api/memories/settings', async (req, res) => {
  try {
    await updateSettingsHandler(req, res);
  } catch (error) {
    console.error('Update settings error:', error);
    if (!res.headersSent) {
      res.status(500).json({ ok: false, error: 'Failed to update settings' });
    }
  }
});

// Get a single memory
app.get('/api/memories/:id', async (req, res) => {
  try {
    await getMemoryHandler(req, res);
  } catch (error) {
    console.error('Get memory error:', error);
    if (!res.headersSent) {
      res.status(500).json({ ok: false, error: 'Failed to get memory' });
    }
  }
});

// Create a new memory
app.post('/api/memories', async (req, res) => {
  try {
    await createMemoryHandler(req, res);
  } catch (error) {
    console.error('Create memory error:', error);
    if (!res.headersSent) {
      res.status(500).json({ ok: false, error: 'Failed to create memory' });
    }
  }
});

// Update a memory
app.patch('/api/memories/:id', async (req, res) => {
  try {
    await updateMemoryHandler(req, res);
  } catch (error) {
    console.error('Update memory error:', error);
    if (!res.headersSent) {
      res.status(500).json({ ok: false, error: 'Failed to update memory' });
    }
  }
});

// Delete a memory
app.delete('/api/memories/:id', async (req, res) => {
  try {
    await deleteMemoryHandler(req, res);
  } catch (error) {
    console.error('Delete memory error:', error);
    if (!res.headersSent) {
      res.status(500).json({ ok: false, error: 'Failed to delete memory' });
    }
  }
});

// Delete all memories
app.delete('/api/memories', async (req, res) => {
  try {
    await deleteAllMemoriesHandler(req, res);
  } catch (error) {
    console.error('Delete all memories error:', error);
    if (!res.headersSent) {
      res.status(500).json({ ok: false, error: 'Failed to delete memories' });
    }
  }
});

// Trigger memory extraction
app.post('/api/memories/extract', async (req, res) => {
  try {
    await triggerExtractionHandler(req, res);
  } catch (error) {
    console.error('Trigger extraction error:', error);
    if (!res.headersSent) {
      res.status(500).json({ ok: false, error: 'Failed to trigger extraction' });
    }
  }
});

// Record memory usage
app.post('/api/memories/usage', async (req, res) => {
  try {
    await recordUsageHandler(req, res);
  } catch (error) {
    console.error('Record usage error:', error);
    if (!res.headersSent) {
      res.status(500).json({ ok: false, error: 'Failed to record usage' });
    }
  }
});

// =============================================================================
// SCHEDULES API ROUTES
// =============================================================================

// Get schedule stats
app.get('/api/schedules/stats', async (req, res) => {
  try {
    await getStatsHandler(req, res);
  } catch (error) {
    console.error('Get schedule stats error:', error);
    if (!res.headersSent) {
      res.status(500).json({ ok: false, error: 'Failed to get schedule stats' });
    }
  }
});

// List schedules
app.get('/api/schedules', async (req, res) => {
  try {
    await listSchedulesHandler(req, res);
  } catch (error) {
    console.error('List schedules error:', error);
    if (!res.headersSent) {
      res.status(500).json({ ok: false, error: 'Failed to list schedules' });
    }
  }
});

// Get a schedule by ID
app.get('/api/schedules/:id', async (req, res) => {
  try {
    await getScheduleHandler(req, res);
  } catch (error) {
    console.error('Get schedule error:', error);
    if (!res.headersSent) {
      res.status(500).json({ ok: false, error: 'Failed to get schedule' });
    }
  }
});

// Create a schedule
app.post('/api/schedules', async (req, res) => {
  try {
    await createScheduleHandler(req, res);
  } catch (error) {
    console.error('Create schedule error:', error);
    if (!res.headersSent) {
      res.status(500).json({ ok: false, error: 'Failed to create schedule' });
    }
  }
});

// Create a schedule from proposal
app.post('/api/schedules/from-proposal', async (req, res) => {
  try {
    await createFromProposalHandler(req, res);
  } catch (error) {
    console.error('Create from proposal error:', error);
    if (!res.headersSent) {
      res.status(500).json({ ok: false, error: 'Failed to create schedule from proposal' });
    }
  }
});

// Update a schedule
app.patch('/api/schedules/:id', async (req, res) => {
  try {
    await updateScheduleHandler(req, res);
  } catch (error) {
    console.error('Update schedule error:', error);
    if (!res.headersSent) {
      res.status(500).json({ ok: false, error: 'Failed to update schedule' });
    }
  }
});

// Delete a schedule
app.delete('/api/schedules/:id', async (req, res) => {
  try {
    await deleteScheduleHandler(req, res);
  } catch (error) {
    console.error('Delete schedule error:', error);
    if (!res.headersSent) {
      res.status(500).json({ ok: false, error: 'Failed to delete schedule' });
    }
  }
});

// Approve a schedule
app.post('/api/schedules/:id/approve', async (req, res) => {
  try {
    await approveScheduleHandler(req, res);
  } catch (error) {
    console.error('Approve schedule error:', error);
    if (!res.headersSent) {
      res.status(500).json({ ok: false, error: 'Failed to approve schedule' });
    }
  }
});

// Pause a schedule
app.post('/api/schedules/:id/pause', async (req, res) => {
  try {
    await pauseScheduleHandler(req, res);
  } catch (error) {
    console.error('Pause schedule error:', error);
    if (!res.headersSent) {
      res.status(500).json({ ok: false, error: 'Failed to pause schedule' });
    }
  }
});

// Resume a schedule
app.post('/api/schedules/:id/resume', async (req, res) => {
  try {
    await resumeScheduleHandler(req, res);
  } catch (error) {
    console.error('Resume schedule error:', error);
    if (!res.headersSent) {
      res.status(500).json({ ok: false, error: 'Failed to resume schedule' });
    }
  }
});

// Manually run a schedule
app.post('/api/schedules/:id/run', async (req, res) => {
  try {
    await runScheduleHandler(req, res);
  } catch (error) {
    console.error('Run schedule error:', error);
    if (!res.headersSent) {
      res.status(500).json({ ok: false, error: 'Failed to run schedule' });
    }
  }
});

// List executions for a schedule
app.get('/api/schedules/:id/executions', async (req, res) => {
  try {
    await listExecutionsHandler(req, res);
  } catch (error) {
    console.error('List executions error:', error);
    if (!res.headersSent) {
      res.status(500).json({ ok: false, error: 'Failed to list executions' });
    }
  }
});

// Get an execution by ID
app.get('/api/schedules/:id/executions/:executionId', async (req, res) => {
  try {
    await getExecutionHandler(req, res);
  } catch (error) {
    console.error('Get execution error:', error);
    if (!res.headersSent) {
      res.status(500).json({ ok: false, error: 'Failed to get execution' });
    }
  }
});

// Cancel an execution
app.post('/api/schedules/:id/executions/:executionId/cancel', async (req, res) => {
  try {
    await cancelExecutionHandler(req, res);
  } catch (error) {
    console.error('Cancel execution error:', error);
    if (!res.headersSent) {
      res.status(500).json({ ok: false, error: 'Failed to cancel execution' });
    }
  }
});

// Create a simulated task with real-time progress
const createTask = (name: string, description: string, agentId: string, agentName: string) => {
  const task = {
    id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    description,
    status: 'queued',
    progress: 0,
    agentId,
    agentName,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  demoTasks.push(task);
  console.log(`📋 Created task: ${task.name} (${task.id.substring(0, 12)}...)`);
  
  // Broadcast task creation
  broadcastUpdate({
    type: 'task_created',
    data: task
  });
  
  return task;
};

// Simulate task execution with progress updates
const executeTask = async (taskId: string, duration: number = 3000) => {
  const task = demoTasks.find(t => t.id === taskId);
  if (!task) return;
  
  // Start task
  task.status = 'running';
  task.updatedAt = new Date().toISOString();
  console.log(`🚀 Starting task: ${task.name}`);
  
  // Broadcast task started
  broadcastUpdate({
    type: 'task_updated',
    data: task
  });
  
  // Progress updates
  const steps = [25, 50, 75, 100];
  const stepDuration = duration / steps.length;
  
  for (const progress of steps) {
    await new Promise(resolve => setTimeout(resolve, stepDuration));
    task.progress = progress;
    task.updatedAt = new Date().toISOString();
    console.log(`📊 ${task.agentName}: ${task.name} - ${progress}%`);
    
    // Broadcast progress update
    broadcastUpdate({
      type: 'task_updated',
      data: task
    });
    
    if (progress === 100) {
      task.status = 'succeeded';
      console.log(`✅ Completed task: ${task.name}`);
      
      // Broadcast completion
      broadcastUpdate({
        type: 'task_completed',
        data: task
      });
    }
  }
  
  // Update overall stats
  updateStats();
};

app.post('/demo/reddit', async (req, res) => {
  try {
    console.log('🧪 Running Reddit automation demo with real tasks...');
    
    // Create tasks for the Reddit workflow
    const analyzeTask = createTask(
      'analyze_subreddit',
      'Analyze r/artificial subreddit for trends and sentiment',
      'reddit-agent',
      'Reddit Automation Agent'
    );
    
    const reportTask = createTask(
      'generate_report',
      'Generate comprehensive analysis report',
      'analytics-agent',
      'Data Analytics Agent'
    );
    
    const commentTask = createTask(
      'post_comment',
      'Post strategic comment based on analysis',
      'reddit-agent',
      'Reddit Automation Agent'
    );
    
    // Respond immediately
    res.json({
      demo: 'reddit-automation',
      message: 'Analyze r/artificial subreddit and post a professional comment about AI trends',
      tasks: [analyzeTask.id, reportTask.id, commentTask.id],
      status: 'started',
      note: 'Watch the Activity Feed for real-time progress updates'
    });
    
    // Execute tasks with dependencies (async)
    executeTask(analyzeTask.id, 2500).then(() => {
      // After analysis completes, start report and comment in parallel
      executeTask(reportTask.id, 3000);
      executeTask(commentTask.id, 2000);
    });

  } catch (error: any) {
    console.error('Demo error:', error);
    res.status(500).json({ 
      error: 'Demo failed', 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

app.post('/demo/full', async (req, res) => {
  try {
    console.log('🎬 Demo functionality has been removed');
    
    res.json({
      status: 'unavailable',
      message: 'Demo functionality has been removed',
      note: 'Use the Reddit automation demo instead: POST /demo/reddit'
    });

  } catch (error: any) {
    console.error('Demo error:', error);
    res.status(500).json({ 
      error: 'Demo failed', 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

// Start the server
server.listen(port, async () => {
  console.log('')
  console.log('🎉 PIXELL AGENT FRAMEWORK - PHASE 2')
  console.log('='.repeat(50))
  console.log(`🚀 Orchestrator running on http://localhost:${port}`)

  // Initialize scheduler service with execution handler
  try {
    const schedulerService = SchedulerService.getInstance()

    // Set up execution handler that calls agents when schedules fire
    schedulerService.setExecutionHandler(async (context) => {
      const { schedule, execution, activityId } = context
      console.log(`⏰ Executing schedule: ${schedule.name} (${schedule.id})`)
      console.log(`   Agent: ${schedule.agentId}, Prompt: ${schedule.prompt.substring(0, 50)}...`)

      try {
        // Get agent configuration
        const { getAgentById } = await import('./utils/agents')
        const agent = getAgentById(schedule.agentId)

        if (!agent) {
          console.error(`⏰ Agent not found: ${schedule.agentId}`)
          return { success: false, error: `Agent not found: ${schedule.agentId}` }
        }

        console.log(`⏰ Calling agent at ${agent.url}`)

        // Create unique IDs for this execution
        const messageId = `scheduled_${execution.id}_${Date.now()}`
        const sessionId = `scheduled_session_${execution.id}`

        // Call the agent with the scheduled prompt using A2A protocol
        // Use the special "scheduled_execution" metadata flag
        const response = await fetch(agent.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'message/stream',
            id: messageId,
            params: {
              sessionId,
              message: {
                messageId,
                role: 'user',
                parts: [{ text: schedule.prompt }],
                metadata: {
                  scheduled_execution: true,  // Flag to skip clarification
                  schedule_id: schedule.id,
                  execution_id: execution.id,
                  activity_id: activityId,
                  // Pass execution plan for consistent scheduled runs
                  execution_plan: schedule.executionPlan,
                }
              },
              metadata: {
                scheduled_execution: true,
                schedule_id: schedule.id,
                // Pass execution plan for consistent scheduled runs
                execution_plan: schedule.executionPlan,
              }
            }
          }),
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error(`⏰ Agent request failed: ${response.status} ${errorText}`)
          return { success: false, error: `Agent request failed: ${response.status}` }
        }

        // Read and process the SSE stream to completion
        const reader = response.body?.getReader()
        if (!reader) {
          return { success: false, error: 'No response body' }
        }

        let resultSummary = ''
        let hasError = false
        let errorMessage = ''
        const decoder = new TextDecoder()

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))

                // Check for completion
                if (data.type === 'completed' || data.event === 'completed') {
                  resultSummary = data.data?.message || data.message || 'Completed successfully'
                  console.log(`⏰ Schedule execution completed: ${resultSummary.substring(0, 100)}`)
                }

                // Check for error
                if (data.type === 'error' || data.event === 'error') {
                  hasError = true
                  errorMessage = data.data?.message || data.message || 'Unknown error'
                  console.error(`⏰ Schedule execution error: ${errorMessage}`)
                }
              } catch (e) {
                // Not JSON, skip
              }
            }
          }
        }

        if (hasError) {
          return { success: false, error: errorMessage }
        }

        return { success: true, summary: resultSummary }

      } catch (error: any) {
        console.error(`⏰ Schedule execution error:`, error)
        return { success: false, error: error.message || 'Unknown error' }
      }
    })

    await schedulerService.start()
    console.log('⏰ Scheduler service started with execution handler')
  } catch (error) {
    console.error('⏰ Failed to start scheduler service:', error)
  }

  // Start memory extraction background processor (processes pending extraction jobs)
  try {
    startExtractionProcessor(300000) // Run every 5 minutes
    console.log('🧠 Memory extraction processor started')
  } catch (error) {
    console.error('🧠 Failed to start memory extraction processor:', error)
  }
  console.log('')
  console.log('📚 API Endpoints:')
  console.log(`   GET  /health - Health check and framework info`)
  console.log(`   GET  /agents - List registered agents`)
  console.log(`   GET  /tasks - List recent tasks and status`)
  console.log(`   GET  /stats - System statistics`)
  console.log(`   GET  /stream - SSE real-time updates`)
  console.log(`   WS   /ws - WebSocket real-time updates`)
  console.log(`   POST /demo/reddit - Run Reddit automation demo`)
  console.log('')
  console.log('🤖 Phase 3: AI Chat Endpoints (via PAF Core Agent):')
  console.log(`   POST /api/chat/stream - Stream AI responses`)
  console.log(`   GET  /api/health - PAF Core Agent health status`)
  console.log(`   GET  /api/chat/status - Detailed PAF Core Agent status`)
  console.log(`   GET  /api/chat/models - Available AI models`)
  console.log('')
  console.log('📋 Plan Mode Endpoints:')
  console.log(`   POST /api/chat/respond - Send clarification response`)
  console.log(`   GET  /api/chat/clarifications - Pending clarifications status`)
  console.log('')
  console.log('🔗 A2A Protocol Endpoints:')
  console.log(`   POST /api/chat/a2a/stream - Stream from external A2A agent`)
  console.log(`   GET  /api/agents - Get configured agents`)
  console.log('')
  console.log('🧠 Memory System Endpoints:')
  console.log(`   GET  /api/memories - List memories with filters`)
  console.log(`   POST /api/memories - Create a memory`)
  console.log(`   GET  /api/memories/:id - Get a memory`)
  console.log(`   PATCH /api/memories/:id - Update a memory`)
  console.log(`   DELETE /api/memories/:id - Delete a memory`)
  console.log(`   GET  /api/memories/context - Get memories for context injection`)
  console.log(`   GET  /api/memories/settings - Get user memory settings`)
  console.log(`   PATCH /api/memories/settings - Update memory settings`)
  console.log(`   POST /api/memories/extract - Trigger memory extraction`)
  console.log('')
  console.log('⏰ Schedule System Endpoints:')
  console.log(`   GET  /api/schedules - List schedules with filters`)
  console.log(`   POST /api/schedules - Create a schedule`)
  console.log(`   GET  /api/schedules/:id - Get a schedule`)
  console.log(`   PATCH /api/schedules/:id - Update a schedule`)
  console.log(`   DELETE /api/schedules/:id - Delete a schedule`)
  console.log(`   POST /api/schedules/from-proposal - Create from agent proposal`)
  console.log(`   POST /api/schedules/:id/approve - Approve pending schedule`)
  console.log(`   POST /api/schedules/:id/pause - Pause a schedule`)
  console.log(`   POST /api/schedules/:id/resume - Resume a schedule`)
  console.log(`   POST /api/schedules/:id/run - Trigger manual run`)
  console.log(`   GET  /api/schedules/:id/executions - List executions`)
  console.log(`   GET  /api/schedules/stats - Get schedule statistics`)
  console.log('')
  console.log('✨ New Phase 2 Features:')
  console.log('   • Multi-agent orchestration')
  console.log('   • A2A protocol communication')
  console.log('   • Task dependency management')
  console.log('   • Real-time progress tracking')
  console.log('   • Agent registry & discovery')
  console.log('   • Pluggable runtime architecture')
  console.log('')
  console.log('🧪 Try the demos:')
  console.log(`   curl -X POST http://localhost:${port}/demo/reddit`)
  console.log(`   curl -X POST http://localhost:${port}/demo/full`)
  console.log('')
}); 