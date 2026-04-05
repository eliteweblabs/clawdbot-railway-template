# New Client Website Checklist

## 1. Domain & DNS
- [ ] Purchase/transfer domain (name.com)
- [ ] A record → Railway edge IP (66.33.22.137)
- [ ] www → URL redirect to https://domain.com (via name.com)
- [ ] MX records (Google Workspace)
- [ ] SPF: `v=spf1 include:_spf.google.com include:_spf.resend.com ~all`
- [ ] DMARC: `v=DMARC1; p=quarantine; rua=mailto:admin@domain.com`
- [ ] Google DKIM (via Google Admin → Gmail → Authenticate Email)
- [ ] Resend DKIM (add domain in Resend dashboard)
- [ ] Railway verification TXT

## 2. Email
- [ ] Google Workspace setup (or add domain to existing)
- [ ] Resend domain verified (transactional email)
- [ ] Test email send/receive

## 3. Railway / Hosting
- [ ] Create Railway project
- [ ] Deploy app service (Astro + Supabase or WordPress)
- [ ] Custom domain added + SSL verified
- [ ] Environment variables configured
- [ ] Supabase connection (self-hosted or cloud)
- [ ] Storage bucket created (project-media)

## 4. Database
- [ ] Schema deployed (clone from template or fresh)
- [ ] Admin user created
- [ ] Client user created (if needed)
- [ ] Sample data cleaned out

## 5. Branding & Content
- [ ] Logo uploaded (SVG for theme support)
- [ ] Icon/favicon set
- [ ] Company name, slogan, address, phone, email
- [ ] Primary + secondary colors configured
- [ ] Homepage content
- [ ] Contact page
- [ ] Privacy policy
- [ ] Terms of service

## 6. SEO & Analytics
- [ ] Google Search Console — domain verified
- [ ] Plausible or analytics script added
- [ ] robots.txt configured
- [ ] Sitemap generated
- [ ] Meta descriptions on key pages
- [ ] Open Graph / social sharing tags

## 7. Security & Auth
- [ ] Auth provider configured (email/password, magic link, OAuth)
- [ ] RLS policies verified
- [ ] Admin access tested
- [ ] Client login tested

## 8. Testing & QA
- [ ] Test emails using @eliteweblabs.com addresses (catch-all setup)
- [ ] Contact form submissions working
- [ ] Invoice/transactional emails delivering
- [ ] Magic links working (if applicable)
- [ ] All automated workflows tested

## 9. Coming Soon → Launch
- [ ] Coming soon mode ON during setup
- [ ] Contact form working
- [ ] Social media links set
- [ ] Final review with client
- [ ] Coming soon mode OFF → live
- [ ] Announce to client

## 10. Post-Launch
- [ ] Monitor Google Search Console (indexing)
- [ ] Test contact form submissions
- [ ] Verify email deliverability (SPF/DKIM/DMARC pass)
- [ ] Set up uptime monitoring
- [ ] Backup schedule confirmed
