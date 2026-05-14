## Problem

For order `CCC754494384887CARRG4`, the inspection summary RPC returns:

```
inspected_at: 2026-04-27, has_issues: true,
approved_count: 0, resolved_count: 2,
repairs_approved_at: null, repairs_completed_at: null
```

The two issues both have `status = 'repaired'` (mechanic completed them straight after customer approval). The current `get_public_inspection_summary` function:

- Counts `approved_count` only when `status = 'approved'` — so once a row moves to `repaired` it's no longer "approved", and the count drops to 0.
- Derives `repairs_approved_at` from `status = 'approved'` only — so once repairs are done, the approval timestamp disappears.
- Gates `repairs_completed_at` behind `approved_count > 0` — never satisfied once everything is `repaired`.

Net effect on the public timeline: "Repairs Approved" and "Repairs Completed" never appear for any order where the mechanic has already finished the work. "Inspection Complete — Issues Found" should still appear (the RPC does return `inspected_at`); if the user is not seeing that either it will return as soon as the summary stops being empty.

## Fix

Update the `get_public_inspection_summary` SQL function so it treats `resolved` and `repaired` rows as still-approved-historically:

- `approved_count` = rows where `status IN ('approved','resolved','repaired')`
- `repairs_approved_at` = earliest `customer_responded_at` where `customer_response = 'Approved'` OR `status IN ('approved','resolved','repaired')`
- `repairs_completed_at` only set when `approved_count > 0` AND every approved row has a `resolved_at` (i.e. `resolved_count = approved_count`), value = latest `resolved_at` across those rows
- `repairs_declined_at` unchanged (still only when every issue is declined and none approved)

This is purely a SQL change — no frontend or types changes required. Existing orders immediately benefit.

## Verification

After the migration, calling the RPC for `CCC754494384887CARRG4` should return:

- `approved_count: 2`
- `repairs_approved_at: 2026-04-27T12:41:21Z` (earliest of the two customer-approved timestamps)
- `repairs_completed_at: 2026-05-06T23:18:00Z` (latest resolved_at)

The public tracking page will then render: Awaiting Inspection → Inspection Complete — Issues Found → Repairs Approved → Repairs Completed.

## Out of scope

- Frontend timeline component (already handles these fields correctly).
- Inspection workflow / mechanic UI.
- Any orders without `needs_inspection`.