# AWS Secrets Manager Integration

This document explains how environment variables are managed using AWS Secrets Manager for deployed environments.

## Overview

Environment variables are stored in AWS Secrets Manager for both development and production deployments:
- **Development**: `pixell/dev`
- **Production**: `pixell/prod`

## How It Works

### Local Development
When running locally without `PIXELL_ENV` set, the application uses traditional `.env` files:
- `.env.local`
- `.env.dev`
- `.env`

### Deployed Environments
When deploying to AWS with `PIXELL_ENV=dev` or `PIXELL_ENV=prod`, the application:
1. Fetches secrets from AWS Secrets Manager on server startup
2. Loads them into `process.env`
3. Falls back to `.env` files if Secrets Manager is unavailable

## Setup

### 1. Create Secrets in AWS

Both secrets have already been created:

```bash
# Dev environment
aws secretsmanager create-secret \
  --name "pixell/dev" \
  --description "Pixell Agent Framework development environment variables" \
  --secret-string '{ ... }' \
  --region us-east-2

# Production environment
aws secretsmanager create-secret \
  --name "pixell/prod" \
  --description "Pixell Agent Framework production environment variables" \
  --secret-string '{ ... }' \
  --region us-east-2
```

### 2. Verify Secrets

```bash
# List all pixell secrets
aws secretsmanager list-secrets \
  --region us-east-2 \
  --filters Key=name,Values=pixell/

# View dev secret
aws secretsmanager get-secret-value \
  --secret-id pixell/dev \
  --region us-east-2

# View prod secret
aws secretsmanager get-secret-value \
  --secret-id pixell/prod \
  --region us-east-2
```

### 3. Update Secrets

To update environment variables:

```bash
# Update dev environment
aws secretsmanager update-secret \
  --secret-id pixell/dev \
  --secret-string '{"KEY":"VALUE", ...}' \
  --region us-east-2

# Update prod environment
aws secretsmanager update-secret \
  --secret-id pixell/prod \
  --secret-string '{"KEY":"VALUE", ...}' \
  --region us-east-2
```

## Deployment Configuration

### Environment Variables Required

Set these environment variables in your deployment platform (AWS ECS, Amplify, etc.):

#### Development Deployment
```bash
PIXELL_ENV=dev
AWS_REGION=us-east-2
```

#### Production Deployment
```bash
PIXELL_ENV=prod
AWS_REGION=us-east-2
```

### AWS Permissions

Ensure your deployment role has these IAM permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ],
      "Resource": [
        "arn:aws:secretsmanager:us-east-2:636212886452:secret:pixell/dev-*",
        "arn:aws:secretsmanager:us-east-2:636212886452:secret:pixell/prod-*"
      ]
    }
  ]
}
```

## Implementation Details

### Files Modified

1. **`apps/web/src/lib/aws-secrets.ts`** (new)
   - Handles fetching and caching secrets from AWS Secrets Manager
   - Exports `loadSecretsToEnv()` function

2. **`apps/web/src/lib/root-env.ts`** (modified)
   - Now supports both AWS Secrets Manager and local .env files
   - Falls back gracefully if Secrets Manager is unavailable

3. **`apps/web/src/instrumentation.ts`** (new)
   - Next.js server startup hook
   - Loads secrets on server initialization

4. **`apps/web/next.config.ts`** (modified)
   - Enabled `instrumentationHook` experimental feature

### How Environment Loading Works

```
Server Startup
    ↓
instrumentation.ts calls register()
    ↓
Check PIXELL_ENV (dev/prod/production)
    ↓
    ├─→ [YES] → Load from AWS Secrets Manager
    │             ↓
    │           Success → Load into process.env
    │             ↓
    │           Failure → Fall back to .env files
    │
    └─→ [NO] → Use local .env files
```

### Caching

Secrets are cached in memory after first fetch to avoid repeated AWS API calls:
- Cache persists for the lifetime of the Node.js process
- Server restart = fresh fetch from Secrets Manager

## Troubleshooting

### Issue: Secrets not loading

**Check logs for:**
```
[Instrumentation] Loading secrets from AWS Secrets Manager...
```

**Common causes:**
- `PIXELL_ENV` not set correctly
- AWS credentials not configured
- IAM permissions missing
- Network/firewall blocking AWS API

**Solution:**
1. Verify environment variable: `echo $PIXELL_ENV`
2. Check AWS credentials: `aws sts get-caller-identity`
3. Test secret access: `aws secretsmanager get-secret-value --secret-id pixell/dev`

### Issue: Wrong environment loaded

**Check:**
- `PIXELL_ENV` value matches secret name (`dev` → `pixell/dev`, `prod` → `pixell/prod`)
- Server logs show correct secret being loaded

### Issue: Secrets out of date

**Solution:**
Update the secret in AWS and restart the server:
```bash
aws secretsmanager update-secret --secret-id pixell/dev --secret-string '{...}'
# Then restart your application
```

## Security Best Practices

1. **Never commit secrets to git** - All secrets in AWS Secrets Manager only
2. **Use IAM roles** - Don't hardcode AWS credentials
3. **Principle of least privilege** - Only grant `GetSecretValue` permission
4. **Rotate secrets regularly** - Update database passwords, API keys periodically
5. **Monitor access** - Use CloudTrail to audit secret access
6. **Separate dev/prod** - Keep environments isolated

## Migration from .env Files

To migrate environment variables to AWS Secrets Manager:

1. **Read current .env file:**
   ```bash
   cat .env.dev
   ```

2. **Convert to JSON:**
   ```json
   {
     "DB_HOST": "...",
     "DB_USER": "...",
     "DB_PASSWORD": "..."
   }
   ```

3. **Create/update secret:**
   ```bash
   aws secretsmanager create-secret \
     --name pixell/dev \
     --secret-string file://secret.json
   ```

4. **Test deployment** with `PIXELL_ENV=dev`

5. **Remove .env from deployment** (keep for local dev)

## Cost

AWS Secrets Manager pricing (us-east-2):
- **Storage**: $0.40 per secret per month
- **API calls**: $0.05 per 10,000 API calls

**Estimated monthly cost:**
- 2 secrets (dev + prod) = $0.80/month
- ~100,000 API calls (high traffic) = $0.50/month
- **Total**: ~$1.30/month

With caching, API calls are minimal (only on server restart).

## References

- [AWS Secrets Manager Documentation](https://docs.aws.amazon.com/secretsmanager/)
- [Next.js Instrumentation](https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation)
- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)
