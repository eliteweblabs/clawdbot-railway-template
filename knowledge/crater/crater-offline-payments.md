# Crater — Offline Payment Recording

Use POST `/api/openclaw/record-payment` (header: `X-OpenClaw-Token`) to record a payment received outside of Stripe (cash, check, etc.).

## Fields

| Field | Required | Description |
|-------|----------|-------------|
| `customer_name` | Yes | Partial name works — server does substring match |
| `amount` | Yes | In dollars (e.g. `150.00`) |
| `payment_mode` | No | `CASH`, `CHECK`, `CREDIT_CARD`, `BANK_TRANSFER`, `OTHER` |
| `payment_date` | No | Defaults to today (`YYYY-MM-DD`) |
| `notes` | No | Free text |
| `invoice_id` | No | Skip discovery, apply directly to known invoice |

## Conversational Flow

Server may return `needs_selection: true`. Always present the question to the user and re-send with the answer.

| Selection Type | What Happened | What to Do |
|---------------|----------------|------------|
| `payment_mode` | Not provided | Ask "How was this paid?" → re-send with `payment_mode` |
| `customer` | Matched multiple records | Show list, ask for more specificity → re-send with tighter `customer_name` |
| `invoice` | Multiple open invoices for that customer | Show list with amounts due → ask which to apply → re-send with `invoice_id` |

### Automatic Behavior (No User Input)

- **Customer not found** → Created automatically
- **No open invoices** → Draft invoice created, payment applied; response includes `invoice_created: true`

## Success Response

Includes:
- `payment_number`
- `invoice_number`
- `admin_payment_url`
- `admin_invoice_url`
- `invoice_created`
- `customer_created`

## Trigger Phrases

- "record payment"
- "they paid"
- "paid offline"
- "received payment"
- "cash payment"
- "check came in"