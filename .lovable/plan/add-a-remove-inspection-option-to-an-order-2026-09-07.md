# Add a "Remove inspection" option to an order

Right now an order can be added to the workshop list ("Inspect and Service") but there is no way to take it off again — the panel only shows the enable button once inspection is off.

## What you'll get

In the order's Services & Add-ons section, under Inspect & Service, admins will see a **Remove inspection** button whenever inspection is enabled.

- Clicking it asks for confirmation first.
- If no workshop work has happened yet, the order is taken off the workshop list and the empty inspection record is removed. The order goes back to normal, and the amber "Inspect" tag disappears from the order card.
- If work has already been recorded (issues added, prices set, repairs approved, or an invoice raised), removal is blocked with a clear message explaining why, so history and invoices are never silently deleted.
- Only admins see the button.

## Technical notes

- `src/services/inspectionService.ts`: add `disableInspectionForOrder(orderId)` — loads `bicycle_inspections` rows for the order plus their `inspection_issues`; refuses if any issue exists or any inspection row has been submitted (inspected/repaired status, `inspected_at`, or invoice fields set); otherwise deletes the inspection rows and sets `orders.needs_inspection = false`.
- `src/components/order-detail/OrderServicesPanel.tsx`: in `InspectServiceSection`, add the destructive-styled button behind an `AlertDialog` confirmation, shown when `order.needsInspection` and the current user is admin; call `onRefresh()` after success and toast the blocking reason on refusal.
- Role check follows the existing admin pattern already used in order detail components.
- Existing delete policies on `bicycle_inspections`/`inspection_issues` are in place, so no database migration is needed.
