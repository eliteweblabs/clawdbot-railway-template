#!/bin/bash
# Crater Invoice Helper - ensures Railway link and creates invoices
# Usage: crater-invoice.sh "Customer Name" "Item Name" "Description" Price

set -e

CRATER_DIR="/Users/4rgd/Astro/crater-invoicing"
cd "$CRATER_DIR"

# Check if Railway is linked
if ! railway status >/dev/null 2>&1; then
    echo "❌ Railway not linked. Linking now..."
    # This will fail non-interactively, but at least we'll know
    railway link -p 7f2a5563-482b-418c-b7b1-c1f076f60d3b -e 93a9e823-5a27-4047-a61e-4fbcea19bc5a || {
        echo "⚠️  Railway link failed. Run manually: cd $CRATER_DIR && railway link"
        exit 1
    }
fi

CUSTOMER="$1"
ITEM_NAME="$2"
ITEM_DESC="$3"
PRICE="$4"

railway run php -r "
require '$CRATER_DIR/bootstrap/app.php';
\$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

\$customer = Crater\Models\Customer::where('name', 'LIKE', '%${CUSTOMER}%')->first();
if (!\$customer) {
    \$customer = Crater\Models\Customer::create([
        'name' => '${CUSTOMER}',
        'email' => 'test@eliteweblabs.com',
        'company_id' => 1,
        'contact_name' => 'Contact',
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

echo 'https://ap.reave.app/reave/invoices/' . \$invoice->id . '/view';
" 2>&1 | grep -v "Deprecated" | tail -1
