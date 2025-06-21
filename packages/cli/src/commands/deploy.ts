import { execSync } from 'child_process'
import fs from 'fs-extra'
import path from 'path'
import chalk from 'chalk'
import ora from 'ora'
import { useCLIStore } from '../stores/cli-store'

interface DeployOptions {
  platform: string
  env: string
  dryRun: boolean
}

const deploymentTargets = {
  docker: {
    name: 'Docker',
    description: 'Deploy using Docker containers',
    commands: [
      'docker build -t pixell-app .',
      'docker run -p 3000:3000 pixell-app'
    ]
  },
  kubernetes: {
    name: 'Kubernetes',
    description: 'Deploy to Kubernetes cluster',
    commands: [
      'kubectl apply -f k8s/',
      'kubectl get deployments'
    ]
  },
  vercel: {
    name: 'Vercel',
    description: 'Deploy to Vercel platform',
    commands: [
      'vercel --prod'
    ]
  },
  aws: {
    name: 'AWS',
    description: 'Deploy to AWS using CDK',
    commands: [
      'cdk deploy --all'
    ]
  }
}

export async function deployApp(options: DeployOptions) {
  const spinner = ora('Preparing deployment...').start()
  
  try {
    const store = useCLIStore.getState()
    store.setDeploying(true)
    
    // Check if we're in a Pixell project
    if (!store.currentProject) {
      spinner.fail('Not in a Pixell project. Run `pixell create <app-name>` first.')
      return
    }
    
    const target = deploymentTargets[options.platform as keyof typeof deploymentTargets]
    if (!target) {
      spinner.fail(`Unsupported platform: ${options.platform}`)
      console.log(chalk.yellow('Supported platforms:'), Object.keys(deploymentTargets).join(', '))
      return
    }
    
    spinner.text = `Deploying to ${target.name}...`
    
    // Pre-deployment checks
    await performPreDeploymentChecks(store.currentProject.path, options)
    
    if (options.dryRun) {
      spinner.succeed('Dry run completed')
      console.log(chalk.blue('\nDeployment Plan:'))
      console.log(chalk.white(`Platform: ${target.name}`))
      console.log(chalk.white(`Environment: ${options.env}`))
      console.log(chalk.white(`Project: ${store.currentProject.name}`))
      
      console.log(chalk.blue('\nCommands that would be executed:'))
      target.commands.forEach(cmd => {
        console.log(chalk.gray(`  ${cmd}`))
      })
      return
    }
    
    // Generate deployment files based on platform
    await generateDeploymentFiles(options.platform, store.currentProject.path, options.env)
    
    // Execute deployment commands
    for (const command of target.commands) {
      spinner.text = `Running: ${command}`
      
      try {
        execSync(command, {
          cwd: store.currentProject.path,
          stdio: 'inherit'
        })
      } catch (error) {
        spinner.fail(`Deployment failed at: ${command}`)
        throw error
      }
    }
    
    spinner.succeed(`Successfully deployed to ${chalk.green(target.name)}!`)
    
    // Show deployment info
    await showDeploymentInfo(options.platform, options.env)
    
  } catch (error) {
    spinner.fail(`Deployment failed: ${error}`)
    console.error(error)
  } finally {
    useCLIStore.getState().setDeploying(false)
  }
}

async function performPreDeploymentChecks(projectPath: string, options: DeployOptions) {
  // Check if required files exist
  const requiredFiles = ['package.json', 'Dockerfile']
  
  for (const file of requiredFiles) {
    if (!fs.existsSync(path.join(projectPath, file))) {
      throw new Error(`Required file missing: ${file}`)
    }
  }
  
  // Check environment variables
  const envFile = path.join(projectPath, '.env.local')
  if (!fs.existsSync(envFile)) {
    console.log(chalk.yellow('Warning: .env.local file not found'))
  }
  
  // Platform-specific checks
  switch (options.platform) {
    case 'kubernetes':
      if (!fs.existsSync(path.join(projectPath, 'k8s'))) {
        throw new Error('Kubernetes manifests not found. Run `pixell generate k8s` first.')
      }
      break
    case 'aws':
      if (!fs.existsSync(path.join(projectPath, 'cdk.json'))) {
        throw new Error('AWS CDK configuration not found.')
      }
      break
  }
}

