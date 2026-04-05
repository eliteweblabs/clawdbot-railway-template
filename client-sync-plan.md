# Client Sync: Supabase ↔ Crater

## Problem
- Crater (invoicing) and Supabase (CMS) both have client data
- Manual duplication leads to inconsistencies 
- Need automatic sync to prevent duplicates

## Data Sources

### Supabase: `profiles` + `auth.users`
- Authenticated client accounts (CMS users with role='Client')
- Fields: id (UUID), companyName, firstName, lastName, email, phone, role
- Linked to auth.users for authentication data

### Crater: `customers` 
- Billing/invoicing client records
- Fields: name, email, phone, contact_name, company_name, website

## Sync Strategy

### Required: Bidirectional Sync (MANDATORY)
**Why:** Customers need Supabase profiles for magic link invoice access

**Flow 1:** Supabase profiles → Crater customers
- Existing authenticated clients become billing customers

**Flow 2:** Crater customers → Supabase profiles 
- New customers get Supabase profiles for invoice portal access
- Magic links require auth.users + profiles records

**Critical:** Every Crater customer MUST have a Supabase profile

## Field Mapping

| Supabase | Crater | Logic |
|----------|---------|--------|
| profiles.firstName + lastName | contact_name | Concatenate with space |
| profiles.companyName | company_name | Direct mapping |
| profiles.companyName | name | Use company as primary customer name |
| auth.users.email | email | Direct mapping from auth table |
| profiles.phone | phone | Direct mapping |
| profiles.id (UUID) | (custom field) | Store Supabase UUID for sync tracking |

**Sync Criteria:** Only profiles where `role = 'Client'`

**Supabase Query:**
```sql
SELECT 
    p.id,
    p."companyName",
    p."firstName", 
    p."lastName",
    p.phone,
    p."createdAt",
    u.email
FROM profiles p
JOIN auth.users u ON p.id = u.id 
WHERE p.role = 'Client'
```

## Implementation Options

### A. Bidirectional Sync Script
```python
def sync_clients_bidirectional():
    # FLOW 1: Supabase → Crater
    # 1. Get Supabase profiles (role='Client') + auth.users
    # 2. Create missing customers in Crater
    # 3. Update existing customers with latest info
    
    # FLOW 2: Crater → Supabase  
    # 4. Get Crater customers without Supabase profiles
    # 5. Create auth.users records (for magic links)
    # 6. Create profiles with role='Client'
    # 7. Send magic link invitation emails
```

### B. Webhook-Driven (Real-time)
- Supabase trigger on INSERT → webhook → Crater API
- Instant sync when contact form submitted

### C. Database Trigger
- PostgreSQL trigger/function 
- Direct database-to-database sync

## Next Steps

1. **Choose approach** (recommend Option A - API script)
2. **Build sync script** using Crater + Supabase APIs
3. **Test with sample data**
4. **Set up cron job** for automated sync
5. **Add monitoring/logging**

## Benefits
- ✅ **Invoice portal access** — Every customer can access invoices via magic links
- ✅ **Single source of truth** — No data inconsistencies 
- ✅ **No manual setup** — New customers automatically get portal access
- ✅ **Seamless workflow** — Create customer → they get magic link → can view invoices
- ✅ **Authentication handled** — Supabase manages magic links, sessions, security

## Critical Requirements
- Every Crater customer → Supabase profile (role='Client')
- Every Supabase client → Crater customer
- Magic link functionality depends on this sync working