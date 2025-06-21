# Pixell Agent Framework

A modern, scalable agent framework built with Next.js 15, React 19, and comprehensive CLI tools for agent development. This framework provides a foundation for building intelligent agent systems with real-time communication, data persistence, and powerful developer tooling.

## ⚡ Quick Start (Recommended)

Get up and running in 3 simple steps:

```bash
# 1. Clone and install
git clone <repository-url>
cd pixell-agent-framework
npm install

# 2. Setup environment and database with CLI
npm run pixell env                    # Create development environment
npm run pixell supabase-init         # Setup Supabase database

# 3. Start development
npm run dev
```

**That's it!** Visit:
- **Frontend**: http://localhost:3003
- **Backend**: http://localhost:4001  
- **Database Studio**: http://127.0.0.1:54323

## 🛠️ Pixell CLI - Your Development Assistant

The Pixell CLI is a comprehensive toolkit that provides everything you need for agent development, including Unix-like filesystem commands, environment management, and database setup.

### 📋 Available Commands

Run `npm run pixell help` to see all available commands:

#### 🏗️ Project & Environment Setup
```bash
npm run pixell create my-agent-app           # Create new agent application
npm run pixell env                           # Manage development environments
npm run pixell config-init                   # Initialize CLI configuration
npm run pixell storage-init                  # Setup file storage
```

#### 🗄️ Database & Supabase Management
```bash
npm run pixell supabase-init                 # Complete Supabase setup
npm run pixell supabase-status               # Check service status
npm run pixell supabase-migrations           # Manage database migrations
npm run pixell supabase-stop                 # Stop local services
npm run pixell supabase-reset                # Reset database (⚠️ destructive)
```

#### 📁 File System Operations (Unix-like)
```bash
# Directory operations
npm run pixell ls -la                        # List files with details
npm run pixell mkdir -p myapp/src            # Create directories
npm run pixell tree myapp/                   # Display directory structure

# File operations
npm run pixell cp -r project/ backup/       # Copy files/directories
npm run pixell mv old.txt new.txt           # Move/rename files
npm run pixell rm *.tmp                     # Remove files
npm run pixell touch README.md              # Create/update files

# File content
npm run pixell cat package.json             # Display file contents
npm run pixell head -20 logs/app.log        # Show first 20 lines
npm run pixell tail -f logs/app.log         # Follow log file
npm run pixell grep -rn "TODO" src/         # Search in files

# Search and discovery
npm run pixell find "*.ts" src/             # Find TypeScript files
npm run pixell du -sh projects/             # Check disk usage
npm run pixell stat myfile.txt              # File information
```

#### 🧩 Extensions & Workers
```bash
npm run pixell extensions-list              # List available extensions
npm run pixell extensions-install auth      # Install extensions
npm run pixell generate-worker analytics    # Generate worker agents
npm run pixell deploy --platform docker     # Deploy applications
```

#### 💡 Getting Help
```bash
npm run pixell help                         # Show all commands
npm run pixell <command> --help            # Command-specific help
```

## 🚀 Detailed Setup Guide

### Prerequisites

- **Node.js**: 18.18.0+ (Recommended: 20.x LTS)
- **npm**: 10.5.0+
- **Git**: Latest version

| Technology | Version | Notes |
|------------|---------|-------|
| Node.js | ^18.18.0 \|\| ^19.8.0 \|\| >= 20.0.0 | **Critical**: 18.16.x will NOT work |
| Next.js | 15.1.6 | Latest stable with React 19 support |
| React | 19.0.0+ | Stable version |

### Step 1: Clone and Install

```bash
git clone <repository-url>
cd pixell-agent-framework
npm install
```

### Step 2: Environment Setup with CLI

The Pixell CLI makes environment management simple:

```bash
# Create your first development environment
npm run pixell env
```

This interactive command will:
- 📋 Guide you through environment creation
- 🏠 Set up local development environment
- ☁️ Configure remote environments if needed
- 🔄 Manage environment switching
- ✅ Update your `.env.local` automatically

### Step 3: Database Setup with CLI

```bash
# Complete Supabase setup
npm run pixell supabase-init
```

This command will:
- 🗄️ Initialize local Supabase instance
- 🔗 Connect to your managed environment
- 📝 Apply database migrations
- ✅ Verify connectivity
- 🚀 Prepare for development

### Step 4: Start Development

```bash
# Start all services
npm run dev

# OR start services individually:
npm run dev:web          # Frontend only (port 3003)
npm run dev:orchestrator # Backend only (port 4001)
```

