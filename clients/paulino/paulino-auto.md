# Paulino Auto Group

**Contact:** (978) 343-4000
**Address:** 347 Lunenburg St, Fitchburg, MA 01420
**Website:** https://www.paulinoautogroup.com
**Telegram bot:** @paulino_auto_group_bot

## Services & Infrastructure

| Service | URL | Purpose |
|---------|-----|---------|
| Wizard | https://paulino-wizard-production.up.railway.app | Customer purchase wizard (magic links) + vehicle browser |
| Inventory API | https://inventory-api-production-bc78.up.railway.app | Vehicle inventory (scraped daily at 8 AM) |
| Booking API | https://calcom-booking-api-production.up.railway.app | Test drive scheduling (Cal.com) |

## Inventory Search

```bash
curl 'https://inventory-api-production-bc78.up.railway.app/api/inventory?limit=10&offset=0'
```

Response: `{ total, limit, offset, vehicles: [...] }`
Each vehicle: id, site_id, name, year, make, model, color, vin, stock, price, mileage, vehicle_condition, url, image_url, description, is_active

When a customer asks about inventory, search the API and present results conversationally. Include vehicle name, year, mileage, color, and price. Link to the listing via the `url` field.

You can also send them to browse visually: https://paulino-wizard-production.up.railway.app/ — this shows a Tinder-style swipeable car browser. If they like a car, it captures their info and creates a lead automatically.

## Magic Links (Private Purchase Wizard)

Magic links send customers to a private, pre-filled purchase wizard with their vehicle info. This is for collecting sensitive data (SSN, insurance, trade-in, deposits) that should NOT go through Telegram.

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

Required: `name`, `phone`
Optional: `email`, `vehicle_id` (from inventory API), `vehicle_site_id`, `vehicle_name` (fallback)

Response includes `magicLink` URL like: `https://paulino-wizard-production.up.railway.app/?deal=TOBSA8G2`

### When to Create Magic Links

- Customer is interested in a specific vehicle
- Customer wants to start purchase/financing
- Customer needs to submit private info (credit check, insurance, deposit)
- You have at least their name and phone number

### Flow

1. Customer chats on Telegram → help them find a vehicle
2. They're interested → collect name + phone (email if available)
3. Create magic link with their vehicle_id from inventory API
4. Send them the magicLink URL
5. They complete the wizard privately (contact, trade-in, credit, docs, deposit)

### Example

Customer: I'm interested in that Ram 3500
You: Great choice! Let me set up a private purchase link. Can I get your name and phone number?
Customer: John Doe, 978-555-1234
You: [run curl to POST /api/leads with name, phone, vehicle_id]
You: Here's your private purchase link: https://paulino-wizard-production.up.railway.app/?deal=ABC123
     This walks you through financing and paperwork, including trade-in if you have one. Everything stays secure — nothing sensitive goes through Telegram.

## Test Drive Booking

The booking API is a separate service that connects to the Cal.com installation.

### Check Availability

```bash
curl 'https://calcom-booking-api-production.up.railway.app/api/booking/availability'
```

Response: `{ days: [{ date, label, slots: [{ iso, label }] }] }`
Each day has a list of available time slots with ISO timestamps and human-readable labels.

### Book a Test Drive

```bash
curl -X POST https://calcom-booking-api-production.up.railway.app/api/booking/create \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "start": "2026-04-18T14:00:00.000Z",
    "notes": "Test drive: 2020 Jeep Compass Limited"
  }'
```

Required: `name`, `email`, `start` (ISO timestamp from availability slots)
Optional: `notes` (include the vehicle name)

### Booking Flow

1. Customer wants a test drive → check availability
2. Present available dates/times conversationally (e.g. "Friday at 2 PM, Saturday at 10 AM")
3. Customer picks a slot → book it with their name and email
4. Confirm the booking

### Example

Customer: Can I come see the Jeep Compass this weekend?
You: [check availability via API]
You: Saturday has openings at 10 AM, 10:30 AM, and 11 AM. What works best?
Customer: 11 AM works
You: [POST to /api/booking/create with name, email, start ISO, and vehicle in notes]
You: You're all set! Test drive booked for Saturday at 11 AM for the 2020 Jeep Compass Limited. See you at 347 Lunenburg St, Fitchburg!

## Viewing Leads

```bash
curl https://paulino-wizard-production.up.railway.app/api/leads
curl https://paulino-wizard-production.up.railway.app/api/deals/TOBSA8G2
```
