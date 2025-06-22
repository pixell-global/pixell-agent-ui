import chalk from 'chalk'
import inquirer from 'inquirer'
import fs from 'fs-extra'
import path from 'path'
import { useCLIStore } from '../stores/cli-store'

export async function initConfig() {
  console.log(chalk.blue('🔧 Initializing Pixell CLI configuration...\n'))
  
  try {
    const store = useCLIStore.getState()
    
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'defaultTemplate',
        message: 'Default template for new projects:',
        choices: [
          { name: 'Multi-Agent Application (recommended)', value: 'multi-agent' },
          { name: 'Simple Agent App', value: 'simple' },
          { name: 'Worker Agent Only', value: 'worker-only' }
        ],
        default: store.config.defaultTemplate
      },
      {
        type: 'list',
        name: 'preferredRuntime',
        message: 'Preferred agent runtime:',
        choices: [
          { name: 'AWS Strand (recommended)', value: 'aws-strand' },
          { name: 'LangGraph', value: 'langgraph' },
          { name: 'OpenAI Assistants', value: 'openai-assistants' }
        ],
        default: store.config.preferredRuntime
      },
      {
        type: 'checkbox',
        name: 'deploymentTargets',
        message: 'Deployment targets you plan to use:',
        choices: [
          { name: 'Docker', value: 'docker', checked: true },
          { name: 'Kubernetes', value: 'kubernetes' },
          { name: 'Vercel', value: 'vercel' },
          { name: 'AWS', value: 'aws' }
        ],
        default: store.config.deploymentTargets
      },
      {
        type: 'input',
        name: 'extensionRegistry',
        message: 'Extension registry URL:',
        default: store.config.extensionRegistry,
        validate: (input) => {
          try {
            new URL(input)
            return true
          } catch {
            return 'Please enter a valid URL'
          }
        }
      },
      {
        type: 'confirm',
        name: 'telemetryEnabled',
        message: 'Enable anonymous usage telemetry (helps improve the CLI):',
        default: store.config.telemetryEnabled
      },
      {
        type: 'input',
        name: 'storageLimit',
        message: 'Storage limit for file uploads (in GB):',
        default: store.config.storageLimit.toString(),
        validate: (input) => {
          const limit = parseInt(input)
          if (isNaN(limit) || limit <= 0) return 'Please enter a valid number greater than 0'
          if (limit > 1000) return 'Storage limit cannot exceed 1000GB'
          return true
        },
        filter: (input) => parseInt(input)
      }
    ])
    
    // Update configuration
    store.setConfig({
      ...answers,
      lastUpdate: new Date().toISOString()
    })
    
    console.log(chalk.green('\n✅ Configuration saved successfully!'))
    
    // Show summary
    console.log(chalk.blue('\nConfiguration Summary:'))
    console.log(chalk.white(`  Default Template: ${answers.defaultTemplate}`))
    console.log(chalk.white(`  Preferred Runtime: ${answers.preferredRuntime}`))
    console.log(chalk.white(`  Deployment Targets: ${answers.deploymentTargets.join(', ')}`))
    console.log(chalk.white(`  Extension Registry: ${answers.extensionRegistry}`))
    console.log(chalk.white(`  Telemetry: ${answers.telemetryEnabled ? 'enabled' : 'disabled'}`))
    console.log(chalk.white(`  Storage Limit: ${answers.storageLimit}GB`))
    
    console.log(chalk.gray('\nYou can change these settings anytime with `pixell config init`'))
    
  } catch (error) {
    console.error(chalk.red('Failed to initialize configuration:'), error)
  }
}

