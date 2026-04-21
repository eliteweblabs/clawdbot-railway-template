#!/bin/bash
# Booking API helper — availability, create, list, cancel, reschedule
# Uses BOOKING_API_URL env var (defaults to Railway internal)
#
# Usage:
#   booking-api.sh availability
#   booking-api.sh create "Todd Smith" "todd@example.com" "2026-04-20T10:00:00" [notes] [address]
#   booking-api.sh list [upcoming]
#   booking-api.sh get <uid>
#   booking-api.sh cancel <uid> "reason"
#   booking-api.sh reschedule <uid> "2026-04-25T14:00:00" [address] [notes]
#   booking-api.sh event-types
#
# Address goes into Booking.location (Cal.com's in-person address field), which
# is what the /jobs geofence page reads first when picking an address to
# geocode. Notes go into Booking.description.

set -e

BASE="${BOOKING_API_URL:-http://calcom-booking-api.railway.internal:8080}"
HEADERS=(-H "Content-Type: application/json")
if [ -n "$BOOKING_API_KEY" ]; then
  HEADERS+=(-H "X-API-Key: $BOOKING_API_KEY")
fi

# Auto-reauth: if API returns auth error, try to re-authenticate and retry once
retry_with_auth() {
  "$@" 2>/dev/null && return 0

  # Check if it looks like an auth error
  RESULT=$("$@" 2>&1 || true)
  if echo "$RESULT" | grep -qiE "auth|401|unauthorized|expired|token"; then
    # Try to refresh auth token - set this in Railway variables:
    # REAUTH_URL, REAUTH_KEY, REAUTH_EMAIL
    if [ -n "$REAUTH_URL" ] && [ -n "$REAUTH_KEY" ]; then
      NEW_TOKEN=$(curl -s -X POST "$REAUTH_URL" \
        -H "Content-Type: application/json" \
        -d "{\"key\":\"$REAUTH_KEY\",\"email\":\"$REAUTH_EMAIL\"}" \
        -H "Authorization: Bearer $REAUTH_KEY" 2>/dev/null | python3 -c "
import sys,json
d=json.load(sys.stdin)
print(d.get('token',''))
" 2>/dev/null || echo "")

      if [ -n "$NEW_TOKEN" ]; then
        export BOOKING_API_KEY="$NEW_TOKEN"
        HEADERS+=(-H "X-API-Key: $NEW_TOKEN")
        echo "Re-authenticated. Retrying..." >&2
        "$@"
        return 0
      fi
    fi
  fi
  echo "$RESULT"
  return 1
}

CMD="$1"
shift

case "$CMD" in
  availability)
    curl -s "$BASE/api/booking/availability" "${HEADERS[@]}"
    ;;
  create)
    # Pass strings via env vars, not shell interpolation, so apostrophes,
    # commas, and quotes in addresses/notes don't break the JSON encoder.
    export BAPI_NAME="$1" BAPI_EMAIL="$2" BAPI_START="$3" BAPI_NOTES="${4:-}" BAPI_ADDRESS="${5:-}"
    BODY=$(python3 -c '
import json, os
d = {"name": os.environ["BAPI_NAME"], "email": os.environ["BAPI_EMAIL"], "start": os.environ["BAPI_START"]}
if os.environ.get("BAPI_NOTES"):   d["notes"]   = os.environ["BAPI_NOTES"]
if os.environ.get("BAPI_ADDRESS"): d["address"] = os.environ["BAPI_ADDRESS"]
print(json.dumps(d))
')
    curl -s -X POST "$BASE/api/booking/create" "${HEADERS[@]}" -d "$BODY"
    ;;
  list)
    FILTER="${1:-}"
    if [ "$FILTER" = "upcoming" ]; then
      curl -s "$BASE/api/booking/list?upcoming=true" "${HEADERS[@]}"
    else
      curl -s "$BASE/api/booking/list" "${HEADERS[@]}"
    fi
    ;;
  get)
    UID="$1"
    curl -s "$BASE/api/booking/$UID" "${HEADERS[@]}"
    ;;
  cancel)
    UID="$1"; REASON="${2:-}"
    BODY="{}"
    [ -n "$REASON" ] && BODY="{\"reason\":\"$REASON\"}"
    curl -s -X DELETE "$BASE/api/booking/$UID" "${HEADERS[@]}" -d "$BODY"
    ;;
  reschedule)
    export BAPI_UID="$1" BAPI_START="$2" BAPI_ADDRESS="${3:-}" BAPI_NOTES="${4:-}"
    BODY=$(python3 -c '
import json, os
d = {"start": os.environ["BAPI_START"]}
if os.environ.get("BAPI_ADDRESS"): d["address"] = os.environ["BAPI_ADDRESS"]
if os.environ.get("BAPI_NOTES"):   d["notes"]   = os.environ["BAPI_NOTES"]
print(json.dumps(d))
')
    curl -s -X PATCH "$BASE/api/booking/$BAPI_UID/reschedule" "${HEADERS[@]}" -d "$BODY"
    ;;
  event-types)
    curl -s "$BASE/api/booking/event-types" "${HEADERS[@]}"
    ;;
  health)
    curl -s "$BASE/health"
    ;;
  *)
    echo "Usage: booking-api.sh {availability|create|list|get|cancel|reschedule|event-types|health} [args...]"
    exit 1
    ;;
esac
