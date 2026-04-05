# Kinsta → Railway Migration Plan

## Site Inventory (from screenshots)

### 🟢 PRIORITY 1 — Active Clients (migrate first)
| Site | Client Status | Traffic | Size | Notes |
|------|---------------|---------|------|-------|
| **All Auto Financial** | ✅ Active ($14,595, last: 2026-02-11) | 96 visits | 4MB | Live + dev version |
| **DPM Construction** | ✅ Active ($15,267, last: 2026-03-01) | 2,633 visits | 75MB | $425 outstanding |
| **Inner City Fire Protection** | ✅ Active ($4,766, last: 2026-01-30) | 71 visits | 4MB | $600 outstanding |
| **Sam's Catch Basin Cleaning** | ✅ Active ($5,803, last: 2026-01-07) | 2,222 visits | 131MB | Live + sammy |
| **Tyler Associates** | ✅ Active ($9,625, last: 2026-02-01) | 3,267 visits | 110MB | Live + dev |

### 🟡 PRIORITY 2 — Recent Clients (migrate second)
| Site | Client Status | Traffic | Size | Notes |
|------|---------------|---------|------|-------|
| **Life Qi Holistic Medicine** | Recent ($1,235, last: 2025-07-09) | 19,428 visits | 198MB | Live only |
| **Paradigm Landscape** | Recent ($6,073, last: 2025-04-30) | 3,946 visits | 139MB | Live + scapeLAND |
| **Paradigm Hydroseed** | Recent ($5,052, last: 2025-06-01) | 2,713 visits | 121MB | Live + DEV |
| **Levine Law** | Outstanding ($2,100, last: 2025-11-05) | 5,622 visits | 94MB | $2,100 owed |

### 🔵 PRIORITY 3 — Keep but lower priority
| Site | Client Status | Traffic | Size | Notes |
|------|---------------|---------|------|-------|
| **CREED Lounge** | 2024 client ($2,000, last: 2024-03-08) | 1,930 visits | 171MB | Live + staging |
| **Care Elder Specialist** | Unknown | 2,561 visits | 60MB | Live + staging |
| **Tomsen + Rekko** | Unknown | 2,441 visits | 117MB | Live + stg |
| **firepumptestingco.com** | Unknown | 1,925 visits | 427MB | 3GB total |

### ⚪ CANDIDATES FOR ARCHIVE/DELETE (download first)
| Site | Reason | Traffic | Size |
|------|--------|---------|------|
| **Squarer from BU** | Very low traffic, old WP | 69 visits | 6MB |
| **M-Dot** | Very low traffic | 66 visits | 41MB |
| **giveaFUX** | No recent client relationship | 1,495 visits | 207MB |
| **Bed Bug Elimination Guide** | Static content candidate | 2,160 visits | 91MB |

## FINAL MIGRATION LIST (11 sites total)

### Active Clients - Priority 1
1. **All Auto Financial** — Active client
2. **Sam's Catch Basin Cleaning** — Active client  
3. **Tyler Associates** — Active client
4. **Inner City Fire Protection** — Active client
5. **Bed Bug Elimination Guide** — Active client
6. **DPM Construction** — Active client
7. **Fire Pump Testing Co** — **PRODUCTION SITE** (firepumptestingco.com, 1,925 visits/month) - MAVSAFE rebrand in development

### Priority 2
8. **Paradigm Hydroseed** — Recent client
9. **Paradigm Landscape** — Recent client
10. **Care Elder Specialist** — Unknown status
11. **Tomsen + Rekko** — Your portfolio

### Ignore/Delete
- Life Qi Holistic Medicine
- Levine Law  
- CREED Lounge
- giveaFUX
- M-Dot
- Squarer from BU
- All other sites

## Migration Strategy
1. **devKinsta download** — only the 11 sites above
2. **Railway projects** — create WordPress + MySQL for each
3. **Migrate in order** — active clients first
4. **Delete ignored sites** from Kinsta (no backup needed)

## Railway Cost Estimate
- **Active sites (5):** ~$10-15/month
- **All sites (17):** ~$25-40/month  
- **vs Kinsta:** $340/month → **90% savings**

## Next Steps
1. Start devKinsta downloads immediately
2. Set up WordPress-on-Railway template
3. Begin with All Auto Financial (smallest, active client)