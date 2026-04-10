# Beemaster Backend - Cloudflare Workers

Credits-System für Beemaster App mit LiteLLM Integration.

## Architektur

```
Android App (Virtual Key)
        ↓
Cloudflare Workers(Endpoint)
        ↓
┌───────────────────┬─────────────────────┐
│ D1 SQLite │ LiteLLM Proxy       │
│ (User Credits)     │ (LLM Routing)|
└───────────────────┴─────────────────────┘
                            ↓
                    DeepInfra API
```

## Endpoints

| Endpoint | Method | Beschreibung |
|----------|--------|--------------|
| `/` | GET | Health Check |
| `/api/v1/user/register` | POST | Neuen User erstellen (100 Gratis-Credits) |
| `/api/v1/purchase/verify` | POST | Google Play Purchase verifizieren |
| `/api/v1/user/balance` | GET | Credit-Stand abfragen |
| `/api/v1/credits/consume` | POST | Credits verbrauchen (LLM Query) |

## Deployment

```bash
#1. Install dependencies
npm install

# 2. Create D1 Database
wrangler d1 create beemaster-users

# 3. Copy database_id to wrangler.toml

# 4. Run migrations
wrangler d1 execute beemaster-users --file=./schema.sql

# 5. Set secrets
wrangler secret put LITELLM_MASTER_KEY
wrangler secret put GOOGLE_PLAY_SERVICE_ACCOUNT

# 6. Deploy
wrangler deploy
```

## Lokale Entwicklung

```bash
# Start local dev server
wrangler dev

# Test endpoints
curl http://localhost:8787/
curl -X POST http://localhost:8787/api/v1/user/register \
  -H "Content-Type: application/json" \
  -d '{"user_id": "test-user-123"}'
```

## Google Play Service Account

1. Google Cloud Console → APIs & Services → Credentials
2. Create Service Account
3. Download JSON
4. Base64 encode: `base64 service-account.json`
5. Set as GOOGLE_PLAY_SERVICE_ACCOUNT secret

## Umgebung

RequiredEnvironment Variables:

| Variable | Beschreibung |
|----------|--------------|
| `LITELLM_URL` | LiteLLM Proxy URL |
| `LITELLM_MASTER_KEY` | LiteLLM Admin Key |
| `GOOGLE_PLAY_SERVICE_ACCOUNT` | Base64 JSON Service Account |

## Kosten

| Service | Monatliche Kosten |
|---------|-------------------|
| Cloudflare Workers | Kostenlos (100k Requests/Tag) |
| D1 Database | Kostenlos (25MB) |
| **Gesamt** | **$0** |

---

*Created: 2026-04-10*