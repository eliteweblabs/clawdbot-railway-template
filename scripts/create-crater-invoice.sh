#!/bin/bash
# Create Crater invoice via OpenClaw API
# Usage: create-crater-invoice.sh "Customer Name" "Item Name" "Description" Price

CUSTOMER="$1"
ITEM_NAME="$2"
ITEM_DESC="$3"
PRICE="$4"

if [ -z "$CUSTOMER" ] || [ -z "$ITEM_NAME" ] || [ -z "$PRICE" ]; then
    echo "Usage: $0 \"Customer Name\" \"Item Name\" \"Description\" Price"
    exit 1
fi

TOKEN=$(cat ~/.openclaw/workspace/.crater-api-token)

curl -X POST https://ap.reave.app/api/openclaw/create-invoice \
  -H "Content-Type: application/json" \
  -H "X-OpenClaw-Token: $TOKEN" \
  -d "{
    \"customer_name\": \"$CUSTOMER\",
    \"customer_email\": \"test@eliteweblabs.com\",
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
  }" 2>&1 | jq -r '.view_url // .'
