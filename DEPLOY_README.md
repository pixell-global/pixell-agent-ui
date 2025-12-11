# Pixell Agent Framework - Deployment Guide

This guide explains how to deploy the Pixell Agent Framework web application to AWS ECS Fargate.

## Quick Start

```bash
# 1. Set up environment file
cp env.dev.template .env.dev
# Edit .env.dev with your actual values

# 2. Deploy
./deploy.sh
```

## Prerequisites

- AWS CLI configured with appropriate permissions
- Docker installed and running
- `jq` command-line JSON processor
- Environment file (`.env.dev`) with required variables

## Environment Configuration

### Required Environment Variables

Create a `.env.dev` file in the project root with the following variables:

```bash
# PAF Core Agent URL
NEXT_PUBLIC_PAF_CORE_AGENT_URL=https://paf-core-agent-prod-alb-62806388.us-east-2.elb.amazonaws.com
PAF_CORE_AGENT_URL=https://paf-core-agent-prod-alb-62806388.us-east-2.elb.amazonaws.com

# Firebase Configuration (Server-side only)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY_BASE64=your-base64-encoded-private-key
FIREBASE_WEB_API_KEY=your-web-api-key
SESSION_COOKIE_NAME=session

# Database Configuration
DATABASE_HOST=your-database-host
DATABASE_PORT=5432
DATABASE_NAME=your-database-name
DATABASE_USER=your-database-user
DB_PASSWORD=your-database-password
```

### Firebase Private Key Setup

The Firebase private key should be base64 encoded to avoid shell parsing issues:

```bash
# Encode your private key
base64 -i your-firebase-private-key.pem

# Add the base64 string to FIREBASE_PRIVATE_KEY_BASE64 in .env.dev
```

## Deployment Script Usage

### Basic Deployment

```bash
# Deploy to dev environment (default)
./deploy.sh

# Deploy to production environment
./deploy.sh --env prod

# Deploy with specific image tag
./deploy.sh --tag v1.0.0
```

### Verification

```bash
# Verify current deployment
./deploy.sh --verify-only
```

### Help

```bash
./deploy.sh --help
```

## What the Deployment Script Does

1. **Prerequisites Check**: Verifies AWS CLI, Docker, and required tools
2. **ECR Repository**: Creates ECR repository if it doesn't exist
3. **Docker Build**: Builds the application with platform compatibility for ECS Fargate
4. **Image Push**: Pushes the built image to ECR
5. **Task Definition**: Updates ECS task definition with new image
6. **Service Update**: Updates ECS service to use new task definition
7. **Deployment Wait**: Waits for deployment to stabilize
8. **Verification**: Tests health endpoint and service status

## Current AWS Resources

- **Region**: us-east-2
- **ECS Cluster**: pixell-web-cluster
- **ECS Service**: pixell-web-simple
- **Task Family**: pixell-web-simple
- **ECR Repository**: pixell-web
- **Load Balancer**: pac-alb (dev.pixell.global)
- **Target Group**: pac-web-tg

## Monitoring and Troubleshooting

### View Logs

```bash
# Follow application logs
aws logs tail /ecs/pixell-web-simple --follow

# View recent logs
aws logs describe-log-groups --log-group-name-prefix /ecs/pixell-web-simple
```

### Check Service Status

```bash
# Service status
aws ecs describe-services --cluster pixell-web-cluster --services pixell-web-simple

# Task status
aws ecs list-tasks --cluster pixell-web-cluster --service-name pixell-web-simple

# Task details
aws ecs describe-tasks --cluster pixell-web-cluster --tasks $(aws ecs list-tasks --cluster pixell-web-cluster --service-name pixell-web-simple --query 'taskArns[0]' --output text)
```

### Health Check

```bash
# Test health endpoint
curl -sS https://dev.pixell.global/api/health | jq

# Test application
curl -I https://dev.pixell.global/signin
```

## Rollback

To rollback to a previous deployment:

1. Find the previous task definition revision:
   ```bash
   aws ecs describe-task-definition --task-definition pixell-web-simple --query 'taskDefinition.revision'
   ```

2. Update service to use previous revision:
   ```bash
   aws ecs update-service \
     --cluster pixell-web-cluster \
     --service pixell-web-simple \
     --task-definition pixell-web-simple:PREVIOUS_REVISION \
     --force-new-deployment
   ```

## Architecture

```
Internet → ALB (pac-alb) → ECS Fargate → Next.js App
                ↓
         Target Group (pac-web-tg)
                ↓
         Health Check (/api/health)
```

## Security Notes

- Environment variables are loaded at runtime from `.env.dev`
- Firebase private keys are base64 encoded to avoid shell parsing issues
- The application uses server-side authentication with HTTP-only session cookies
- All traffic is routed through HTTPS with SSL termination at the load balancer

## Troubleshooting Common Issues

### Build Failures

- Ensure all dependencies are installed: `npm install`
- Check that `.env.dev` exists and has required variables
- Verify Docker is running and has sufficient resources

### Deployment Failures

- Check AWS CLI credentials: `aws sts get-caller-identity`
- Verify ECR repository exists: `aws ecr describe-repositories --repository-names pixell-web`
- Check ECS service status and logs

### Runtime Issues

- Check application logs for errors
- Verify environment variables are correctly set
- Test health endpoint for service availability
- Check load balancer target group health

### SSL/HTTPS Issues

- Verify SSL certificate is valid and attached to load balancer
- Check DNS resolution: `dig dev.pixell.global`
- Test SSL connection: `openssl s_client -connect dev.pixell.global:443`