export async function showConfig() {
  console.log(chalk.blue('📋 Pixell CLI Configuration\n'))
  
  try {
    const store = useCLIStore.getState()
    const config = store.config
    
    // Configuration details
    console.log(chalk.bold('GENERAL SETTINGS:'))
    console.log(`  Default Template: ${chalk.white(config.defaultTemplate)}`)
    console.log(`  Preferred Runtime: ${chalk.white(config.preferredRuntime)}`)
    console.log(`  Extension Registry: ${chalk.white(config.extensionRegistry)}`)
    console.log(`  Telemetry: ${chalk.white(config.telemetryEnabled ? 'enabled' : 'disabled')}`)
    console.log(`  Storage Limit: ${chalk.white(config.storageLimit)}GB`)
    
    console.log(chalk.bold('\nDEPLOYMENT TARGETS:'))
    config.deploymentTargets.forEach(target => {
      console.log(`  ${chalk.green('✓')} ${target}`)
    })
    
    console.log(chalk.bold('\nINSTALLED EXTENSIONS:'))
    if (config.installedExtensions.length === 0) {
      console.log(chalk.gray('  No extensions installed'))
    } else {
      config.installedExtensions.forEach(extension => {
        console.log(`  ${chalk.green('✓')} ${extension}`)
      })
    }
    
    console.log(chalk.bold('\nAI CONFIGURATION:'))
    if (config.aiConfig.configured) {
      console.log(`  ${chalk.green('✓')} Default Provider: ${getProviderDisplayName(config.aiConfig.defaultProvider)}`)
      
      const providers = config.aiConfig.providers || {}
      const enabledProviders = Object.keys(providers).filter(key => {
        const provider = (providers as any)[key]
        return provider?.enabled
      })
      
      if (enabledProviders.length > 0) {
        console.log(`  ${chalk.white('Enabled Providers:')} ${enabledProviders.length}`)
        enabledProviders.forEach(provider => {
          const providerConfig = (providers as any)[provider]
          const displayName = getProviderDisplayName(provider)
          
          if (provider === 'openai' && providerConfig?.defaultModel) {
            console.log(`    ${chalk.white(displayName)}: ${providerConfig.defaultModel}`)
          } else if (provider === 'anthropic' && providerConfig?.defaultModel) {
            console.log(`    ${chalk.white(displayName)}: ${providerConfig.defaultModel}`)
          } else if (provider === 'awsBedrock' && providerConfig?.defaultModel) {
            console.log(`    ${chalk.white(displayName)}: ${providerConfig.defaultModel} (${providerConfig.region || 'N/A'})`)
          } else if (provider === 'azureOpenai' && providerConfig?.deploymentName) {
            console.log(`    ${chalk.white(displayName)}: ${providerConfig.deploymentName}`)
          } else if (provider === 'google' && providerConfig?.defaultModel) {
            console.log(`    ${chalk.white(displayName)}: ${providerConfig.defaultModel}`)
          } else {
            console.log(`    ${chalk.white(displayName)}: Configured`)
          }
        })
      }
      
      if (config.aiConfig.lastConfigured) {
        console.log(`  ${chalk.gray('Last configured: ' + new Date(config.aiConfig.lastConfigured).toLocaleString())}`)
      }
    } else {
      console.log(chalk.yellow('  ⚠️  AI not configured'))
      console.log(chalk.gray('  Run `pixell config-ai` to set up AI integration'))
    }
    
    // Project state
    const currentProject = store.currentProject
    if (currentProject) {
      console.log(chalk.bold('\nCURRENT PROJECT:'))
      console.log(`  Name: ${chalk.white(currentProject.name)}`)
      console.log(`  Path: ${chalk.gray(currentProject.path)}`)
      console.log(`  Template: ${chalk.white(currentProject.template)}`)
      console.log(`  Runtime: ${chalk.white(currentProject.runtime)}`)
      console.log(`  Created: ${chalk.gray(new Date(currentProject.createdAt).toLocaleDateString())}`)
    } else {
      console.log(chalk.bold('\nCURRENT PROJECT:'))
      console.log(chalk.gray('  No active project'))
      console.log(chalk.yellow('  Run `pixell create <app-name>` to create a new project'))
    }
    
    // Metadata
    console.log(chalk.bold('\nMETADATA:'))
    console.log(`  CLI Version: ${chalk.white('0.3.0')}`)
    console.log(`  Config Location: ${chalk.gray('~/.config/pixell/config.json')}`)
    
    if (config.lastUpdate) {
      console.log(`  Last Updated: ${chalk.gray(new Date(config.lastUpdate).toLocaleString())}`)
    }
    
    console.log(chalk.blue('\nCommands:'))
    console.log(chalk.white('  pixell config-init - Reconfigure settings'))
    console.log(chalk.white('  pixell config-ai - Configure AI runtime and credentials'))
    console.log(chalk.white('  pixell plugins list - View available plugins'))
    console.log(chalk.white('  pixell create <name> - Create new project'))
    
  } catch (error) {
    console.error(chalk.red('Failed to show configuration:'), error)
  }
}

