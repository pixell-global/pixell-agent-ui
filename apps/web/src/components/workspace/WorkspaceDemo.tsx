'use client'
import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  useWorkspaceStore, 
  selectMessages, 
  selectAgents,
  selectLiveMetrics,
  selectActiveTasks 
} from '@/stores/workspace-store'
import type { WorkerAgentStatus } from '@/types'
import type { ChatMessage } from '@/stores/workspace-store'

// Demo component to showcase Phase 1 implementation
export const WorkspaceDemo: React.FC = () => {
  const isConnected = false
  const connectionState = 'disabled'
  
  // Using selectors for optimized subscriptions
  const messages = useWorkspaceStore(selectMessages)
  const agents = useWorkspaceStore(selectAgents)
  const liveMetrics = useWorkspaceStore(selectLiveMetrics)
  const activeTasks = useWorkspaceStore(selectActiveTasks)
  
  // Store actions
  const addMessage = useWorkspaceStore(state => state.addMessage)
  const updateAgent = useWorkspaceStore(state => state.updateAgent)
  const setLiveMetrics = useWorkspaceStore(state => state.setLiveMetrics)
  
  // Demo data functions
  const addDemoMessage = () => {
    const demoMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: 'Hello! This is a demo message from Phase 1 implementation.',
      messageType: 'text',
      createdAt: new Date().toISOString(),
      fileReferences: []
    }
    addMessage(demoMessage)
  }
  
  const addDemoAgent = () => {
    const demoAgent: WorkerAgentStatus = {
      id: crypto.randomUUID(),
      name: `Demo Agent ${agents.length + 1}`,
      type: 'custom',
      status: 'idle',
      lastActivity: new Date().toISOString(),
      capabilities: ['demo', 'testing'],
      healthScore: 95,
      load: Math.floor(Math.random() * 100),
      exposed_ui: 'activity'
    }
    updateAgent(demoAgent)
  }
  
  const updateDemoMetrics = () => {
    setLiveMetrics({
      activeAgents: agents.length,
      tasksCompleted: Math.floor(Math.random() * 100),
      tasksRunning: activeTasks.length,
      tasksQueued: Math.floor(Math.random() * 10),
      systemHealth: 'healthy',
      uptime: '2h 15m'
    })
  }
  
  const sendDemoWebSocketMessage = () => {
    console.log('WebSocket functionality removed')
  }
  
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Phase 1 Implementation Demo</h1>
        <Badge 
          variant={isConnected ? 'default' : 'destructive'}
          className="capitalize"
        >
          {connectionState}
        </Badge>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Zustand Store Demo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🏪 Zustand Store Demo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Messages: {messages.length}
              </p>
              <p className="text-sm text-muted-foreground">
                Agents: {agents.length}
              </p>
              <p className="text-sm text-muted-foreground">
                Active Tasks: {activeTasks.length}
              </p>
            </div>
            
            <div className="space-y-2">
              <Button 
                onClick={addDemoMessage}
                variant="outline"
                size="sm"
                className="w-full"
              >
                Add Demo Message
              </Button>
              <Button 
                onClick={addDemoAgent}
                variant="outline"
                size="sm"
                className="w-full"
              >
                Add Demo Agent
              </Button>
              <Button 
                onClick={updateDemoMetrics}
                variant="outline"
                size="sm"
                className="w-full"
              >
                Update Metrics
              </Button>
            </div>
          </CardContent>
        </Card>
        
        {/* WebSocket Demo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🔌 WebSocket Manager Demo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Status: {connectionState}
              </p>
              <p className="text-sm text-muted-foreground">
                Connected: {isConnected ? 'Yes' : 'No'}
              </p>
            </div>
            
            <div className="space-y-2">
              <Button 
                onClick={sendDemoWebSocketMessage}
                variant="outline"
                size="sm"
                className="w-full"
                disabled={!isConnected}
              >
                Send Test Message
              </Button>
              <Button 
                onClick={() => console.log('Metrics request disabled')}
                variant="outline"
                size="sm"
                className="w-full"
                disabled={!isConnected}
              >
                Request Metrics
              </Button>
            </div>
          </CardContent>
        </Card>
        
        {/* Live Metrics Display */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              📊 Live Metrics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {liveMetrics ? (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Active Agents:</span>
                  <span className="font-medium">{liveMetrics.activeAgents}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Tasks Done:</span>
                  <span className="font-medium">{liveMetrics.tasksCompleted}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Running:</span>
                  <span className="font-medium">{liveMetrics.tasksRunning}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Queued:</span>
                  <span className="font-medium">{liveMetrics.tasksQueued}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Health:</span>
                  <Badge 
                    variant={liveMetrics.systemHealth === 'healthy' ? 'default' : 'destructive'}
                    className="text-xs"
                  >
                    {liveMetrics.systemHealth}
                  </Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Uptime:</span>
                  <span className="font-medium">{liveMetrics.uptime}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No metrics available. Click &quot;Update Metrics&quot; to simulate data.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Recent Messages */}
      {messages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Messages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {messages.slice(-5).map((message) => (
                <div 
                  key={message.id}
                  className="p-3 bg-muted rounded-md text-sm"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">
                      {message.role}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {message.messageType}
                    </Badge>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {new Date(message.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <p>{message.content}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Agent Status */}
      {agents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Demo Agents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {agents.map((agent) => (
                <div 
                  key={agent.id}
                  className="p-3 border rounded-md"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">{agent.name}</h4>
                    <Badge 
                      variant={agent.status === 'idle' ? 'secondary' : 'default'}
                      className="text-xs"
                    >
                      {agent.status}
                    </Badge>
                  </div>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Type:</span>
                      <span>{agent.type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Health:</span>
                      <span>{agent.healthScore}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Load:</span>
                      <span>{agent.load}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
} 