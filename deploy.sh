#!/bin/bash

# Beemaster Backend Deployment Script
# Run this on your local machine with Node.js installed

set -e

echo "=== Beemaster Backend Deployment ==="

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "Node.js required"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "npm required"; exit 1; }

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Login to Cloudflare (if not already logged in)
echo "🔑 Cloudflare authentication..."
if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
    echo "Run: export CLOUDFLARE_API_TOKEN=your-token"
    echo "Or: wrangler login"
    exit 1
fi

# Create D1 Database (if not exists)
echo "🗄️ Creating D1 database..."
wrangler d1 create beemaster-users 2>/dev/null || echo "Database already exists"

# Get database ID
DB_ID=$(wrangler d1 list | grep beemaster-users | awk '{print $NF}')
echo "Database ID: $DB_ID"

# Update wrangler.toml with database ID
sed -i "s/database_id = \"will be created\"/database_id = \"$DB_ID\"/" wrangler.toml

# Run migrations
echo "📊 Running database migrations..."
wrangler d1 execute beemaster-users --file=./schema.sql

# Set secrets (you'll be prompted)
echo "🔐 Setting secrets..."
echo "Set LITELLM_MASTER_KEY when prompted..."
wrangler secret put LITELLM_MASTER_KEY

echo "Set GOOGLE_PLAY_SERVICE_ACCOUNT when prompted..."
wrangler secret put GOOGLE_PLAY_SERVICE_ACCOUNT

# Deploy
echo "🚀 Deploying..."
wrangler deploy

echo "✅ Deployment complete!"
echo ""
echo "Test with:"
echo "  curl https://beemaster-backend.YOUR-SUBDOMAIN.workers.dev/"