export async function setStorageLimit(limit?: string) {
  console.log(chalk.blue('💾 Setting storage limit...\n'))
  
  try {
    const store = useCLIStore.getState()
    let storageLimit: number
    
    if (limit) {
      storageLimit = parseInt(limit)
      if (isNaN(storageLimit) || storageLimit <= 0 || storageLimit > 1000) {
        console.error(chalk.red('Storage limit must be a number between 1 and 1000 GB'))
        return
      }
    } else {
      const answer = await inquirer.prompt([
        {
          type: 'input',
          name: 'storageLimit',
          message: 'Storage limit for file uploads (in GB):',
          default: store.config.storageLimit.toString(),
          validate: (input) => {
            const limit = parseInt(input)
            if (isNaN(limit) || limit <= 0) return 'Please enter a valid number greater than 0'
            if (limit > 1000) return 'Storage limit cannot exceed 1000GB'
            return true
          },
          filter: (input) => parseInt(input)
        }
      ])
      storageLimit = answer.storageLimit
    }
    
    // Update configuration
    store.setConfig({
      storageLimit,
      lastUpdate: new Date().toISOString()
    })
    
    console.log(chalk.green(`✅ Storage limit set to ${storageLimit}GB`))
    console.log(chalk.gray('This setting will be used by the Navigator pane and file upload functions'))
    
  } catch (error) {
    console.error(chalk.red('Failed to set storage limit:'), error)
  }
}

export async function configAI() {
  console.log(chalk.blue.bold('🤖 MULTI-PROVIDER AI CONFIGURATION'))
  console.log(chalk.blue('='.repeat(50)))
  console.log(chalk.gray('Configure multiple AI providers for maximum flexibility\n'))
  
  try {
    const store = useCLIStore.getState()
    const currentAiConfig = store.config.aiConfig
    
    // Step 1: Choose setup mode
    const setupMode = await inquirer.prompt([
      {
        type: 'list',
        name: 'mode',
        message: 'How would you like to configure AI providers?',
        choices: [
          {
            name: '🚀 Quick Setup (OpenAI only - Recommended)',
            value: 'quick'
          },
          {
            name: '⚙️  Advanced Setup (Multiple providers)',
            value: 'advanced'
          },
          {
            name: '📝 Manage Existing Providers',
            value: 'manage'
          }
        ],
        default: 'quick'
      }
    ])
    
    let aiConfig: any = {
      defaultProvider: currentAiConfig.defaultProvider || 'openai',
      providers: { ...currentAiConfig.providers },
      configured: false,
      lastConfigured: new Date().toISOString()
    }
    
    if (setupMode.mode === 'quick') {
      // Quick OpenAI setup
      console.log(chalk.blue('\n🚀 Quick OpenAI Setup'))
      console.log(chalk.gray('Get your API key from https://platform.openai.com/api-keys'))
      
      const openaiConfig = await inquirer.prompt([
        {
          type: 'password',
          name: 'apiKey',
          message: 'OpenAI API Key:',
          default: currentAiConfig.providers?.openai?.apiKey || '',
          validate: (input) => input.trim() ? true : 'OpenAI API Key is required'
        },
        {
          type: 'list',
          name: 'defaultModel',
          message: 'Default Model:',
          choices: [
            { name: 'GPT-4o (Best overall)', value: 'gpt-4o' },
            { name: 'GPT-4o Mini (Fast & cheap)', value: 'gpt-4o-mini' },
            { name: 'GPT-4 Turbo (Previous gen)', value: 'gpt-4-turbo' },
            { name: 'o1-preview (Reasoning)', value: 'o1-preview' },
            { name: 'o1-mini (Fast reasoning)', value: 'o1-mini' }
          ],
          default: currentAiConfig.providers?.openai?.defaultModel || 'gpt-4o'
        },
        {
          type: 'input',
          name: 'organization',
          message: 'Organization ID (optional):',
          default: currentAiConfig.providers?.openai?.organization || ''
        }
      ])
      
      aiConfig.providers.openai = {
        ...openaiConfig,
        organization: openaiConfig.organization || undefined,
        enabled: true
      }
      aiConfig.defaultProvider = 'openai'
      aiConfig.configured = true
      
    } else if (setupMode.mode === 'advanced') {
      // Advanced multi-provider setup
      console.log(chalk.blue('\n⚙️  Advanced Multi-Provider Setup'))
      
      const providersToSetup = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'providers',
          message: 'Which AI providers would you like to configure?',
          choices: [
            { name: '🧠 OpenAI (GPT-4o, GPT-4o Mini, o1)', value: 'openai', checked: true },
            { name: '🎭 Anthropic (Claude 3.5 Sonnet, Haiku)', value: 'anthropic' },
            { name: '🏗️  AWS Bedrock (Multiple models via AWS)', value: 'awsBedrock' },
            { name: '☁️  Azure OpenAI (Enterprise GPT models)', value: 'azureOpenai' },
            { name: '🔍 Google (Gemini 1.5 Pro)', value: 'google' }
          ],
          validate: (input) => input.length > 0 ? true : 'Select at least one provider'
        }
      ])
      
      // Configure each selected provider
      for (const provider of providersToSetup.providers) {
        await configureProvider(provider, aiConfig, currentAiConfig)
      }
      
      // Choose default provider
      if (providersToSetup.providers.length > 1) {
        const defaultChoice = await inquirer.prompt([
          {
            type: 'list',
            name: 'defaultProvider',
            message: 'Which provider should be the default?',
            choices: providersToSetup.providers.map((p: string) => ({
              name: getProviderDisplayName(p),
              value: p
            })),
            default: providersToSetup.providers.includes('openai') ? 'openai' : providersToSetup.providers[0]
          }
        ])
        aiConfig.defaultProvider = defaultChoice.defaultProvider
      } else {
        aiConfig.defaultProvider = providersToSetup.providers[0]
      }
      
      aiConfig.configured = true
      
    } else if (setupMode.mode === 'manage') {
      // Manage existing providers
      await manageExistingProviders(aiConfig, currentAiConfig)
    }
    
    // Step 3: Save configuration
    store.setConfig({
      aiConfig,
      lastUpdate: new Date().toISOString()
    })
    
    // Step 4: Write environment variables to .env.local
    await writeEnvironmentVariables(aiConfig)
    
    console.log(chalk.green('\n✅ AI Configuration saved successfully!'))
    
    // Show configuration summary
    showConfigurationSummary(aiConfig)
    
    console.log(chalk.blue('\n🚀 Next Steps:'))
    console.log(chalk.white('  1. Start your project: pixell start --env local'))
    console.log(chalk.white('  2. Test AI integration in the chat workspace'))
    console.log(chalk.white('  3. Switch models dynamically in your application'))
    
    console.log(chalk.gray('\n💡 Pro Tips:'))
    console.log(chalk.gray('  • Use multiple providers for fallback/redundancy'))
    console.log(chalk.gray('  • Different models excel at different tasks'))
    console.log(chalk.gray('  • Run `pixell config-ai` anytime to add more providers'))
    
  } catch (error) {
    console.error(chalk.red('Failed to configure AI:'), error)
  }
}

