#!/usr/bin/env node

const { execSync } = require('child_process')

// Get app name from command line
const appName = process.argv[2]

if (!appName) {
  console.error('Error: App name is required')
  console.log('Usage: create-pixell-agent <app-name>')
  process.exit(1)
}

// Run pixell create command
try {
  execSync(`npx @pixell/cli create ${appName}`, { stdio: 'inherit' })
} catch (error) {
  console.error('Failed to create app:', error.message)
  process.exit(1)
} 