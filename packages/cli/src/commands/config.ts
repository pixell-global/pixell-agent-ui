import chalk from 'chalk'
import inquirer from 'inquirer'
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
    console.log(chalk.white('  pixell config init - Reconfigure settings'))
    console.log(chalk.white('  pixell plugins list - View available plugins'))
    console.log(chalk.white('  pixell create <name> - Create new project'))
    
  } catch (error) {
    console.error(chalk.red('Failed to show configuration:'), error)
  }
} 