import chalk from 'chalk'
import ora from 'ora'
import { useCLIStore } from '../stores/cli-store'

interface ExtensionListOptions {
  type?: string
  installed?: boolean
}

interface ExtensionInstallOptions {
  version?: string
}

export async function listExtensions(options: ExtensionListOptions) {
  const spinner = ora('Fetching extensions...').start()
  
  try {
    const store = useCLIStore.getState()
    
    // Fetch available extensions
    await store.fetchAvailablePlugins()
    
    spinner.succeed('Extensions loaded')
    
    let extensions = store.availablePlugins
    
    // Filter by type
    if (options.type) {
      extensions = store.getPluginsByType(options.type)
    }
    
    // Filter by installed status
    if (options.installed) {
      extensions = extensions.filter(extension => store.isPluginInstalled(extension.id))
    }
    
    if (extensions.length === 0) {
      console.log(chalk.yellow('No extensions found matching criteria'))
      return
    }
    
    console.log(chalk.blue(`\nFound ${extensions.length} extension(s):\n`))
    
    // Group by type
    const extensionsByType = extensions.reduce((acc, extension) => {
      if (!acc[extension.type]) {
        acc[extension.type] = []
      }
      acc[extension.type].push(extension)
      return acc
    }, {} as Record<string, typeof extensions>)
    
    // Display extensions by type
    Object.entries(extensionsByType).forEach(([type, typeExtensions]) => {
      console.log(chalk.bold.blue(`${type.toUpperCase()} EXTENSIONS:`))
      
      typeExtensions.forEach(extension => {
        const installed = store.isPluginInstalled(extension.id)
        const verifiedBadge = extension.verified ? chalk.green('✓ verified') : chalk.gray('unverified')
        const installedBadge = installed ? chalk.green('✓ installed') : ''
        
        console.log(`  ${chalk.white.bold(extension.name)} ${chalk.gray(`v${extension.version}`)} ${verifiedBadge} ${installedBadge}`)
        console.log(`    ${chalk.gray(extension.description)}`)
        console.log(`    ${chalk.gray(`Downloads: ${extension.downloads.toLocaleString()}`)}`)
        console.log()
      })
    })
    
    // Show installation instructions
    console.log(chalk.blue('Usage:'))
    console.log(chalk.white('  pixell extensions-install <extension-id>'))
    console.log(chalk.white('  pixell extensions-uninstall <extension-id>'))
    
  } catch (error) {
    spinner.fail(`Failed to list extensions: ${error}`)
    console.error(error)
  }
}

export async function installExtension(extensionId: string, options: ExtensionInstallOptions) {
  const spinner = ora(`Installing extension: ${extensionId}...`).start()
  
  try {
    const store = useCLIStore.getState()
    
    // Check if already installed
    if (store.isPluginInstalled(extensionId)) {
      spinner.fail(`Extension ${extensionId} is already installed`)
      return
    }
    
    // Find extension in registry
    await store.fetchAvailablePlugins()
    const extension = store.availablePlugins.find(p => p.id === extensionId)
    
    if (!extension) {
      spinner.fail(`Extension ${extensionId} not found in registry`)
      console.log(chalk.yellow('Run `pixell extensions-list` to see available extensions'))
      return
    }
    
    spinner.text = `Installing ${extension.name} v${options.version || extension.version}...`
    
    // Simulate installation process
    await simulateInstallation(extension, options.version)
    
    // Add to installed extensions
    store.addInstalledPlugin(extensionId)
    
    spinner.succeed(`Successfully installed ${chalk.green(extension.name)}!`)
    
    // Show post-installation info
    console.log(chalk.blue('\nExtension Information:'))
    console.log(chalk.white(`  Name: ${extension.name}`))
    console.log(chalk.white(`  Type: ${extension.type}`))
    console.log(chalk.white(`  Version: ${options.version || extension.version}`))
    console.log(chalk.white(`  Description: ${extension.description}`))
    
    if (extension.type === 'runtime') {
      console.log(chalk.blue('\nNext steps:'))
      console.log(chalk.white(`  pixell runtime-swap --to ${extensionId.replace('-runtime', '')}`))
    } else if (extension.type === 'worker') {
      console.log(chalk.blue('\nNext steps:'))
      console.log(chalk.white('  Restart your orchestrator to register the new agent'))
    }
    
  } catch (error) {
    spinner.fail(`Failed to install extension: ${error}`)
    console.error(error)
  }
}

export async function uninstallExtension(extensionId: string) {
  const spinner = ora(`Uninstalling extension: ${extensionId}...`).start()
  
  try {
    const store = useCLIStore.getState()
    
    // Check if installed
    if (!store.isPluginInstalled(extensionId)) {
      spinner.fail(`Extension ${extensionId} is not installed`)
      return
    }
    
    // Find extension details
    await store.fetchAvailablePlugins()
    const extension = store.availablePlugins.find(p => p.id === extensionId)
    const extensionName = extension?.name || extensionId
    
    spinner.text = `Removing ${extensionName}...`
    
    // Simulate uninstallation
    await simulateUninstallation(extensionId)
    
    // Remove from installed extensions
    store.removeInstalledPlugin(extensionId)
    
    spinner.succeed(`Successfully uninstalled ${chalk.green(extensionName)}!`)
    
    if (extension?.type === 'runtime') {
      console.log(chalk.yellow('\nWarning: You may need to swap to a different runtime'))
      console.log(chalk.white('Run `pixell runtime-swap --to aws-strand` to use the default runtime'))
    }
    
  } catch (error) {
    spinner.fail(`Failed to uninstall extension: ${error}`)
    console.error(error)
  }
}

async function simulateInstallation(extension: any, version?: string): Promise<void> {
  // Simulate network delay and installation steps
  const steps = [
    'Downloading package...',
    'Verifying integrity...',
    'Installing dependencies...',
    'Registering extension...'
  ]
  
  for (const step of steps) {
    await new Promise(resolve => setTimeout(resolve, 500))
    // Update spinner text would go here in a real implementation
  }
}

async function simulateUninstallation(extensionId: string): Promise<void> {
  // Simulate uninstallation steps
  const steps = [
    'Stopping services...',
    'Removing files...',
    'Cleaning up dependencies...',
    'Updating registry...'
  ]
  
  for (const step of steps) {
    await new Promise(resolve => setTimeout(resolve, 300))
    // Update spinner text would go here in a real implementation
  }
} 