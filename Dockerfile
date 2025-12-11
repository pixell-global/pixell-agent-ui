FROM node:20-alpine AS base

# Stage 1: Install dependencies for the monorepo
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy only manifests to maximize layer cache
COPY package.json package-lock.json turbo.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages/protocols/package.json ./packages/protocols/package.json
COPY packages/renderer/package.json ./packages/renderer/package.json
COPY packages/file-storage/package.json ./packages/file-storage/package.json
COPY packages/db-mysql/package.json ./packages/db-mysql/package.json
COPY packages/auth-core/package.json ./packages/auth-core/package.json
COPY packages/auth-firebase/package.json ./packages/auth-firebase/package.json

# Install dependencies (use npm install for resilience with file: workspace links)
RUN npm install

# Stage 2: Build workspaces and the web app
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build internal packages first (respect dependency order)
RUN npm run build --workspace=@pixell/protocols --if-present \
 && npm run build --workspace=@pixell/renderer --if-present \
 && npm run build --workspace=@pixell/file-storage --if-present \
 && npm run build --workspace=@pixell/db-mysql --if-present \
 && npm run build --workspace=@pixell/auth-core --if-present \
 && npm run build --workspace=@pixell/auth-firebase --if-present

# Decide which env file to use for the web app build
# APP_ENV should be one of: dev, prod (defaults to dev)
ARG APP_ENV=dev

# PAF Core Agent environment variables (server-side only)
ARG PAF_CORE_AGENT_URL

# Firebase environment variables (build-time, will be bundled into client)
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET

# Other public environment variables (build-time)
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_BASE_URL
ARG NEXT_PUBLIC_PAF_CORE_AGENT_URL
ARG NEXT_PUBLIC_ORCHESTRATOR_URL

# Copy the appropriate env file into the Next.js app directory if it exists (optional)
# Note: Environment variables are primarily set via build args (see below)
# The .env files are optional and mainly for local development compatibility
# Always copy to .env.production since we build with NODE_ENV=production
RUN set -e; \
  if [ "$APP_ENV" = "prod" ]; then \
    if [ -f "/app/.env.prod" ]; then \
      cp /app/.env.prod /app/apps/web/.env.production; \
    fi; \
  else \
    if [ -f "/app/.env.dev" ]; then \
      cp /app/.env.dev /app/apps/web/.env.production; \
    fi; \
  fi

# Build Next.js app from its workspace to avoid hoisting/CLI resolution issues
WORKDIR /app/apps/web
# Set environment variables that will be available to the build process
ENV NODE_ENV=production
ENV PIXELL_ENV=${APP_ENV}

# Set PAF Core Agent environment variables from build args (server-side only)
ENV PAF_CORE_AGENT_URL=${PAF_CORE_AGENT_URL}

# Set Firebase environment variables from build args (build-time, bundled into client)
ENV NEXT_PUBLIC_FIREBASE_API_KEY=${NEXT_PUBLIC_FIREBASE_API_KEY}
ENV NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}
ENV NEXT_PUBLIC_FIREBASE_PROJECT_ID=${NEXT_PUBLIC_FIREBASE_PROJECT_ID}
ENV NEXT_PUBLIC_FIREBASE_APP_ID=${NEXT_PUBLIC_FIREBASE_APP_ID}
ENV NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=${NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID}
ENV NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=${NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}

# Set other public environment variables from build args
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
ENV NEXT_PUBLIC_BASE_URL=${NEXT_PUBLIC_BASE_URL}
ENV NEXT_PUBLIC_PAF_CORE_AGENT_URL=${NEXT_PUBLIC_PAF_CORE_AGENT_URL}
ENV NEXT_PUBLIC_ORCHESTRATOR_URL=${NEXT_PUBLIC_ORCHESTRATOR_URL}

# Build the Next.js app with environment variables loaded
RUN npm install && npm run build

# Stage 3: Runtime image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Copy the standalone build output
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
# Copy public assets where Next.js standalone server expects them (relative to server.js)
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

# Environment variables are set at build time via Docker build args
# NEXT_PUBLIC_* variables are bundled into the client at build time
# Server-side environment variables are injected at runtime via ECS task definition
# No .env file or entrypoint script needed

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]


