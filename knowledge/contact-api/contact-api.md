# Contact API — Unified Client Identity

The **contact-api** is the single source of truth for client identity across all systems (Cal.com bookings, Crater invoicing, Supabase CMS). It prevents duplicate client records caused by slight name/email variations across systems.

## When to Use

**Always resolve a contact before:**
- Creating a booking (calcom-booking-api does this automatically)
- Creating a Crater invoice/customer
- Referencing a client in any external system

**Use resolution to answer:**
- "Is this a new client or an existing one?"
- "Do we already have a Todd Smith?" (fuzzy match handles "Tod Smith", "T. Smith")

## Quick Reference

### Environment Variables

| Var | Purpose |
|-----|---------|
| `CONTACT_API_URL` | Base URL (default: `http://contact-api.railway.internal:8080`) |
| `CONTACT_API_KEY` | Auth key for authentication |

### Scripts

```bash
# Resolve — check if someone exists (fuzzy name/email/phone)
scripts/contact-api.sh resolve "Todd Smith" "todd@example.com" "555-1234"

# Create — add a new contact
scripts/contact-api.sh create "Todd Smith" "todd@example.com" "555-1234" "Acme Corp"

# Search — find contacts by name/email
scripts/contact-api.sh search "Todd"

# Get — fetch by UID
scripts/contact-api.sh get <uid>

# Link — connect to external system (crater, calcom, supabase)
scripts/contact-api.sh link <uid> crater 42

# Merge — combine duplicate contacts
scripts/contact-api.sh merge <keep-uid> <discard-uid>

# List all contacts
scripts/contact-api.sh list
```

### Resolution Algorithm

When you call `resolve`, the API checks in this order:

1. **Exact email match** → `match: "exact"`
2. **Exact phone match** → `match: "exact"`
3. **Fuzzy name match** (pg_trgm trigram similarity) → `match: "likely"` or `"possible"`
4. **No match** → `match: "none"`

Response types:
- `exact` / `likely` — safe to proceed, contact returned as `.contact`
- `possible` — human should confirm, candidates in `.candidates[]`
- `none` — create a new contact

## Priority System (2026-04-28)

Added to contact-api schema:

| Priority | Status | Meaning |
|----------|--------|----------|
| 0 | archived | On hold / archive — ignore |
| 1-1000 | active | Higher = more important |

When asked "what should I work on?", query contacts sorted by priority DESC, filter priority > 0.

Common scale:
- 100 = Low priority
- 300 = Medium
- 500 = Normal
- 700 = High
- 900 = Highest
- 1000 = Critical

### Workflow: Creating an Invoice

```bash
# 1. Resolve the client
RESULT=$(scripts/contact-api.sh resolve "DPM Design" "dpm@example.com")

# 2. Check match type
MATCH=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('match','none'))")

# 3a. If exact/likely — use the contact
# 3b. If possible — ask human to confirm
# 3c. If none — create new contact

# 4. Create invoice (crater-invoice.sh handles all of this automatically)
scripts/crater-invoice.sh "DPM Design" "Web maintenance" "Monthly retainer" 450 "dpm@example.com"
```

### Workflow: Booking an Appointment

The `calcom-booking-api` already calls `contact-api/resolve` automatically during `POST /api/booking/create`. If a possible match is returned, the booking API returns `needsConfirmation: true` with candidates — present these to the human.

```bash
# Check availability
scripts/booking-api.sh availability

# Create booking (contact resolution happens server-side)
scripts/booking-api.sh create "Todd Smith" "todd@example.com" "2026-04-20T10:00:00"
```

### Cross-System Links

Each contact can be linked to IDs in external systems:

| System | What gets linked |
|--------|-----------------|
| `crater` | Crater customer ID |
| `calcom_booking` | Cal.com booking UID |
| `supabase` | Supabase profile UUID |

These links let you trace a single person across all platforms.

## API Endpoints (Direct curl)

```
POST   /api/contacts/resolve    — fuzzy resolve
POST   /api/contacts            — create
GET    /api/contacts             — list/search (?q=term&sort=priority)
GET    /api/contacts/:uid        — get by uid
PATCH  /api/contacts/:uid        — update
POST   /api/contacts/:uid/link   — add system link
POST   /api/contacts/:uid/merge  — merge duplicates
GET    /health                   — health check
```