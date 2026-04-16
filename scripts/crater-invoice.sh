#!/bin/bash
# Crater Invoice Helper - resolves contact identity first, then creates invoice
# Usage: crater-invoice.sh "Customer Name" "Item Name" "Description" Price ["email"] ["phone"]

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CRATER_DIR="/Users/4rgd/Astro/crater-invoicing"

CUSTOMER="$1"
ITEM_NAME="$2"
ITEM_DESC="$3"
PRICE="$4"
EMAIL="${5:-}"
PHONE="${6:-}"

# --- Resolve through contact-api first ---
CONTACT_BASE="${CONTACT_API_URL:-http://contact-api.railway.internal:8080}"
CONTACT_HEADERS=(-H "Content-Type: application/json")
[ -n "$CONTACT_API_KEY" ] && CONTACT_HEADERS+=(-H "X-API-Key: $CONTACT_API_KEY")

RESOLVE_BODY=$(python3 -c "
import json
d = {'name': '$CUSTOMER'}
if '$EMAIL': d['email'] = '$EMAIL'
if '$PHONE': d['phone'] = '$PHONE'
print(json.dumps(d))
")

RESOLVE_RESULT=$(curl -s -X POST "$CONTACT_BASE/api/contacts/resolve" "${CONTACT_HEADERS[@]}" -d "$RESOLVE_BODY" 2>/dev/null || echo '{}')
MATCH_TYPE=$(echo "$RESOLVE_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('match','none'))" 2>/dev/null || echo "none")
CONTACT_UID=$(echo "$RESOLVE_RESULT" | python3 -c "import sys,json; r=json.load(sys.stdin); print(r.get('contact',{}).get('uid',''))" 2>/dev/null || echo "")

if [ "$MATCH_TYPE" = "none" ] || [ -z "$CONTACT_UID" ]; then
  CREATE_BODY=$(python3 -c "
import json
d = {'name': '$CUSTOMER'}
if '$EMAIL': d['email'] = '$EMAIL'
if '$PHONE': d['phone'] = '$PHONE'
print(json.dumps(d))
")
  CREATE_RESULT=$(curl -s -X POST "$CONTACT_BASE/api/contacts" "${CONTACT_HEADERS[@]}" -d "$CREATE_BODY" 2>/dev/null || echo '{}')
  CONTACT_UID=$(echo "$CREATE_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('uid',''))" 2>/dev/null || echo "")
  echo "📇 New contact created: $CONTACT_UID"
elif [ "$MATCH_TYPE" = "possible" ]; then
  echo "⚠️  Possible match found — review before proceeding:"
  echo "$RESOLVE_RESULT" | python3 -m json.tool
  echo ""
  echo "Proceeding with best candidate..."
  CONTACT_UID=$(echo "$RESOLVE_RESULT" | python3 -c "import sys,json; r=json.load(sys.stdin); cs=r.get('candidates',[]); print(cs[0]['uid'] if cs else '')" 2>/dev/null || echo "")
else
  echo "📇 Contact resolved: $CONTACT_UID ($MATCH_TYPE match)"
fi

# --- Create invoice in Crater ---
cd "$CRATER_DIR"

if ! railway status >/dev/null 2>&1; then
    echo "❌ Railway not linked. Linking now..."
    railway link -p 7f2a5563-482b-418c-b7b1-c1f076f60d3b -e 93a9e823-5a27-4047-a61e-4fbcea19bc5a || {
        echo "⚠️  Railway link failed. Run manually: cd $CRATER_DIR && railway link"
        exit 1
    }
fi

USE_EMAIL="${EMAIL:-noreply@reave.app}"

CRATER_OUTPUT=$(railway run php -r "
require '$CRATER_DIR/bootstrap/app.php';
\$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

\$customer = Crater\Models\Customer::where('name', 'LIKE', '%${CUSTOMER}%')->first();
if (!\$customer) {
    \$customer = Crater\Models\Customer::create([
        'name' => '${CUSTOMER}',
        'email' => '${USE_EMAIL}',
        'company_id' => 1,
        'contact_name' => '${CUSTOMER}',
        'currency_id' => 1
    ]);
}

\$priceCents = ${PRICE} * 100;
\$invoice = Crater\Models\Invoice::create([
    'invoice_date' => date('Y-m-d'),
    'due_date' => date('Y-m-d', strtotime('+30 days')),
    'invoice_number' => 'INV-' . time(),
    'customer_id' => \$customer->id,
    'company_id' => 1,
    'sub_total' => \$priceCents,
    'total' => \$priceCents,
    'tax' => 0,
    'notes' => 'Generated via automation',
    'status' => 'DRAFT'
]);

\$invoice->items()->create([
    'invoice_id' => \$invoice->id,
    'name' => '${ITEM_NAME}',
    'description' => '${ITEM_DESC}',
    'quantity' => 1,
    'price' => \$priceCents,
    'total' => \$priceCents,
    'company_id' => 1
]);

echo \$customer->id . '|' . \$invoice->id . '|https://ap.reave.app/reave/invoices/' . \$invoice->id . '/view';
" 2>&1 | grep -v "Deprecated" | tail -1)

CRATER_CUSTOMER_ID=$(echo "$CRATER_OUTPUT" | cut -d'|' -f1)
INVOICE_URL=$(echo "$CRATER_OUTPUT" | cut -d'|' -f3)

# --- Link Crater customer to unified contact ---
if [ -n "$CONTACT_UID" ] && [ -n "$CRATER_CUSTOMER_ID" ]; then
  curl -s -X POST "$CONTACT_BASE/api/contacts/$CONTACT_UID/link" "${CONTACT_HEADERS[@]}" \
    -d "{\"system\":\"crater\",\"externalId\":\"$CRATER_CUSTOMER_ID\"}" >/dev/null 2>&1 || true
  echo "🔗 Linked contact $CONTACT_UID ↔ Crater customer $CRATER_CUSTOMER_ID"
fi

echo "$INVOICE_URL"
