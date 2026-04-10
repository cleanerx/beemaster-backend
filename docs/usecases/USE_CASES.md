# Use Cases - Beemaster Backend

## UC-B001: Benutzer-Registrierung (Auto-Create)

**Priorität:** Hoch

**Akteure:**
- Benutzer (via App)
- System

**Vorbedingung:**
- Neue App-Installation
- Kein existierender User

**Ablauf:**
1. App generiert Device ID (UUID)
2. App speichert Device ID in EncryptedSharedPreferences
3. Benutzer startet ersten Kauf (Google Play Billing)
4. App sendet `{ purchase_token, product_id, device_id }` an Backend
5. Backend prüft: User existiert?
   - NEIN: Erstellt User + Virtual Key
   - JA: Lädt existierende Daten
6. Backend verifiziert Purchase
7. Backend schreibt Credits gut
8. Backend sendet `{ user_id, virtual_key, credits_balance }` zurück

**Nachbedingung:**
- User existiert in D1 Database
- Virtual Key ist generiert
- Credits sindgebucht

**Fehlerfälle:**
- E1: Purchase Token ungültig → 400 Error
- E2: Purchase Token bereits verwendet → 400 Error
- E3: Netzwerkfehler → Retry durch App

---

## UC-B002: Credits Kauf

**Priorität:** Hoch

**Akteure:**
- Benutzer (via App)
- Google Play Billing
- Backend
- LiteLLM Proxy

**Vorbedingung:**
- User existiert (oder wird auto-erstellt)
- Google Play Account konfiguriert

**Ablauf:**
1. Benutzer wählt Credit-Paket in App
2. App ruft BillingClient.launchBillingFlow()
3. Benutzer bestätigt Kauf bei Google Play
4. App erhält Purchase Token
5. App sendet POST /api/v1/purchase/verify
6. Backend verifiziert bei Google Play API
7. Backend schreibt Credits gut
8. App zeigt "X Credits gutgeschrieben"

**Produkte:**

| Product ID | Credits | Preis |
|------------|---------|-------|
| credits_starter_100 | 100 | €1.99 |
| credits_medium_500 | 500 | €4.99 |
| credits_pro_2000 | 2000 | €14.99 |
| credits_unlimited | 10000 |€49.99 |

**Nachbedingung:**
- Credits sind gebucht
- LiteLLM Budget ist aktualisiert

---

## UC-B003: Credit-Abfrage

**Priorität:** Hoch

**Akteure:**
- App (regelmäßiger Check)

**Vorbedingung:**
- Device ID vorhanden

**Ablauf:**
1. App sendet GET /api/v1/user/balance?user_id=XXX
2. Backend prüft User
   - Existiert: Return balance
   - Existiert nicht: Auto-create mit 0 Credits
3. App zeigt Balance an

**Response:**
```json
{
  "user_id": "uuid",
  "virtual_key": "sk-beemaster-xxx",
  "credits_balance": 150,
  "total_purchased": 500
}
```

---

## UC-B004: Credit-Verbrauch (LLM Query)

**Priorität:** Hoch

**Akteure:**
- Benutzer (via Voice Agent)
- LiteLLM Proxy
- Backend

**Vorbedingung:**
- Virtual Key vorhanden
- Credits > 0

**Ablauf:**
1. Benutzer spricht mit Voice Agent
2. App sendet Request an LiteLLM Proxy
   - Header: Authorization: Bearer {virtual_key}
3. LiteLLM Proxy validiert Key
4. LiteLLM ruft an DeepInfra
5. LiteLLM sendet POST /api/v1/credits/consume an Backend
6. Backend zieht Credits ab
7. Backend loggt Transaction
8. App erhält Response

**Fehlerfälle:**
- E1: Credits < 1 → "Nicht genug Credits"
- E2: User nicht gefunden → 404

---

## UC-B005: Admin - User Übersicht

**Priorität:** Mittel

**Akteure:**
- Administrator

**Vorbedingung:**
- Admin Key konfiguriert

**Ablauf:**
1. Admin öffnet Web-Panel
2. Admin sendet GET /api/v1/admin/users
   - Header: X-Admin-Key: {ADMIN_API_KEY}
3. Backend authentifiziert Admin
4. Backend返回 alle User

**Response:**
```json
{
  "count": 42,
  "users": [
    {
      "id": "...",
      "user_id": "...",
      "virtual_key": "sk-beemaster-...",
      "credits_balance": 150,
      "total_purchased": 500,
      "created_at": "2026-04-10T..."
    }
  ]
}
```

---

## UC-B006: Admin - Credits Anpassen

**Priorität:** Hoch

**Akteure:**
- Administrator

**Vorbedingung:**
- Admin Key konfiguriert
- User existiert

**Ablauf:**
1. Admin wählt User in Web-Panel
2. Admin gibt Credit-Änderung ein (+/-)
3. Admin sendet PUT /api/v1/admin/users/:id/credits
   - Body: `{ "amount": 100, "reason": "Kompensation bei Fehler" }`
4. Backend aktualisiert Credits
5. Backend loggt Transaction

**Use Cases:**
- Fehlerhafte Abbuchung korrigieren
- Credits geschenkt (Marketing-Aktion)
- Refund bei Problemen

---

## UC-B007: Admin - Benutzer Löschen

**Priorität:** Niedrig

**Akteure:**
- Administrator

**Vorbedingung:**
- Admin Key konfiguriert
- User existiert

**Ablauf:**
1. Admin wählt User in Web-Panel
2. Admin klickt "Löschen"
3. Backend löscht:
   - Alle Transactions
   - Alle Purchases
   - User Record
4. Backend bestätigt Löschung

**Warnung:** Unwiderruflich!

---

## UC-B008: Admin - System Statistiken

**Priorität:** Mittel

**Akteure:**
- Administrator

**Ablauf:**
1. Admin ruft GET /api/v1/admin/stats
2. Backend aggregiert:
   - Total Users
   - Total Credits in Circulation
   - Total Purchases
   - Total Transactions

**Response:**
```json
{
  "total_users": 1250,
  "total_credits_in_circulation": 45000,
  "total_purchases": 320,
  "total_transactions": 15800
}
```

---

*Created: 2026-04-10*