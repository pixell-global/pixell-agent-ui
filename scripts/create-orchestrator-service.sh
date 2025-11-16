#!/bin/bash
# Create ECS service for orchestrator
set -e

AWS_REGION="us-east-2"
CLUSTER_NAME="pixell-web-cluster"
SERVICE_NAME="pixell-orchestrator"
TASK_FAMILY="pixell-orchestrator"

# Network configuration (same as web app)
SUBNETS="subnet-0fd1d99dab3fdf17b,subnet-035d6ed0a581e57df"
SECURITY_GROUP="sg-0312d256226a19bf4"

echo "Creating ECS service: $SERVICE_NAME"
echo "Cluster: $CLUSTER_NAME"
echo "Region: $AWS_REGION"
echo ""

# Get latest task definition
TASK_DEF_ARN=$(aws ecs describe-task-definition \
  --task-definition $TASK_FAMILY \
  --region $AWS_REGION \
  --query 'taskDefinition.taskDefinitionArn' \
  --output text)

if [ -z "$TASK_DEF_ARN" ]; then
  echo "❌ Task definition not found. Please deploy first with deploy-orchestrator.sh"
  exit 1
fi

echo "Using task definition: $TASK_DEF_ARN"
echo ""

# Create service
aws ecs create-service \
  --cluster $CLUSTER_NAME \
  --service-name $SERVICE_NAME \
  --task-definition $TASK_DEF_ARN \
  --desired-count 1 \
  --launch-type FARGATE \
  --platform-version LATEST \
  --network-configuration "awsvpcConfiguration={
    subnets=[$SUBNETS],
    securityGroups=[$SECURITY_GROUP],
    assignPublicIp=ENABLED
  }" \
  --region $AWS_REGION

echo ""
echo "✅ Service created successfully!"
echo ""
echo "Monitor deployment:"
echo "  aws ecs describe-services --cluster $CLUSTER_NAME --services $SERVICE_NAME --region $AWS_REGION"
echo ""
echo "View logs:"
echo "  aws logs tail /ecs/$TASK_FAMILY --follow --region $AWS_REGION"