async function generateDeploymentFiles(platform: string, projectPath: string, env: string) {
  switch (platform) {
    case 'kubernetes':
      await generateKubernetesManifests(projectPath, env)
      break
    case 'aws':
      await generateAWSCDKStack(projectPath, env)
      break
    case 'vercel':
      await generateVercelConfig(projectPath, env)
      break
  }
}

async function generateKubernetesManifests(projectPath: string, env: string) {
  const k8sDir = path.join(projectPath, 'k8s')
  fs.ensureDirSync(k8sDir)
  
  const deployment = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: pixell-app
  labels:
    app: pixell-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: pixell-app
  template:
    metadata:
      labels:
        app: pixell-app
    spec:
      containers:
      - name: app
        image: pixell-app:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "${env}"
---
apiVersion: v1
kind: Service
metadata:
  name: pixell-app-service
spec:
  selector:
    app: pixell-app
  ports:
    - protocol: TCP
      port: 80
      targetPort: 3000
  type: LoadBalancer
`
  
  fs.writeFileSync(path.join(k8sDir, 'deployment.yaml'), deployment)
}

async function generateAWSCDKStack(projectPath: string, env: string) {
  const cdkStack = `import * as cdk from 'aws-cdk-lib'
import * as ecs from 'aws-cdk-lib/aws-ecs'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import { Construct } from 'constructs'

export class PixellAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    // Create VPC
    const vpc = new ec2.Vpc(this, 'PixellVPC', {
      maxAzs: 2
    })

    // Create ECS Cluster
    const cluster = new ecs.Cluster(this, 'PixellCluster', {
      vpc: vpc
    })

    // Create Fargate Service
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'PixellTask', {
      memoryLimitMiB: 1024,
      cpu: 512
    })

    taskDefinition.addContainer('PixellContainer', {
      image: ecs.ContainerImage.fromRegistry('pixell-app:latest'),
      portMappings: [{ containerPort: 3000 }],
      environment: {
        NODE_ENV: '${env}'
      }
    })

    new ecs.FargateService(this, 'PixellService', {
      cluster,
      taskDefinition,
      publicLoadBalancer: true
    })
  }
}
`
  
  fs.writeFileSync(path.join(projectPath, 'lib', 'pixell-app-stack.ts'), cdkStack)
}

async function generateVercelConfig(projectPath: string, env: string) {
  const vercelConfig = {
    name: path.basename(projectPath),
    version: 2,
    builds: [
      {
        src: 'apps/web/package.json',
        use: '@vercel/next'
      }
    ],
    env: {
      NODE_ENV: env
    }
  }
  
  fs.writeFileSync(
    path.join(projectPath, 'vercel.json'), 
    JSON.stringify(vercelConfig, null, 2)
  )
}

async function showDeploymentInfo(platform: string, env: string) {
  console.log(chalk.blue('\nDeployment Information:'))
  
  switch (platform) {
    case 'docker':
      console.log(chalk.white('🐳 Container: pixell-app:latest'))
      console.log(chalk.white('🌐 URL: http://localhost:3000'))
      break
    case 'kubernetes':
      console.log(chalk.white('☸️  Cluster: Check kubectl get services'))
      console.log(chalk.white('🔍 Monitor: kubectl logs -f deployment/pixell-app'))
      break
    case 'vercel':
      console.log(chalk.white('🚀 Platform: Vercel'))
      console.log(chalk.white('🌐 URL: Check Vercel dashboard'))
      break
    case 'aws':
      console.log(chalk.white('☁️  Platform: AWS'))
      console.log(chalk.white('🔍 Monitor: AWS CloudWatch'))
      break
  }
  
  console.log(chalk.gray(`Environment: ${env}`))
  console.log(chalk.gray(`Deployed at: ${new Date().toISOString()}`))
} 