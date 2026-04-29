# Crater — Create Invoice via OpenClaw API

Use POST `/api/openclaw/create-invoice` to create invoices directly via HTTP (no Railway CLI needed).

## Endpoint

```
POST https://ap.reave.app/api/openclaw/create-invoice
Header: X-OpenClaw-Token
```

## Token

- Stored in: `~/.openclaw/workspace/.crater-api-token`
- Railway env var: `OPENCLAW_API_TOKEN` must be set

## Request Body

```json
{
  "customer_name": "Client Name",
  "items": [
    {
      "name": "Service Description",
      "price": 150.00,
      "quantity": 1
    }
  ]
}
```

## Notes

- Partial customer name works — server does substring match
- If customer doesn't exist, it's created automatically
- **Pagination rule:** When fetching customers via Crater API (`/api/v1/customers`), always call both page 1 and page 2 and combine results. Don't assume all results come in one page.
  - Page 1: `/api/v1/customers?page=1&per_page=50`
  - Page 2: `/api/v1/customers?page=2&per_page=50`