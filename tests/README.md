# Beemaster Backend - Tests

## Teststruktur

```
tests/
├── unit/                    # Isolierte Funktions-Tests
│   ├── uuid.test.ts        # UUID-Generierung
│   ├── validation.test.ts  # Input-Validierung
│   └── credit-mapping.test.ts# Credit-Produkt-Mapping
├── integration/             # API-Endpoint-Tests (gemockt)
│   ├── purchase.test.ts    # Purchase Flow
│   ├── balance.test.ts     # Balance API
│   ├── admin-users.test.ts # Admin User Management
│   └── admin-credits.test.ts # Admin Credits
└── system/                  # End-to-End Tests
    ├── health.test.ts      # Health Check
    ├── purchase-flow.test.ts # Kompletter Kauf-Flow
    └── admin-flow.test.ts   # Kompletter Admin-Flow
```

## Test-Ausführung

```bash
# Alle Tests
npm test

# Nur Unit Tests
npm run test:unit

# Nur Integration Tests
npm run test:integration

# Nur System Tests
npm run test:system

# Mit Coverage
npm run test:coverage
```

## Coverage-Ziele

| Typ | Ziel |
|-----|------|
| Unit | ≥ 80% |
| Integration | ≥ 70% |
| System | ≥ 50% |
| **Gesamt** | **≥ 70%** |

---

*Created: 2026-04-10*