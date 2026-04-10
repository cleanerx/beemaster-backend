# System Tests - Beemaster Backend

End-to-End Tests mit echtem Worker und D1 Database.

## Test Files

| File | Beschreibung |
|------|--------------|
| `health.test.ts` | Health Check Endpoints |
| `purchase-flow.test.ts` | Complete Purchase Flow |
| `admin-flow.test.ts` | Complete Admin Flow |
| `error-handling.test.ts` | Error Scenarios |

## Run

```bash
npm run test:system
```

## Requirements

- Running Cloudflare Worker (local or remote)
- D1 Database (local or remote)