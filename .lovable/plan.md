# Cancelled-but-invoiced orders audit

## Goal
Find every job that is cancelled but was still billed in QuickBooks, so you can credit or refund the customer.

## What we know now
- 514 orders are cancelled. 192 of them are linked to a QuickBooks invoice, so they may have been billed.
- The app doesn't save when a job was cancelled. So for past jobs we can't always tell if it was cancelled before or after the invoice. We can only flag the invoice as covering a cancelled job.

## What you'll get
1. **"Cancelled but invoiced" tab on the Invoices page** (admins and customer service only):
   - Tracking number, customer, invoice number (links to QuickBooks), invoice date, amount billed for the job, cancellation date (when known), and order date.
   - Labels: "Cancelled after invoice", "Cancelled before invoice" (billed by mistake), or "Cancel date unknown" for older jobs.
   - Filters for customer and date range. Total amount at risk. CSV download.
   - Live check with QuickBooks for each invoice: paid, unpaid, or already credited/voided.
   - "Mark resolved" with a note (for example "credit note CN-123 issued"), so jobs leave the list once dealt with.
2. **Record the cancellation time from now on:** each cancellation saves when it happened and who did it.
3. **Warning when cancelling:** if the job already has an invoice, staff see "This job was invoiced on invoice #X — issue a credit note" before confirming.
4. **Stop future mistakes:** weekly invoicing and retrospective invoicing already skip cancelled jobs. I'll check this and add a block if any path can still bill a cancelled job.

## Technical details
- Migration: `orders.cancelled_at`, `cancelled_by`; trigger sets them when status becomes `cancelled`. Backfill from the latest Shipday or tracking event where possible.
- New table `cancelled_invoice_reviews` (order_id, invoice_id, resolved_at, resolved_by, note) with grants and admin/CS RLS.
- Security-definer RPC `cancelled_invoiced_orders()` joins cancelled orders with `order_invoice_links` (paginated, so the 1,000-row limit doesn't cut results off).
- Edge function `check-invoice-payment-status` fetches Balance/status from QuickBooks in batches.
- cancel-order edge function + UI: look up links and show the warning.