async function configureProvider(provider: string, aiConfig: any, currentAiConfig: any) {
  switch (provider) {
    case 'openai':
      await configureOpenAI(aiConfig, currentAiConfig)
      break
    case 'anthropic':
      await configureAnthropic(aiConfig, currentAiConfig)
      break
    case 'awsBedrock':
      await configureAWSBedrock(aiConfig, currentAiConfig)
      break
    case 'azureOpenai':
      await configureAzureOpenAI(aiConfig, currentAiConfig)
      break
    case 'google':
      await configureGoogle(aiConfig, currentAiConfig)
      break
  }
}

async function configureOpenAI(aiConfig: any, currentAiConfig: any) {
  console.log(chalk.blue('\n🧠 OpenAI Configuration'))
  console.log(chalk.gray('Get your API key from https://platform.openai.com/api-keys'))
  
  const config = await inquirer.prompt([
    {
      type: 'password',
      name: 'apiKey',
      message: 'OpenAI API Key:',
      default: currentAiConfig.providers?.openai?.apiKey || '',
      validate: (input) => input.trim() ? true : 'OpenAI API Key is required'
    },
    {
      type: 'list',
      name: 'defaultModel',
      message: 'Default Model:',
      choices: [
        { name: 'GPT-4o (Best overall)', value: 'gpt-4o' },
        { name: 'GPT-4o Mini (Fast & cheap)', value: 'gpt-4o-mini' },
        { name: 'o1-preview (Reasoning)', value: 'o1-preview' },
        { name: 'o1-mini (Fast reasoning)', value: 'o1-mini' },
        { name: 'GPT-4 Turbo (Previous gen)', value: 'gpt-4-turbo' }
      ],
      default: currentAiConfig.providers?.openai?.defaultModel || 'gpt-4o'
    },
    {
      type: 'input',
      name: 'organization',
      message: 'Organization ID (optional):',
      default: currentAiConfig.providers?.openai?.organization || ''
    },
    {
      type: 'input',
      name: 'baseUrl',
      message: 'Custom Base URL (optional):',
      default: currentAiConfig.providers?.openai?.baseUrl || ''
    }
  ])
  
  aiConfig.providers.openai = {
    ...config,
    organization: config.organization || undefined,
    baseUrl: config.baseUrl || undefined,
    enabled: true
  }
}

