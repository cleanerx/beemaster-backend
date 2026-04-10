# Beemaster Backend - CI/CD

## Jenkins Pipeline

### Job-Konfiguration

| Einstellung | Wert |
|-------------|------|
| **Pipeline** | Pipeline script from SCM |
| **SCM** | Git |
| **Repository** | https://github.com/l33ttoolbot/beemaster-backend |
| **Branch** */main |
| **Agent** | android (DolphinCrusher) |
| **Credentials** | cloudflare-api-token (Secret Text) |

### Stages

1. **Checkout** - Repository klonen
2. **Setup Node.js** - NVM aktivieren
3. **Install Dependencies** - npm install
4. **Lint** - Code-Qualitätsprüfung
5. **Unit Tests** - Isolierte Funktions-Tests
6. **Integration Tests** - API-Endpoint-Tests
7. **System Tests** - End-to-End Tests
8. **Coverage Report** - Test-Abdeckung
9. **Deploy to Cloudflare** - Production Deployment

### Credentials Setup

```bash
# In Jenkins: Manage Jenkins → Credentials → System → Global credentials
# Add Secret Text:
ID: cloudflare-api-token
Secret: <dein-cloudflare-api-token>
```

### Jellyfin Job erstellen

```groovy
// Jenkins → New Item → Pipeline
// Name: beemaster-backend
// Pipeline script from SCM:
// Git Repository: https://github.com/l33ttoolbot/beemaster-backend
// Branch: */main
// Script Path: Jenkinsfile
```

### Ziel-Agent

Der Jobwird auf dem `android` Agent (DolphinCrusher) ausgeführt:

```
DolphinCrusher - x86_64 Android Build Server
- Host: 192.168.178.123
- User: beemaster
- Node.js: v20.20.2 (via NVM)
- Wrangler: 3.114.17
```

### Test Commands (Lokal)

```bash
# Unit Tests
npm run test:unit

# Integration Tests
npm run test:integration

# System Tests
npm run test:system

# Alle Tests mit Coverage
npm run test:coverage
```

### Deployment

- **Branch main/master**: Automatisches Deployment zu Cloudflare Workers
- **Feature Branches**: Tests ohne Deployment

---

*Created: 2026-04-10*