# Reave — Client Knowledge

Reave-specific client identity context. Generic Crater API knowledge lives in
the canonical `eliteweblabs/crater` repo and is auto-synced into
`services/crater/KNOWLEDGE.md` on every container start.

> **Future home**: this file is staging for a per-installation knowledge repo
> (e.g. `eliteweblabs/reave-knowledge`). Once that exists, this content moves
> there and disappears from the runtime template.

## Client Name Aliases (fuzzy resolution)

When a name is spoken in conversation that doesn't exactly match a Crater
customer record, use this table before asking the human to clarify:

| Spoken | Means |
|---|---|
| `Todd` | **Green Planet Pest Control** (Todd is the contact, not the company) |
| `Paradigm` | **Ambiguous** — confirm whether `Paradigm Hydroseed` or `Paradigm Landscape` |
| `Paradigm hydro` | Paradigm Hydroseed |
| `Paradigm landscape` | Paradigm Landscape |

Always confirm with the user when in doubt. Add new aliases here as patterns
emerge.

## Recurring Invoices (snapshot)

Active recurring invoices in Crater. **Always fetch current totals from the API
at request time** — this list is for context only, not for quoting prices.

| Client | Cadence | Approx amount |
|---|---|---|
| Green Planet Pest Control | Yearly | $425.00 |
| Life Qi Holistic Medicine | Yearly | $425.00 |
| Paradigm Landscape | Yearly | $425.00 |
| Masonic Health System | Quarterly | $250.00 |
| All Auto Financial | Yearly | $425.00 |
| Sams Catch Basin Cleaning | Yearly | $425.00 |
| Tyler Associates Inc. | Yearly | $425.00 |
| DPM Design and Construction | Yearly | $425.00 |
| Rothco Built | Yearly | $425.00 |
| Levines Law | Yearly | $425.00 |

To fetch the live list:

```
GET {CRATER_URL}/api/v1/recurring-invoices
```

See `services/crater/KNOWLEDGE.md` for the canonical recurring-invoices API
reference, including the cron-format frequency table.
