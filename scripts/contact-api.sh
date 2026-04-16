#!/bin/bash
# Contact API helper — resolve, create, search, link contacts
# Uses CONTACT_API_URL env var (defaults to Railway internal)
#
# Usage:
#   contact-api.sh resolve "Todd Smith" "todd@example.com" "555-1234"
#   contact-api.sh create  "Todd Smith" "todd@example.com" "555-1234" "Company Inc"
#   contact-api.sh search  "Todd"
#   contact-api.sh get     <uid>
#   contact-api.sh link    <uid> crater 42
#   contact-api.sh merge   <target-uid> <source-uid>

set -e

BASE="${CONTACT_API_URL:-http://contact-api.railway.internal:8080}"
HEADERS=(-H "Content-Type: application/json")
if [ -n "$CONTACT_API_KEY" ]; then
  HEADERS+=(-H "X-API-Key: $CONTACT_API_KEY")
fi

CMD="$1"
shift

case "$CMD" in
  resolve)
    NAME="$1"; EMAIL="$2"; PHONE="$3"
    BODY="{}"
    [ -n "$NAME" ]  && BODY=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); d['name']='$NAME'; print(json.dumps(d))")
    [ -n "$EMAIL" ] && BODY=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); d['email']='$EMAIL'; print(json.dumps(d))")
    [ -n "$PHONE" ] && BODY=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); d['phone']='$PHONE'; print(json.dumps(d))")
    curl -s -X POST "$BASE/api/contacts/resolve" "${HEADERS[@]}" -d "$BODY"
    ;;
  create)
    NAME="$1"; EMAIL="$2"; PHONE="$3"; COMPANY="$4"
    BODY=$(python3 -c "
import json
d = {'name': '$NAME'}
if '$EMAIL': d['email'] = '$EMAIL'
if '$PHONE': d['phone'] = '$PHONE'
if '$COMPANY': d['company'] = '$COMPANY'
print(json.dumps(d))
")
    curl -s -X POST "$BASE/api/contacts" "${HEADERS[@]}" -d "$BODY"
    ;;
  search)
    Q="$1"
    curl -s "$BASE/api/contacts?q=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$Q'))")" "${HEADERS[@]}"
    ;;
  get)
    UID="$1"
    curl -s "$BASE/api/contacts/$UID" "${HEADERS[@]}"
    ;;
  link)
    UID="$1"; SYSTEM="$2"; EXT_ID="$3"
    curl -s -X POST "$BASE/api/contacts/$UID/link" "${HEADERS[@]}" \
      -d "{\"system\":\"$SYSTEM\",\"externalId\":\"$EXT_ID\"}"
    ;;
  merge)
    TARGET="$1"; SOURCE="$2"
    curl -s -X POST "$BASE/api/contacts/$TARGET/merge" "${HEADERS[@]}" \
      -d "{\"sourceUid\":\"$SOURCE\"}"
    ;;
  list)
    curl -s "$BASE/api/contacts?limit=50" "${HEADERS[@]}"
    ;;
  health)
    curl -s "$BASE/health"
    ;;
  *)
    echo "Usage: contact-api.sh {resolve|create|search|get|link|merge|list|health} [args...]"
    exit 1
    ;;
esac
