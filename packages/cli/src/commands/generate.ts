import fs from 'fs-extra'
import path from 'path'
import chalk from 'chalk'
import ora from 'ora'
import { useCLIStore } from '../stores/cli-store'

interface GenerateOptions {
  domain: string
  tools: string
  protocol: string
}

const workerTemplates = {
  'social-media': {
    description: 'Social media automation agent',
    tools: ['twitter', 'reddit', 'linkedin'],
    capabilities: ['post', 'analyze', 'monitor']
  },
  'analytics': {
    description: 'Data analytics and reporting agent',
    tools: ['database', 'charts', 'export'],
    capabilities: ['analyze', 'report', 'visualize']
  },
  'custom': {
    description: 'Custom domain agent',
    tools: ['api', 'webhook'],
    capabilities: ['execute', 'monitor']
  }
}

export async function generateWorker(name: string, options: GenerateOptions) {
  const spinner = ora('Generating worker agent...').start()
  
  try {
    const store = useCLIStore.getState()
    
    // Check if we're in a Pixell project
    if (!store.currentProject) {
      spinner.fail('Not in a Pixell project. Run `pixell create <app-name>` first.')
      return
    }
    
    const agentName = name.toLowerCase().replace(/[^a-z0-9-]/g, '-')
    const className = name.charAt(0).toUpperCase() + name.slice(1).replace(/-([a-z])/g, (g) => g[1].toUpperCase())
    
    spinner.text = 'Creating agent structure...'
    
    // Create agent directory
    const agentPath = path.join(store.currentProject.path, 'packages', 'workers', `${agentName}-agent`)
    fs.ensureDirSync(agentPath)
    
    // Template variables
    const templateVars = {
      agentName,
      className,
      domain: options.domain,
      tools: options.tools.split(',').map(t => t.trim()),
      protocol: options.protocol,
      timestamp: new Date().toISOString()
    }
    
    // Create agent files
    await createAgentFiles(agentPath, templateVars)
    
    spinner.succeed(`Generated worker agent: ${chalk.green(agentName)}`)
    
    console.log(chalk.blue('\nNext steps:'))
    console.log(chalk.white(`  cd packages/workers/${agentName}-agent`))
    console.log(chalk.white('  npm install'))
    console.log(chalk.white('  npm run dev'))
    
    // Show domain-specific info
    const template = workerTemplates[options.domain as keyof typeof workerTemplates]
    if (template) {
      console.log(chalk.gray(`\nDomain: ${template.description}`))
      console.log(chalk.gray(`Tools: ${template.tools.join(', ')}`))
      console.log(chalk.gray(`Capabilities: ${template.capabilities.join(', ')}`))
    }
    
  } catch (error) {
    spinner.fail(`Failed to generate worker: ${error}`)
    console.error(error)
  }
}

