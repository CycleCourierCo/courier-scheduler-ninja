# Stop failed collections being marked as collected

## What's going wrong

When a collection fails, the driver often still has the delivery job on their Shipday app. When they start (or fail) that delivery job, the system treats it as "on the way to deliver" and marks the bike as **collected**, even though we never picked it up.

Example: **CCC754418388450FABDE6**. The collection failed on 7 Oct. The driver then started the delivery job, so it was flagged as collected. When the delivery then failed, it went back to "Collected". Because of that it showed in Mohammed's list on the loading page and was ticked as loaded onto the van.

## What will change

1. A bike only counts as collected when the **collection** job is completed in Shipday (or staff mark it collected by hand). Starting a delivery job won't do it any more.
2. If a delivery job is started before the collection is done, the job keeps its current status. A note goes on the tracking history so you can see it happened.
3. When a delivery fails and the bike was never really collected, the job goes back to needing a collection, not to "Collected". It won't show as being in anyone's van.
4. Jobs already affected get fixed. These are jobs flagged collected with a failed collection and no completed collection since. I'll list them for you first and only change them once you say yes. Jobs staff marked collected by hand won't be touched.

## Technical details

- `supabase/functions/shipday-webhook/index.ts`:
  - Delivery-leg `ORDER_ONTHEWAY`: if the order isn't really collected (`order_collected` false and status not `collected`), skip the `driver_to_delivery` change. Record a tracking event only.
  - Only set `order_collected = true` for statuses that come from pickup-leg completion/POD, or for `delivered` / `delivered_to_ferry`. `driver_to_delivery` / `delivery_scheduled` will no longer set it.
  - `ORDER_FAILED` on a delivery: only revert to `collected` if there is real evidence of collection. That means a pickup `ORDER_COMPLETED`/`ORDER_POD_UPLOAD` for the current pickup id, or the order was already flagged collected before any delivery-leg events. Otherwise use the normal availability revert, and don't set `held_by_driver_name` or the loaded flag.
- `supabase/functions/reconcile-shipday-orders/index.ts`: make the same changes so the nightly check matches.
- Data repair (run after your OK): find orders where `order_collected = true`, not delivered, the last pickup event is `ORDER_FAILED`, there's no later pickup completion, and they weren't marked collected by hand. For those, reset `order_collected`, `loaded_onto_van` and `held_by_driver_*`, and revert the status. Today that includes CCC754418388450FABDE6.
- Redeploy both functions. No change to the database structure.