async function configureAnthropic(aiConfig: any, currentAiConfig: any) {
  console.log(chalk.blue('\n🎭 Anthropic Configuration'))
  console.log(chalk.gray('Get your API key from https://console.anthropic.com'))
  
  const config = await inquirer.prompt([
    {
      type: 'password',
      name: 'apiKey',
      message: 'Anthropic API Key:',
      default: currentAiConfig.providers?.anthropic?.apiKey || '',
      validate: (input) => input.trim() ? true : 'Anthropic API Key is required'
    },
    {
      type: 'list',
      name: 'defaultModel',
      message: 'Default Model:',
      choices: [
        { name: 'Claude 3.5 Sonnet (Best overall)', value: 'claude-3-5-sonnet-20241022' },
        { name: 'Claude 3.5 Haiku (Fast & cheap)', value: 'claude-3-5-haiku-20241022' },
        { name: 'Claude 3 Opus (Most capable)', value: 'claude-3-opus-20240229' }
      ],
      default: currentAiConfig.providers?.anthropic?.defaultModel || 'claude-3-5-sonnet-20241022'
    }
  ])
  
  aiConfig.providers.anthropic = {
    ...config,
    enabled: true
  }
}

async function configureAWSBedrock(aiConfig: any, currentAiConfig: any) {
  console.log(chalk.blue('\n🏗️  AWS Bedrock Configuration'))
  console.log(chalk.gray('You need AWS credentials with Bedrock access'))
  
  const config = await inquirer.prompt([
    {
      type: 'input',
      name: 'accessKeyId',
      message: 'AWS Access Key ID:',
      default: currentAiConfig.providers?.awsBedrock?.accessKeyId || '',
      validate: (input) => input.trim() ? true : 'AWS Access Key ID is required'
    },
    {
      type: 'password',
      name: 'secretAccessKey',
      message: 'AWS Secret Access Key:',
      default: currentAiConfig.providers?.awsBedrock?.secretAccessKey || '',
      validate: (input) => input.trim() ? true : 'AWS Secret Access Key is required'
    },
    {
      type: 'list',
      name: 'region',
      message: 'AWS Region:',
      choices: [
        { name: 'US East 1 (N. Virginia)', value: 'us-east-1' },
        { name: 'US West 2 (Oregon)', value: 'us-west-2' },
        { name: 'EU West 1 (Ireland)', value: 'eu-west-1' },
        { name: 'Asia Pacific (Tokyo)', value: 'ap-northeast-1' }
      ],
      default: currentAiConfig.providers?.awsBedrock?.region || 'us-east-1'
    },
    {
      type: 'list',
      name: 'defaultModel',
      message: 'Default Model:',
      choices: [
        { name: 'Claude 3.5 Sonnet (Recommended)', value: 'anthropic.claude-3-5-sonnet-20241022-v2:0' },
        { name: 'Claude 3.5 Haiku (Faster)', value: 'anthropic.claude-3-5-haiku-20241022-v1:0' },
        { name: 'Claude 3 Opus (Most Capable)', value: 'anthropic.claude-3-opus-20240229-v1:0' }
      ],
      default: currentAiConfig.providers?.awsBedrock?.defaultModel || 'anthropic.claude-3-5-sonnet-20241022-v2:0'
    }
  ])
  
  aiConfig.providers.awsBedrock = {
    ...config,
    enabled: true
  }
}

