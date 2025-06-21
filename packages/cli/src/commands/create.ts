import { execSync } from 'child_process'
import fs from 'fs-extra'
import path from 'path'
import chalk from 'chalk'
import ora from 'ora'
import inquirer from 'inquirer'
import mustache from 'mustache'
import { useCLIStore } from '../stores/cli-store'

interface CreateOptions {
  template: string
  runtime: string
  install: boolean
  git: boolean
}

const templates = {
  'multi-agent': {
    name: 'Multi-Agent Application',
    description: 'Full-featured app with multiple specialized agents',
    files: ['orchestrator', 'web', 'reddit-agent', 'analytics-agent']
  },
  'simple': {
    name: 'Simple Agent App',
    description: 'Basic single-agent application',
    files: ['orchestrator', 'web', 'simple-agent']
  },
  'worker-only': {
    name: 'Worker Agent Only',
    description: 'Standalone worker agent without UI',
    files: ['worker-agent']
  }
}

export async function createApp(appName: string, options: CreateOptions) {
  const spinner = ora('Creating Pixell agent application...').start()
  
  try {
    // Get CLI store instance
    const store = useCLIStore.getState()
    
    // Validate app name
    if (!appName || appName.length === 0) {
      spinner.fail('App name is required')
      return
    }
    
    const targetPath = path.resolve(process.cwd(), appName)
    
    // Check if directory already exists
    if (fs.existsSync(targetPath)) {
      spinner.fail(`Directory ${appName} already exists`)
      return
    }
    
    spinner.text = 'Setting up project structure...'
    
    // Create project directory
    fs.ensureDirSync(targetPath)
    
    // Template variables
    const templateVars = {
      appName,
      runtime: options.runtime,
      timestamp: new Date().toISOString(),
      packageName: appName.toLowerCase().replace(/[^a-z0-9-]/g, '-')
    }
    
    // Copy template files
    await copyTemplate(options.template, targetPath, templateVars)
    
    // Initialize package.json
    await createPackageJson(targetPath, templateVars)
    
    // Create environment files
    await createEnvFiles(targetPath, templateVars)
    
    // Create Docker files
    await createDockerFiles(targetPath, templateVars)
    
    spinner.text = 'Installing dependencies...'
    
    if (options.install) {
      // Install dependencies
      execSync('npm install', { 
        cwd: targetPath, 
        stdio: 'inherit' 
      })
    }
    
    if (options.git) {
      spinner.text = 'Initializing git repository...'
      
      // Initialize git
      execSync('git init', { cwd: targetPath, stdio: 'pipe' })
      execSync('git add .', { cwd: targetPath, stdio: 'pipe' })
      execSync('git commit -m "Initial commit"', { cwd: targetPath, stdio: 'pipe' })
    }
    
    // Update CLI store with project info
    store.setCurrentProject({
      name: appName,
      path: targetPath,
      template: options.template,
      runtime: options.runtime,
      plugins: [],
      createdAt: new Date().toISOString()
    })
    
    spinner.succeed(`Successfully created ${chalk.green(appName)}!`)
    
    // Show next steps
    console.log(chalk.blue('\nNext steps:'))
    console.log(chalk.white(`  cd ${appName}`))
    
    if (!options.install) {
      console.log(chalk.white('  npm install'))
    }
    
    console.log(chalk.white('  npm run dev'))
    console.log(chalk.white('\nVisit http://localhost:3000 to see your app!'))
    
    // Show template-specific info
    const template = templates[options.template as keyof typeof templates]
    if (template) {
      console.log(chalk.gray(`\nTemplate: ${template.description}`))
    }
    
  } catch (error) {
    spinner.fail(`Failed to create app: ${error}`)
    console.error(error)
  }
}

async function copyTemplate(templateName: string, targetPath: string, vars: any) {
  // Template directory structure
  const templateDir = path.join(__dirname, '../../templates', templateName)
  
  // For now, create basic structure - in real implementation, copy from templates
  const structure = {
    'package.json': JSON.stringify({
      name: vars.packageName,
      version: '0.1.0',
      scripts: {
        dev: 'turbo dev',
        build: 'turbo build',
        test: 'turbo test'
      },
      devDependencies: {
        turbo: '^2.5.4'
      }
    }, null, 2),
    
    'turbo.json': JSON.stringify({
      pipeline: {
        dev: {
          cache: false,
          persistent: true
        },
        build: {
          dependsOn: ['^build'],
          outputs: ['dist/**', '.next/**']
        }
      }
    }, null, 2),
    
    'README.md': mustache.render(`# {{appName}}

A Pixell agent application created with CLI v0.3.0

## Getting Started

\`\`\`bash
npm run dev
\`\`\`

Visit http://localhost:3000 to see your app.

## Template

- **Template**: {{runtime}}
- **Runtime**: {{runtime}}
- **Created**: {{timestamp}}

## Available Commands

- \`npm run dev\` - Start development servers
- \`npm run build\` - Build for production
- \`pixell generate worker <name>\` - Generate new worker agent
- \`pixell deploy\` - Deploy your application
`, vars)
  }
  
  // Write files
  for (const [filePath, content] of Object.entries(structure)) {
    const fullPath = path.join(targetPath, filePath)
    fs.ensureDirSync(path.dirname(fullPath))
    fs.writeFileSync(fullPath, content)
  }
}

async function createPackageJson(targetPath: string, vars: any) {
  // Already created in copyTemplate, this could be expanded
}

async function createEnvFiles(targetPath: string, vars: any) {
  const envContent = `# Pixell Agent Framework Environment
# Generated on ${vars.timestamp}

# Supabase Configuration (get from supabase.com)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Agent Runtime Configuration
AGENT_RUNTIME=${vars.runtime}

# Development
NODE_ENV=development
`
  
  fs.writeFileSync(path.join(targetPath, '.env.example'), envContent)
  fs.writeFileSync(path.join(targetPath, '.env.local'), envContent)
}

async function createDockerFiles(targetPath: string, vars: any) {
  const dockerfile = `# Pixell Agent Framework - ${vars.appName}
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --omit=dev

# Build the app
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
`
  
  const dockerCompose = `version: '3.8'

services:
  ${vars.packageName}:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    volumes:
      - ./.env.local:/app/.env.local:ro

  supabase:
    image: supabase/supabase:latest
    ports:
      - "54321:54321"
    environment:
      - POSTGRES_PASSWORD=postgres
`
  
  fs.writeFileSync(path.join(targetPath, 'Dockerfile'), dockerfile)
  fs.writeFileSync(path.join(targetPath, 'docker-compose.yml'), dockerCompose)
} 