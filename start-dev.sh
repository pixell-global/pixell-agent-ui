#!/bin/bash

# Start both web app and orchestrator for development
echo "🚀 Starting Pixell Agent Framework development environment..."

# Function to cleanup background processes on exit
cleanup() {
    echo "🛑 Stopping development servers..."
    kill $WEB_PID $ORCHESTRATOR_PID 2>/dev/null
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Start orchestrator in background
echo "📡 Starting orchestrator on port 3001..."
cd apps/orchestrator && npm run dev &
ORCHESTRATOR_PID=$!

# Wait a moment for orchestrator to start
sleep 3

# Start web app in background
echo "🌐 Starting web app on port 3003..."
cd ../web && npm run dev &
WEB_PID=$!

echo ""
echo "✅ Development environment started!"
echo "   🌐 Web app: http://localhost:3003"
echo "   📡 Orchestrator: http://localhost:3001"
echo "   🔍 Health check: http://localhost:3003/api/health"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for background processes
wait
