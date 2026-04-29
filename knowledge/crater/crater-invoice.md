# Crater Invoice Helper

Automatically resolves contact identity first, then creates a Crater invoice.

## Usage

```bash
crater-invoice.sh "Customer Name" "Item Name" "Description" Price ["email"] ["phone"]
```

## Arguments

| Arg | Required | Description |
|-----|----------|-------------|
| 1 | Yes | Customer name |
| 2 | Yes | Item name |
| 3 | Yes | Description |
| 4 | Yes | Price (dollars) |
| 5 | No | Email |
| 6 | No | Phone |

## Workflow

1. **Resolve contact** — calls `contact-api/resolve` first
2. **If no match** — creates new contact automatically
3. **If possible match** — shows candidates, proceeds with best match
4. **Create invoice** — in Crater (via Railway)
5. **Link systems** — links Crater customer ID to unified contact

## Environment

- `CONTACT_API_URL` — contact-api base URL
- `CONTACT_API_KEY` — contact-api key
- Runs via Railway in `crater-invoicing` project
- **Not all projects have Crater** — e.g., Rothco Built uses separate invoicing

## Notes

- Uses Railway CLI (`railway run`)
- Creates DRAFT invoices (not sent automatically)
- Links contact → Crater customer after creation
- Price is in dollars, converted to cents internally