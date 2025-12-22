-- Migration: Add s3_storage_path column to users table
-- This column stores the user's allocated S3 storage path for file isolation

ALTER TABLE users ADD COLUMN s3_storage_path VARCHAR(512) NULL AFTER display_name;

-- Add index for faster lookups when querying by storage path
CREATE INDEX idx_users_s3_storage_path ON users(s3_storage_path);
