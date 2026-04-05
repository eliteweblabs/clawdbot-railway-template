# Domain Transitions - Priority Order

## 1. Solid Builders (Next Up)
- **Current:** https://solid-production.up.railway.app ✅ (working)
- **Target:** solidboston.com → Railway custom domain
- **Status:** **WAITING** for domain access from client
- **Action:** Need solidboston.com DNS control to point to Railway
- **Railway Setup:** Add solidboston.com as custom domain in Railway dashboard
- **DNS Changes Needed:** 
  - A record: @ → 66.33.22.137 (Railway edge IP)
  - Or CNAME: @ → solid-production.up.railway.app

## 2. MAVSAFE (Development - Future)
- **Current:** firepumptestingco.com (live production site on Kinsta)
- **Development:** mavsafe.com (Railway, coming soon mode)
- **Status:** Development site ready, rebrand "not even close to ready yet"
- **Timeline:** TBD - waiting for content/brand completion

## 3. Other Projects
- **CAPCO:** capcofire.com already live
- **Other Railway projects:** Paulino, PhaseLine, Luxe Meds (domain status unknown)

## Domain Access Checklist

### For solidboston.com (Immediate)
- [ ] Get domain registrar access (name.com? GoDaddy? other?)
- [ ] Or get client to add DNS records
- [ ] Add custom domain in Railway dashboard
- [ ] Test SSL certificate provision
- [ ] Verify site loads on custom domain

### Client Communication Template
"Hi [client], 

The new Solid Builders website is ready to go live at solidboston.com. I need access to your domain settings to point it to the new hosting. 

Can you either:
1. Give me temporary access to your domain registrar account, OR
2. Add these DNS records yourself: [provide specific records]

This should take about 5 minutes and the site will be live immediately after.

Thanks!"

---
**Status:** Solid Builders deployment ready, waiting on domain access.