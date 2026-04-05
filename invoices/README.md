# Invoices

**All invoicing now goes through Crater at https://ap.reave.app**

No more markdown invoice files. When work is done for a client, add line items directly to their invoice in Crater via the API.

## Crater API Quick Reference
- List invoices: `GET /api/v1/invoices`
- Create invoice: `POST /api/v1/invoices`
- Update invoice: `PUT /api/v1/invoices/{id}`
- Add items to existing invoice: update the invoice with new items array
- Amounts are in **cents** (e.g. $500 = 50000)

## Remaining Files
- `luxe-meds-social-rollout.md` — strategy doc, not an invoice (keep)