async function configureAzureOpenAI(aiConfig: any, currentAiConfig: any) {
  console.log(chalk.blue('\n☁️  Azure OpenAI Configuration'))
  console.log(chalk.gray('Get your credentials from Azure Portal'))
  
  const config = await inquirer.prompt([
    {
      type: 'password',
      name: 'apiKey',
      message: 'Azure OpenAI API Key:',
      default: currentAiConfig.providers?.azureOpenai?.apiKey || '',
      validate: (input) => input.trim() ? true : 'Azure OpenAI API Key is required'
    },
    {
      type: 'input',
      name: 'endpoint',
      message: 'Azure OpenAI Endpoint:',
      default: currentAiConfig.providers?.azureOpenai?.endpoint || '',
      validate: (input) => input.trim() ? true : 'Azure OpenAI Endpoint is required'
    },
    {
      type: 'input',
      name: 'deploymentName',
      message: 'Deployment Name:',
      default: currentAiConfig.providers?.azureOpenai?.deploymentName || '',
      validate: (input) => input.trim() ? true : 'Deployment Name is required'
    },
    {
      type: 'input',
      name: 'apiVersion',
      message: 'API Version:',
      default: currentAiConfig.providers?.azureOpenai?.apiVersion || '2024-02-01'
    }
  ])
  
  aiConfig.providers.azureOpenai = {
    ...config,
    enabled: true
  }
}

async function configureGoogle(aiConfig: any, currentAiConfig: any) {
  console.log(chalk.blue('\n🔍 Google AI Configuration'))
  console.log(chalk.gray('Get your API key from Google AI Studio'))
  
  const config = await inquirer.prompt([
    {
      type: 'password',
      name: 'apiKey',
      message: 'Google AI API Key:',
      default: currentAiConfig.providers?.google?.apiKey || '',
      validate: (input) => input.trim() ? true : 'Google AI API Key is required'
    },
    {
      type: 'list',
      name: 'defaultModel',
      message: 'Default Model:',
      choices: [
        { name: 'Gemini 1.5 Pro (Best overall)', value: 'gemini-1.5-pro' },
        { name: 'Gemini 1.5 Flash (Fast)', value: 'gemini-1.5-flash' },
        { name: 'Gemini 1.0 Pro (Previous gen)', value: 'gemini-1.0-pro' }
      ],
      default: currentAiConfig.providers?.google?.defaultModel || 'gemini-1.5-pro'
    }
  ])
  
  aiConfig.providers.google = {
    ...config,
    enabled: true
  }
}

function getProviderDisplayName(provider: string): string {
  const names: Record<string, string> = {
    openai: '🧠 OpenAI',
    anthropic: '🎭 Anthropic',
    awsBedrock: '🏗️  AWS Bedrock',
    azureOpenai: '☁️  Azure OpenAI',
    google: '🔍 Google AI'
  }
  return names[provider] || provider
}

async function manageExistingProviders(aiConfig: any, currentAiConfig: any) {
  console.log(chalk.blue('\n📝 Manage Existing Providers'))
  
  const enabledProviders = Object.keys(currentAiConfig.providers || {})
    .filter(key => currentAiConfig.providers[key]?.enabled)
  
  if (enabledProviders.length === 0) {
    console.log(chalk.yellow('No providers configured yet. Use Quick Setup or Advanced Setup first.'))
    return
  }
  
  const action = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: 'Add new provider', value: 'add' },
        { name: 'Edit existing provider', value: 'edit' },
        { name: 'Enable/disable providers', value: 'toggle' },
        { name: 'Change default provider', value: 'default' }
      ]
    }
  ])
  
  // Implementation would continue based on action.action
  aiConfig.configured = true
}

function showConfigurationSummary(aiConfig: any) {
  console.log(chalk.blue('\n📋 Configuration Summary:'))
  console.log(chalk.white(`  Default Provider: ${getProviderDisplayName(aiConfig.defaultProvider)}`))
  
  const enabledProviders = Object.keys(aiConfig.providers)
    .filter(key => aiConfig.providers[key]?.enabled)
  
  console.log(chalk.white(`  Enabled Providers: ${enabledProviders.length}`))
  
  enabledProviders.forEach(provider => {
    const config = aiConfig.providers[provider]
    const displayName = getProviderDisplayName(provider)
    
    if (provider === 'openai') {
      console.log(chalk.white(`    ${displayName}: ${config.defaultModel} (${config.apiKey?.substring(0, 8)}...)`))
    } else if (provider === 'anthropic') {
      console.log(chalk.white(`    ${displayName}: ${config.defaultModel} (${config.apiKey?.substring(0, 8)}...)`))
    } else if (provider === 'awsBedrock') {
      console.log(chalk.white(`    ${displayName}: ${config.defaultModel} (${config.region})`))
    } else if (provider === 'azureOpenai') {
      console.log(chalk.white(`    ${displayName}: ${config.deploymentName} (${config.endpoint})`))
    } else if (provider === 'google') {
      console.log(chalk.white(`    ${displayName}: ${config.defaultModel} (${config.apiKey?.substring(0, 8)}...)`))
    }
  })
}

