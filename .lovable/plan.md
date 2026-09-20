# Keep workshop-only bikes out of "Repairs Declined"

## What happens today

The "Repairs Declined" list shows any bike that has declined work not yet offered on to the receiver. Workshop-only entries (walk-in customers, no transport job) get caught by this too, so the Fuji Cross one.5 appears in both "Repairs Declined" and "Awaiting Repair" even though there is nobody else to offer the declined work to.

## Change

Treat "Repairs Declined" as the list of bikes whose declined work can still be offered to a second person.

- A workshop-only bike (no transport job attached) never appears in "Repairs Declined" — the walk-in customer is the only approver, so a decline is final.
- The same applies when the approval already went to the receiver: there is no further person to offer to, so it stays out of this list.
- Workshop-only bikes carry on showing in their normal stage tab (Awaiting Parts / Awaiting Repair / Inspected & Serviced) and their declined items still show on the card with prices.
- Bikes on a transport job where the booking account declined continue to behave exactly as now, including fully-declined ones.
- Only which bikes the list shows changes — no change to statuses, emails, invoicing, or the offer action itself. The count badge follows the narrower list.

## Technical notes

- `src/pages/BicycleInspections.tsx`, the tab-bucketing memo around lines 1654-1668: before pushing into `repairsDeclined`, skip rows where the inspection has no `order_id` (workshop-only) or where `approval_recipient` is `receiver` / `walkin`. Apply the guard to both the `status === "repairs_declined"` branch and the partial-decline branch.
- Frontend filtering only; no service, database, RLS, or edge function changes.
