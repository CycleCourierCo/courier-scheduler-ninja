# Fix the missing weekly invoice batch report

## What the data shows

The batch itself ran fine: `weekly_invoice_batch_logs` has a completed run for **Aug 3 to Aug 10, 2026**, started 01:00, finished 01:00:53, with 28 successful, 3 failed, 101 skipped out of 120 eligible customers. The cron job `weekly-invoice-batch` (Mondays 01:00) is active.

So the invoices were created — only the summary email is missing. Why it is missing cannot be confirmed from the current records: edge function logs for that window have already rolled out of retention, and the function stores nothing about the report email. The code sends the report by POSTing to `send-email` inside a `try` block and never checks the response, so any failure (bad status, Resend rejection, oversized HTML) is swallowed and the run is still marked `completed`.

## What to change

1. **Record the report attempt.** Add report email columns to `weekly_invoice_batch_logs` (status, HTTP status, error text, sent timestamp, recipient) and write them on every run, so the next run is diagnosable without relying on log retention.
2. **Stop swallowing failures.** Check the `send-email` response status and body; on a non-OK response or a `{ success: false }` body, log the status plus body and persist the error. Send the report via Resend directly (same verified sender and reply-to as the other internal reports) instead of hopping through `send-email`, removing one silent failure point.
3. **Always send something.** Move the report send so it also fires when the batch hits a fatal error, with a short "batch failed" report instead of silence.
4. **Re-send on demand.** Accept a `reportOnly: true` (with an optional `logId`) request on `weekly-invoice-batch` so the report for an existing run can be regenerated and emailed without recreating invoices — used to recover last night's missing report.
5. **After deploying, re-send the Aug 3–10 report** using that path and confirm delivery.

## Technical notes

- Migration adds `report_status text`, `report_http_status int`, `report_error text`, `report_sent_at timestamptz`, `report_recipient text` to `public.weekly_invoice_batch_logs` (nullable, no backfill needed).
- Report generation moves into a helper that takes the run's counters so it can be rebuilt from a stored log row; the per-customer arrays needed for the detail tables are recomputed for the run's date range when re-sending.
- Resend send uses `RESEND_API_KEY` with from `CCC - Cycle Courier Co. <Ccc@notification.cyclecourierco.com>` and `reply_to: Info@cyclecourierco.com`, matching the existing email configuration.
- Auth on the function is unchanged (`X-Cron-Secret` or admin JWT); the report-only path uses the same check.
- Failure logging keeps to counts, order references and customer names — no additional PII.
