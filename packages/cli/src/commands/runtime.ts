import fs from 'fs-extra'
import path from 'path'
import chalk from 'chalk'
import ora from 'ora'
import { useCLIStore } from '../stores/cli-store'

interface RuntimeSwapOptions {
  from?: string
  to: string
  backup: boolean
}

const supportedRuntimes = {
  'aws-strand': {
    name: 'AWS Strand',
    description: 'AWS native agent runtime with Bedrock integration',
    dependencies: [
      '@aws-sdk/client-bedrock',
      '@aws-sdk/client-lambda'
    ],
    configFiles: ['aws-strand.config.ts'],
    adapterClass: 'StrandAdapter'
  },
  'langgraph': {
    name: 'LangGraph',
    description: 'LangChain Graph-based agent runtime',
    dependencies: [
      '@langchain/core',
      '@langchain/langgraph'
    ],
    configFiles: ['langgraph.config.ts'],
    adapterClass: 'LangGraphAdapter'
  },
  'openai-assistants': {
    name: 'OpenAI Assistants',
    description: 'OpenAI Assistants API runtime',
    dependencies: [
      'openai'
    ],
    configFiles: ['openai.config.ts'],
    adapterClass: 'OpenAIAdapter'
  }
}

export async function swapRuntime(options: RuntimeSwapOptions) {
  const spinner = ora('Preparing runtime swap...').start()
  
  try {
    const store = useCLIStore.getState()
    
    // Check if we're in a Pixell project
    if (!store.currentProject) {
      spinner.fail('Not in a Pixell project. Run `pixell create <app-name>` first.')
      return
    }
    
    const targetRuntime = supportedRuntimes[options.to as keyof typeof supportedRuntimes]
    if (!targetRuntime) {
      spinner.fail(`Unsupported runtime: ${options.to}`)
      console.log(chalk.yellow('Supported runtimes:'), Object.keys(supportedRuntimes).join(', '))
      return
    }
    
    const currentRuntime = options.from || store.currentProject.runtime
    
    if (currentRuntime === options.to) {
      spinner.fail(`Already using ${targetRuntime.name}`)
      return
    }
    
    spinner.text = `Swapping runtime: ${currentRuntime} → ${targetRuntime.name}...`
    
    // Create backup if requested
    if (options.backup) {
      await createRuntimeBackup(store.currentProject.path, currentRuntime)
      spinner.text = 'Backup created, continuing swap...'
    }
    
    // Update dependencies
    await updateDependencies(store.currentProject.path, currentRuntime, options.to)
    
    // Update configuration files
    await updateConfigurationFiles(store.currentProject.path, options.to)
    
    // Update orchestrator code
    await updateOrchestratorCode(store.currentProject.path, currentRuntime, options.to)
    
    // Update project state
    store.setCurrentProject({
      ...store.currentProject,
      runtime: options.to
    })
    
    spinner.succeed(`Successfully swapped to ${chalk.green(targetRuntime.name)}!`)
    
    // Show next steps
    console.log(chalk.blue('\nNext steps:'))
    console.log(chalk.white('  npm install'))
    console.log(chalk.white('  npm run dev'))
    
    if (options.backup) {
      console.log(chalk.gray(`\nBackup saved in: backup-${currentRuntime}-${Date.now()}/`))
    }
    
    // Show runtime-specific setup instructions
    showRuntimeSetupInstructions(targetRuntime)
    
  } catch (error) {
    spinner.fail(`Runtime swap failed: ${error}`)
    console.error(error)
  }
}

async function createRuntimeBackup(projectPath: string, currentRuntime: string) {
  const backupDir = path.join(projectPath, `backup-${currentRuntime}-${Date.now()}`)
  fs.ensureDirSync(backupDir)
  
  // Backup key files
  const filesToBackup = [
    'package.json',
    'apps/orchestrator/src/core',
    'apps/orchestrator/src/runtime'
  ]
  
  for (const file of filesToBackup) {
    const sourcePath = path.join(projectPath, file)
    const targetPath = path.join(backupDir, file)
    
    if (fs.existsSync(sourcePath)) {
      fs.ensureDirSync(path.dirname(targetPath))
      fs.copySync(sourcePath, targetPath)
    }
  }
}

async function updateDependencies(projectPath: string, fromRuntime: string, toRuntime: string) {
  const packageJsonPath = path.join(projectPath, 'apps/orchestrator/package.json')
  const packageJson = fs.readJsonSync(packageJsonPath)
  
  const oldRuntime = supportedRuntimes[fromRuntime as keyof typeof supportedRuntimes]
  const newRuntime = supportedRuntimes[toRuntime as keyof typeof supportedRuntimes]
  
  // Remove old dependencies
  if (oldRuntime) {
    oldRuntime.dependencies.forEach(dep => {
      delete packageJson.dependencies[dep]
    })
  }
  
  // Add new dependencies
  newRuntime.dependencies.forEach(dep => {
    packageJson.dependencies[dep] = 'latest'
  })
  
  fs.writeJsonSync(packageJsonPath, packageJson, { spaces: 2 })
}

async function updateConfigurationFiles(projectPath: string, runtime: string) {
  const runtimeConfig = supportedRuntimes[runtime as keyof typeof supportedRuntimes]
  const configDir = path.join(projectPath, 'apps/orchestrator/src/config')
  
  fs.ensureDirSync(configDir)
  
  // Generate runtime-specific configuration
  const configContent = generateRuntimeConfig(runtime, runtimeConfig)
  
  for (const configFile of runtimeConfig.configFiles) {
    fs.writeFileSync(
      path.join(configDir, configFile),
      configContent[configFile] || '// TODO: Configure runtime'
    )
  }
}

