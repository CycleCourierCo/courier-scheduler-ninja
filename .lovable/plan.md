# Move zero-value completed repairs into the Invoiced tab

Some inspections have repairs done but the total billable value comes to £0 (no parts cost, no labour cost). There is nothing to invoice, so they should be treated as settled and appear in the **Invoiced** tab instead of sitting in "Inspected & serviced" forever.

## Behaviour

A job counts as billing-settled when, in addition to the existing cases (has an invoice number, manually marked "No invoice needed", no issues at all, all repairs declined):

- New: the inspection is released (status `inspected` or `repaired`) and the sum of parts + labour across all non-declined issues is £0 (zero or unset).

Those jobs move out of "Inspected & serviced" into **Invoiced**, with a small "£0 — nothing to bill" badge alongside the existing Invoiced / Not invoiced / No issues / Repairs declined labels. Tab counts update automatically. If pricing is later added to an issue, the job automatically becomes invoiceable again — no undo needed.

The admin billing filter's "Unsettled" option will now also exclude these zero-value jobs; "Skipped" keeps meaning manually skipped.

## Technical notes

- `src/pages/BicycleInspections.tsx`: extend `getSettledReason(i)` with a `'zero_value'` result — after the declined checks, sum `(parts_cost ?? 0) + (labour_cost ?? 0)` (falling back to `estimated_cost` when the split fields are null) over non-declined/non-cancelled issues and return `'zero_value'` when the total rounds to 0.
- Extend the derived-reason badge block (around the invoiced card rendering) to render the new badge for `'zero_value'`.
- `isBillingSettled` and the `filters.billing` branch already delegate to `getSettledReason`, so no other changes are needed. No database or service changes.
