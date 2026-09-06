# Fix: finished bikes still show as "in the workshop" to customers

## What's wrong with CCC754707584260ANDNG6

The bike's workshop record is finished (marked as repaired on 3 Sep), which is why job scheduling shows it as done. But the record was never stamped as "shared with the customer".

Everything the customer sees — the delivery-date page and the tracking page — only reveals workshop progress once that "shared with the customer" stamp exists. With it missing, the customer gets "the bike is being inspected and serviced" and tracking shows no workshop steps.

Why it's missing: the stamp is normally set when we send the repair-approval email to the customer. On this job the repair was added and approved in-house, so that step never ran, and the automatic finishing step deliberately skips the stamp whenever repairs were approved. So the job finished with no stamp at all.

Three other records are in the same state today (2 repaired, 1 inspected).

## The fix

1. Treat a finished workshop record as customer-visible. Any record that has reached inspected or repaired counts as visible to the customer even if the sharing stamp was never set, so the delivery-date page opens and tracking shows the workshop steps.
2. Stamp the record when it finishes. The automatic finishing step will set the sharing stamp for both routes (repairs done and no repairs), so new jobs are never left in this state.
3. Backfill the existing records. Stamp the 3 finished records that are missing it, using their completion time.
4. Kick this order along. After the backfill, send the receiver their delivery-date request for CCC754707584260ANDNG6 so they can pick dates straight away, and confirm the tracking page now shows the workshop steps.

The customer report PDF keeps its existing rule (only inspections created from 25 August 2026 onwards expose a report), so nothing new is revealed for legacy jobs.

## Technical notes

- `get_public_inspection_summary`: set `v_public_inspected_at := coalesce(released_to_customer_at, inspected_at)` when `status IN ('inspected','repaired')`, otherwise `released_to_customer_at`. Report-URL cutoff logic unchanged.
- `src/services/inspectionService.ts`, `setInspectionCleaningTask` auto-promote: set `released_to_customer_at`/`released_by_*` on the `hadApproved` branch too (currently only the no-issues branch). Also add the same stamp where an inspection is marked repaired via the reconcile path if it lands terminal without a stamp.
- Data backfill migration: `update bicycle_inspections set released_to_customer_at = coalesce(released_to_customer_at, inspected_at, updated_at) where released_to_customer_at is null and status in ('inspected','repaired')`.
- Verification: re-run `get_public_inspection_summary('CCC754707584260ANDNG6')` (expect `inspection_exists: true`, `repairs_completed_at` set) and `get_public_order` for the tracking payload, then trigger the receiver availability email for this order.
