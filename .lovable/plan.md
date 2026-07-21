## Problem

After linking Mark Rushby via "Create customer in QuickBooks", his profile now has `quickbooks_customer_id` set. But `create-quickbooks-invoice` only searches QuickBooks by `PrimaryEmailAddr = accounts@giant-halifax.co.uk`, and that QB record has a different (or no) primary email. Lookup returns 0 rows → "Customer not found in QuickBooks" (confirmed in edge logs at 21:54:27Z).

Meanwhile `create-quickbooks-customer` and the backfill function already persist the QB customer id onto `profiles.quickbooks_customer_id`, but the invoice function never reads it.

## Fix

In `supabase/functions/create-quickbooks-invoice/index.ts`, resolve the QB customer id in this order:

1. **Stored id** — read `profiles.quickbooks_customer_id` for `invoiceData.customerId` (we already fetch the profile for `special_rate_code`; extend that select). If present, verify it with `SELECT * FROM Customer WHERE Id = '<id>'` via `qbFetch`. Use it if active.
2. **Email match** — existing `PrimaryEmailAddr = '<accounts_email>'` query (unchanged).
3. **DisplayName match** — new fallback: `DisplayName = '<customerName>'` using `escapeQuickBooksString`, mirroring the logic already in `create-quickbooks-customer`.
4. If a match is found in step 2 or 3, persist it back to `profiles.quickbooks_customer_id` so subsequent runs skip straight to step 1.
5. Only throw "Customer not found — please create the customer first" if all three fail. Keep the structured JSON error shape added in the previous change.

No changes to invoice line-item logic, tax, terms, or the email report. No schema changes.

## Verification

- Re-run the "Create invoice" button for Mark Rushby: expect a 200 with `quickbooksInvoiceId`, and the report email to arrive.
- Re-run for a customer whose email does match QB: unchanged behaviour.
- Re-run for a truly missing customer: still returns the clear "please create the customer first" error.
