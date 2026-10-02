# Show unlinked-order count and date period on the Invoices page

## Goal
On the Invoices page, staff can see how many orders have no invoice linked yet, and the date span those orders cover — so gaps after an invoice-link sync stay visible instead of hidden.

## What will show
A summary line/card next to the existing "Sync order invoice links" button and last-sync status:

> **X orders have no linked invoice** — spanning {earliest date} to {latest date}

- Counted over **delivered orders only** (an order that hasn't been delivered can't have been invoiced yet). Example with today's data: all 7,003 delivered orders are unlinked because the first sync hasn't run yet; after syncing, the count drops to the genuine gaps.
- The date period is the earliest and latest order dates among those unlinked orders, so you can tell whether gaps are old or recent.
- Count and dates update live (computed fresh when the page loads), and again after each sync finishes.

## How it works
1. **Database function** — a small security-definer SQL function `unlinked_invoice_summary()` returns the count, earliest date and latest date of delivered orders with no row in `order_invoice_links`. Executable by admin and customer-service staff only. This avoids the browser having to page through thousands of orders (which would hit the 1,000-row query limit).
2. **Invoices page** — calls the function on load and after the sync completes, and renders the summary beside the sync controls. Shown to admins and customer service, matching who can already see invoice links.
3. **Sync response** — the sync edge function also returns the fresh unlinked count and date span in its result, so the completion toast can mention it (e.g. "312 orders still unlinked").

## Out of scope
- No change to which orders get linked, or to the order page's Invoices section.
- Orders on test accounts are not excluded (there are very few); this can be added later if the numbers look noisy.
