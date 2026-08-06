# Move "nothing to invoice" jobs into the Invoiced tab

On the Bicycle Inspections page, jobs that finish inspection with no issues found, or where the customer declined all repairs, currently sit in the "Inspected & serviced" list forever because they have no invoice and were never explicitly skipped. They should be treated as settled and shown in the **Invoiced** tab.

## Behaviour

A job counts as billing-settled when any of these is true:

- It has an invoice number (unchanged).
- It was manually marked "No invoice needed" (unchanged).
- New: inspection is released (status `inspected` or `repaired`) and it has no issues at all.
- New: inspection is released and every issue on it is declined (or the order has `repairs_declined_at` set with no approved/repaired issues).

Those jobs move out of "Inspected & serviced" and into **Invoiced**, with a small badge distinguishing why they are there ("No issues" / "Repairs declined") next to the existing invoiced/skipped labels. The counts on both tabs update automatically. The "Make invoiceable again" undo stays available only for manually skipped jobs — no-issue and declined jobs are auto-derived, so an admin who does want to invoice one can still add issues or price them as today.

The admin billing filter's "Skipped" option keeps meaning manually skipped; a new value is not required, but the "Unsettled" option will now correctly exclude no-issue and declined jobs.

## Technical notes

- `src/pages/BicycleInspections.tsx`: extend `isBillingSettled(i)` with the two derived cases, computed from `i.issues` (all declined / empty) plus `i.repairs_declined_at`, gated on inspection status being `inspected` or `repaired`. Reuse that same helper in the `filters.billing` block so filter and tab logic can't drift.
- Add a small helper (e.g. `getSettledReason(i)`) returning `'invoiced' | 'skipped' | 'no_issues' | 'declined'`, used for the badge in the invoiced card rendering.
- No database or service changes needed.
