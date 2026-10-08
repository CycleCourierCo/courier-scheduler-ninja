# Exclude Shopify orders from invoice-matching

Orders booked through the website (account `shopify@cyclecourierco.com` — 1,138 orders) are paid at checkout, so they never need a QuickBooks invoice. Today they show up as "missing invoice" jobs, which makes the unlinked count and the revenue check look far worse than they are.

## Changes

1. **Unlinked jobs panel (Invoices page)**
   - Orders whose owner is `shopify@cyclecourierco.com` are excluded from the unlinked list and its count.
   - A small note shows how many Shopify orders were excluded (e.g. "1,138 website orders excluded — paid online, no invoice needed").

2. **Revenue check (Route Profitability page)**
   - Shopify orders no longer count as "unlinked / missing invoice" in the monthly gap table.
   - Their revenue still counts toward the totals (estimated from bike types / rates, since there is no QB invoice), but shown as its own line or flagged "paid via website" so the gap figure only reflects jobs that genuinely should have an invoice.

3. **Sync / linking tools**
   - `sync-order-invoices` and the link-order-invoice flow leave Shopify orders alone (they'd never match anyway); no change needed beyond the filters above.

## Technical notes

- Identify Shopify orders by joining `orders.user_id` to the profile with email `shopify@cyclecourierco.com` (server-side queries filter on that profile id).
- No database migration needed — filtering only.
