# Crater API Documentation

## Base URL
`https://ap.reave.app/api/v1`

## Authentication
Use Bearer token in the Authorization header:
```
Authorization: Bearer <token>
```

## Endpoints

### Customers
- **List:** `GET /customers`
- **Pagination:** Add `&page=2&per_page=50` for additional pages
- **Note:** Crater paginates at 10 customers per page by default

### Invoices
- **List:** `GET /invoices?per_page=100`
- **Filters:** Add `status=SENT`, `status=PAID`, etc.
- **Fields returned:** `customer.name`, `total` (in cents), `unique_hash`

## Pagination
Many endpoints paginate. Always check for Page 2:
```
/api/v1/customers?page=1&per_page=50
/api/v1/customers?page=2&per_page=50
```

## Common Issues
1. **Missing customers** - Check pagination (default shows only 10)
2. **Total is in cents** - Divide by 100 for dollar amount
3. **No customers endpoint** - Falls back to invoices to get client list

## Custom Endpoints (OpenClaw)

### Create Invoice
```
POST /api/openclaw/create-invoice
Headers:
  X-OpenClaw-Token: <token>
  Content-Type: application/json
Body:
{
  "customer_name": "Client Name",
  "customer_email": "client@email.com",
  "items": [
    {"name": "Service Description", "price": 1000, "quantity": 1}
  ],
  "notes": "Optional notes",
  "status": "SENT" // or DRAFT
}
```

### Get Clients
```
GET /api/openclaw/clients
Headers:
  X-OpenClaw-Token: <token>
```

## Environment Variables (Railway)
- `OPENCLAW_API_TOKEN` - Token for OpenClaw endpoints
- `STRIPE_KEY` - Stripe publishable key
- `STRIPE_SECRET` - Stripe secret key