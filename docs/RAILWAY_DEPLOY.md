# LiteLLM Railway Deployment

## Overview

This directory contains the configuration for deploying LiteLLM to Railway.
LiteLLM acts as a proxy for LLM calls and deducts credits from the Beemaster Backend.

## Architecture

```
Android App
    │
    ▼
┌─────────────────────────────────────────┐
│ LiteLLM (Railway)                       │
│  - Virtual Key Auth                     │
│  - Routes to DeepInfra (Nemotron)       │
│  - Callback: Deduct Credits             │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ Beemaster Backend (Cloudflare Workers)  │
│  - /api/v1/credits/consume              │
│  - Deducts credits from user            │
└─────────────────────────────────────────┘
```

## Railway Setup

### 1. Create PostgreSQL Database

Railway Dashboard → New Service → Database → PostgreSQL

### 2. Deploy LiteLLM

Railway Dashboard → New Service → GitHub Repo → Select `beemaster-backend`

### 3. Set Environment Variables

In Railway Dashboard, set:

```bash
DEEPINFRA_API_KEY=your-deepinfra-key
LITELLM_MASTER_KEY=sk-beemaster-master-xxx
BEEMASTER_BACKEND_URL=https://beemaster-backend.cleanerx.workers.dev
INTERNAL_API_KEY=your-internal-secret-key
DATABASE_URL=${{Postgres.DATABASE_URL}}  # Reference Railway PostgreSQL
```

### 4. Configure Health Check

Railway sets the health check path to `/health` automatically.

## Files

| File | Purpose |
|------|---------|
| `Dockerfile.litellm` | Docker build for LiteLLM |
| `railway.toml` | Railway deployment config |
| `litellm-config-railway.yaml` | LiteLLM configuration |
| `callbacks/beemaster_callback.py` | Credit deduction callback |

## Local Development

```bash
# Start PostgreSQL
docker-compose -f docker-compose.litellm.yml up postgres -d

# Set environment variables
export DEEPINFRA_API_KEY=your-key
export LITELLM_MASTER_KEY=your-master-key
export BEEMASTER_BACKEND_URL=http://localhost:8787
export INTERNAL_API_KEY=your-internal-key
export DATABASE_URL=postgresql://beemaster:localpass@localhost:5432/beemaster_litellm

# Start LiteLLM
docker-compose -f docker-compose.litellm.yml up litellm
```

## Testing

```bash
# Health check
curl https://your-litellm.railway.app/health

# Test LLM call
curl -X POST https://your-litellm.railway.app/v1/chat/completions \
  -H "Authorization: Bearer sk-beemaster-xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "nemotron",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

## Credit Calculation

| Tokens | Credits |
|--------|---------|
| 1-999 | 1 |
| 1000-1999 | 1 |
| 2000-2999 | 2 |
| ... | ... |

Formula: `credits = max(1, total_tokens // 1000)`

---

*Created: 2026-04-11*