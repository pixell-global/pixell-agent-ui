# Storage Architecture - S3-Only Per-Organization Buckets

## Overview

Pixell Agent Framework uses **S3-only storage** with **per-organization bucket isolation** and **multi-context file organization** (users, teams, brands, shared).

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     AWS Account                              │
│                                                               │
│  ┌──────────────────────┐      ┌──────────────────────┐    │
│  │ paf-org-acme-a1b2c3  │      │ paf-org-vividai-x9y8 │    │
│  │  (Organization 1)     │      │  (Organization 2)     │    │
│  │                       │      │                       │    │
│  │  orgs/org-123/        │      │  orgs/org-456/        │    │
│  │    ├─ users/          │      │    ├─ users/          │    │
│  │    │   ├─ user-a/     │      │    │   ├─ user-c/     │    │
│  │    │   │   └─ workspace-files/│   │    │   └─ workspace-files/│
│  │    │   └─ user-b/     │      │    │   └─ user-d/     │    │
│  │    │       └─ workspace-files/│   │        └─ workspace-files/│
│  │    ├─ teams/          │      │    ├─ teams/          │    │
│  │    │   ├─ team-1/     │      │    │   └─ team-3/     │    │
│  │    │   │   └─ shared/ │      │    │       └─ shared/ │    │
│  │    │   └─ team-2/     │      │    ├─ brands/         │    │
│  │    │       └─ shared/ │      │    │   └─ brand-1/    │    │
│  │    ├─ brands/         │      │    │       └─ assets/ │    │
│  │    │   └─ brand-1/    │      │    └─ shared/         │    │
│  │    │       └─ assets/ │      │                       │    │
│  │    └─ shared/         │      └──────────────────────┘    │
│  │                       │                                    │
│  └──────────────────────┘                                    │
│                                                               │
│  ┌──────────────────────┐                                    │
│  │ paf-org-public-0pub  │   (Unauthenticated users)         │
│  │                       │                                    │
│  │  orgs/public/         │                                    │
│  │    └─ users/          │                                    │
│  │        └─ {userId}/   │                                    │
│  │            └─ workspace-files/                            │
│  │                       │                                    │
│  └──────────────────────┘                                    │
└─────────────────────────────────────────────────────────────┘
```

## Key Concepts

### 1. Per-Organization Buckets

Each organization gets its own S3 bucket:

- **Naming**: `paf-org-{org-slug}-{org-id-hash}` (max 63 chars)
- **Isolation**: Complete separation between organizations
- **Security**: Per-bucket encryption, versioning, and access controls

**Example**:
- Organization: "VividAI" (ID: `a1b2c3d4-e5f6-7890`)
- Bucket: `paf-org-vividai-a1b2c3d4`

### 2. Multi-Context Storage

Four storage contexts within each organization bucket:

| Context | Path Pattern | Use Case | Example |
|---------|-------------|----------|---------|
| **User** | `orgs/{orgId}/users/{userId}/workspace-files/` | Private user files | Personal documents |
| **Team** | `orgs/{orgId}/teams/{teamId}/shared/` | Team collaboration | Project files |
| **Brand** | `orgs/{orgId}/brands/{brandId}/assets/` | Brand assets | Logos, guidelines |
| **Shared** | `orgs/{orgId}/shared/` | Org-wide files | Company policies |

### 3. Bucket Security Features

Every bucket is created with:

- ✅ **Versioning Enabled**: File recovery after accidental deletion
- ✅ **AES-256 Encryption**: Server-side encryption at rest
- ✅ **Public Access Blocked**: No public internet access
- ⏸️ **Lifecycle Policies**: (Optional) Archive to Glacier after 30 days

## Implementation Details

### Bucket Naming Convention

```typescript
function generateOrgBucketName(orgId: string, orgName: string | null): string {
  const baseSource = (orgName || orgId).toLowerCase()
  const slug = baseSource
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/--+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  const suffix = orgId.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 8)
  return `paf-org-${slug}-${suffix}`.slice(0, 63)
}
```

### Path Resolution

```typescript
// User context
buildStoragePrefix('org-123', { type: 'user', userId: 'user-abc' })
// → "orgs/org-123/users/user-abc/workspace-files"

// Team context
buildStoragePrefix('org-123', { type: 'team', teamId: 'team-xyz' })
// → "orgs/org-123/teams/team-xyz/shared"

// Brand context
buildStoragePrefix('org-123', { type: 'brand', brandId: 'brand-def' })
// → "orgs/org-123/brands/brand-def/assets"

