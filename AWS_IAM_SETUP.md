# AWS IAM Setup for S3-Only Storage

## Overview

This document provides step-by-step instructions for configuring AWS IAM permissions required for the Pixell Agent Framework S3-only storage system.

## Quick Start

**Minimum Required**:
- AWS Account with S3 access
- IAM user or role with bucket creation permissions
- Access Key ID and Secret Access Key

## IAM Policy

### Production-Ready Policy

Create an IAM policy named `PixellAgentFrameworkS3Policy`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowBucketCreation",
      "Effect": "Allow",
      "Action": [
        "s3:CreateBucket",
        "s3:ListBucket",
        "s3:GetBucketLocation",
        "s3:GetBucketVersioning",
        "s3:PutBucketVersioning",
        "s3:GetBucketEncryption",
        "s3:PutBucketEncryption",
        "s3:GetPublicAccessBlock",
        "s3:PutPublicAccessBlock",
        "s3:PutBucketTagging",
        "s3:GetBucketTagging"
      ],
      "Resource": "arn:aws:s3:::paf-org-*"
    },
    {
      "Sid": "AllowObjectOperations",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:GetObjectVersion",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucketVersions"
      ],
      "Resource": "arn:aws:s3:::paf-org-*/*"
    },
    {
      "Sid": "AllowListAllBuckets",
      "Effect": "Allow",
      "Action": [
        "s3:ListAllMyBuckets",
        "s3:HeadBucket"
      ],
      "Resource": "*"
    }
  ]
}
```

### Optional: Lifecycle Policy Management

If you want to enable lifecycle policies (currently disabled in code):

```json
{
  "Sid": "AllowLifecycleManagement",
  "Effect": "Allow",
  "Action": [
    "s3:GetLifecycleConfiguration",
    "s3:PutLifecycleConfiguration"
  ],
  "Resource": "arn:aws:s3:::paf-org-*"
}
```

## Setup Instructions

### Option 1: IAM User (Development/Testing)

1. **Create IAM User**:
   ```bash
   aws iam create-user --user-name pixell-agent-framework-dev
   ```

2. **Create Policy**:
   ```bash
   aws iam create-policy \
     --policy-name PixellAgentFrameworkS3Policy \
     --policy-document file://pixell-s3-policy.json
   ```

3. **Attach Policy to User**:
   ```bash
   aws iam attach-user-policy \
     --user-name pixell-agent-framework-dev \
     --policy-arn arn:aws:iam::YOUR_ACCOUNT_ID:policy/PixellAgentFrameworkS3Policy
   ```

4. **Create Access Keys**:
   ```bash
   aws iam create-access-key --user-name pixell-agent-framework-dev
   ```

   Save the output:
   ```json
   {
     "AccessKeyId": "AKIAXXXXXXXXXXXXXXXX",
     "SecretAccessKey": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
   }
   ```

5. **Add to Environment**:
   ```bash
   # .env.local
   AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX
   AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   AWS_DEFAULT_REGION=us-east-2
   ```

### Option 2: IAM Role (Production/EC2/ECS)

1. **Create IAM Role**:
   ```bash
   aws iam create-role \
     --role-name PixellAgentFrameworkS3Role \
     --assume-role-policy-document file://trust-policy.json
   ```

   **trust-policy.json** (for EC2):
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Principal": {
           "Service": "ec2.amazonaws.com"
         },
         "Action": "sts:AssumeRole"
       }
     ]
   }
   ```

   **trust-policy.json** (for ECS):
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Principal": {
           "Service": "ecs-tasks.amazonaws.com"
         },
         "Action": "sts:AssumeRole"
       }
     ]
   }
   ```

2. **Attach Policy to Role**:
   ```bash
   aws iam attach-role-policy \
     --role-name PixellAgentFrameworkS3Role \
     --policy-arn arn:aws:iam::YOUR_ACCOUNT_ID:policy/PixellAgentFrameworkS3Policy
   ```

3. **Attach Role to EC2 Instance**:
   ```bash
   # Create instance profile
   aws iam create-instance-profile \
     --instance-profile-name PixellAgentFrameworkS3Profile

   # Add role to profile
   aws iam add-role-to-instance-profile \
     --instance-profile-name PixellAgentFrameworkS3Profile \
     --role-name PixellAgentFrameworkS3Role

   # Attach to EC2 instance
   aws ec2 associate-iam-instance-profile \
     --instance-id i-1234567890abcdef0 \
     --iam-instance-profile Name=PixellAgentFrameworkS3Profile
   ```

4. **For ECS**: Add role to task definition:
   ```json
   {
     "family": "pixell-agent-framework",
     "taskRoleArn": "arn:aws:iam::YOUR_ACCOUNT_ID:role/PixellAgentFrameworkS3Role",
     ...
   }
   ```

### Option 3: AWS CLI Profile (Local Development)

1. **Configure AWS CLI**:
   ```bash
   aws configure --profile pixell-dev
   ```

   Enter:
   - Access Key ID
   - Secret Access Key
   - Default region: `us-east-2`
   - Default output format: `json`

2. **Set Environment Variable**:
   ```bash
   export AWS_PROFILE=pixell-dev
   ```

   Or add to `.env.local`:
   ```bash
   AWS_PROFILE=pixell-dev
   ```

## Verification

### Test IAM Permissions

Run this script to verify permissions:

```bash
#!/bin/bash

# Test bucket creation
TEST_BUCKET="paf-org-test-$(date +%s)"
echo "Testing bucket creation: $TEST_BUCKET"

aws s3api create-bucket \
  --bucket $TEST_BUCKET \
  --region us-east-2 \
  --create-bucket-configuration LocationConstraint=us-east-2

