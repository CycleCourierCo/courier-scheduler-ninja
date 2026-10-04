# Make the "orders with no linked invoice" warning useful

## What's happening
The sync did work. The latest run (today 19:06) checked 1,708 QuickBooks invoices. 5,929 jobs were already linked, 1 new link was made, and 130 invoices had no tracking number on them. The 1,710 unlinked jobs are jobs that **no QuickBooks invoice mentions by tracking number**, so the sync has nothing to match them to. Rough split:
- **About 620 from Mar to Aug 2025**, before portal invoicing started (Sep 2025). These were probably invoiced another way, or not at all.
- **About 1,090 from Sep 2025 onwards**, mostly business customers, at roughly 50 to 150 a month. Those could be on the 130 invoices with no tracking numbers, invoiced by hand in QuickBooks, or not invoiced yet.

At the moment the warning just tells you to run the sync again, which doesn't help.

## What I'll build
1. **Better warning wording.** Show the last sync time and what it found, and say clearly that these jobs aren't on any QuickBooks invoice by tracking number.
2. **"View unlinked jobs" list** on the Invoices page:
   - Grouped by month, with a count and estimated value for each month, and a filter by customer.
   - Each row shows tracking number, customer, delivered date, a link to the order, and the estimated price.
   - A tag for each row: "Before portal invoicing", "Customer paid by card", or "Business – not invoiced".
3. **Link by hand.** On a row (or a ticked group of rows from the same customer), enter a QuickBooks invoice number. It checks the invoice exists in QuickBooks, then links the jobs and saves the delivery amount for the profitability page.
4. **Mark as "not to be invoiced"** (e.g. free jobs, returns, or jobs billed somewhere else), so they stop counting as missing.
5. **Unmatched invoices list.** Show the 130 QuickBooks invoices with no tracking numbers (number, customer, date, amount) so you can link them to jobs by hand.

## Technical details
- New table `order_invoice_exclusions` (order_id, reason, created_by), staff-only access with grants and RLS. The unlinked summary skips these orders.
- `sync-order-invoices`: save unmatched invoice id/number/customer/date/total to a new `quickbooks_unmatched_invoices` table on each run (cleared and refilled).
- New admin edge function `link-order-invoice`: looks up the invoice by DocNumber (escaped QbSQL), works out transport net from its lines, and upserts `order_invoice_links` with link_source 'manual' (widen the CHECK).
- The list loads in pages to get past the 1,000-row limit.
