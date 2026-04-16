#!/bin/bash
# Booking API helper — availability, create, list, cancel, reschedule
# Uses BOOKING_API_URL env var (defaults to Railway internal)
#
# Usage:
#   booking-api.sh availability
#   booking-api.sh create "Todd Smith" "todd@example.com" "2026-04-20T10:00:00"
#   booking-api.sh list [upcoming]
#   booking-api.sh get <uid>
#   booking-api.sh cancel <uid> "reason"
#   booking-api.sh reschedule <uid> "2026-04-25T14:00:00"
#   booking-api.sh event-types

set -e

BASE="${BOOKING_API_URL:-http://calcom-booking-api.railway.internal:8080}"
HEADERS=(-H "Content-Type: application/json")
if [ -n "$BOOKING_API_KEY" ]; then
  HEADERS+=(-H "X-API-Key: $BOOKING_API_KEY")
fi

CMD="$1"
shift

case "$CMD" in
  availability)
    curl -s "$BASE/api/booking/availability" "${HEADERS[@]}"
    ;;
  create)
    NAME="$1"; EMAIL="$2"; START="$3"; NOTES="${4:-}"
    BODY=$(python3 -c "
import json
d = {'name': '$NAME', 'email': '$EMAIL', 'start': '$START'}
if '$NOTES': d['notes'] = '$NOTES'
print(json.dumps(d))
")
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
    UID="$1"; NEW_START="$2"
    curl -s -X PATCH "$BASE/api/booking/$UID/reschedule" "${HEADERS[@]}" \
      -d "{\"start\":\"$NEW_START\"}"
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
