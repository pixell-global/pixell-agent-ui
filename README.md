# Pixell Agent Framework

A modern, scalable agent framework built with Next.js 15, React 19, and Zustand for state management. This framework provides a foundation for building intelligent agent systems with real-time communication and data persistence.

## ⚡ Quick Start for Contributors

```bash
# 1. Clone the repository
git clone <repository-url>
cd pixell-agent-framework

# 2. One-command setup (installs deps + sets up Supabase)
npm run setup

# 3. Start development
npm start
# OR individually:
# npm run dev

# 4. Check Supabase status anytime
npm run supabase:status
```

**That's it!** Visit:
- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:3001  
- **Database Studio**: http://127.0.0.1:54323

## 🚀 Quick Start

### Prerequisites

- **Node.js**: 18.18.0+ (Recommended: 20.x LTS)
- **npm**: 10.5.0+
- **Git**: Latest version

### Version Requirements

| Technology | Version | Notes |
|------------|---------|-------|
| Node.js | ^18.18.0 \|\| ^19.8.0 \|\| >= 20.0.0 | **Critical**: 18.16.x will NOT work |
| Next.js | 15.1.6 | Latest stable with React 19 support |
| React | 19.0.0+ | Stable version |
| Zustand | 5.0.3+ | React 19 compatible |
| TypeScript | 5.7.3+ | Latest stable |

## 📋 Installation & Setup

### 1. Clone and Setup

```bash
git clone <repository-url>
cd pixell-agent-framework
```

### 2. Install Dependencies

```bash
# Install root dependencies
npm install

# Install web app dependencies
cd apps/web
npm install

# Install orchestrator dependencies
cd ../orchestrator
npm install

# Return to root
cd ../..
```

### 3. Start Supabase (Database)

```bash
# Initialize and start local Supabase
npx supabase start
```

This will start:
- **Database**: `http://127.0.0.1:54321`
- **Studio**: `http://127.0.0.1:54323`

### 4. Start Development Servers

#### Option A: Start All Services Together
```bash
npm run dev
```

#### Option B: Start Services Individually

**Frontend (Next.js)**:
```bash
# Terminal 1
npm run dev:web
# Runs on: http://localhost:3003
```

**Backend (Orchestrator)**:
```bash
# Terminal 2
npm run dev:orchestrator
# Runs on: http://localhost:4001
```

## 🌐 Service Endpoints

| Service | URL | Description |
|---------|-----|-------------|
| **Frontend** | http://localhost:3003 | Next.js application UI |
| **Backend API** | http://localhost:4001 | Orchestrator REST API |
| **API Health** | http://localhost:4001/health | Health check endpoint |
| **Database** | http://127.0.0.1:54321 | Supabase local instance |
| **DB Studio** | http://127.0.0.1:54323 | Supabase admin interface |

## 🛠 Development Commands

```bash
# Start all services
npm run dev

# Start specific services
npm run dev:web          # Frontend only
npm run dev:orchestrator # Backend only

# Build for production
npm run build

# Run linting
npm run lint

# Run tests
npm run test
```

## 🔧 Pixell CLI

The Pixell CLI provides developer tools for agent framework management. All commands can be run from the project root:

### Supabase Management
```bash
# Setup Supabase (local or production)
npm run supabase:init

# Check Supabase service status  
npm run supabase:status

# Stop local Supabase services
npm run supabase:stop

# Reset local database (⚠️ destructive)
npm run supabase:reset
```

### General CLI Usage
```bash
# Run any CLI command
npm run pixell -- <command> [options]

# Examples:
npm run pixell -- create my-app              # Create new app
npm run pixell -- generate-worker analytics  # Generate worker
npm run pixell -- extensions-list            # List extensions
npm run pixell -- config-show               # Show configuration
```

### CLI Help
```bash
# Show all available commands
npm run pixell -- --help

# Get help for specific command
npm run pixell -- supabase-init --help
```

### For Frequent CLI Users
If you're working heavily with the CLI, you can install it globally:
```bash
npm install -g ./packages/cli
pixell --help  # Now available globally
```

## 🛠️ CLI Tools

The Pixell CLI provides comprehensive tools for managing your agent development workflow:

### Core Commands
```bash
# Framework commands
npx pixell create my-agent-app          # Create new agent app
npx pixell generate-worker 3            # Generate 3 worker agents
npx pixell deploy --platform docker     # Deploy to production

# Extension management
npx pixell extensions-list              # List available extensions
npx pixell extensions-install auth      # Install authentication extension

# Configuration
npx pixell config-init                  # Initialize CLI configuration
npx pixell config-show                  # Show current settings
```

