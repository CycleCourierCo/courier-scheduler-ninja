# Fix "Failed to add issue" on workshop-only inspections

## What's happening

Walk-in (workshop-only) inspections have no transport job attached. On the inspections page these are shown in the same card layout as job-based inspections, and the card reuses the inspection's own reference as if it were a job reference. When you add an issue retrospectively, the app tries to link the new issue to a transport job that doesn't exist, so the database rejects it and you see the generic "Failed to add issue" message.

Ibrahim's record is one of these walk-in inspections (there is no user account with that email — the name comes from the walk-in customer details on the inspection itself).

## The fix

1. When adding an issue to a walk-in inspection, save it against the inspection only, with no transport job link. Job-based inspections keep their existing link.
2. Show the real reason instead of the generic message if an add ever fails again, so problems are diagnosable from the screen.

## Verification

Add an issue to Ibrahim's walk-in inspection (with and without parts/labour prices) and confirm it appears on the card, and that adding an issue to a normal job-based inspection still works.

## Technical detail

- `inspection_issues.order_id` is a nullable FK to `orders`; `addIssueToExistingInspection` in `src/services/inspectionService.ts` already accepts `orderId: string | null`.
- In `src/pages/BicycleInspections.tsx`, workshop-only rows are synthesised in `getPendingInspections` with `id: insp.id` and `workshop_only: true`. The add-issue click at line 2712 passes `orderId: order.id`, i.e. the inspection UUID, which fails `inspection_issues_order_id_fkey`.
- Change the call to pass `order.workshop_only ? null : order.id`, widen the mutation's `orderId` type to `string | null`, and surface `error.message` in the error toast.
- No database change needed.
