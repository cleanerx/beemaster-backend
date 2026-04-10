# Beemaster Backend - System Architecture

## Overview

Serverless Backend für Beemaster App Credits-System mit Cloudflare Workers und D1 Database.

**Live URL:** https://beemaster-backend.cleanerx.workers.dev

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          ANDROID APP                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Device ID (UUID)                                                    │   │
│  │ EncryptedSharedPreferences                                          │   │
│  │ Virtual Key (nach Purchase)                                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                             │
│                     Google Play Billing Flow                                   │
│                                    │                                             │
└────────────────────────────────────│───────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     CLOUDFLARE WORKERS (Edge)                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ PUBLIC ENDPOINTS                                                    │   │
│  │  POST /api/v1/purchase/verify  → Auto-create User + Add Credits     │   │
│  │  GET  /api/v1/user/balance    → Get Credit Balance                  │   │
│  │  POST /api/v1/credits/consume → Deduct Credits                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ADMIN ENDPOINTS (X-Admin-Key required)                              │   │
│  │  GET    /api/v1/admin/stats              → System Stats              │   │
│  │  GET    /api/v1/admin/users             → List all Users            │   │
│  │  GET    /api/v1/admin/users/:id         → User Details              │   │
│  │  POST   /api/v1/admin/users             → Create User               │   │
│  │  PUT    /api/v1/admin/users/:id/credits → Adjust Credits            │   │
│  │  DELETE /api/v1/admin/users/:id          → Delete User             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                             │
└────────────────────────────────────│───────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     CLOUDFLARE D1 (SQLite)                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ users                                                                │   │
│  │  - id, user_id, virtual_key, credits_balance, total_purchased      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ purchases                                                            │   │
│  │  - id, user_id, product_id, credits_added, purchase_token, status   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ credit_transactions                                                  │   │
│  │  - id, user_id, amount, type, description                            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ rate_limits                                                          │   │
│  │  - id, identifier, endpoint, created_at                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     LITELLM PROXY (Railway/Fly.io)                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Virtual Keys → User Budget Mapping                                   │   │
│  │ LLM Routing (DeepInfra, OpenAI, etc.)                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### Purchase Flow (Auto-Create User)

```
1. App Start
   └→ Generate Device ID (UUID)
   └→ Store in EncryptedSharedPreferences

2. User clicks "Buy Credits"
   └→ Google Play Billing Flow
   └→ Get purchase_token

3. App calls POST /api/v1/purchase/verify
   └→ { purchase_token, product_id, device_id }

4. Backend:
   ├→ Check if user exists (by device_id)
   │   └→ NO: Create user + virtual_key
   │   └→ YES: Load user data
   ├→ Verify purchase_token (Google Play API)
   ├→ Add credits to user
   ├→ Log transaction
   └→ Return: { success, user_id, virtual_key, credits_balance }

5. App stores virtual_key for future LLM calls
```

### Credit Consumption Flow

```
1. User triggers Voice Agent
   └→ App sends request to LiteLLM Proxy
   └→ Header: Authorization: Bearer {virtual_key}

2. LiteLLM Proxy:
   ├→ Validate virtual_key
   ├→ Check user budget
   └→ Call Backend: POST /api/v1/credits/consume

3. Backend:
   ├→ Deduct credits
   ├→ Log transaction
   └→ Return remaining balance
```

---

## Security Architecture

### Public Endpoints

| Endpoint | Protection |
|----------|------------|
| `/purchase/verify` | Google Play signature verification |
| `/user/balance` | Device ID lookup |
| `/credits/consume` | Virtual Key validation |

### Admin Endpoints

| Endpoint | Protection |
|----------|------------|
| `/admin/*` | X-Admin-Key header required |

### Key Types

| Key | Purpose | Storage |
|-----|---------|---------|
| Device ID | User identification | App (EncryptedSharedPreferences) |
| Virtual Key | LLM authentication | App + Backend |
| Admin Key | Admin panel access | Admin only |
| LITELLM_MASTER_KEY | Backend → LiteLLM communication | Backend secrets |
| GOOGLE_PLAY_SERVICE_ACCOUNT | Purchase verification | Backend secrets |

---

## Database Schema

### users

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key (UUID) |
| user_id | TEXT | Unique user identifier (device UUID) |
| virtual_key | TEXT | LiteLLM virtual key |
| credits_balance | INTEGER | Current credits |
| total_purchased | INTEGER | Total credits purchased |
| created_at | TEXT | ISO timestamp |

### purchases

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key |
| user_id | TEXT | Foreign key |
| product_id | TEXT | Google Play product ID |
| credits_added | INTEGER | Credits granted |
| purchase_token | TEXT | Google Play token (unique) |
| status | TEXT | VERIFIED/PENDING/FAILED |

### credit_transactions

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key |
| user_id | TEXT | Foreign key |
| amount | INTEGER | Credit amount |
| type | TEXT | PURCHASE/BONUS/USE/DEDUCT |
| description | TEXT | Human-readable reason |

---

## Deployment

### Cloudflare Resources

| Resource | ID |
|----------|-----|
| Worker | beemaster-backend |
| D1 Database | beemaster-users (10fc87a5-deb2-48d0-94ce-c60a2b3e8099) |
| Subdomain | cleanerx.workers.dev |

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| LITELLM_URL | Yes | LiteLLM Proxy URL |
| LITELLM_MASTER_KEY | Yes | LiteLLM admin key |
| GOOGLE_PLAY_SERVICE_ACCOUNT | Yes | Base64 JSON |
| ADMIN_API_KEY | Yes | Admin panel secret |

### Set Secrets

```bash
wrangler secret put LITELLM_MASTER_KEY
wrangler secret put GOOGLE_PLAY_SERVICE_ACCOUNT
wrangler secret put ADMIN_API_KEY
```

---

## Costs

| Service | Monthly Cost |
|---------|-------------|
| Cloudflare Workers | $0 (100k requests/day free) |
| D1 Database | $0 (25MB free) |
| **Total** | **$0** |

---

## Monitoring

### Logs

```bash
# Tail worker logs
wrangler tail

# View D1 database
wrangler d1 execute beemaster-users --command="SELECT * FROM users LIMIT10"
```

### Metrics

- Request count (Cloudflare Dashboard)
- Error rate
- D1 query performance
- Credit balance totals

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-04-10 | Initial deployment |
| 1.1.0 | 2026-04-10 | Added admin endpoints, auto-create user on purchase |

---

*Last Updated: 2026-04-10*