### 🌍 Environment Management

Manage multiple development environments (local, staging, production, etc.) with full configuration support:

```bash
# Environment management
npm run pixell env                       # Short command (recommended)
npm run environments                     # Alternative full command
npx pixell env                          # Direct CLI access (short)
npx pixell environments                  # Direct CLI access (full)

# Quick environment actions via the interactive menu:
# 📋 List All Environments - View all configured environments
# ➕ Add New Environment - Create local or remote environments
# ✏️ Edit Environment - Modify name, description, and database settings
# 🗑️ Delete Environment - Remove environments (with confirmation)
# 🔄 Switch Active Environment - Change which environment is active
# 📊 Test Environment Connection - Verify environment connectivity

# Note: Supabase settings are managed via dedicated Supabase commands
```

#### Environment Types

**🏠 Local Development**
- Automatically configured for local Supabase (localhost:54321)
- Uses default local database credentials
- Perfect for development and testing

**☁️ Remote Environment**
- Custom database host, port, credentials
- Production or staging Supabase projects
- Flexible connection configuration

#### Environment Configuration

Each environment stores:
- **Name & Description**: Custom identifiers (dev, staging, prod-v2, etc.)
- **Database Settings**: Host, port, credentials, connection strings
- **Supabase Configuration**: Project URL, anonymous keys
- **Active Status**: Which environment is currently active
- **Timestamps**: Creation and modification tracking

#### Active Environment

The active environment automatically:
- ✅ Updates your `.env.local` file with correct URLs and keys
- ✅ Used by default in migration commands
- ✅ Shown with 🟢 indicator in environment lists
- ✅ Applied to all CLI operations

#### Environment Security

🔒 **Secure by Design**:
- Passwords masked during input
- Service keys never displayed in output
- Configuration stored locally in `.pixell/environments.json`
- Connection strings properly formatted and protected

### 🗄️ Database & Migrations

Complete Supabase setup and migration management:

```bash
# Supabase setup
npm run supabase:init                   # Complete Supabase setup
npm run supabase:status                 # Check service status
npm run supabase:stop                  # Stop local services
npm run supabase:reset                 # Reset database

# Migration management
npm run supabase:migrations             # Interactive migration management
npx pixell supabase-migrations         # Alternative way to run
```

#### Migration Features

**📋 Migration Status & Tracking**
- View all migrations with timestamps and descriptions
- Check which migrations are applied vs pending
- Compare migration status between any environments
- File-system based tracking (works offline)

**🔄 Environment-Aware Operations**
- Apply migrations to any configured environment
- Automatic environment selection from your configured environments
- No more manual connection string entry
- Smart local vs remote migration handling

**⚖️ Environment Comparison**
- Compare migration status between any two environments
- Identify missing migrations and sync requirements
- Generate sync plans for environment alignment
- Visual diff showing environment discrepancies

**📝 Migration Creation**
- Interactive migration creation with descriptions
- Automatic timestamp and naming
- Integration with Supabase CLI migration tools

### Storage Setup
```bash
npm run storage:init                    # Setup file storage
npm run storage:status                  # Check storage config
```

### Quick Start for Contributors

Set up the entire development environment in 3 commands:

```bash
npm install                             # Install dependencies
npm run setup                          # Complete environment setup
npm start                              # Start development (web + orchestrator)
```

The `npm run setup` command will:
1. 🔧 Install all dependencies
2. 🗄️ Initialize Supabase (with options for local/production)
3. 🌍 Create your first environment configuration
4. ✅ Set up database migrations
5. 🚀 Prepare the development environment

### Help & Discovery

```bash
npx pixell --help                       # Show all available commands
npx pixell <command> --help             # Get help for specific command

# Interactive help
npm run pixell env                      # Environment management menu
npm run supabase:migrations             # Migration management menu
```

### Optional Global Installation

For frequent CLI usage, you can install globally:

```bash
npm install -g @pixell/cli               # Install globally
pixell --help                           # Use directly without npx
```

**Note**: Project-level commands (`npm run`) work without global installation and are recommended for consistent contributor experience.

## 📁 Project Structure

