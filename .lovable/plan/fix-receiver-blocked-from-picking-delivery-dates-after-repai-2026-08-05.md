# Fix: receiver blocked from picking delivery dates after repairs are declined

## What's happening on CCC754674618057PETNG9

The order is sitting in `receiver_availability_pending` with no delivery dates. The inspection for this bike was completed and released to the customer on 15 May, and all 6 issues were **declined** by the customer (17 May). No issue was ever approved.

The receiver availability page blocks the date form whenever the bike needs inspection and the inspection summary does not report either:
- `repairs_completed_at` (only set when at least one issue was approved **and** all approved issues are resolved), or
- an inspection with no issues at all.

Because every issue was declined, `repairs_completed_at` stays null and `has_issues` is true, so the page permanently shows "This delivery isn't ready to schedule yet" — even though there is no work left to do. Any order where the customer declines all repairs hits this same dead end.

## The fix

1. Treat "all repairs declined" as service-complete for the availability gate: the receiver form unblocks when the summary reports `repairs_declined_at` (all issues declined, none approved), in addition to the existing completed/no-issues cases.
2. Also unblock when the inspection has been released to the customer and there is nothing outstanding (no pending and no approved-but-unresolved issues), so mixed cases (some declined, rest repaired) don't get stuck either.
3. Recover this specific order: with the gate fixed, the receiver's existing availability link works again. Re-send the receiver availability email for CCC754674618057PETNG9 so they get a fresh prompt.

## Technical detail

- `src/pages/ReceiverAvailability.tsx` — extend the `inspectionBlocked` condition to accept `repairs_declined_at`, and to treat `pending_count === 0 && approved_count === resolved_count` on a released inspection as ready.
- No database change is needed: `get_public_inspection_summary` already returns `repairs_declined_at`, `pending_count`, `approved_count` and `resolved_count`.
- The same relaxed check is applied wherever the deferred receiver-availability handoff decides readiness (`src/services/inspectionService.ts`) so the automatic email fires for declined-repair orders as well.
- Verification: reload the receiver availability link for this tracking number and confirm the calendar renders, then submit a date to confirm the order moves to `scheduled_dates_pending`.
