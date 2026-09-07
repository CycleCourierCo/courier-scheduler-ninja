# Show a failed bike as being in the van of the driver who failed it

## The problem today

When a delivery is marked failed, the bike is taken off the van (the loaded flag and its
time are cleared). Because the "who has this bike" logic relies on that cleared timestamp,
the bike falls back to the driver who originally collected it. So the loading page and the
loading list either can't find the bike or show it sitting in a different driver's van.

## What will change

- When a delivery fails, we still take the bike off the van, but we now record the name of
  the driver who failed it as the bike's current holder, with the date and time.
- On the loading page, unallocated bikes are grouped under the driver who actually has
  them, and their card shows "In {Driver}'s van - failed delivery {date}".
- The bike search shows the same "In {Driver}'s van" state instead of "Pending Allocation".
- The loading list message/email uses the same holder, so a bike sitting in a driver's van
  is listed under that driver rather than missing or under the wrong one.
- The holder is cleared as soon as the bike is put into a storage bay or loaded onto a van
  again, so nothing lingers.

## Technical detail

Migration on `public.orders`:
- `held_by_driver_name text`
- `held_by_driver_at timestamptz`
(no new table, so no grants/RLS changes needed)

Edge functions (both failure paths):
- `supabase/functions/shipday-webhook/index.ts` - in the existing `ORDER_FAILED` delivery
  branch that clears `loaded_onto_van`/`loaded_onto_van_at`, also set
  `held_by_driver_name = payload.carrier?.name || dbOrder.delivery_driver_name` and
  `held_by_driver_at = now`.
- `supabase/functions/reconcile-shipday-orders/index.ts` - same fields in its `ORDER_FAILED`
  handling, using the carrier from the fetched Shipday job, falling back to
  `delivery_driver_name`.

Frontend:
- `src/types/order.ts` + `src/services/orderServiceUtils.ts` - map the two new fields.
- `src/components/loading/PendingStorageAllocation.tsx` - holder precedence becomes
  `held_by_driver_name` -> previous delivery-van driver -> collection driver; add the
  "failed delivery" badge on those cards.
- `src/components/loading/BikeSearchSection.tsx` - new `held` state/badge.
- `src/pages/LoadingUnloadingPage.tsx` - clear both fields in the storage-allocation and
  load-onto-van updates; pass the holder name into the loading-list payload so grouping and
  the "needs loading" lines use it.
