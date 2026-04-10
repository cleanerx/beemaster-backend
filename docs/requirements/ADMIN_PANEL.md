# Beemaster Admin Panel - Requirements

## Übersicht

Web-basiertes Admin-Panel für Beemaster Backend zur Verwaltung von Benutzern und Credits.

---

## Feature Requirements

### FEAT-001: Dashboard

| ID | Requirement | Beschreibung |
|----|-------------|--------------|
| FEAT-001-01 | Gesamtstatistiken | User, Credits, Purchases, Transactions |
| FEAT-002-02 | Echtzeit-Updates | Auto-Refreshalle30 Sekunden |
| FEAT-003-03 | Visuelle Charts | Credits over Time, Purchases by Product |

### FEAT-002: User Management

| ID | Requirement | Beschreibung |
|----|-------------|--------------|
| FEAT-002-01 | User Liste | Paginated, Sortable, Filterable |
| FEAT-002-02 | User Suche | Nach user_id oder virtual_key |
| FEAT-002-03 | User Details | Credits, Transactions, Purchases |
| FEAT-002-04 | User erstellen | Mit initialen Credits |
| FEAT-002-05 | User löschen | Mit Bestätigungsdialog |

### FEAT-003: Credit Management

| ID | Requirement | Beschreibung |
|----|-------------|--------------|
| FEAT-003-01 | Credits hinzufügen | Mit Grundtext |
| FEAT-003-02 | Credits abziehen | Mit Grundtext |
| FEAT-003-03 | Transaction History | Pro User mit Zeitstempel |
| FEAT-003-04 | Bulk Operations | Mehrere User gleichzeitig |

### FEAT-004: Authentication

| ID | Requirement | Beschreibung |
|----|-------------|--------------|
| FEAT-004-01 | Admin Login | Mit Admin Key |
| FEAT-004-02 | Session Management | Auto-Logout nach Inaktivität |
| FEAT-004-03 | Access Logging | Wer hat wann was geändert |

---

## UI Requirements

### Desktop Layout

```
┌────────────────────────────────────────────────────────────────┐
│ BEEMASTER ADMIN                           [Logout]             │
├────────────────┬───────────────────────────────────────────────┤
│                │                                               │
│  Dashboard     │  ┌─────────────────────────────────────────┐ │
│  Users         │  │  Users                                   │ │
│  Credits       │  │  ───────────────────────────────────────│ │
│  Transactions  │  │  [Search...                  ] [Add User] │ │
│  Settings      │  │  ┌─────────────────────────────────────┐ │ │
│                │  │  │ ID    │ Credits │ Created    │ ... │ │ │
│                │  │  ├─────────────────────────────────────┤ │ │
│                │  │  │ abc123│ 500    │ 2026-04-10 │ [+] │ │ │
│                │  │  │ def456│ 200    │ 2026-04-09 │ [+] │ │ │
│                │  │  └─────────────────────────────────────┘ │ │
│                │  └─────────────────────────────────────────┘ │
└────────────────┴───────────────────────────────────────────────┘
```

### Mobile Layout (Responsive)

```
┌──────────────────────┐
│ ≡BEEMASTER ADMIN[...]│
├──────────────────────┤
│ Dashboard            │
│ Users      Credits   │
│ Transactions        │
├──────────────────────┤
│ Users               │
│ [Search...] [+]     │
│ ┌──────────────────┐ │
│ │ abc123           │ │
│ │ Credits: 500     │ │
│ │ [View] [Edit]    │ │
│ └──────────────────┘ │
└──────────────────────┘
```

---

## Technical Stack

### Option A: Static HTML + JavaScript (Empfohlen)

| Komponente | Technologie |
|------------|-------------|
| Frontend | Plain HTML/CSS/JS |
| UI Framework | Bootstrap 5 oder Tailwind CSS|
| API Calls | Fetch API |
| Hosting | Cloudflare Pages (kostenlos) |

**Vorteile:**
- Kein Build-Process
- Einfaches Deployment
- Kleinste Bundle-Size

### Option B: Vue.js SPA

| Komponente | Technologie |
|------------|-------------|
| Frontend | Vue 3 |
| UI Framework | Vuetify |
| Build | Vite |
| Hosting | Cloudflare Pages |

**Vorteile:**
- Bessere UX
- Komponenten-Wiederverwendbarkeit

---

## API Integration

### Auth Header

```javascript
const headers = {
  'Content-Type': 'application/json',
  'X-Admin-Key': 'your-admin-key'
}
```

### Endpoints

```javascript
// Dashboard Stats
GET /api/v1/admin/stats

// User List
GET /api/v1/admin/users

// User Details
GET /api/v1/admin/users/:id

// Create User
POST /api/v1/admin/users
{ "user_id": "optional", "initial_credits": 100 }

// Adjust Credits
PUT /api/v1/admin/users/:id/credits
{ "amount": 50,"reason": "Compensation" }

// Delete User
DELETE /api/v1/admin/users/:id
```

---

## Deployment

### Cloudflare Pages

```bash
# Build (for Option B)
npm run build

# Deploy
wrangler pages deploy ./dist
```

### Custom Domain

```
admin.beemaster.app → Cloudflare Pages
```

---

## Security

| Maßnahme | Beschreibung |
|----------|--------------|
| Admin Key | Starkes Secret (32+ Zeichen) |
| HTTPS | Automatisch durch Cloudflare |
| Rate Limiting | Backend-seitig implementiert |
| Session Timeout | 15 Minuten Inaktivität |
| Audit Logging | Alle Admin-Actions geloggt |

---

## Roadmap

### Phase 1 (MVP)
- [ ] Dashboard mit Stats
- [ ] User Liste
- [ ] Credits anpassen
- [ ] Admin Login

### Phase 2
- [ ] Charts (Credits over Time)
- [ ] Transaction History
- [ ] Bulk Operations
- [ ] Export CSV

### Phase 3
- [ ] Real-time Updates (WebSocket)
- [ ] Two-Factor Auth
- [ ] Role-based Access
- [ ] Audit Log Viewer

---

*Created: 2026-04-10*