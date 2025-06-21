# File Storage Configuration Guide

The Pixell Agent Framework provides a flexible file storage system that supports multiple backends with zero-config defaults and production-ready scaling options.

## Quick Start (Zero Setup)

The framework defaults to **local filesystem storage** - no configuration required!

```bash
pixell create my-agent-app
cd my-agent-app
pixell dev
```

Your files will be stored in `./workspace-files/` and immediately available to your AI agents.

## Supported Storage Backends

### 1. Local Filesystem (Default)
- ✅ **Zero setup** - works immediately
- ✅ **Perfect for development** and small deployments
- ✅ **Fast performance** for local access
- ⚠️ **Not suitable** for distributed deployments

### 2. AWS S3 (Production Ready)
- ✅ **Scalable** - handles petabytes of data
- ✅ **Production ready** with high availability
- ✅ **Compatible** with MinIO, DigitalOcean Spaces, etc.
- ✅ **Cost effective** for large files

### 3. Supabase Storage (Integrated)
- ✅ **Integrated** with your existing Supabase setup
- ✅ **Real-time** updates and subscriptions
- ✅ **Built-in CDN** for fast global access
- ✅ **Generous free tier**

## Configuration Options

### Option 1: Interactive Setup (Recommended)

```bash
pixell storage-init
```

This will guide you through selecting and configuring your preferred storage backend.

### Option 2: Environment Variables

Create or update your `.env.local` file:

```bash
# Local Filesystem (default)
STORAGE_PROVIDER=local
STORAGE_LOCAL_PATH=./workspace-files
STORAGE_MAX_FILE_SIZE=52428800  # 50MB in bytes

# AWS S3
STORAGE_PROVIDER=s3
STORAGE_S3_BUCKET=my-agent-files
STORAGE_S3_REGION=us-east-1
STORAGE_S3_ACCESS_KEY_ID=your_access_key
STORAGE_S3_SECRET_ACCESS_KEY=your_secret_key
STORAGE_S3_PREFIX=workspace-files

# MinIO (S3-compatible)
STORAGE_PROVIDER=s3
STORAGE_S3_BUCKET=agent-files
STORAGE_S3_ENDPOINT=http://localhost:9000
STORAGE_S3_ACCESS_KEY_ID=minioadmin
STORAGE_S3_SECRET_ACCESS_KEY=minioadmin
STORAGE_S3_FORCE_PATH_STYLE=true

# Supabase Storage
STORAGE_PROVIDER=supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
STORAGE_SUPABASE_BUCKET=workspace-files
```

### Option 3: Programmatic Configuration

```typescript
import { StorageManager } from '@pixell/file-storage'

const storage = new StorageManager()
await storage.initialize({
  provider: 'local',
  config: {
    rootPath: './my-files',
    maxFileSize: 50 * 1024 * 1024,
    allowedTypes: ['.txt', '.md', '.json', '.ts', '.py']
  }
})
```

## Advanced Configuration

### Fallback Storage

Configure automatic fallback to local storage if your primary storage fails:

```bash
# Primary: S3, Fallback: Local
STORAGE_PROVIDER=s3
STORAGE_S3_BUCKET=my-bucket
# ... other S3 config

# Fallback is automatically configured if S3 fails
```

### File Type Restrictions

Limit allowed file types for security:

```bash
STORAGE_ALLOWED_TYPES=.txt,.md,.json,.js,.ts,.py,.yml,.yaml,.csv,.xml,.html,.css,.png,.jpg,.jpeg,.pdf
```

### Size Limits

Configure maximum file sizes:

```bash
# 100MB for S3 (supports larger files)
STORAGE_MAX_FILE_SIZE=104857600

# 50MB for local/Supabase (recommended)
STORAGE_MAX_FILE_SIZE=52428800
```

## Production Deployment Examples

### Docker Compose with MinIO

```yaml
version: '3.8'
services:
  pixell-app:
    build: .
    environment:
      - STORAGE_PROVIDER=s3
      - STORAGE_S3_BUCKET=agent-files
      - STORAGE_S3_ENDPOINT=http://minio:9000
      - STORAGE_S3_ACCESS_KEY_ID=minioadmin
      - STORAGE_S3_SECRET_ACCESS_KEY=minioadmin
      - STORAGE_S3_FORCE_PATH_STYLE=true
    depends_on:
      - minio

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      - MINIO_ROOT_USER=minioadmin
      - MINIO_ROOT_PASSWORD=minioadmin
    volumes:
      - minio_data:/data
    ports:
      - "9000:9000"
      - "9001:9001"

volumes:
  minio_data:
```