## 🌐 Service Endpoints

| Service | URL | Description |
|---------|-----|-------------|
| **Frontend** | http://localhost:3003 | Next.js application UI |
| **Backend API** | http://localhost:4001 | Orchestrator REST API |
| **API Health** | http://localhost:4001/health | Health check endpoint |
| **Database** | http://127.0.0.1:54321 | Supabase local instance |
| **DB Studio** | http://127.0.0.1:54323 | Supabase admin interface |

## 📁 Workspace File Management

The Pixell CLI includes comprehensive filesystem commands that work within your agent workspace:

### Quick File Operations
```bash
# Project setup workflow
npm run pixell mkdir -p myagent/{src,docs,tests}
npm run pixell touch myagent/README.md
npm run pixell tree myagent/

# Development workflow  
npm run pixell find "*.ts" -type f              # Find TypeScript files
npm run pixell grep -i "error" logs/            # Search for errors
npm run pixell tail -f logs/development.log     # Monitor logs
npm run pixell du -sh projects/                 # Check project sizes
```

### Safe Operations
- **Workspace isolation** - All operations contained within workspace
- **Path validation** - Prevents access outside workspace boundaries  
- **Interactive prompts** - Confirmation for destructive operations
- **Progress indicators** - Visual feedback for long operations

### Advanced Usage
```bash
# Batch operations
npm run pixell cp -r templates/ new-project/
npm run pixell find "*.js" | npm run pixell grep -l "deprecated"

# Archive operations (requires system commands)
npm run pixell zip backup.zip project/
npm run pixell unzip backup.zip restore/

# File monitoring and analysis
npm run pixell stat important-file.txt
npm run pixell head -50 logs/error.log
```

## 🌍 Environment Management

Manage multiple development environments with ease:

```bash
# Environment lifecycle
npm run pixell env                           # Interactive menu
npm run pixell config-show                   # Show current configuration
```

### Environment Types

**🏠 Local Development**
- Pre-configured for local Supabase (localhost:54321)
- Default development setup
- Perfect for testing and development

**☁️ Remote Environment**  
- Custom database connections
- Production/staging Supabase projects
- Team collaboration environments

### Environment Features

- **🔄 Active Environment Switching** - Automatically updates `.env.local`
- **🔒 Secure Configuration** - Encrypted storage of sensitive data
- **📊 Connection Testing** - Verify environment connectivity
- **⚖️ Environment Comparison** - Compare configurations across environments

## 🗄️ Database & Migration Management

Complete database lifecycle management:

```bash
# Migration workflow
npm run pixell supabase-migrations           # Interactive migration menu
npm run pixell supabase-status               # Check current status
npm run pixell supabase-migrations -- --env staging  # Target specific environment
```

### Migration Features

- **📋 Status Tracking** - View applied vs pending migrations
- **🔄 Environment-Aware** - Apply migrations to any environment
- **⚖️ Environment Comparison** - Compare migration status between environments
- **📝 Interactive Creation** - Create new migrations with descriptions

## 🛠 Development Commands

```bash
# Development workflow
npm run dev                    # Start all services
npm run build                  # Build for production
npm run lint                   # Run linting
npm run test                   # Run tests

# Specific services
npm run dev:web               # Frontend only
npm run dev:orchestrator      # Backend only

# Database management
npm run supabase:status       # Check Supabase status
npm run supabase:stop         # Stop local Supabase
```

## 📁 Project Structure

```
pixell-agent-framework/
├── apps/
│   ├── web/                    # Next.js 15 frontend
│   │   ├── src/
│   │   │   ├── app/           # App router pages
│   │   │   ├── components/    # Reusable components
│   │   │   └── lib/           # Utilities and configurations
│   │   └── package.json
│   └── orchestrator/          # Express.js backend
│       ├── src/
│       │   ├── core/          # Core agent functionality
│       │   └── index.ts       # Main server file
│       └── package.json
├── packages/
│   ├── cli/                   # Pixell CLI tools
│   ├── protocols/             # Agent communication protocols
│   ├── file-storage/          # File storage management
│   └── workers/               # Worker agent implementations
├── supabase/                  # Database schema & migrations
├── .pixell/                   # CLI configuration (auto-generated)
├── turbo.json                 # Monorepo configuration
└── package.json               # Root workspace config
```

## 🔧 Technology Stack

