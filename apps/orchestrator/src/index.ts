import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { streamChatHandler, healthHandler, statusHandler, modelsHandler } from './api/chat';
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
const broadcastUpdate = (data: any) => {
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
server.listen(port, () => {
  console.log('')
  console.log('🎉 PIXELL AGENT FRAMEWORK - PHASE 2')
  console.log('='.repeat(50))
  console.log(`🚀 Orchestrator running on http://localhost:${port}`)
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