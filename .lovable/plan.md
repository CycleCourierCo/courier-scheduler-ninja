# Make the revenue check columns clearer

## Why the two columns differ
- **From invoices** — the invoiced delivery money for jobs shown on this page only (orders on approved driver timeslips that month).
- **Invoiced in QuickBooks** — all transport invoiced in QuickBooks that month, including work this page can't see: days with no approved timeslip, and invoices not yet linked to an order.

So QuickBooks is usually higher. The gap is invoiced work the page doesn't count.

## Change
Relabel the columns in the Revenue check table so the meaning is obvious without asking:

- "From invoices" → "Invoiced (jobs on this page)"
- "Invoiced in QuickBooks" → "All transport invoiced in QuickBooks"
- Add a one-line note under the table: "QuickBooks includes invoiced work not on this page — days with no approved timeslip and invoices not yet linked to an order."

## Technical details
- Edit `RevenueReconciliationCard.tsx` column headers and add the note line only. No data or logic changes.