### Frontend
- **Next.js 15.1.6** - React framework with App Router
- **React 19** - UI library with latest features
- **TypeScript 5.7.3** - Type safety
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - Beautiful UI components
- **Zustand 5.0.3** - State management

### Backend
- **Express.js** - Web server framework
- **TypeScript** - Type-safe server development
- **WebSocket (ws)** - Real-time communication
- **AWS SDK** - Cloud integrations

### Database & Real-time
- **Supabase** - PostgreSQL with real-time subscriptions
- **TanStack Query** - Server state management

### CLI & DevOps
- **Commander.js** - CLI framework
- **Inquirer.js** - Interactive prompts
- **Chalk** - Colored terminal output
- **Turbo** - Monorepo build system

## ⚠️ Common Issues & Solutions

### Node.js Version Error
```
You are using Node.js 18.16.1. For Next.js, Node.js version "^18.18.0 || ^19.8.0 || >= 20.0.0" is required.
```

**Solution**: Update Node.js
```bash
# Using nvm
nvm install 20
nvm use 20
nvm alias default 20

# Verify version
node --version  # Should be 20.x.x
```

### CLI Command Not Found
```bash
# If npm run pixell commands fail, try:
npm install                              # Reinstall dependencies
npm run build --workspace=@pixell/cli    # Rebuild CLI
```

### Supabase Connection Issues
```bash
# Reset Supabase if connection fails
npm run pixell supabase-stop
npm run pixell supabase-reset
npm run pixell supabase-init
```

### Environment Configuration Issues
```bash
# Reset environment configuration
npm run pixell config-init
npm run pixell env                       # Recreate environments
```

## 🔍 Verification & Health Checks

### 1. CLI Health Check
```bash
npm run pixell help                      # Should show all commands
npm run pixell config-show               # Should show configuration
npm run pixell ls                        # Should list workspace files
```

### 2. Service Health Checks
```bash
# Frontend
curl http://localhost:3003               # Should return HTML

# Backend  
curl http://localhost:4001/health        # Should return JSON status

# Database
npm run pixell supabase-status           # Should show service status
```

### 3. Environment Verification
```bash
npm run pixell env                       # Should show configured environments
cat .env.local                          # Should show active environment vars
```

## 🚦 Development Status

- ✅ **Phase 0**: Package Installation & Build Verification (COMPLETE)
- ✅ **CLI Tools**: Comprehensive filesystem and environment management (COMPLETE)
- 🔄 **Phase 1**: Core Agent Implementation (READY TO START)

## 📝 Next Steps

With the enhanced CLI and setup complete, you can now:

1. **🚀 Start Building Agents** - Use the CLI to scaffold new agents
2. **📁 Manage Your Workspace** - Use filesystem commands for efficient development
3. **🌍 Configure Environments** - Set up staging and production environments
4. **🗄️ Database Development** - Create and manage migrations
5. **🧩 Extend Functionality** - Install and develop extensions

## 🎯 Pro Tips

### Efficient Development Workflow
```bash
# Morning startup routine
npm run pixell supabase-status           # Check database
npm run dev                              # Start development

# File management during development
npm run pixell find "*.ts" | head -10    # Find recent TypeScript files
npm run pixell tail -f logs/app.log      # Monitor application logs
npm run pixell tree src/ | head -20      # Quick project overview

# End of day cleanup
npm run pixell find "*.tmp" -delete      # Clean temporary files
npm run pixell supabase-stop             # Stop database
```

### Team Collaboration
```bash
# Share environment configuration
npm run pixell env                       # Export environment settings
npm run pixell supabase-migrations       # Sync database changes

# Code organization
npm run pixell mkdir -p features/{auth,dashboard,agents}
npm run pixell cp templates/ new-feature/
```

## 🤝 Contributing

1. **Setup**: Follow the Quick Start guide above
2. **CLI**: Use `npm run pixell help` to discover available tools
3. **Code Style**: Follow TypeScript best practices
4. **Testing**: Verify all services start without errors
5. **File Management**: Use CLI filesystem commands for consistency

## 📞 Support

If you encounter issues:

1. **Check CLI Help**: `npm run pixell help` and command-specific help
2. **Verify Prerequisites**: Ensure Node.js 18.18.0+ is installed
3. **Reset Environment**: Use CLI reset commands for clean state
4. **Check Service Status**: Verify all endpoints are responding

For detailed filesystem command documentation, see `packages/cli/FILESYSTEM_COMMANDS.md`.

---

**Ready to build intelligent agents with powerful CLI tools!** 🚀🛠️