```
pixell-agent-framework/
├── apps/
│   ├── web/                 # Next.js 15 frontend
│   │   ├── src/
│   │   │   ├── app/         # App router pages
│   │   │   └── components/  # Reusable components
│   │   └── package.json
│   └── orchestrator/        # Express.js backend
│       ├── src/
│       │   └── index.ts     # Main server file
│       └── package.json
├── packages/                # Shared packages (future)
├── supabase/               # Database schema & config
├── turbo.json              # Monorepo configuration
└── package.json            # Root workspace config
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
- **AWS SDK** - Cloud integrations (Bedrock, Lambda)

### Database & Real-time
- **Supabase** - PostgreSQL with real-time subscriptions
- **TanStack Query** - Server state management

### DevOps
- **Turbo** - Monorepo build system
- **npm** - Package management

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

### Port Conflicts
If you see port conflicts (3000, 3001 in use):

**Solution**: The services are configured to use specific ports:
- Frontend: Port 3003
- Backend: Port 4001
- Database: Port 54321

### Supabase Not Starting
```bash
# Stop and restart Supabase
npx supabase stop
npx supabase start
```

## 🔍 Verification

### Health Checks

1. **Frontend**: Visit http://localhost:3003
   - Should show "Pixell Agent Framework" with "Phase 0 Setup Complete"

2. **Backend**: 
   ```bash
   curl http://localhost:4001/health
   # Should return: {"status":"ok","message":"Pixell Agent Framework Orchestrator"}
   ```

3. **Database**: Visit http://127.0.0.1:54323
   - Should show Supabase Studio interface

## 🚦 Development Status

- ✅ **Phase 0**: Package Installation & Build Verification (COMPLETE)
- 🔄 **Phase 1**: Core Implementation (READY TO START)

## 📝 Next Steps

With Phase 0 complete, you can now:

1. **Start Phase 1 Implementation** - Begin building core features
2. **Customize UI Components** - Modify the frontend interface
3. **Add API Endpoints** - Extend the orchestrator with new routes
4. **Configure Database** - Set up your data schemas in Supabase

## 🤝 Contributing

1. Ensure all services start without errors
2. Follow the existing code structure
3. Use TypeScript for type safety
4. Test endpoints before committing

## 📞 Support

If you encounter issues:

1. Check the **Common Issues** section above
2. Verify all **Prerequisites** are met
3. Ensure **Node.js version** is 18.18.0 or higher
4. Check that all **ports are available**

---

**Ready to build intelligent agents!** 🚀 

#### 🗄️  Supabase Commands

Set up and manage Supabase database, authentication, and storage. All Supabase configurations are now integrated with managed environments.

**Available Commands:**
```bash
npm run supabase:init          # Complete Supabase setup for environments
npm run supabase:init -- --env <name>  # Configure specific environment directly
npm run supabase:edit          # Edit Supabase settings for environments  
npm run supabase:edit -- --env <name>  # Edit specific environment directly
npm run supabase:status        # Check Supabase service status
npm run supabase:status -- --env <name>  # Check specific environment status
npm run supabase:stop          # Stop local Supabase services
npm run supabase:reset         # Reset local Supabase database
npm run supabase:migrations    # Manage database migrations
npm run supabase:migrations -- --env <name>  # Use specific environment for migrations
```

**Environment-Specific Commands:**
- **Direct Environment Access**: Use `--env <name>` to target specific environments
- **Status Checking**: `npm run supabase:status -- --env dev` shows dev environment status
- **Configuration**: `npm run supabase:init -- --env staging` configures staging directly
- **Error Handling**: Shows available environments if specified environment doesn't exist
- **Connection Testing**: Tests actual connectivity for local/remote environments

**Environment Integration:**
- **🔗 Environment Dependency**: Supabase settings require managed environments to exist first
- **🎯 Environment Selection**: Choose which environment to configure Supabase for
- **⚡ Auto-Configuration**: Active environment settings update `.env.local` automatically
- **🔒 Secure Storage**: All settings stored in managed environment configuration
- **🔄 Easy Switching**: Change environments and Supabase config switches too

**Clear Workflow:**
1. **Create environments** with `npm run pixell env` (environment management only)
2. **Configure Supabase** with `npm run supabase:init` (requires environments to exist)
3. **Switch environments** with `npm run pixell env` (automatically updates Supabase config)
4. **Check status** with `npm run supabase:status -- --env <name>` (environment-specific)

**Key Design Principle:**
- **Environment Management**: `npm run pixell env` handles environment lifecycle only
- **Supabase Configuration**: `npm run supabase:init` handles all Supabase setup
- **Foreign Key Relationship**: Supabase cannot be configured without managed environments
- **Single Source of Truth**: One command for each responsibility
- **Direct Access**: Use `--env` flags for quick environment-specific operations