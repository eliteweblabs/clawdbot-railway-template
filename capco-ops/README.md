# CAPCO Operations — CAP Design Group Business Automation

## What This Is
Operational AI assistant for Jason Kahan (Jay), P.E. — principal at CAP Design Group.
Fire protection engineering firm in Massachusetts.

## Goal
Replace Jason's current zero-project-management chaos with an AI-driven ops layer that:
1. Handles email → task conversion
2. Generates documents (narratives, affidavits, NFPA 241 plans) from templates
3. Manages designer pipeline (keeps people on track)
4. Integrates with GoHighLevel CRM
5. Lives on Slack (Jason's preferred surface)

## Jason's Profile
- **Name:** Jason Kahan, P.E. (MA Registration 48388)
- **Email:** jk@capcofire.com
- **Phone:** 617-633-3533
- **Role:** Engineer of record, principal
- **Style:** Wants results, not database tables. Iterative — gives scope then refines.

## CAP Design Group
- Fire sprinkler design (NFPA 13, 13R, 13D)
- Fire alarm design (NFPA 72)
- NFPA 25 inspection/remediation
- Life safety narratives
- Building code compliance analysis
- Third-party plan review (stamping)

## Massachusetts Regulatory Environment
- 780 CMR (10th Edition, based on IBC 2021)
- 527 CMR 1.00 (MA Fire Safety Code)
- Local AHJ requirements (including Boston Fire Dept rules)
- NFPA: 1, 13, 13D, 13R, 14, 25, 72, 101, 241

## Key Clients & Collaborators
- The Hamilton Company (property management)
- Bob Parsekian (developer)
- John Crowell (architect)
- Xcel Fire Protection (contractor)
- Boustris & Sons, Inc. (contractor)

## Existing Tools
- Google Workspace (Forms → Sheets → Docs via Apps Script)
- Node.js docx library for Word generation
- Zoho Books for proposals/invoicing
- GoHighLevel (has API — to be integrated)
- Slack (preferred comms)

## Jason's Working Principles
- AHJ interpretation > strict code compliance
- Proactive issue flagging (surface problems, don't bury them)
- Preempt reviewer pushback in submittals
- Template integrity: red text = placeholder only, final = all black
- Sections 3, 4, 6, 7 of life safety narratives = fixed boilerplate
- Boston vs non-Boston toggle for BFD Rules Section 9
- Downloadable/exportable outputs > inline markdown
- Plan review: color-coded priority tables (critical/major/clarification)

## Active Work (from Jason's Claude project)
- Life Safety Narrative template builder (7-step, working for non-Boston)
- 23 Prince St, Danvers — NFPA 25 remediation (open: missing backflow preventer Bldg 2)
- Expanding narrative templates: 13D/13R, 13, commercial
- MA building code IRC/IBC threshold analysis

## Staff Domains (not clients)
- capcofire.com
- eliteweblabs.com
- tomsens.com
