# Allow Route Planner to Edit Order Addresses

## Goal
Route planners should be able to edit the sender and receiver contact/address blocks on the Order Detail page, just like admins can today.

## Scope
Frontend gating only. Database RLS already permits the `route_planner` role to update the `orders` table (`orders_route_planner_update_policy`), so no schema or policy changes are needed.

## Change
In `src/pages/OrderDetail.tsx`, the sender and receiver blocks currently render `AdminContactEditor` only when `isAdmin` is true, and otherwise fall back to the read-only `ContactDetails`. The variable `isAdminOrRoutePlanner` already exists in the file.

Swap the gating condition for both the sender block (~line 1518) and the receiver block (~line 1542) from `isAdmin` to `isAdminOrRoutePlanner`, so route planners get the editable variant.

## Out of scope
- No changes to `AdminContactEditor` itself.
- `AdminTrackingEditor` and the rest of the admin-only sections remain admin-only.
- No backend, RLS, or edge function changes.