async function createAgentFiles(agentPath: string, vars: any) {
  const packageJson = {
    name: `@pixell/${vars.agentName}-agent`,
    version: '0.1.0',
    description: `${vars.className} worker agent for Pixell`,
    main: 'dist/index.js',
    scripts: {
      dev: 'tsx src/index.ts',
      build: 'tsc',
      start: 'node dist/index.js',
      test: 'jest'
    },
    dependencies: {
      '@pixell/protocols': 'workspace:*',
      'zod': '^3.24.1',
      'uuid': '^10.0.0'
    },
    devDependencies: {
      '@types/node': '^22.10.5',
      '@types/uuid': '^10.0.0',
      'tsx': '^4.19.2',
      'typescript': '^5.7.3',
      'jest': '^29.7.0'
    }
  }
  
  const agentCardYaml = `# Agent Card for ${vars.className}
id: ${vars.agentName}
name: "${vars.className}"
description: "A ${vars.domain} agent built with Pixell"
domain: "${vars.domain}"
protocol: "${vars.protocol}"
version: "0.1.0"

# Capabilities
capabilities:
  streaming: true
  pushNotifications: true
  batchProcessing: false

# Tool requirements
tools:
${vars.tools.map((tool: string) => `  - ${tool}`).join('\n')}

# Resource requirements
resources:
  memory: "512MB"
  cpu: "0.5"
  timeout: 300

# Pricing (optional)
pricing:
  model: "per_execution"
  base_cost: 0.01
  
# UI Configuration
ui:
  exposed_ui: "activity"
  color_scheme: "blue"
  icon: "bot"
`

  const agentCode = `import { A2AAgent, AgentCard, Task, TaskResult } from '@pixell/protocols'
import { z } from 'zod'
import { v4 as uuid } from 'uuid'

// Input validation schemas
const ${vars.className}InputSchema = z.object({
  action: z.enum(['execute', 'analyze', 'monitor']),
  parameters: z.record(z.any()).optional()
})

export type ${vars.className}Input = z.infer<typeof ${vars.className}InputSchema>

export class ${vars.className}Agent implements A2AAgent {
  public readonly card: AgentCard = {
    id: '${vars.agentName}',
    name: '${vars.className}',
    description: 'A ${vars.domain} agent built with Pixell',
    domain: '${vars.domain}',
    protocol: '${vars.protocol}',
    version: '0.1.0',
    capabilities: {
      streaming: true,
      pushNotifications: true,
      batchProcessing: false
    },
    ui: {
      exposed_ui: 'activity',
      color_scheme: 'blue',
      icon: 'bot'
    }
  }

  async discoverCapabilities(): Promise<AgentCard> {
    return this.card
  }

  async delegateTask(task: Task): Promise<TaskResult> {
    try {
      // Validate input
      const input = ${vars.className}InputSchema.parse(task.input)
      
      // Update progress
      this.updateProgress(task.id, 10, 'Starting ${vars.domain} task...')
      
      let result: any
      
      switch (input.action) {
        case 'execute':
          result = await this.executeAction(input.parameters)
          break
        case 'analyze':
          result = await this.analyzeData(input.parameters)
          break
        case 'monitor':
          result = await this.monitorSystem(input.parameters)
          break
        default:
          throw new Error(\`Unsupported action: \${input.action}\`)
      }
      
      this.updateProgress(task.id, 100, 'Task completed successfully')
      
      return {
        id: uuid(),
        taskId: task.id,
        status: 'success',
        data: result,
        timestamp: new Date().toISOString(),
        agent: this.card.id
      }
      
    } catch (error) {
      return {
        id: uuid(),
        taskId: task.id,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        agent: this.card.id
      }
    }
  }

  private async executeAction(parameters: any = {}): Promise<any> {
    // TODO: Implement ${vars.domain}-specific execution logic
    await this.simulateWork(2000)
    
    return {
      message: \`Executed ${vars.domain} action\`,
      parameters,
      timestamp: new Date().toISOString()
    }
  }

  private async analyzeData(parameters: any = {}): Promise<any> {
    // TODO: Implement ${vars.domain}-specific analysis logic
    await this.simulateWork(3000)
    
    return {
      analysis: \`${vars.domain} data analysis complete\`,
      insights: [
        'Key insight 1',
        'Key insight 2',
        'Key insight 3'
      ],
      parameters,
      timestamp: new Date().toISOString()
    }
  }

  private async monitorSystem(parameters: any = {}): Promise<any> {
    // TODO: Implement ${vars.domain}-specific monitoring logic
    await this.simulateWork(1500)
    
    return {
      status: 'healthy',
      metrics: {
        uptime: '99.9%',
        response_time: '150ms',
        error_rate: '0.1%'
      },
      parameters,
      timestamp: new Date().toISOString()
    }
  }

  private updateProgress(taskId: string, progress: number, message: string) {
    // TODO: Implement progress updates via A2A protocol
    console.log(\`[\${this.card.id}] Task \${taskId}: \${progress}% - \${message}\`)
  }

  private async simulateWork(duration: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, duration))
  }
}

// Export for use in orchestrator
export default ${vars.className}Agent
`

  const indexFile = `import { ${vars.className}Agent } from './${vars.className}Agent'

const agent = new ${vars.className}Agent()

console.log(\`🤖 \${agent.card.name} starting...\`)
console.log(\`📋 Domain: \${agent.card.domain}\`)
console.log(\`🔧 Protocol: \${agent.card.protocol}\`)

// TODO: Connect to orchestrator via A2A protocol
// This would typically involve:
// 1. Registering with the orchestrator
// 2. Listening for incoming tasks
// 3. Sending capability updates

export { ${vars.className}Agent }
export default agent
`

  const tsConfig = {
    compilerOptions: {
      target: 'ES2022',
      lib: ['ES2022'],
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      declaration: true,
      outDir: './dist'
    },
    include: ['src/**/*'],
    exclude: ['node_modules', 'dist']
  }

  // Write files
  fs.writeFileSync(path.join(agentPath, 'package.json'), JSON.stringify(packageJson, null, 2))
  fs.writeFileSync(path.join(agentPath, 'agent-card.yaml'), agentCardYaml)
  fs.writeFileSync(path.join(agentPath, 'tsconfig.json'), JSON.stringify(tsConfig, null, 2))
  
  // Create src directory and files
  fs.ensureDirSync(path.join(agentPath, 'src'))
  fs.writeFileSync(path.join(agentPath, 'src', `${vars.className}Agent.ts`), agentCode)
  fs.writeFileSync(path.join(agentPath, 'src', 'index.ts'), indexFile)
  
  // Create README
  const readme = `# ${vars.className} Agent

A ${vars.domain} worker agent built with Pixell Agent Framework.

## Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\`

## Configuration

Edit \`agent-card.yaml\` to configure capabilities and resources.

## Development

- \`npm run dev\` - Start in development mode
- \`npm run build\` - Build for production
- \`npm run test\` - Run tests

## Integration

This agent implements the A2A protocol and can be registered with any Pixell orchestrator.
`
  
  fs.writeFileSync(path.join(agentPath, 'README.md'), readme)
} 