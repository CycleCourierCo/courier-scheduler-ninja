# Fix the weekly invoice batch report email

## What happened (26 Oct run, Oct 19–26)
- The run itself mostly worked: 24 invoices created, 112 skipped, 3 failed.
- The 3 failures (Ebike Exchange, Horizon Micromobility and one other) all failed within the first second. QuickBooks' invoice step returned "502 Bad Gateway", meaning it was briefly unavailable, not a problem with the orders.
- The batch saved the whole raw error web page as the error message. That page contains its own headings, so in the email it showed up as giant "502 Bad Gateway" text and crushed the table. That is why the email looked wrong.
- Earlier weeks also had 2–5 failures each, so short QuickBooks outages happen fairly often.

## Changes
1. **Clean error messages:** if the invoice step sends back a web page instead of a normal reply, save a short message like "QuickBooks temporarily unavailable (502)". Never put raw HTML in the email or the invoice history.
2. **Retry automatically:** retry each customer up to 3 times, waiting a little longer each time (about 2s, then 5s, then 10s), when the error is temporary (502/503/504 or a network error). Customers who already succeeded are never retried, so no duplicate invoices.
3. **Safe email layout:** escape any error text in the report, limit it to about 200 characters, and let email addresses wrap normally instead of one letter per line.
4. **Re-run the 3 failed customers** for Oct 19–26 once the fix is live, then confirm in invoice history that their invoices were created.

## Technical details
- In `weekly-invoice-batch/index.ts`, when the response isn't OK, check whether it is HTML. Then add a retry loop around the fetch to `create-quickbooks-invoice` that only retries 5xx and network errors.
- The report builder HTML-escapes `error`, `customerName` and `customerEmail`, and applies `word-break:break-word` to the email column.
- Re-run with the existing manual trigger, limited to the failed customer IDs and the same date range. First check that each of them has no `created` invoice_history row for that range.
- Add a vitest test for the error-summary helper: an HTML 502 body gives a short message, and JSON `{error}` keeps that message.
