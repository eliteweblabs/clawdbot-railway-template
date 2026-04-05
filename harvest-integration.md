# Harvest Integration for Billing

## Setup Steps

### 1. Get Your Personal Access Token
1. Go to https://id.getharvest.com/developers
2. Click **Create New Personal Access Token**
3. Give it a name like "OpenClaw Integration"
4. Copy the **token** and **Account ID**

### 2. Store Credentials
Add to your environment (e.g. `~/.zshrc` or OpenClaw gateway env):
```bash
export HARVEST_ACCESS_TOKEN="your-token-here"
export HARVEST_ACCOUNT_ID="your-account-id-here"
```

### 3. Quick Test
```bash
curl -s -H "Authorization: Bearer $HARVEST_ACCESS_TOKEN" \
  -H "Harvest-Account-Id: $HARVEST_ACCOUNT_ID" \
  -H "User-Agent: EliteWebLabs (thomas@eliteweblabs.com)" \
  https://api.harvestapp.com/v2/users/me | python3 -m json.tool
```

## What I Can Do Once Connected

With the Harvest API, I can help you:

- **Track time** — Start/stop timers, log hours to projects
- **View unbilled hours** — See which clients have uninvoiced time
- **Create invoices** — Generate invoices from tracked time
- **Check project budgets** — See hours used vs. budget
- **Weekly billing reports** — Summarize what you worked on
- **Invoice reminders** — Alert you about overdue invoices
- **Auto-log time** — I can remind you to log time or help reconstruct entries

## API Endpoints (Reference)

| Action | Endpoint |
|--------|----------|
| List projects | `GET /v2/projects` |
| List clients | `GET /v2/clients` |
| List time entries | `GET /v2/time_entries` |
| Create time entry | `POST /v2/time_entries` |
| List invoices | `GET /v2/invoices` |
| Create invoice | `POST /v2/invoices` |
| Uninvoiced report | `GET /v2/reports/uninvoiced` |

## Automation Ideas

### Heartbeat Checks
Once connected, I can add to HEARTBEAT.md:
- Check for unbilled time > 2 weeks old
- Remind to log time if nothing tracked today
- Alert on overdue invoices

### Client Mapping
Map Harvest clients to projects:
- CAPCO Design Group → capcofire.com
- MAVSAFE → mavsafe.com
- Paulino Auto Group → Railway
- PhaseLine Painting → Railway
- Luxe Meds → Railway
- (+ WordPress clients on Kinsta)

## Status: ⏳ Waiting for Token

Thomas needs to:
1. [ ] Create Personal Access Token at https://id.getharvest.com/developers
2. [ ] Share the token + account ID (or set as env vars)

Then I can start pulling data and setting up automations.
