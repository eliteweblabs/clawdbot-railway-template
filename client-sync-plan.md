# Client Sync: contact-api ↔ Crater ↔ Supabase

## Architecture (Updated)

The **contact-api** is now the single source of truth for client identity.
All systems link back to it via `contact_links` (see `CONTACT-API.md`).

```
                  ┌──────────────┐
                  │  contact-api │  ← canonical identity
                  │  (Postgres)  │
                  └──────┬───────┘
                         │ contact_links
            ┌────────────┼────────────┐
            ▼            ▼            ▼
       ┌─────────┐ ┌──────────┐ ┌──────────┐
       │ Crater  │ │ Cal.com  │ │ Supabase │
       │ (MySQL) │ │ (Postgres)│ │ (Postgres)│
       └─────────┘ └──────────┘ └──────────┘
```

## Problem
- Crater (invoicing), Cal.com (booking), and Supabase (CMS) each create client records independently
- Slight name/email variations cause duplicates
- contact-api resolves this with fuzzy matching (pg_trgm)

## Data Sources

### contact-api (canonical)
- Postgres DB with `contacts`, `contact_aliases`, `contact_links` tables
- Fuzzy resolution via email → phone → name similarity
- Tracks which external IDs belong to each contact

### Supabase: `profiles` + `auth.users`
- Authenticated client accounts (CMS users with role='Client')
- Fields: id (UUID), companyName, firstName, lastName, email, phone, role

### Crater: `customers` (MySQL)
- Billing/invoicing client records
- Fields: name, email, phone, contact_name, company_name, website

### Cal.com: `bookings`
- Scheduling records linked to attendee email/name
- Already wired — calcom-booking-api calls contact-api/resolve automatically

## Sync Strategy

### Phase 1: contact-api as hub (DONE)
- calcom-booking-api resolves contacts before booking ✅
- crater-invoice.sh resolves contacts before invoicing ✅
- All new interactions flow through contact-api

### Phase 2: Backfill existing clients
1. Export Crater customers → resolve each against contact-api → create/link
2. Export Supabase profiles (role='Client') → resolve → create/link
3. Import Harvest dashboard clients → resolve → create/link

### Phase 3: Bidirectional sync
**Flow 1:** New contact-api entry → create in Crater + Supabase
**Flow 2:** New Crater customer → resolve in contact-api → link
**Flow 3:** New Supabase profile → resolve in contact-api → link

## Field Mapping

| contact-api | Crater | Supabase |
|-------------|--------|----------|
| name | name / contact_name | firstName + lastName |
| email | email | auth.users.email |
| phone | phone | profiles.phone |
| company | company_name | profiles.companyName |
| uid | contact_links.external_id (system='crater') | contact_links.external_id (system='supabase') |

## Next Steps

1. ~~Set up contact-api~~ ✅
2. ~~Wire into booking and invoicing flows~~ ✅
3. **Backfill script** — iterate Crater customers, resolve+link in contact-api
4. **Supabase sync trigger** — on new profile(role='Client'), call contact-api/resolve
5. **Dashboard update** — generate `clients/dashboard.md` from contact-api list endpoint

## Benefits
- Single identity across all platforms
- Fuzzy matching catches "Todd Smith" vs "Tod Smith" vs "T. Smith"
- Every client traceable across Crater, Cal.com, Supabase via contact_links
- Merge endpoint handles discovered duplicates