async function writeEnvironmentVariables(aiConfig: any) {
  try {
    const envPath = path.join(process.cwd(), '.env.local')
    let envContent = ''
    
    // Read existing .env.local if it exists
    if (await fs.pathExists(envPath)) {
      envContent = await fs.readFile(envPath, 'utf-8')
    }
    
    // Remove existing AI-related variables
    const linesToKeep = envContent.split('\n').filter(line => {
      const aiVars = [
        'AI_DEFAULT_PROVIDER',
        'OPENAI_API_KEY',
        'OPENAI_MODEL',
        'OPENAI_ORGANIZATION',
        'OPENAI_BASE_URL',
        'ANTHROPIC_API_KEY',
        'ANTHROPIC_MODEL',
        'AWS_ACCESS_KEY_ID',
        'AWS_SECRET_ACCESS_KEY',
        'AWS_REGION',
        'AWS_BEDROCK_MODEL',
        'AZURE_OPENAI_API_KEY',
        'AZURE_OPENAI_ENDPOINT',
        'AZURE_OPENAI_DEPLOYMENT',
        'AZURE_OPENAI_API_VERSION',
        'GOOGLE_AI_API_KEY',
        'GOOGLE_AI_MODEL'
      ]
      return !aiVars.some(varName => line.startsWith(`${varName}=`))
    })
    
    // Add new AI configuration
    const newLines = [`# Multi-Provider AI Configuration (Generated by pixell config ai)`]
    newLines.push(`AI_DEFAULT_PROVIDER=${aiConfig.defaultProvider}`)
    
    // Add agent runtime (execution framework) - defaults to aws-strand
    newLines.push(`AGENT_RUNTIME=aws-strand`)
    
    // Add orchestrator URL for frontend connection
    newLines.push(`NEXT_PUBLIC_ORCHESTRATOR_URL=http://localhost:3001`)
    
    // Add provider-specific variables
    Object.keys(aiConfig.providers).forEach(provider => {
      const config = aiConfig.providers[provider]
      if (!config?.enabled) return
      
      if (provider === 'openai') {
        newLines.push(`OPENAI_API_KEY=${config.apiKey}`)
        newLines.push(`OPENAI_MODEL=${config.defaultModel}`)
        if (config.organization) newLines.push(`OPENAI_ORGANIZATION=${config.organization}`)
        if (config.baseUrl) newLines.push(`OPENAI_BASE_URL=${config.baseUrl}`)
      } else if (provider === 'anthropic') {
        newLines.push(`ANTHROPIC_API_KEY=${config.apiKey}`)
        newLines.push(`ANTHROPIC_MODEL=${config.defaultModel}`)
      } else if (provider === 'awsBedrock') {
        newLines.push(`AWS_ACCESS_KEY_ID=${config.accessKeyId}`)
        newLines.push(`AWS_SECRET_ACCESS_KEY=${config.secretAccessKey}`)
        newLines.push(`AWS_REGION=${config.region}`)
        newLines.push(`AWS_BEDROCK_MODEL=${config.defaultModel}`)
      } else if (provider === 'azureOpenai') {
        newLines.push(`AZURE_OPENAI_API_KEY=${config.apiKey}`)
        newLines.push(`AZURE_OPENAI_ENDPOINT=${config.endpoint}`)
        newLines.push(`AZURE_OPENAI_DEPLOYMENT=${config.deploymentName}`)
        newLines.push(`AZURE_OPENAI_API_VERSION=${config.apiVersion}`)
      } else if (provider === 'google') {
        newLines.push(`GOOGLE_AI_API_KEY=${config.apiKey}`)
        newLines.push(`GOOGLE_AI_MODEL=${config.defaultModel}`)
      }
    })
    
    // Combine existing and new content
    const finalContent = [...linesToKeep, '', ...newLines, ''].join('\n')
    
    // Write to .env.local
    await fs.writeFile(envPath, finalContent)
    
    console.log(chalk.green(`✅ Environment variables written to ${envPath}`))
    
  } catch (error) {
    console.log(chalk.yellow(`⚠️  Could not write to .env.local: ${error}`))
    console.log(chalk.gray('You may need to set environment variables manually'))
  }
}