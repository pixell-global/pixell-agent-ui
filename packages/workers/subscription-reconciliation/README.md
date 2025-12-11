# Subscription Reconciliation Worker

AWS Lambda function that reconciles subscription data between Stripe (source of truth) and our database.

## Overview

### Why This Exists

Stripe is the **Single Source of Truth (SSoT)** for all subscription data. Our database is a read-optimized cache that must stay synchronized with Stripe.

**Primary Sync: Webhooks**
- Real-time updates when Stripe events occur
- Handles: `checkout.session.completed`, `customer.subscription.*`, `invoice.*`
- Located at: `apps/web/src/app/api/webhooks/stripe/route.ts`

**Backup Sync: This Lambda (Weekly)**
- Catches missed webhook events (network failures, downtime, bugs)
- Reconciles drift from manual Stripe dashboard changes
- Ensures eventual consistency
- **Schedule**: Sundays at 3am UTC

### Architecture

```
┌─────────────────┐                    ┌──────────────────┐
│ EventBridge     │                    │ AWS Lambda       │
│ Cron Rule       ├────────────────────▶ Reconciliation   │
│ (Sun 3am UTC)   │                    │ Function         │
└─────────────────┘                    └────────┬─────────┘
                                                │
                            ┌───────────────────┼───────────────────┐
                            │                   │                   │
                            ▼                   ▼                   ▼
                    ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
                    │ Stripe API   │   │ RDS MySQL    │   │ CloudWatch   │
                    │ (Fetch SSoT) │   │ (Update DB)  │   │ Logs         │
                    └──────────────┘   └──────────────┘   └──────────────┘
```

## Infrastructure

**AWS Resources:**
- **Lambda Function**: `pixell-subscription-reconciliation`
- **VPC**: `vpc-0dc5816f0b041abad` (same as Fargate web service)
- **Subnets**: Public subnets in us-east-2a/b/c
- **Security Group**: Access to RDS port 3306 (sg-0869c371d1826a660)
- **RDS**: `database-3.cmkyt9c4u4iq.us-east-2.rds.amazonaws.com:3306`
- **Runtime**: Node.js 18
- **Memory**: 512 MB
- **Timeout**: 5 minutes
- **Secrets**: Stripe key from AWS Secrets Manager (`pixell/prod`)

**Deployed via CDK:**
- Stack: `infrastructure/lib/pixell-infrastructure-stack.ts`
- EventBridge rule with cron expression
- Lambda function with VPC configuration
- IAM role with permissions for Logs, VPC, Secrets Manager

## Development

### Local Setup

```bash
# Install dependencies
cd packages/workers/subscription-reconciliation
npm install

# Build TypeScript
npm run build

# Run locally (requires .env with DB credentials)
npm run local
```

### Environment Variables

**For Local Testing:**
```env
# Database
DB_HOST=database-3.cmkyt9c4u4iq.us-east-2.rds.amazonaws.com
DB_USER=vivid_dev
DB_PASSWORD=VividAIDev2025!
DB_NAME=vivid_dev
DB_PORT=3306

# Stripe
STRIPE_SECRET_KEY=sk_test_...
```

**For Lambda:**
- Environment variables are set in CDK stack
- Stripe key fetched from AWS Secrets Manager

### Testing

```bash
# Unit tests
npm run test

# Local execution
npm run local

# Test Lambda in AWS
aws lambda invoke \
  --function-name pixell-subscription-reconciliation \
  --region us-east-2 \
  output.json

# View logs
aws logs tail /aws/lambda/pixell-subscription-reconciliation \
  --follow \
  --region us-east-2
```

## What It Does

### Reconciliation Logic

For each organization with a subscription:

1. **Fetch current state from Stripe** (SSoT)
   - Use `stripeSubscriptionId` to retrieve subscription
   - Fall back to customer ID if subscription ID missing

2. **Compare with database state**
   - Check: `planTier`, `status`, `currentPeriodStart/End`, `cancelAtPeriodEnd`, etc.
   - Detect any differences

