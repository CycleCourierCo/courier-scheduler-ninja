# Increase proactive update gap from 2 to 4 days

## What changes
The daily 08:00 job (send-order-updates) only emails a sender or receiver if that side hasn't been contacted about the job within a quiet window. That window is currently **2 days**; it becomes **4 days**.

Confirmed in code: `supabase/functions/send-order-updates/index.ts` line 114 — `const QUIET_DAYS = 2;`, used at line 779 as the cutoff against `order_update_log.sent_at`.

## Steps
1. Change `QUIET_DAYS` from `2` to `4` in `supabase/functions/send-order-updates/index.ts`.
2. Redeploy the `send-order-updates` edge function.
3. Confirm deployment succeeds (function log / endpoint check).

## Effect
- Each side of a job is contacted at most once every 4 days instead of every 2.
- Unchanged: milestone emails (collection/delivery confirmations) still fire immediately and reset the quiet window; cancelled/delivered jobs are never contacted; the same-day suppression against milestone emails still applies.
