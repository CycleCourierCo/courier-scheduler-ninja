## Goal

On the Dispatch Routes page, in the "Routes on {date}" list:

1. Show the timeslot for each stop next to the address.
2. Add **Rename** and **Delete** buttons to each saved route.

## 1. Per-stop timeslots

Timeslots live on the `orders` table (`pickup_timeslot`, `delivery_timeslot`) — not on `dispatch_route_stops`. They are matched by `(order_id, stop_type)`: `pickup` → `pickup_timeslot`, `delivery` → `delivery_timeslot`.

Changes in `src/pages/DispatchRoutesPage.tsx`:

- Extend the `routesForDate` query (around line 194) to also fetch order timeslots for every order_id referenced by the day's stops in a single `orders` query (`select id, pickup_timeslot, delivery_timeslot`). Build a `Map<order_id, {pickup, delivery}>`.
- Attach the relevant timeslot string onto each stop as `s.timeslot` when grouping stops by route.
- In the stop list (line 818–826), render the timeslot as a small muted suffix, e.g. `14:00–17:00` after the address. Use `formatTimeslotWindow` from `src/utils/timeslotUtils.ts` if the value is a single `HH:MM`, otherwise display as-is.

No DB changes.

## 2. Rename + Delete buttons

In the route card header (around line 796–804), next to the existing Show/Hide button, add two small icon buttons:

- **Rename** (Pencil icon): opens a lightweight inline prompt (use the existing `Dialog` from shadcn or a simple `prompt()`-style `Input` inside a small `Dialog`). On submit, `update dispatch_routes set name=? where id=?`, then `qc.invalidateQueries(["dispatch-routes-for-date", routeDate])`.
- **Delete** (Trash icon): wrap in an `AlertDialog` confirmation. On confirm, delete `dispatch_route_stops` where `route_id=?`, then delete `dispatch_routes` where `id=?`, then invalidate `["dispatch-routes-for-date", routeDate]` and `["dispatch-existing-stops", routeDate]`. Also remove the route's polyline / markers from the local refs (`routePolylinesRef`, `routeStopMarkersRef`, `routePathCacheRef`) and `hiddenRoutes` state to avoid stale map artefacts.

Both actions show a toast on success/failure. RLS already permits the existing save/optimise operations, so the same auth context covers update/delete.

## Out of scope

- No changes to `optimise-route` or `route-path` edge functions.
- No DB schema changes.
- No changes to the map rendering logic beyond cleanup on delete.
