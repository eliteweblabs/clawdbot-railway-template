#!/bin/bash
# Create Crater invoice via OpenClaw API — resolves contact identity first
# Usage: create-crater-invoice.sh "Customer Name" "Item Name" "Description" Price ["email"]

CUSTOMER="$1"
ITEM_NAME="$2"
ITEM_DESC="$3"
PRICE="$4"
EMAIL="${5:-}"

if [ -z "$CUSTOMER" ] || [ -z "$ITEM_NAME" ] || [ -z "$PRICE" ]; then
    echo "Usage: $0 \"Customer Name\" \"Item Name\" \"Description\" Price [\"email\"]"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# --- Resolve through contact-api ---
CONTACT_BASE="${CONTACT_API_URL:-http://contact-api.railway.internal:8080}"
RESOLVE_BODY=$(python3 -c "
import json
d = {'name': '$CUSTOMER'}
if '$EMAIL': d['email'] = '$EMAIL'
print(json.dumps(d))
")

RESOLVE_RESULT=$(curl -s -X POST "$CONTACT_BASE/api/contacts/resolve" \
  -H "Content-Type: application/json" -d "$RESOLVE_BODY" 2>/dev/null || echo '{}')
MATCH=$(echo "$RESOLVE_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('match','none'))" 2>/dev/null || echo "none")
CONTACT_UID=$(echo "$RESOLVE_RESULT" | python3 -c "import sys,json; r=json.load(sys.stdin); print(r.get('contact',{}).get('uid',''))" 2>/dev/null || echo "")

if [ "$MATCH" = "none" ] || [ -z "$CONTACT_UID" ]; then
  CREATE_BODY=$(python3 -c "
import json
d = {'name': '$CUSTOMER'}
if '$EMAIL': d['email'] = '$EMAIL'
print(json.dumps(d))
")
  CREATE_RESULT=$(curl -s -X POST "$CONTACT_BASE/api/contacts" \
    -H "Content-Type: application/json" -d "$CREATE_BODY" 2>/dev/null || echo '{}')
  CONTACT_UID=$(echo "$CREATE_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('uid',''))" 2>/dev/null || echo "")
fi

# --- Create invoice via Crater OpenClaw endpoint ---
TOKEN=$(cat ~/.openclaw/workspace/.crater-api-token 2>/dev/null || echo "")
USE_EMAIL="${EMAIL:-noreply@reave.app}"

INVOICE_RESULT=$(curl -s -X POST https://ap.reave.app/api/openclaw/create-invoice \
  -H "Content-Type: application/json" \
  -H "X-OpenClaw-Token: $TOKEN" \
  -d "{
    \"customer_name\": \"$CUSTOMER\",
    \"customer_email\": \"$USE_EMAIL\",
    \"items\": [
      {
        \"name\": \"$ITEM_NAME\",
        \"description\": \"$ITEM_DESC\",
        \"quantity\": 1,
        \"price\": $PRICE
      }
    ],
    \"notes\": \"Generated via OpenClaw API\",
    \"status\": \"DRAFT\"
  }" 2>&1)

VIEW_URL=$(echo "$INVOICE_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('view_url',''))" 2>/dev/null || echo "$INVOICE_RESULT")
CRATER_ID=$(echo "$INVOICE_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('customer_id',''))" 2>/dev/null || echo "")

# --- Link Crater customer to unified contact ---
if [ -n "$CONTACT_UID" ] && [ -n "$CRATER_ID" ]; then
  curl -s -X POST "$CONTACT_BASE/api/contacts/$CONTACT_UID/link" \
    -H "Content-Type: application/json" \
    -d "{\"system\":\"crater\",\"externalId\":\"$CRATER_ID\"}" >/dev/null 2>&1 || true
fi

echo "$VIEW_URL"
