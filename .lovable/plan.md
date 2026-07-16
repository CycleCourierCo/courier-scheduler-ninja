## Goal

1. Extend the Postgres `order_status` enum with the 5 Box My Bike stages so an order's `status` column reflects its boxing lifecycle natively.
2. Keep `orders.status` in sync with `orders.box_my_bike_status` via a DB trigger, backfill existing rows, and route the new statuses through webhooks.
3. Update the frontend `OrderStatus` union, `StatusBadge`, and hide cancelled orders on the Box My Bike page.

## 1. Database migration

### 1a. Enum values (must be committed before use)
```sql
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'awaiting_depot';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'in_depot_awaiting_boxing';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'boxed_awaiting_label';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'awaiting_3p_collection';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'collected_by_3p';
```
`ALTER TYPE ... ADD VALUE` must run outside a transaction / in its own migration commit before the values are usable in subsequent SQL — so this migration only adds the enum values.

### 1b. Second migration: trigger + backfill + webhook mapping

- Sync trigger on `public.orders` (BEFORE INSERT OR UPDATE):
  - If `NEW.is_box_my_bike = true`:
    - On INSERT with NULL `box_my_bike_status`, default it to `awaiting_depot`.
    - Always set `NEW.status := NEW.box_my_bike_status::order_status`.
  - No effect for non-box orders.
- Backfill: `UPDATE public.orders SET status = box_my_bike_status::order_status WHERE is_box_my_bike = true AND box_my_bike_status IS NOT NULL AND status <> 'cancelled';`
- Extend `public.get_webhook_event_for_status` to map each new status to a distinct event:
  - `awaiting_depot` → `order.box.awaiting_depot`
  - `in_depot_awaiting_boxing` → `order.box.in_depot`
  - `boxed_awaiting_label` → `order.box.boxed`
  - `awaiting_3p_collection` → `order.box.awaiting_3p`
  - `collected_by_3p` → `order.box.collected_by_3p`
  
  Existing webhook events remain unchanged. `trigger_order_webhook` already fires via `get_webhook_event_for_status`, so no trigger changes required beyond the mapping.

## 2. Frontend

### 2a. Types
`src/types/order.ts` — extend the `OrderStatus` union with the five new values.

### 2b. `src/components/StatusBadge.tsx`
Add cases for the five stages using the existing `BOX_MY_BIKE_STATUS_LABELS`:
- `awaiting_depot` → amber
- `in_depot_awaiting_boxing` → blue
- `boxed_awaiting_label` → indigo
- `awaiting_3p_collection` → purple
- `collected_by_3p` → green

No other call-site changes needed — every `StatusBadge` consumer already receives `order.status`, which will now carry the box stage.

### 2c. `src/pages/BoxMyBikePage.tsx`
- Add `.neq("status", "cancelled")` to the orders query so cancelled box orders don't appear.
- Client-side stage update mutation (line ~113) — no functional change needed: the DB trigger will keep `status` synced. Optionally also send `status: newStage` in the update patch to avoid a round-trip re-render before the trigger fires.

## 3. Scheduling / dispatch / other filters

- Scheduling and dispatch queries do NOT enumerate positive status lists that would need to include the new values — they either use `is_box_my_bike` or exclude by status (e.g. `<> 'cancelled'`). Box My Bike orders skip Shipday scheduling entirely, so no additional exclusions are required.
- `shipday-webhook` and `reconcile-shipday-orders` reference `order_status` only for driver events (`driver_to_collection`, `collected`, etc.) — untouched by the new values.

## Not changing
- Existing `order_status` values, their triggers, or their consumers.
- The Box My Bike UI stage flow — same 5 tabs and progression.
- RLS.

## Order of execution
1. Approve → migration 1 (enum values only).
2. Migration 2 (trigger + backfill + webhook mapping).
3. Frontend edits (types + badge + cancelled filter).
