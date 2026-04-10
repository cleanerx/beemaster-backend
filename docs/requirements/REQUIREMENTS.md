# Requirements - Beemaster Backend

## Funktionale Requirements (FR)

### FR-001: User Management

| ID | Requirement | Priorität |
|----|-------------|-----------|
| FR-001-01 | User werden automatisch bei erstem Purchase erstellt | Hoch |
| FR-001-02 | Jeder User erhält eine eindeutige Device ID (UUID) | Hoch |
| FR-001-03 | Jeder User erhält einen Virtual Key für LiteLLM | Hoch |
| FR-001-04 | User-ID ist persistent in EncryptedSharedPreferences | Hoch |

### FR-002: Credits System

| ID | Requirement | Priorität |
|----|-------------|-----------|
| FR-002-01 | Credits werden durch Google Play Purchase hinzugefügt | Hoch |
| FR-002-02 | Jedes Product ID hat eine definierte Credit-Menge | Hoch |
| FR-002-03 | Credit-Balance ist jederzeit abfragbar | Hoch |
| FR-002-04 | Credit-Transaktionen werden gelogt (Audit Trail) | Mittel |
| FR-002-05 | Credits werden pro LLM Query verbraucht | Hoch |

### FR-003: Purchase Verification

| ID | Requirement | Priorität |
|----|-------------|-----------|
| FR-003-01 | Jeder Purchase Token wird genau einmal verarbeitet | Hoch |
| FR-003-02 | Duplikate Purchases werden erkannt und abgelehnt | Hoch |
| FR-003-03 | Purchase Token wird mit Google Play API verifiziert | Hoch |
| FR-003-04 | Bei Fehlern wird kein Credit gutgeschrieben | Hoch |

### FR-004: LiteLLM Integration

| ID | Requirement | Priorität |
|----|-------------|-----------|
| FR-004-01 | Virtual Keys werdenbei User-Erstellung generiert | Hoch |
| FR-004-02 | Budget wird basierend auf Credits aktualisiert | Mittel |
| FR-004-03 | LiteLLM Proxy URL ist konfigurierbar | Mittel |

### FR-005: Admin Panel

| ID | Requirement | Priorität |
|----|-------------|-----------|
| FR-005-01 | Admin kann alle User auflisten | Hoch |
| FR-005-02 | Admin kann User-Details einsehen | Hoch |
| FR-005-03 | Admin kann Credits hinzufügen/abziehen | Hoch |
| FR-005-04 | Admin kann User erstellen | Mittel |
| FR-005-05 | Admin kann User löschen | Niedrig |
| FR-005-06 | Admin kann System-Statistiken abrufen | Mittel |
| FR-005-07 | Admin-Zugriff erfordert X-Admin-Key Header | Hoch |

---

## Nicht-Funktionale Requirements (NFR)

### NFR-001: Performance

| ID | Requirement | Metrik |
|----|-------------|--------|
| NFR-001-01 | API Response Time < 200ms | P95 |
| NFR-001-02 | D1 Query Time < 50ms | P95 |
| NFR-001-03 | Cold Start < 100ms | Workers |

### NFR-002: Verfügbarkeit

| ID | Requirement | Metrik |
|----|-------------|--------|
| NFR-002-01 | Uptime > 99.9% | Cloudflare SLA |
| NFR-002-02 | Edge-Ausführung weltweit | Automatisch |

### NFR-003: Sicherheit

| ID | Requirement | Priorität |
|----|-------------|-----------|
| NFR-003-01 | HTTPS für alle Endpoints | Hoch |
| NFR-003-02 | Admin Endpoints durch X-Admin-Key geschützt | Hoch |
| NFR-003-03 | Virtual Keys sind UUID-basiert (nicht ratbar) | Hoch |
| NFR-003-04 | Purchase Tokens sind eindeutig | Hoch |
| NFR-003-05 | Secrets werden nicht geloggt | Hoch |
| NFR-003-06 | Rate Limiting schützt vor Spam | Mittel |

### NFR-004: Skalierbarkeit

| ID | Requirement | Metrik |
|----|-------------|--------|
| NFR-004-01 | Bis 100k Requests/Tag kostenlos | Cloudflare Free |
| NFR-004-02 | D1 Database bis25MB kostenlos | Cloudflare Free |
| NFR-004-03 | Horizontale Skalierung automatisch | Workers |

### NFR-005: Wartbarkeit

| ID | Requirement | Priorität |
|----|-------------|-----------|
| NFR-005-01 | Code ist TypeScript (strict mode) | Hoch |
| NFR-005-02 | API ist RESTful dokumentiert | Hoch |
| NFR-005-03 | Database Schema ist versioniert | Hoch |
| NFR-005-04 | Logs sind über Wrangler Tail abrufbar | Mittel |

---

## Technische Requirements (TR)

### TR-001: Infrastructure

| ID | Requirement | Value |
|----|-------------|-------|
| TR-001-01 | Runtime | Cloudflare Workers (V8 isolates) |
| TR-001-02 | Database | Cloudflare D1 (SQLite) |
| TR-001-03 | Language | TypeScript |
| TR-001-04 | Framework | Hono |

### TR-002: External Services

| ID | Requirement | Value |
|----|-------------|-------|
| TR-002-01 | LLM Proxy | LiteLLM (Railway/Fly.io) |
| TR-002-02 | Payment | Google Play Billing |
| TR-002-03 | LLM Provider | DeepInfra (Nemotron) |

### TR-003: Data Retention

| ID | Requirement | Dauer |
|----|-------------|-------|
| TR-003-01 | User Records | Unbegrenzt |
| TR-003-02 | Purchase Records | Unbegrenzt |
| TR-003-03 | Transaction Logs | Unbegrenzt |
| TR-003-04 | Rate Limit Logs | 24 Stunden |

---

## Schnittstellen (API)

### Public Endpoints

| Endpoint | Method | Auth | Beschreibung |
|----------|--------|------|--------------|
| `/` | GET | None | Health Check |
| `/api/v1/purchase/verify` | POST | Purchase Token | Credits kaufen |
| `/api/v1/user/balance` | GET | Device ID | Balance abfragen |
| `/api/v1/credits/consume` | POST | Virtual Key | Credits verbrauchen |

### Admin Endpoints

| Endpoint | Method | Auth | Beschreibung |
|----------|--------|------|--------------|
| `/api/v1/admin/stats` | GET | X-Admin-Key | Statistiken |
| `/api/v1/admin/users` | GET | X-Admin-Key | User auflisten |
| `/api/v1/admin/users/:id` | GET | X-Admin-Key | User Details |
| `/api/v1/admin/users` | POST | X-Admin-Key | User erstellen |
| `/api/v1/admin/users/:id/credits` | PUT | X-Admin-Key | Credits anpassen |
| `/api/v1/admin/users/:id` | DELETE | X-Admin-Key | User löschen |

---

## Abhängigkeiten

| ID | Abhängigkeit | Status |
|----|--------------|--------|
| DEP-001 | Cloudflare Account | ✅ Aktiv |
| DEP-002 | D1 Database | ✅ Erstellt |
| DEP-003 | workers.dev Subdomain | ✅ Aktiv |
| DEP-004 | LiteLLM Proxy | ⏳ Ausstehend |
| DEP-005 | Google Play Service Account | ⏳ Ausstehend |

---

*Created: 2026-04-10*