### Kubernetes with AWS S3

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: pixell-app
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
        image: your-repo/pixell-app:latest
        env:
        - name: STORAGE_PROVIDER
          value: "s3"
        - name: STORAGE_S3_BUCKET
          value: "my-production-bucket"
        - name: STORAGE_S3_REGION
          value: "us-west-2"
        - name: STORAGE_S3_ACCESS_KEY_ID
          valueFrom:
            secretKeyRef:
              name: aws-credentials
              key: access-key-id
        - name: STORAGE_S3_SECRET_ACCESS_KEY
          valueFrom:
            secretKeyRef:
              name: aws-credentials
              key: secret-access-key
```

### Vercel with Supabase

```bash
# .env.local
STORAGE_PROVIDER=supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
STORAGE_SUPABASE_BUCKET=workspace-files
```

## CLI Commands

### Check Storage Status

```bash
pixell storage status
```

### Reconfigure Storage

```bash
pixell storage-init --force
```

### Migrate Between Storage Types

```bash
pixell storage migrate --from local --to s3
```

## Security Best Practices

### 1. File Type Validation

Always restrict allowed file types in production:

```bash
# Only allow safe file types
STORAGE_ALLOWED_TYPES=.txt,.md,.json,.csv,.yml,.yaml
```

### 2. Size Limits

Set appropriate file size limits:

```bash
# Reasonable limit for most use cases
STORAGE_MAX_FILE_SIZE=52428800  # 50MB
```

### 3. Access Controls

For S3 and Supabase, configure proper IAM policies:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::your-bucket/workspace-files/*"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": "arn:aws:s3:::your-bucket",
      "Condition": {
        "StringLike": {
          "s3:prefix": "workspace-files/*"
        }
      }
    }
  ]
}
```

### 4. Network Security

Use HTTPS endpoints and private networks when possible:

```bash
# Use VPC endpoints for S3 in AWS
STORAGE_S3_ENDPOINT=https://s3.us-west-2.amazonaws.com

# Use private MinIO in Docker networks
STORAGE_S3_ENDPOINT=http://minio:9000  # Internal Docker network
```

## Troubleshooting

### Common Issues

**Storage validation failed:**
```bash
# Check your configuration
pixell storage status

# Verify network connectivity
ping your-s3-endpoint.com

# Test with minimal config
STORAGE_PROVIDER=local pixell dev
```

**File upload errors:**
```bash
# Check file size limits
ls -la your-file.txt

# Verify file type is allowed
file your-file.txt

# Check storage space
df -h  # for local storage
```

**Permission errors:**
```bash
# For local storage
chmod -R 755 ./workspace-files

# For S3, check IAM policies
aws sts get-caller-identity
```

### Debug Mode

Enable detailed logging:

```bash
DEBUG=pixell:storage pixell dev
```

## Migration Guide

### From Local to S3

1. Set up S3 configuration
2. Run migration command
3. Update environment variables
4. Test functionality

```bash
# 1. Configure S3
pixell storage-init --provider s3

# 2. Migrate files (when available)
pixell storage migrate --from local --to s3

# 3. Verify
pixell storage status
```

### From Other Platforms

If you're migrating from other AI agent frameworks:

```bash
# Copy existing files to workspace-files
cp -r /path/to/existing/files ./workspace-files/

# Or upload via API
curl -X POST http://localhost:3000/api/files \
  -F "file=@myfile.txt" \
  -F "path=/documents/"
```

## Performance Optimization

### Local Storage

- Use SSD drives for better performance
- Consider NFS/NAS for shared deployments
- Regular cleanup of temp files

### S3 Storage

- Use CloudFront CDN for better global performance
- Enable transfer acceleration for large files
- Use intelligent tiering for cost optimization

### Supabase Storage

- Use CDN for frequently accessed files
- Configure appropriate bucket policies
- Monitor usage and quotas

## Backup and Recovery

### Automated Backups

```bash
# Local to S3 backup (example)
aws s3 sync ./workspace-files s3://my-backup-bucket/workspace-files/
```

### Cross-Region Replication

For S3, enable cross-region replication:

```json
{
  "Role": "arn:aws:iam::123456789012:role/replication-role",
  "Rules": [
    {
      "Status": "Enabled",
      "Priority": 1,
      "Prefix": "workspace-files/",
      "Destination": {
        "Bucket": "arn:aws:s3:::backup-bucket"
      }
    }
  ]
}
```

This file storage system provides the foundation for a truly "out of the box" experience while offering production-ready scalability options as your AI agent applications grow. 