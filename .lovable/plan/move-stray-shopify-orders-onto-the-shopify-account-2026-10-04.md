# Move stray Shopify orders onto the Shopify account

## What I found
- Shopify order numbers look like "CCC1117" (CCC plus digits). Orders like CCC754339589915PAUPR4 / CCC1117 were booked by hand from Shopify under Abdullah Admin.
- Orders with a CCC-number order reference: 117 under Abdullah Admin (May 2025 to Sep 2026), 1 under Andrew Thornley, 1 under invisiframe, 5 already on Shopify.
- Plus the 4 strays found earlier (Rob Bowen, Paul Martin, Marcos Ruiz, Arkadiusz Wosk).

## What will change
1. Move the 4 earlier strays and the 117 Abdullah Admin orders with a CCC-number reference onto the "Shopify orders" account.
2. Leave the Andrew Thornley and invisiframe ones alone unless you say otherwise (they may be real customer accounts).
3. Before moving, I'll list the 117 so I can skip any that are clearly not Shopify (e.g. no matching order in the Shopify log, or a real invoice already linked) and tell you about them.

## Effect
- These orders stop counting as "missing invoice" on the Invoices page and show as "Paid via website" on Route Profitability.
- Customer contact details on each order (sender/receiver) stay exactly as they are; only the owning account changes.

## Technical details
- Data update via run_sql: `update orders set user_id = <shopify profile id>` for the selected ids, looked up by profile email shopify@cyclecourierco.com.
- Pre-check query excludes orders with existing order_invoice_links rows.