function generateRuntimeConfig(runtime: string, config: any): Record<string, string> {
  switch (runtime) {
    case 'aws-strand':
      return {
        'aws-strand.config.ts': `import { StrandConfig } from '@aws-sdk/client-bedrock'

export const strandConfig: StrandConfig = {
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  },
  bedrockModel: 'anthropic.claude-3-sonnet-20240229-v1:0',
  maxTokens: 4096,
  temperature: 0.7
}`
      }
    case 'langgraph':
      return {
        'langgraph.config.ts': `import { LangGraphConfig } from '@langchain/langgraph'

export const langGraphConfig: LangGraphConfig = {
  model: {
    provider: 'openai',
    name: 'gpt-4-turbo-preview',
    apiKey: process.env.OPENAI_API_KEY!
  },
  memory: {
    type: 'buffer',
    maxTokens: 8000
  },
  tools: {
    enabled: true,
    allowDangerous: false
  }
}
`
      }
    case 'openai-assistants':
      return {
        'openai.config.ts': `import { Configuration } from 'openai'

export const openaiConfig = new Configuration({
  apiKey: process.env.OPENAI_API_KEY!,
  organization: process.env.OPENAI_ORG_ID
})

export const assistantConfig = {
  model: 'gpt-4-turbo-preview',
  tools: [
    { type: 'code_interpreter' },
    { type: 'retrieval' }
  ],
  instructions: 'You are a helpful agent runtime coordinator.'
}
`
      }
    default:
      return {}
  }
}

async function updateOrchestratorCode(projectPath: string, fromRuntime: string, toRuntime: string) {
  const adapterPath = path.join(projectPath, 'apps/orchestrator/src/core/RuntimeAdapter.ts')
  const newRuntimeConfig = supportedRuntimes[toRuntime as keyof typeof supportedRuntimes]
  
  const adapterCode = `import { AgentRuntimeAdapter, CoreAgentRuntime } from '@pixell/protocols'
import { ${newRuntimeConfig.adapterClass} } from './${newRuntimeConfig.adapterClass}'

export class RuntimeAdapter implements AgentRuntimeAdapter {
  private adapter: ${newRuntimeConfig.adapterClass}

  constructor() {
    this.adapter = new ${newRuntimeConfig.adapterClass}()
  }

  async createRuntime(config: any): Promise<CoreAgentRuntime> {
    return this.adapter.createRuntime(config)
  }

  async destroyRuntime(): Promise<void> {
    return this.adapter.destroyRuntime()
  }

  getCapabilities(): string[] {
    return this.adapter.getCapabilities()
  }
}
`
  
  fs.ensureDirSync(path.dirname(adapterPath))
  fs.writeFileSync(adapterPath, adapterCode)
  
  // Create runtime-specific adapter stub
  const specificAdapterPath = path.join(
    projectPath, 
    'apps/orchestrator/src/core', 
    `${newRuntimeConfig.adapterClass}.ts`
  )
  
  const specificAdapterCode = generateAdapterCode(toRuntime, newRuntimeConfig)
  fs.writeFileSync(specificAdapterPath, specificAdapterCode)
}

function generateAdapterCode(runtime: string, config: any): string {
  const baseAdapter = `import { AgentRuntimeAdapter, CoreAgentRuntime } from '@pixell/protocols'

export class ${config.adapterClass} implements AgentRuntimeAdapter {
  async createRuntime(config: any): Promise<CoreAgentRuntime> {
    // TODO: Implement ${config.name} runtime creation
    throw new Error('${config.name} adapter not implemented')
  }

  async destroyRuntime(): Promise<void> {
    // TODO: Implement runtime cleanup
  }

  getCapabilities(): string[] {
    return [
      'task_planning',
      'agent_coordination',
      'streaming_support'
    ]
  }
}
`
  
  return baseAdapter
}

function showRuntimeSetupInstructions(runtime: any) {
  console.log(chalk.blue('\nRuntime Setup:'))
  console.log(chalk.white(`Name: ${runtime.name}`))
  console.log(chalk.white(`Description: ${runtime.description}`))
  
  console.log(chalk.blue('\nRequired Environment Variables:'))
  
  // Show runtime-specific env vars
  if (runtime.name.includes('AWS')) {
    console.log(chalk.gray('  AWS_REGION=us-east-1'))
    console.log(chalk.gray('  AWS_ACCESS_KEY_ID=your_access_key'))
    console.log(chalk.gray('  AWS_SECRET_ACCESS_KEY=your_secret_key'))
  } else if (runtime.name.includes('OpenAI')) {
    console.log(chalk.gray('  OPENAI_API_KEY=your_openai_api_key'))
    console.log(chalk.gray('  OPENAI_ORG_ID=your_org_id (optional)'))
  } else if (runtime.name.includes('LangGraph')) {
    console.log(chalk.gray('  OPENAI_API_KEY=your_openai_api_key'))
    console.log(chalk.gray('  LANGCHAIN_API_KEY=your_langchain_key (optional)'))
  }
  
  console.log(chalk.blue('\nDocumentation:'))
  console.log(chalk.gray(`  https://docs.pixell.dev/runtimes/${runtime.name.toLowerCase().replace(/\s+/g, '-')}`))
} 