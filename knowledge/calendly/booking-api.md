# Booking API — Cal.com Appointment Management

Use to check availability, create bookings, list appointments, cancel/reschedule, and get event types.

## Environment Variables

| Var | Purpose |
|-----|---------|
| `BOOKING_API_URL` | Base URL (default: `http://calcom-booking-api.railway.internal:8080`) |
| `BOOKING_API_KEY` | API key for authentication |

## Script Commands

```bash
# Check availability
booking-api.sh availability

# Create booking (contact resolution happens server-side)
booking-api.sh create "Todd Smith" "todd@example.com" "2026-04-20T10:00:00"

# List all bookings
booking-api.sh list

# List upcoming bookings only
booking-api.sh list upcoming

# Get booking by UID
booking-api.sh get <uid>

# Cancel booking
booking-api.sh cancel <uid> "reason"

# Reschedule booking
booking-api.sh reschedule <uid> "2026-04-25T14:00:00"

# List event types
booking-api.sh event-types

# Health check
booking-api.sh health
```

## Workflow

The `booking-api` already calls `contact-api/resolve` automatically during `POST /api/booking/create`. If a possible match is returned, the booking API returns `needsConfirmation: true` with candidates — present these to the human.

## Notes

- Contact resolution is automatic — no need to resolve separately
- If a match is "possible", confirm with the human before proceeding
- Cancelled bookings are marked as `cancelled` in the response