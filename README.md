# Pixell Agent Framework

A modern, scalable agent framework built with Next.js 15, React 19, and Zustand for state management. This framework provides a foundation for building intelligent agent systems with real-time communication and data persistence.

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