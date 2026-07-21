# Parallelize invoice creation (cron + button)

## Goal
Make "Create All Invoices" fast and reliable in two places:
1. The **Monday 01:00 UTC cron** (`weekly-invoice-batch` edge function) — currently silently times out.
2. The **manual button** on `InvoicesPage.tsx` — currently loops sequentially in the browser and some customers silently fail.

## Approach: bounded parallelism (concurrency = 5)

Full `Promise.all` over 114 customers would hammer QuickBooks (rate limits) and Supabase. Instead, run a small worker pool (5 in flight at a time). ~114 customers ÷ 5 ≈ 23 waves; even at 3–5 s each, the whole batch completes in ~1–2 min.

## Cron path (`supabase/functions/weekly-invoice-batch/index.ts`)

- Replace the `for (const customer of eligible)` loop with a concurrency-limited runner (simple inline pool, no new deps).
- Wrap the entire batch (customer loop + report email) in `EdgeRuntime.waitUntil(processBatch())`; return **202 Accepted** immediately so pg_net's HTTP call completes in <1 s.
- Add persistent run logging via new table `public.weekly_invoice_batch_logs` (id, run_started_at, run_completed_at, range_start, range_end, range_label, successful_count, failed_count, skipped_count, status, error_message, triggered_by, created_at). Row inserted on entry, updated on completion / catch. Admin-read RLS, service_role full grants — mirrors `timeslip_generation_logs`.
- Fix `public.invoke_weekly_invoice_batch()` migration to pass `timeout_milliseconds := 60000` to `net.http_post` (defensive; 202 return means we rarely need it, but protects against slow cold starts).

## Button path (`src/pages/InvoicesPage.tsx`, `handleCreateAllInvoices`)

- Replace the sequential `for` loop with the same bounded-parallel pattern (concurrency 5) using `Promise.all` over chunks or a small inline pool.
- Keep the existing per-customer `try/catch` so one failure never poisons the batch.
- Keep the existing progress toast/state; update counters as each promise resolves (not in strict order).
- Report dialog (successful / failed / skipped tables) stays identical — order-independent.

## Persistent per-customer error capture

Right now failures only surface via `notify.error` toasts that disappear. To make the "which customers failed and why" question answerable after the fact:
- Add `error_message TEXT` column to `public.invoice_history` **only** used when we insert a failure row (status = 'failed', quickbooks_invoice_id NULL). The frontend loop and the cron already know per-customer errors — they just don't persist them today. On failure, write a row with `{customer_id, customer_email, start_date, end_date, status: 'failed', error_message}`.
- This gives us a permanent log of every failed attempt with the exact error, viewable in the existing Invoices history UI (with a small badge change to render failed rows differently).

## Not in this plan
- No change to `create-quickbooks-invoice` internals.
- No retry logic (can add later if a specific transient error pattern shows up in `error_message`).
- No backfill of last week's missed invoices — call this out and I'll do it in a follow-up once the fix is live.

## Technical details

- Concurrency helper (inline, both sides):
  ```ts
  async function runPool<T, R>(items: T[], limit: number, worker: (t: T) => Promise<R>): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let next = 0;
    async function run() {
      while (true) {
        const i = next++;
        if (i >= items.length) return;
        results[i] = await worker(items[i]);
      }
    }
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
    return results;
  }
  ```
- Migration order per new table: CREATE TABLE → GRANT (authenticated SELECT, service_role ALL) → ENABLE RLS → CREATE POLICY (admin select).
- Edge function returns `202 { accepted: true, logId }` synchronously; the background task updates the log row.

## Files touched
- `supabase/functions/weekly-invoice-batch/index.ts` — pool + waitUntil + log writes
- `src/pages/InvoicesPage.tsx` — pool in `handleCreateAllInvoices`
- Migration — `weekly_invoice_batch_logs` table, `invoice_history.error_message` column, `invoke_weekly_invoice_batch()` timeout fix
