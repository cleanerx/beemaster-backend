-- Migration: Add device_fingerprint column to users table
-- Version: 2.0.0

ALTER TABLE users ADD COLUMN device_fingerprint TEXT;

-- Index for looking up users by fingerprint (security queries)
CREATE INDEX IF NOT EXISTS idx_users_device_fingerprint ON users(device_fingerprint);
