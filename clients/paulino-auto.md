# Paulino Auto Group

**Contact:** (978) 343-4000
**Address:** 347 Lunenburg St, Fitchburg, MA 01420
**Website:** https://www.paulinoautogroup.com
**Telegram bot:** @paulino_auto_group_bot

## Services & Infrastructure

| Service | URL | Purpose |
|---------|-----|---------|
| Wizard | https://paulino-wizard-production.up.railway.app | Customer purchase wizard (magic links) |
| Inventory API | https://inventory-api-production-bc78.up.railway.app | Vehicle inventory (scraped daily at 8 AM) |
| Internal Wizard | http://paulino-wizard.railway.internal | Same wizard, Railway internal network |

## Inventory Search

```bash
# Search all vehicles (paginated)
curl 'https://inventory-api-production-bc78.up.railway.app/api/inventory?limit=10&offset=0'

# The API returns: { total, limit, offset, vehicles: [...] }
# Each vehicle has: id, site_id, name, year, make, model, color, vin, stock, price, mileage, vehicle_condition, url, image_url, description, is_active
```

When a customer asks about inventory, search the API and present results conversationally. Include the vehicle name, year, mileage, color, and price. Link to the dealership listing via the `url` field.

## Magic Links (Private Purchase Wizard)

Magic links send customers to a private, pre-filled purchase wizard with their vehicle info. This is for collecting sensitive data (SSN for credit check, insurance info, deposits) that should NOT go through Telegram.

### Creating a Magic Link

```bash
curl -X POST https://paulino-wizard-production.up.railway.app/api/leads \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Customer Name",
    "phone": "978-555-0123",
    "email": "customer@example.com",
    "vehicle_id": 29
  }'
```

**Required fields:** `name`, `phone`
**Optional fields:** `email`, `vehicle_id` (from inventory API), `vehicle_site_id` (alternative to vehicle_id), `vehicle_name` (fallback if no vehicle_id)

**Response:**
```json
{
  "success": true,
  "token": "TOBSA8G2",
  "magicLink": "https://paulino-wizard-production.up.railway.app/?deal=TOBSA8G2",
  "lead": {
    "id": "uuid",
    "token": "TOBSA8G2",
    "name": "Customer Name",
    "vehicle_name": "2024 Ram 3500 Tradesman",
    "vehicle_price": null,
    "vehicle_image": "https://cdn-ds.com/stock/..."
  }
}
```

### When to Create Magic Links

Create a magic link when:
- Customer has shown interest in a specific vehicle
- Customer wants to start the purchase/financing process
- Customer needs to submit private information (credit check, insurance, deposit)
- You have at least their name and phone number

### Flow
1. Customer chats on Telegram → you help them find a vehicle
2. They're interested → collect name + phone (and email if available)
3. Create a magic link with their vehicle_id from the inventory API
4. Send them the magicLink URL
5. They complete the wizard privately (contact info, credit check, documents, deposit)

### Example Conversation
> **Customer:** I'm interested in that Ram 3500
> **Tibby:** Great choice! Let me set up a private purchase link for you. Can I get your name and phone number?
> **Customer:** John Doe, 978-555-1234
> **Tibby:** [creates magic link via API with vehicle_id from inventory]
> **Tibby:** Here's your private purchase link: https://paulino-wizard-production.up.railway.app/?deal=ABC123
> This will walk you through the financing and paperwork. All your info stays secure — nothing goes through Telegram.

## Test Drive Booking

Test drives are booked through the Reave Cal.com integration. The wizard has a "Schedule Test Drive" button that connects to the booking API. You can also direct customers to the wizard for booking.

## Viewing Leads

```bash
# List all leads
curl https://paulino-wizard-production.up.railway.app/api/leads

# View a specific deal by token
curl https://paulino-wizard-production.up.railway.app/api/deals/TOBSA8G2
```
