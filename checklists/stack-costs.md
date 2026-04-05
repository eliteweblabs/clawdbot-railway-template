# Monthly Stack Costs & Consolidation Plan

## Current Stack
| Service | Cost/mo | Notes |
|---------|---------|-------|
| Kinsta | $340 | 20-site WP plan — client was paying, may need to take over |
| Supabase (cloud) | $25 | CAPCO project — Pro plan |
| Railway | $? | App hosting, multiple projects |
| Resend | $0-20 | Transactional email |
| Cursor | $20 | AI code editor |
| Harvest | $? | Time tracking/invoicing |
| Google Workspace | $7/user | Email for client domains |
| Proton Mail | $4-10 | Personal email? |
| name.com | ~$12/yr per domain | Domain registration |

**Estimated total: ~$400-450/mo**

## Consolidation Plan

### 🔴 Kill Kinsta ($340/mo saved)
- Migrate 18 WP sites to Railway (WordPress Docker template)
- Est. Railway cost for 18 WP sites: ~$20-40/mo total
- **Savings: ~$300-320/mo**
- Priority: HIGH — start migration ASAP

### 🟡 Self-Host Supabase ($25/mo saved)
- Already done for MAVSAFE (self-hosted on Railway)
- Migrate CAPCO from Supabase cloud → self-hosted on Railway
- **Savings: $25/mo**
- Priority: MEDIUM — after Kinsta migration

### 🟡 Self-Host Resend Alternative
- Railway has a Resend template for self-hosting
- OR: Resend free tier = 3,000 emails/mo (might be enough)
- Check if current usage fits free tier before self-hosting
- **Savings: $0-20/mo**
- Priority: LOW — check usage first

### 🟢 Review Harvest
- Is Harvest worth it if you're bad at using it?
- Options: simpler tool, or build basic time tracking into your Astro/Supabase app
- The CMS already has `timeEntries` table — could build a quick timer UI
- Priority: LOW — quality of life improvement

### 🟢 Proton + Gmail overlap?
- Do you need both? Could consolidate
- Priority: LOW

## Target Stack (optimized)
| Service | Cost/mo |
|---------|---------|
| Railway (all hosting) | ~$50-80 |
| Google Workspace | $7/user |
| Cursor | $20 |
| name.com | ~$12/yr/domain |
| Resend (free tier) | $0 |
| Harvest (or replace) | $0-12 |

**Target total: ~$80-120/mo (down from ~$400+)**
