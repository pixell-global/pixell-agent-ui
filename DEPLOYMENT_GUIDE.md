# Pixell Agent Framework - Deployment Guide

## Overview

The `deploy.sh` script has been configured to correctly deploy the Pixell Agent Framework to **app.pixell.global** using the proper AWS infrastructure settings.

## Production Deployment

### Quick Start

To deploy to production (app.pixell.global):

```bash
./deploy.sh --env prod
```

### What It Does

The deployment script automatically:

1. **Validates Prerequisites**
   - Checks AWS CLI configuration
   - Verifies Docker is running
   - Confirms `.env.prod` file exists
   - Validates jq is installed

2. **Builds and Pushes Docker Image**
   - Builds the Next.js app for production
   - Tags image as `pixell-web:prod`
   - Pushes to AWS ECR in us-east-2

3. **Updates ECS Task Definition**
   - Creates new task definition revision
   - Includes all production environment variables from `.env.prod`
   - Sets `PIXELL_ENV=prod` to trigger AWS Secrets Manager loading
   - Configures Firebase, PAR runtime, and other production settings

4. **Deploys to Correct AWS Infrastructure**
   - **VPC**: `vpc-0039e5988107ae565` (pixell-runtime-vpc)
   - **Subnets**: Public subnets in us-east-2a and us-east-2b
   - **Security Group**: `sg-01fadbe4320c283f7` (pixell-runtime-sg)
   - **Target Group**: `pixell-web-tg` (connected to pixell-runtime-alb)
   - **Cluster**: pixell-web-cluster
   - **Service**: pixell-web-simple

5. **Waits for Deployment**
   - Monitors ECS service until stable
   - Verifies service is active and healthy

6. **Validates Deployment**
   - Tests application endpoint at https://app.pixell.global
   - Shows deployment information and monitoring commands

## Infrastructure Configuration

### Production (APP_ENV=prod)

When deploying with `--env prod`, the script uses:

```bash
ECS_CLUSTER="pixell-web-cluster"
ECS_SERVICE="pixell-web-simple"
TASK_FAMILY="pixell-web-simple"
VPC_ID="vpc-0039e5988107ae565"  # pixell-runtime-vpc
SUBNET_1="subnet-0a79126c8f2c8f05c"  # us-east-2a public
SUBNET_2="subnet-0ba0bc56ff418036e"  # us-east-2b public
SECURITY_GROUP="sg-01fadbe4320c283f7"  # pixell-runtime-sg
TARGET_GROUP_ARN="arn:aws:elasticloadbalancing:us-east-2:636212886452:targetgroup/pixell-web-tg/afbf63262286fd04"
SITE_URL="https://app.pixell.global"
```

### Development (APP_ENV=dev)

For development deployments, different infrastructure is used (default VPC and PAC resources).

## Environment Variables

### Required Files

- **`.env.prod`** - Production environment configuration (MUST exist)
- **`.env.dev`** - Development environment configuration (for dev deployments)

### Key Production Variables

The deployment script loads from `.env.prod`:

```bash
# Critical for production
NODE_ENV=production
PIXELL_ENV=prod  # Triggers AWS Secrets Manager loading
AWS_REGION=us-east-2
NEXT_PUBLIC_SITE_URL=https://app.pixell.global
NEXT_PUBLIC_BASE_URL=https://app.pixell.global

# PAR Runtime
NEXT_PUBLIC_PAF_CORE_AGENT_URL=https://par.pixell.global

# Orchestrator (internal ECS service discovery)
ORCHESTRATOR_URL=http://orchestrator:3001
NEXT_PUBLIC_ORCHESTRATOR_URL=http://orchestrator:3001

# Firebase (client-side public config)
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
# ... other Firebase config
```

### Secrets Management

Production secrets (database credentials, Stripe keys, etc.) are **NOT** in `.env.prod`. They are loaded at runtime from AWS Secrets Manager when `PIXELL_ENV=prod` is set. See `apps/web/src/lib/secrets.ts` for implementation.