# Test versioning
echo "Testing versioning configuration..."
aws s3api put-bucket-versioning \
  --bucket $TEST_BUCKET \
  --versioning-configuration Status=Enabled

# Test encryption
echo "Testing encryption configuration..."
aws s3api put-bucket-encryption \
  --bucket $TEST_BUCKET \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'

# Test public access block
echo "Testing public access block..."
aws s3api put-public-access-block \
  --bucket $TEST_BUCKET \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

# Test object operations
echo "Testing object upload..."
echo "test content" > /tmp/test-file.txt
aws s3 cp /tmp/test-file.txt s3://$TEST_BUCKET/test-file.txt

echo "Testing object download..."
aws s3 cp s3://$TEST_BUCKET/test-file.txt /tmp/test-file-downloaded.txt

echo "Testing object deletion..."
aws s3 rm s3://$TEST_BUCKET/test-file.txt

# Cleanup
echo "Cleaning up test bucket..."
aws s3 rb s3://$TEST_BUCKET

echo "✅ All tests passed!"
```

### Test with Framework

```bash
# Set credentials
export AWS_ACCESS_KEY_ID=your-key
export AWS_SECRET_ACCESS_KEY=your-secret
export AWS_DEFAULT_REGION=us-east-2

# Run unit tests
cd packages/file-storage
npm run test:unit

# Run integration tests (creates real buckets)
RUN_S3_INTEGRATION_TESTS=true npm test
```

## Security Best Practices

### 1. Principle of Least Privilege

✅ **DO**: Use separate IAM users for dev/staging/prod
✅ **DO**: Restrict bucket names with `paf-org-*` pattern
✅ **DO**: Use IAM roles for production deployments

❌ **DON'T**: Use root account credentials
❌ **DON'T**: Grant `s3:*` wildcard permissions
❌ **DON'T**: Allow access to all buckets (`arn:aws:s3:::*`)

### 2. Access Key Rotation

Rotate access keys every 90 days:

```bash
# Create new key
aws iam create-access-key --user-name pixell-agent-framework-dev

# Update .env.local with new credentials

# Test new credentials work

# Delete old key
aws iam delete-access-key \
  --user-name pixell-agent-framework-dev \
  --access-key-id OLD_ACCESS_KEY_ID
```

### 3. Credential Storage

**Development**:
- Store in `.env.local` (gitignored)
- Use AWS CLI profiles

**Production**:
- Use AWS Secrets Manager or Parameter Store
- Use IAM roles (no credentials needed)
- Never commit credentials to git

### 4. Monitoring & Alerts

Set up CloudWatch alarms:

```bash
# Alert on unauthorized access attempts
aws cloudwatch put-metric-alarm \
  --alarm-name pixell-s3-unauthorized-access \
  --metric-name 4xxErrors \
  --namespace AWS/S3 \
  --statistic Sum \
  --period 300 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold

# Alert on bucket creation
aws cloudwatch put-metric-alarm \
  --alarm-name pixell-s3-bucket-creation \
  --metric-name NumberOfBuckets \
  --namespace AWS/S3 \
  --statistic Sum \
  --period 86400 \
  --threshold 90 \
  --comparison-operator GreaterThanThreshold
```

## Troubleshooting

### Common Permission Errors

**Error**: `AccessDenied: User is not authorized to perform s3:CreateBucket`

**Solution**:
1. Verify IAM policy is attached to user/role
2. Check policy allows `s3:CreateBucket` for `paf-org-*`
3. Verify credentials are for correct IAM user

**Error**: `InvalidBucketName: The specified bucket is not valid`

**Solution**:
- Bucket names must be DNS-compliant
- Max 63 characters
- Only lowercase letters, numbers, hyphens
- Cannot start/end with hyphen

**Error**: `BucketAlreadyExists: The requested bucket name is not available`

**Solution**:
- S3 bucket names are globally unique
- Another AWS account owns this bucket name
- Framework will handle this gracefully and continue

**Error**: `CredentialsError: Missing credentials in config`

**Solution**:
```bash
# Verify credentials are set
echo $AWS_ACCESS_KEY_ID
echo $AWS_SECRET_ACCESS_KEY

# Or check .env.local exists and has:
cat .env.local | grep AWS_
```

## Cost Considerations

### IAM Costs

- IAM users, roles, and policies: **Free**
- Access key management: **Free**
- No charges for IAM service

### S3 Costs (with permissions)

- Storage: ~$0.023/GB/month
- Requests: ~$0.005/1000 PUT requests
- Data transfer: First 1GB free/month

### Reducing Costs

1. **Delete test buckets**: Remove buckets created during development
2. **Enable lifecycle policies**: Auto-archive old files
3. **Monitor usage**: Set up billing alerts

## Advanced Configuration

### Cross-Account Access

To allow another AWS account to access buckets:

1. **Add to bucket policy**:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Effect": "Allow",
       "Principal": {
         "AWS": "arn:aws:iam::OTHER_ACCOUNT_ID:root"
       },
       "Action": ["s3:GetObject", "s3:PutObject"],
       "Resource": "arn:aws:s3:::paf-org-*/*"
     }]
   }
   ```

2. **Other account assumes role** with trust policy

### S3 VPC Endpoint

For private VPC access (no internet):

```bash
aws ec2 create-vpc-endpoint \
  --vpc-id vpc-xxxxx \
  --service-name com.amazonaws.us-east-2.s3 \
  --route-table-ids rtb-xxxxx
```

## Support

### AWS Support Resources

- [IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [S3 Permissions](https://docs.aws.amazon.com/AmazonS3/latest/userguide/s3-access-control.html)
- [IAM Policy Simulator](https://policysim.aws.amazon.com/)

### Framework Support

- GitHub Issues: https://github.com/pixell-global/pixell-agent-ui/issues
- Documentation: See `STORAGE_ARCHITECTURE.md`
