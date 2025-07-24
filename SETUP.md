# Enhanced Pixell Agent Framework Setup Guide

## 🚀 One-Command Complete Setup

The Pixell Agent Framework now includes a fully automated setup that handles everything for you:

```bash
npm run setup:complete
```

This single command will:
- ✅ Install all dependencies and build packages
- ✅ Clone the PAF Core Agent repository
- ✅ Set up Docker environment with all services
- ✅ Create 4 default environments (local, development, staging, production)
- ✅ Initialize Supabase with proper configuration
- ✅ Configure AI providers
- ✅ Start all services with health checks

## 🏗️ What Gets Set Up

### 1. Default Environments
Four environments are automatically created:

- **local** (active): Local development with Docker Compose
  - PAF Core Agent: `http://localhost:8000`
  - Supabase: `http://127.0.0.1:54321`
  - Database: `localhost:54322`

- **development**: Development with debugging enabled
  - PAF Core Agent: `http://localhost:8001`
  - Supabase: `http://127.0.0.1:54331`

- **staging**: Remote staging environment (configure your own)
- **production**: Remote production environment (configure your own)

### 2. Docker Services
All services run via Docker Compose:

| Service | Port | URL | Description |
|---------|------|-----|-------------|
| PAF Core Agent | 8000 | http://localhost:8000 | Python UPEE microservice |
| Supabase REST | 54321 | http://localhost:54321 | Database REST API |
| Supabase Studio | 54323 | http://localhost:54323 | Database admin UI |
| PostgreSQL | 54322 | localhost:54322 | Database server |
| Supabase Auth | 54324 | http://localhost:54324 | Authentication service |
| Supabase Storage | 54325 | http://localhost:54325 | File storage service |
| Supabase Realtime | 54326 | http://localhost:54326 | Real-time subscriptions |

### 3. Repository Structure
```
pixell-agent-framework/
├── paf-core-agent/          # 🆕 Auto-cloned Python microservice
├── docker-compose.yml       # 🆕 Production service orchestration
├── docker-compose.dev.yml   # 🆕 Development overrides
├── .pixell/
│   └── environments.json    # 🆕 4 default environments
└── .env.local               # Updated with service URLs
```

## 🛠️ PXUI CLI Commands

The Pixell Agent Framework includes a comprehensive CLI tool called `pxui` for managing all aspects of your development environment:

### Main Commands
```bash
pxui start                           # Start frontend + orchestrator
pxui start core-agent                # Start PAF Core Agent separately
pxui services status                 # Check all service health
pxui svc up                          # Start all services
pxui svc down                        # Stop all services
pxui env                             # Manage environments
pxui config ai                       # Configure AI providers
```

### Complete Setup
```bash
npm run setup:complete               # Full automated setup
npm run setup:complete --skip-clone # Skip PAF Core Agent cloning
npm run setup:complete --skip-docker # Skip Docker setup
```

### PAF Core Agent Management
```bash
npm run paf-core-agent:clone         # Clone repository
npm run paf-core-agent:update        # Update repository
npm run paf-core-agent:status        # Check status
npm run paf-core-agent:remove        # Remove repository

# Or use CLI directly:
pxui paf clone                       # Clone PAF Core Agent
pxui paf update                      # Update PAF Core Agent
pxui paf status                      # Check status
```

### Service Management
```bash
npm run services:start               # Start all services
npm run services:stop                # Stop all services
npm run services:restart             # Restart all services
npm run services:status              # Check service health
npm run services:logs                # View service logs

# Or use CLI directly:
pxui services start                  # Start all services
pxui svc up                          # Shorthand for start
pxui svc status                      # Check service health
pxui svc logs --follow               # Follow logs
pxui svc logs --service paf-core-agent # Specific service logs
```

### Enhanced Docker Management
```bash
npm run docker:status                # Check Docker status
npm run docker:start                 # Start Docker

# Or use CLI directly:
pxui docker status                   # Check Docker
pxui d st                            # Shorthand status
```

## 🚦 Usage Workflow

### 1. Initial Setup (One Time)
```bash
git clone https://github.com/pixell-global/pixell-agent-framework
cd pixell-agent-framework
npm run setup:complete
```

### 2. Daily Development
```bash
# Check everything is healthy
pxui services status

# Start main applications  
pxui start

# Check PAF Core Agent API
curl http://localhost:8000/api/health
open http://localhost:8000/docs
```

### 3. Service Management
```bash
# Start specific services only
pxui svc up --services paf-core-agent,supabase-db

# View logs in real-time
pxui svc logs --follow

# Scale PAF Core Agent
pxui svc scale paf-core-agent 3

# Stop everything
pxui svc down
```

## 🔧 Configuration

### Environment Variables
The setup automatically configures:

```bash
# .env.local (auto-generated)
NEXT_PUBLIC_ORCHESTRATOR_URL=http://localhost:3001
OPENAI_API_KEY=your-openai-key
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=auto-generated
```

### PAF Core Agent Configuration
```bash
# paf-core-agent/.env (auto-generated)
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
DEBUG=false
MAX_CONTEXT_TOKENS=4000
```

## 🎯 Health Checks

The setup includes comprehensive health monitoring:

```bash
# Check all services
pxui services status

# Individual service health
curl http://localhost:8000/api/health     # PAF Core Agent
curl http://localhost:54321/rest/v1/      # Supabase REST
open http://localhost:54323               # Supabase Studio
```

## 🚨 Troubleshooting

### Setup Issues
```bash
# If setup fails, retry individual steps:
npm run setup:install                # Dependencies only
pxui paf clone                        # PAF Core Agent only
pxui docker status                    # Docker check
pxui env                             # Environment management
```

### Service Issues
```bash
# Check what's running
docker-compose ps

# View service logs
pxui svc logs --service paf-core-agent

# Restart problematic services
docker-compose restart paf-core-agent

# Nuclear option - full reset
pxui svc down
docker-compose down --volumes
npm run setup:complete
```

### Port Conflicts
If ports are in use, you can modify `docker-compose.yml`:
```yaml
# Change PAF Core Agent port
paf-core-agent:
  ports:
    - "8001:8000"  # Changed from 8000:8000
```

## 🔄 Migration from Old Setup

If you have an existing installation:

1. **Backup your current setup**:
   ```bash
   cp .env.local .env.local.backup
   cp -r .pixell .pixell.backup 2>/dev/null || true
   ```

2. **Run the new setup**:
   ```bash
   npm run setup:complete
   ```

3. **Merge any custom configurations** from your backups.

## 🎉 What's New

### ✨ Enhanced Features
- **One-command setup**: Everything automated
- **Docker orchestration**: All services containerized
- **PAF Core Agent integration**: Automatically cloned and configured
- **Environment templates**: 4 pre-configured environments
- **Health monitoring**: Comprehensive service health checks
- **Service management**: Start/stop/restart/scale individual services

### 🔧 Technical Improvements
- **Docker Compose**: Full service orchestration
- **Environment management**: Structured environment configuration
- **Health checks**: Automated service monitoring
- **Development workflow**: Streamlined setup and development process

The new setup system makes Pixell Agent Framework truly production-ready with enterprise-grade service management and monitoring capabilities.