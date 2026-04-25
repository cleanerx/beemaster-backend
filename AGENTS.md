# AGENTS.md - Beemaster Backend

## Overview
Cloudflare Workers backend for Beemaster app credits system with LiteLLM integration. Handles credit purchases, consumption, and virtual key management for LLM access.

## Tech Stack
- **Runtime**: Cloudflare Workers (Node.js compat mode)
- **Framework**: Hono
- **Database**: D1 (SQLite)
- **Testing**: Vitest (v8 coverage)
- **Linting**: ESLint with TypeScript
- **Deployment**: Wrangler CLI (Jenkins CI/CD)

## Project Structure
```
src/
  index.ts              # Main Hono app (746 lines, all endpoints)

tests/
  unit/                 # Isolated function tests
  integration/          # API endpoint tests (mocked)
  system/               # End-to-end tests

callbacks/
  beemaster_callback.py # LiteLLM callback for credit deduction

migrations/
  *.sql                 # D1 schema migrations
```

## Development Commands

```bash
# Install dependencies
npm install

# Local development server (uses .dev.vars for secrets)
wrangler dev

# Linting
npm run lint

# Run tests
npm test                    # All tests
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests only
npm run test:system         # System tests only
npm run test:coverage       # With coverage report

# Database operations
wrangler d1 execute beemaster-users --file=./schema.sql

# Deployment (requires CLOUDFLARE_API_TOKEN)
wrangler deploy
```

## Environment & Secrets

**Public vars (wrangler.toml [vars])**:
- `LITELLM_URL` - LiteLLM proxy URL

**Secrets (set via `wrangler secret put`)**:
- `LITELLM_MASTER_KEY` - LiteLLM admin key
- `GOOGLE_PLAY_SERVICE_ACCOUNT` - Base64-encoded JSON
- `ADMIN_API_KEY` - Admin endpoint access
- `INTERNAL_API_KEY` - LiteLLM callback authentication
- `PLAY_INTEGRITY_SERVICE_ACCOUNT` - Play Integrity verification

**Local development**:
Create `.dev.vars` with:
```
LITELLM_MASTER_KEY=sk-...
GOOGLE_PLAY_SERVICE_ACCOUNT=eyJ...
ADMIN_API_KEY=admin-...
INTERNAL_API_KEY=internal-...
PLAY_INTEGRITY_SERVICE_ACCOUNT=eyJ...
```

## API Architecture

### Public Endpoints (App)
- `GET /` - Health check
- `GET /api/v1/user/balance` - Get credits (auth: Bearer virtual_key OR user_id param)
- `POST /api/v1/purchase/verify` - Verify Google Play purchase, create user, add credits

### Internal Endpoints
- `POST /api/v1/credits/consume` - Called by LiteLLM to deduct credits (requires X-Internal-Key)

### Admin Endpoints (requires X-Admin-Key)
- `GET /api/v1/admin/users` - List all users
- `GET /api/v1/admin/users/:user_id` - Get user details
- `POST /api/v1/admin/users` - Create user
- `PUT /api/v1/admin/users/:user_id/credits` - Adjust credits
- `DELETE /api/v1/admin/users/:user_id` - Delete user
- `GET /api/v1/admin/stats` - System statistics

## Key Implementation Details

### Credit System
- 1 credit = 1000 tokens (calculated by LiteLLM callback)
- New users get 1 welcome credit on first registration
- Credits deducted via LiteLLM success callback
- Virtual keys format: `sk-beemaster-{uuid}`

### Rate Limiting
- In-memory rate limiting via D1 rate_limits table
- 5 purchase attempts per device per minute
- 10 balance checks per device per minute
- Old entries cleaned up automatically

### Play Integrity
- Optional integrity verification (graceful fallback)
- Requires X-Integrity-Token and X-Nonce headers
- Validates app and device integrity with Google Play API

### Database Schema
- D1 SQLite with 5 tables: users, purchases, credit_transactions, rate_limits
- Foreign keys enforced
- Indexes on frequently queried columns

## CI/CD (Jenkins)

Pipeline stages (main/master branch only for deploy):
1. Checkout → 2. Setup Node.js → 3. Install → 4. Lint → 5. Unit Tests
6. Integration Tests → 7. Security Tests → 8. Coverage Report
9. Set Secrets → 10. Deploy to Cloudflare

Required Jenkins credentials:
- `cloudflare-api-token`
- `beemaster-internal-key`

## Related Infrastructure

- **LiteLLM Proxy**: Deployed separately (Railway/Docker) with PostgreSQL
- **Callbacks**: Python callback in `callbacks/beemaster_callback.py` handles credit deduction
- **DeepInfra**: LLM provider via LiteLLM routing

## Common Pitfalls

1. **Wrangler secrets vs vars**: Public vars go in `[vars]` section, secrets via `wrangler secret put`
2. **D1 database ID**: Hardcoded in wrangler.toml - don't regenerate unless needed
3. **LiteLLM callback**: Requires `INTERNAL_API_KEY` to be set in both places
4. **Local dev**: `.dev.vars` file needed for secrets, not `.env`
5. **Google Play**: Service account must be Base64-encoded when setting as secret
