# Don't show jobs that haven't been through weekly invoicing yet

## Why it happens
The weekly invoice run goes out every Monday at 1am and covers the week before. The last run (28 Sep) covered jobs up to 27 Sep. Jobs from 28 Sep to 4 Oct are due in tonight's run, but the "Jobs with no linked invoice" list and count only check whether a job has an invoice, not whether it has been invoiced yet. So last week's jobs show as missing.

## What will change
- The list and count only include jobs from before the end of the last finished weekly invoice run. Today that's jobs before 28 Sep.
- After each Monday run finishes, the next week's jobs come into the check on their own. Jobs that still don't get an invoice will show then.
- A short note on the card says: "Jobs from {date} onwards are waiting for the next weekly invoice run."
- If no weekly run has ever finished, today's behaviour stays.

## Technical notes
- Migration: recreate `unlinked_invoice_summary()` and `unlinked_invoice_orders()` with an extra filter `o.created_at < (select max(range_end) from weekly_invoice_batch_logs where status = 'completed')` (coalesce to now()). The existing exclusions stay (Shopify, before Sep 2025, marked not invoiced), and so do the staff-only gates.
- Return the cut-off date from the summary RPC so `UnlinkedInvoicesPanel.tsx` can show the note.