## Deployment Commands

### Full Production Deployment

```bash
# Deploy to production with automatic tag
./deploy.sh --env prod

# Deploy with specific version tag
./deploy.sh --env prod --tag v1.2.3
```

### Verify Current Deployment

```bash
# Check current deployment status without deploying
./deploy.sh --verify-only --env prod
```

### Debug Mode

```bash
# Enable detailed JSON output for troubleshooting
./deploy.sh --env prod --debug
```

### Development Deployment

```bash
# Deploy to dev environment
./deploy.sh --env dev
```

## Monitoring Commands

After deployment, monitor with these commands:

```bash
# View real-time logs
aws logs tail /ecs/pixell-web-simple --follow --region us-east-2

# Check service status
aws ecs describe-services --cluster pixell-web-cluster --services pixell-web-simple --region us-east-2

# List running tasks
aws ecs list-tasks --cluster pixell-web-cluster --service-name pixell-web-simple --region us-east-2

# Check target health in load balancer
aws elbv2 describe-target-health \
  --target-group-arn arn:aws:elasticloadbalancing:us-east-2:636212886452:targetgroup/pixell-web-tg/afbf63262286fd04 \
  --region us-east-2
```

## Network Architecture

### Production Setup

```
Internet → Route 53 (app.pixell.global)
    ↓
pixell-runtime-alb (HTTPS with SSL certificate)
    ↓
pixell-web-tg (Target Group on port 3000)
    ↓
ECS Tasks in pixell-runtime-vpc
    ↓
Next.js App (port 3000)
```

### Security Groups

- **ALB Security Group** (`sg-0f5b28ee64419e95d`): Allows HTTPS (443) from internet
- **ECS Security Group** (`sg-01fadbe4320c283f7`): Allows port 3000 from ALB security group

### Load Balancer

- **ALB**: pixell-runtime-alb
- **DNS**: pixell-runtime-alb-420577088.us-east-2.elb.amazonaws.com
- **SSL**: Certificate for app.pixell.global
- **Health Check**: GET / (HTTP 200)

## Troubleshooting

### Deployment Fails with VPC Errors

Ensure you're deploying to production:
```bash
./deploy.sh --env prod  # Not --env dev
```

### Health Checks Failing

Check if the container is running:
```bash
aws ecs list-tasks --cluster pixell-web-cluster --service-name pixell-web-simple --region us-east-2
```

Check container logs:
```bash
aws logs tail /ecs/pixell-web-simple --follow --region us-east-2
```

### Wrong Infrastructure Being Used

The script automatically selects infrastructure based on `APP_ENV`. Verify:
```bash
# Should show pixell-runtime-vpc for production
grep "VPC_ID=" deploy.sh | grep -A1 "prod"
```

### Secrets Not Loading

Verify `PIXELL_ENV=prod` is set in task definition:
```bash
aws ecs describe-task-definition --task-definition pixell-web-simple --region us-east-2 \
  --query 'taskDefinition.containerDefinitions[0].environment[?name==`PIXELL_ENV`]'
```

## Important Notes

1. **Never commit secrets to `.env.prod`** - Use AWS Secrets Manager for sensitive data
2. **VPC separation** - Production uses pixell-runtime-vpc, dev uses default VPC/PAC resources
3. **Target group health checks** - Currently set to check `/` instead of `/api/health`
4. **Service discovery** - Orchestrator uses ECS service discovery at `http://orchestrator:3001`
5. **SSL certificate** - Automatically configured on pixell-runtime-alb for app.pixell.global

## Architecture Differences: PAC vs Pixell Agent Framework

This deployment is for **Pixell Agent Framework** at `app.pixell.global`, which is completely separate from:

- **PAC (Pixell Agent Cloud)** - Different project using pac-alb and pac-web-tg
- **PAR (Pixell Agent Runtime)** - Backend service at par.pixell.global

Do not modify PAC or PAR resources when deploying Pixell Agent Framework.
