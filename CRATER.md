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
1. **Missing data** - Check pagination (default shows only 10 per page)
2. **Amount in cents** - Divide by 100 for dollar amount

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

## Recurring Invoices
- **Endpoint:** `GET /api/v1/recurring-invoices`
- **Frequency:** Cron format - `0 0 1 5 *` = yearly (May 1st), `0 0 1 */3 *` = quarterly

Example recurring clients:
- Green Planet Pest Control — $425.00/year
- Life Qi Holistic Medicine — $425.00/year
- Paradigm Landscape — $425.00/year
- Masonic Health System — $250.00/quarter
- All Auto Financial — $425.00/year
- Sams Catch Basin Cleaning — $425.00/year
- Tyler Associates Inc. — $425.00/year
- DPM Design and Construction — $425.00/year
- Rothco Built — $425.00/year
- Levines Law — $425.00/year