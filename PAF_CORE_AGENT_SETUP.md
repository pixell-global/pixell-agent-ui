# PAF Core Agent Setup Guide

Since the orchestrator has been removed, the web app now connects directly to your PAF Core Agent. Here's how to configure it:

## Environment Variables

### For Development (.env.local)

```bash
# PAF Core Agent URL (server-side only - client never directly accesses this)
PAF_CORE_AGENT_URL=http://localhost:8000
```

### For Production

```bash
# Replace with your actual PAF Core Agent URL (server-side only)
PAF_CORE_AGENT_URL=https://your-paf-core-agent.com
```

## Docker Compose Configuration

If you're using Docker Compose, update your environment variables in the web service:

```yaml
# docker-compose.prod.yml
services:
  web:
    environment:
      - PAF_CORE_AGENT_URL=${PAF_CORE_AGENT_URL:-http://core-agent:8000}
```

## Testing the Connection

1. Make sure your PAF Core Agent is running
2. Start the web app: `npm run dev:web`
3. Check the health endpoint: `http://localhost:8000/api/health`
4. The web app should now connect directly to your PAF Core Agent

## What Changed

- ✅ Removed orchestrator middleware layer
- ✅ Web app now connects directly to PAF Core Agent
- ✅ Simplified architecture: Web App → PAF Core Agent
- ✅ Updated all configuration files
- ✅ Removed orchestrator dependencies

The web app will now send chat requests directly to your PAF Core Agent at the configured URL.
