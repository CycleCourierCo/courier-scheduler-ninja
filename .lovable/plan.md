# Inspection stages on the public tracking page

When an order has `needs_inspection = true`, surface the inspection lifecycle on the public Track Your Order page (between "Bike Collected" and "Driver En Route to Delivery").

## Stages to display

In timeline order, each driven by real timestamps so they sort naturally:

1. **Awaiting Inspection** — bike has been collected but no inspection record exists yet (or inspection.status = `pending`).
2. **Inspection Complete — No Issues Found** — inspection has `inspected_at` and zero issues raised.
3. **Inspection Complete — Issues Found, Awaiting Customer Approval** — inspected, at least one issue with status `pending`.
4. **Repairs Approved** — at least one issue moved to `approved`. Date = earliest approved-issue `customer_responded_at`.
5. **Repairs Declined — Proceeding to Delivery** — all issues are `declined` (no approvals). Date = latest `customer_responded_at`.
6. **Repairs Completed** — every approved issue is `resolved` or `repaired`. Date = latest `resolved_at` of the approved set.

States 2/3 are mutually exclusive. 4 and 5 are mutually exclusive. 6 only appears once all approved issues are closed.

## Backend: public-safe access

Anonymous tracking can't read `bicycle_inspections` / `inspection_issues` under current RLS, and we don't want to expose issue descriptions or costs publicly.

Add a SECURITY DEFINER RPC:

```text
get_public_inspection_summary(order_identifier text)
  → resolves order via id / tracking_number / customer_order_number
  → returns jsonb with only milestone flags + timestamps:
      inspection_exists, inspected_at,
      has_issues, total_issues, pending_count, approved_count,
      declined_count, resolved_count,
      repairs_approved_at, repairs_declined_at, repairs_completed_at
GRANT EXECUTE TO anon, authenticated;
```

No descriptions, no costs, no names — just enough to drive the timeline.

## Frontend changes

1. **`src/types/order.ts`** — add optional `inspectionSummary` field matching the RPC shape.
2. **`src/services/fetchOrderService.ts`** — in `getPublicOrder`, after the order resolves, if `needs_inspection` call the RPC and attach `inspectionSummary` to the returned order.
3. **`src/components/order-detail/TrackingTimeline.tsx`** — in `getTrackingEvents()`, when `order.needsInspection` push events derived from `order.inspectionSummary` using the rules above. Icons: `Wrench` (awaiting/approved), `Check` (no issues / completed), `AlertCircle` (issues found awaiting approval), `Truck` (declined → proceeding).

No changes to admin pages, inspection workflow, or the orders schema.

## Out of scope
- Editing inspection logic, issue descriptions, or pricing.
- Customer-facing approval UI (already exists separately).
- Authenticated `OrderDetail` page changes.
