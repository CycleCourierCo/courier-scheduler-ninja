## Goal
For Box My Bike orders: still create and show the **collection** job (Cycle Courier picks up from sender → depot), but never create the **delivery** Shipday job and never show a delivery leg on Job Scheduling.

## Changes

### 1. Skip only the delivery leg in Shipday
**`supabase/functions/create-shipday-order/index.ts`** — after loading the order:
- If `order.is_box_my_bike === true` and `jobType === 'delivery'`, return `{ success: true, skipped: 'box_my_bike_delivery' }` without calling Shipday.
- If `order.is_box_my_bike === true` and `jobType` is omitted (create both legs), only create the pickup leg — skip the delivery half and don't write `shipday_delivery_id`.
- Pickup-only calls (`jobType === 'pickup'`) behave normally.

**`src/services/shipdayService.ts`** — in `syncOrdersToShipday`, for `order.is_box_my_bike === true` force the call to `createShipdayOrder(order.id, 'pickup')` instead of both legs (belt-and-braces; the edge function is still the authoritative guard).

**`src/services/orderService.ts`** — no change to the post-create `createShipdayJobs()` call; the edge function will now naturally only create the pickup leg for box orders.

### 2. Hide only the delivery leg from Job Scheduling
**`src/pages/JobScheduling.tsx`** (`filteredOrdersForMap`, ~line 156) — treat Box My Bike orders as having no valid delivery leg:
```
const isBoxMyBike = order.is_box_my_bike === true;
const hasValidDelivery = hasUnscheduledDelivery && deliveryVisibleByDate && ... && !isBoxMyBike;
```
Applied in both the `showCollectionToday` branch and the default branch. Collection leg logic is untouched, so pickups still appear.

**Downstream (`RouteBuilder`, `ClusterMap`, `DualSchedulingForm`)** — I'll audit these to confirm they render legs from the `is_box_my_bike` flag or from `scheduled_delivery_date`/dates in a way that this filter is enough. If any of them independently render a delivery marker from raw order rows, I'll add the same `!is_box_my_bike` guard there.

## Out of scope
- Orders already synced to Shipday with a delivery id from before this change are not cleaned up automatically.
- The `/box-my-bike` page is unaffected.
- No DB migration required.