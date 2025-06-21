# Pixell CLI v0.3.0

> **Developer Experience & Productivity Tools for Pixell Agent Framework**

The Pixell CLI provides powerful tools for scaffolding, developing, and deploying agent applications with zero configuration.

## 🚀 Quick Start

```bash
# Install globally
npm install -g @pixell/cli

# Create new agent app
npx create-pixell-agent my-agent-app

# Or use the CLI directly
pixell create my-agent-app --template multi-agent --runtime aws-strand
```

## 📋 Commands

### Project Creation

```bash
# Create new project with multi-agent template
pixell create my-app

# Specify template and runtime
pixell create my-app --template simple --runtime langgraph

# Skip installation and git init
pixell create my-app --no-install --no-git
```

**Available Templates:**
- `multi-agent` - Full-featured app with multiple specialized agents
- `simple` - Basic single-agent application  
- `worker-only` - Standalone worker agent without UI

### Worker Agent Generation

```bash
# Generate a custom worker agent
pixell generate worker my-worker --domain social-media --tools twitter,reddit

# Generate analytics agent
pixell generate worker analytics-bot --domain analytics --tools database,charts

# Custom protocol
pixell generate worker custom-agent --protocol a2a --tools api,webhook
```

**Available Domains:**
- `social-media` - Twitter, Reddit, LinkedIn automation
- `analytics` - Data analysis and reporting
- `custom` - General-purpose agent template

### Runtime Management

```bash
# Swap to different runtime
pixell runtime swap --to langgraph

# Swap from specific runtime with backup
pixell runtime swap --from aws-strand --to openai-assistants --backup

# List available runtimes
pixell runtime list
```

**Supported Runtimes:**
- `aws-strand` - AWS native with Bedrock integration
- `langgraph` - LangChain Graph-based runtime
- `openai-assistants` - OpenAI Assistants API

### Plugin Management

```bash
# List all available plugins
pixell plugins list

# Filter by type
pixell plugins list --type runtime

# Show only installed plugins
pixell plugins list --installed

# Install plugin
pixell plugins install reddit-agent-pro

# Install specific version
pixell plugins install langgraph-runtime --version 0.8.1

# Uninstall plugin
pixell plugins uninstall chart-ui-components
```

### Deployment

```bash
# Deploy to Docker
pixell deploy --platform docker

# Deploy to Kubernetes
pixell deploy --platform kubernetes --env production

# Dry run (show plan without executing)
pixell deploy --platform vercel --dry-run

# Deploy to AWS
pixell deploy --platform aws --env staging
```

**Supported Platforms:**
- `docker` - Container deployment
- `kubernetes` - K8s cluster deployment
- `vercel` - Serverless frontend deployment
- `aws` - AWS CDK deployment

### Configuration

```bash
# Initialize CLI configuration
pixell config init

# Show current configuration
pixell config show
```

## 🔧 Configuration

The CLI stores configuration in `~/.config/pixell/config.json`:

```json
{
  "defaultTemplate": "multi-agent",
  "preferredRuntime": "aws-strand",
  "deploymentTargets": ["docker", "kubernetes"],
  "pluginRegistry": "https://registry.pixell.dev",
  "telemetryEnabled": true,
  "installedPlugins": ["reddit-agent-pro", "slack-notifications"]
}
```

## 🏗️ Project Structure

Generated projects follow this structure:

```
my-agent-app/
├── apps/
│   ├── web/                    # Next.js frontend
│   └── orchestrator/           # Core agent server
├── packages/
│   ├── workers/               # Worker agents
│   │   ├── reddit-agent/
│   │   └── analytics-agent/
│   └── protocols/             # A2A & MCP protocols
├── docker-compose.yml
├── package.json
└── turbo.json
```

## 🔌 Plugin System

### Plugin Types

- **Runtime** - Agent runtime adapters (LangGraph, OpenAI)
- **Worker** - Pre-built agent implementations
- **Tool** - Integration tools (Slack, database connectors)
- **UI** - Interface components for Activity Pane

### Installing Plugins

```bash
# Install from registry
pixell plugins install reddit-agent-pro

# Install development version
pixell plugins install ./my-local-plugin

# Install from GitHub
pixell plugins install github:username/plugin-repo
```

### Creating Plugins

```bash
# Generate plugin scaffold
pixell generate plugin my-plugin --type worker

# Generate runtime adapter
pixell generate plugin my-runtime --type runtime
```

## 🚀 Deployment Guides

### Docker Deployment

```bash
# Build and run locally
pixell deploy --platform docker

# Custom configuration
docker run -p 3000:3000 \
  -e NODE_ENV=production \
  -e OPENAI_API_KEY=your_key \
  pixell-app:latest
```

### Kubernetes Deployment

```bash
# Generate manifests
pixell deploy --platform kubernetes --dry-run

# Deploy to cluster
kubectl apply -f k8s/
```

### AWS Deployment

```bash
# Deploy with CDK
pixell deploy --platform aws

# Monitor deployment
aws logs tail /aws/ecs/pixell-app --follow
```

## 🔄 Runtime Swapping

Switch between different agent runtimes without rewriting code:

```bash
# Current: AWS Strand → Target: LangGraph
pixell runtime swap --to langgraph

# Automatic dependency management
npm install  # New dependencies installed

# Configuration files updated
cat apps/orchestrator/src/config/langgraph.config.ts
```

## 🧪 Examples

### Create Reddit Bot

```bash
# Create project
pixell create reddit-bot --template multi-agent

# Add Reddit agent
cd reddit-bot
pixell generate worker reddit-monitor --domain social-media --tools reddit

# Deploy
pixell deploy --platform docker
```

### Swap to LangGraph

```bash
# In existing project
pixell runtime swap --to langgraph --backup

# Verify swap
pixell config show
```

### Install Analytics Plugin

```bash
# Browse plugins
pixell plugins list --type worker

# Install advanced analytics
pixell plugins install reddit-agent-pro

# Configure in orchestrator
# Plugin automatically registered with A2A protocol
```

## 🐛 Troubleshooting

### Common Issues

**Command not found**
```bash
npm install -g @pixell/cli
```

**Permission errors**
```bash
sudo chown -R $(whoami) ~/.config/pixell
```

**Plugin installation fails**
```bash
pixell config show  # Check registry URL
pixell plugins list  # Verify plugin exists
```

**Runtime swap errors**
```bash
pixell runtime swap --to aws-strand  # Reset to default
npm install  # Reinstall dependencies
```

### Debug Mode

```bash
# Enable verbose logging
DEBUG=pixell:* pixell create my-app

# Show detailed errors
pixell create my-app --verbose
```

## 📚 Learn More

- [Documentation](https://docs.pixell.dev)
- [Plugin Registry](https://registry.pixell.dev)
- [GitHub Repository](https://github.com/pixell/pixell-agent-framework)
- [Community Discord](https://discord.gg/pixell)

## 🤝 Contributing

```bash
# Clone repository
git clone https://github.com/pixell/pixell-agent-framework

# Install dependencies
cd pixell-agent-framework
npm install

# Link CLI for development
cd packages/cli
npm link

# Test changes
pixell --version
```

## 📄 License

Apache 2.0 - see [LICENSE](LICENSE) file for details. 