3. **Update database to match Stripe** (if differences found)
   - Update `subscriptions` table
   - Update `organizations` table (tier and status)
   - Log all changes

4. **Handle edge cases**
   - Subscription deleted in Stripe → Mark as canceled in DB
   - Customer has no subscription → Skip
   - Already in sync → Skip (no-op)

### Conflict Resolution

**IMPORTANT**: Stripe ALWAYS wins
- If DB says "Free" and Stripe says "Pro" → Update DB to "Pro"
- Never update Stripe based on DB (except user-initiated actions through app)

## Deployment

### Initial Deployment

```bash
# From infrastructure directory
cd infrastructure

# Deploy CDK stack (includes Lambda + EventBridge)
cdk deploy

# Verify deployment
aws lambda get-function \
  --function-name pixell-subscription-reconciliation \
  --region us-east-2
```

### Updates

Changes to Lambda code are automatically deployed via CDK:

```bash
# 1. Make changes to src/handler.ts or src/reconciliation.ts
# 2. Build locally to test
npm run build

# 3. Deploy updated Lambda
cd ../../infrastructure
cdk deploy

# 4. Verify update
aws lambda get-function-configuration \
  --function-name pixell-subscription-reconciliation \
  --region us-east-2 \
  --query 'LastModified'
```

## Monitoring

### CloudWatch Logs

All reconciliation activity is logged to CloudWatch:

```bash
# View recent logs
aws logs tail /aws/lambda/pixell-subscription-reconciliation \
  --region us-east-2 \
  --since 1h

# Follow logs in real-time
aws logs tail /aws/lambda/pixell-subscription-reconciliation \
  --follow \
  --region us-east-2
```

### Log Structure

```json
{
  "message": "Reconciliation completed",
  "result": {
    "totalOrganizations": 42,
    "synchronized": 3,
    "errors": 0,
    "skipped": 39,
    "details": [...]
  }
}
```

### CloudWatch Alarms

Set up alarms for:
- Lambda errors (> 2 in 24 hours)
- Lambda duration (> 4 minutes)
- Reconciliation failures (check return status)

## Troubleshooting

### Common Issues

**1. Database Connection Timeout**
- Check VPC configuration
- Verify security group allows port 3306
- Check RDS instance is running

**2. Stripe API Errors**
- Verify Stripe secret key in Secrets Manager
- Check Stripe API rate limits
- Ensure subscription IDs are valid

**3. Lambda Timeout**
- Increase timeout in CDK (currently 5 minutes)
- Optimize query performance
- Consider batching for large organization counts

### Manual Reconciliation

To trigger reconciliation outside the schedule:

```bash
# Invoke Lambda manually
aws lambda invoke \
  --function-name pixell-subscription-reconciliation \
  --region us-east-2 \
  --log-type Tail \
  --query 'LogResult' \
  --output text \
  output.json | base64 --decode

# Check output
cat output.json
```

## Cost

**Estimated Monthly Cost:**
- Lambda invocations: 4/month (Sundays at 3am)
- Execution time: ~30 seconds each
- Memory: 512 MB
- **Total: ~$0.00** (within free tier)

## Related Files

- **Webhook Handler**: `apps/web/src/app/api/webhooks/stripe/route.ts` (primary sync)
- **Database Schema**: `packages/db-mysql/schema.ts` (subscriptions, organizations)
- **CDK Stack**: `infrastructure/lib/pixell-infrastructure-stack.ts` (deployment)
- **Secrets Manager**: `AWS_SECRETS_MANAGER.md` (credentials management)
- **Architecture Docs**: `BILLING_SYSTEM_ARCHITECTURE.md` (overall system)

## AI Agent Guidelines

When working with subscription data:

1. **Always query Stripe for authoritative data** (SSoT)
2. **Use database for fast reads** (cached data)
3. **On conflict, trust Stripe** over database
4. **Update database through webhooks** (primary) or this reconciliation job (backup)
5. **Never update Stripe based on database state** (except user-initiated actions)

This ensures data consistency and follows industry best practices for payment system integration.