// Shared context
buildStoragePrefix('org-123', { type: 'shared' })
// → "orgs/org-123/shared"
```

## API Usage

### Query Parameters

All file API endpoints accept context parameters:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `context` | string | No | `user` \| `team` \| `brand` \| `shared` (default: `user`) |
| `contextId` | string | Conditional | Required for `team` and `brand` contexts |
| `path` | string | Yes | File path within the context |

### API Examples

**List user files (default)**:
```
GET /api/files/list
GET /api/files/list?context=user
```

**List team files**:
```
GET /api/files/list?context=team&contextId=team-123
```

**Upload brand asset**:
```
POST /api/files/create?context=brand&contextId=brand-456
```

**Read shared file**:
```
GET /api/files/content?path=/policy.pdf&context=shared
```

**Delete user file**:
```
DELETE /api/files/delete?path=/document.txt&context=user
```

## Scaling Considerations

### Bucket Limits

- **Soft limit**: 100 buckets per AWS account
- **Hard limit**: 1,000 buckets per AWS account (by request)
- **Recommendation**: Use per-org buckets up to ~80 organizations, then switch to single shared bucket with prefixes

### Migration Path to Single Bucket

When approaching bucket limits:

1. Create single production bucket: `pixell-agent-framework-production`
2. Update `buildStorageConfigForContext()` to use:
   ```typescript
   bucket: 'pixell-agent-framework-production'
   prefix: `orgs/${orgId}/users/${userId}/workspace-files`
   ```
3. Migrate existing org buckets to shared bucket with same prefix structure

## Cost Optimization

### Storage Costs

- **S3 Standard**: $0.023/GB/month
- **S3 Glacier**: $0.004/GB/month (for archived files)
- **Versioning overhead**: Previous versions count toward storage

### Cost Reduction Strategies

1. **Enable lifecycle policies** (currently disabled):
   - Transition to Glacier after 30 days: ~83% savings
   - Delete after 90 days: 100% savings

2. **Limit file versions**: Configure version expiration
3. **Monitor per-org usage**: Track storage costs by bucket tags

## Monitoring & Operations

### Health Checks

```typescript
const status = await storage.getStatus()
// {
//   provider: 's3',
//   configured: true,
//   healthy: true,
//   lastCheck: '2025-01-15T10:30:00Z',
//   capabilities: ['read', 'write', 'delete', 'upload', 'search']
// }
```

### CloudWatch Metrics

Monitor these S3 metrics:
- `BucketSizeBytes`: Total storage per bucket
- `NumberOfObjects`: File count per bucket
- `AllRequests`: API call volume
- `4xxErrors`: Client errors (permissions, not found)
- `5xxErrors`: Server errors

### Cost Allocation Tags

Each bucket is tagged with:
- `org-id`: Organization identifier
- `created-at`: Bucket creation timestamp
- `environment`: dev/staging/production

## Security

### IAM Permissions Required

See `AWS_IAM_SETUP.md` for complete IAM policy.

Minimum permissions:
- `s3:CreateBucket` (for paf-org-* pattern)
- `s3:ListBucket`
- `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject`
- `s3:PutBucketVersioning`, `s3:PutBucketEncryption`
- `s3:PutPublicAccessBlock`

### Access Control

- **Bucket-level**: IAM policies restrict access to `paf-org-*` pattern
- **Prefix-level**: Application enforces user/team/brand isolation
- **Object-level**: All objects encrypted, no public access

## Backup & Recovery

### Versioning

- Every bucket has versioning enabled
- Deleted files can be recovered via AWS Console
- Old versions count toward storage quota

### Cross-Region Replication (Optional)

For disaster recovery:
1. Enable CRR on production buckets
2. Replicate to different AWS region
3. Configure failover in application

### Restore Process

```bash
# List deleted file versions
aws s3api list-object-versions \
  --bucket paf-org-vividai-a1b2c3d4 \
  --prefix orgs/org-123/users/user-abc/workspace-files/file.txt

# Restore specific version
aws s3api copy-object \
  --copy-source "paf-org-vividai-a1b2c3d4/file.txt?versionId=xyz" \
  --bucket paf-org-vividai-a1b2c3d4 \
  --key orgs/org-123/users/user-abc/workspace-files/file.txt
```

## Troubleshooting

### Common Issues

**Issue**: "The specified bucket does not exist"
- **Cause**: Bucket not auto-created yet
- **Solution**: Ensure AWS credentials have `s3:CreateBucket` permission

**Issue**: "AccessDenied" during bucket creation
- **Cause**: Insufficient IAM permissions
- **Solution**: Update IAM policy (see AWS_IAM_SETUP.md)

**Issue**: Files from different orgs visible
- **Cause**: Using same bucket without proper prefixes
- **Solution**: Verify `buildStorageConfigForContext()` generates correct prefixes

**Issue**: Large files fail to upload
- **Cause**: Default 100MB limit
- **Solution**: Increase `STORAGE_MAX_FILE_SIZE` env var

## Future Enhancements

- [ ] Re-enable lifecycle policies (fix TypeScript compatibility)
- [ ] Implement granular team/brand access control
- [ ] Add CloudWatch dashboard for storage metrics
- [ ] Implement cross-region replication
- [ ] Add storage quota per organization
- [ ] Implement file sharing URLs (pre-signed URLs)
- [ ] Add file search across contexts
