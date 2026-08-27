# Remove Shipday 15-minute cron + fix missing driver/photo on collected bikes

## 1. Remove the 15-minute Shipday cron

The job `backfill-shipday-jobs-every-15-min` (`*/15 * * * *`) is active. It will be unscheduled. The `backfill-shipday-jobs` function itself stays in place so it can still be run manually if a gap ever needs repairing.

## 2. The 9 bikes with no photo or driver — it is not the webhook

The Shipday webhook is working. All of these orders have full pickup event history (`ORDER_ASSIGNED`, `ORDER_ONTHEWAY`, `ORDER_COMPLETED` with a driver name and a proof photo).

The problem is the reference the UI matches against. Both the van badge and the collection photo look up events by `tracking_events.shipday.pickup_id`. On 13 of the 49 collected-but-unallocated orders that reference is wrong:

- 7 orders have **no** `pickup_id` inside the tracking block at all (the flat column has it, the JSON doesn't) — e.g. `CCC754739140674MATL8`, `CCC754858385977DAVDT2`, `CCC754200221957SHIPR6`.
- 6 orders have a **stale** `pickup_id` pointing at a superseded Shipday job while the events belong to the newer one — e.g. `CCC754833580317BLAEN1` (block says 51811224, events say 52253006), `CCC754750651346ETHPO1`, `CCC754212669277ESTBT3`.

With no match, both `getDriverAssignment` and `getCollectionPhotos` return nothing, so the card shows neither a driver nor an image even though both exist in the data.

## 3. Fixes

**Make the lookups resilient (frontend)**
- Fall back to the order's `shipday_pickup_id` / `shipday_delivery_id` columns when the tracking block has no id.
- If still no match, use the event's own `leg` field (`pickup` / `delivery`), which the webhook already writes on every update, instead of requiring an id match.
- Apply the same fallback to the collection photo helper so the proof image appears.

**Repair the stored data**
- One-off backfill that writes the correct `pickup_id` / `delivery_id` into `tracking_events.shipday` from the flat columns (and from the pickup/delivery leg events where the columns disagree), so the block and the events line up going forward.

**Stop it recurring**
- Where Shipday legs are re-created (re-sync after a failed collection), write the new ids into the tracking block through the existing atomic merge so the block never keeps a superseded id.

## Technical notes

- Cron removal via `cron.unschedule('backfill-shipday-jobs-every-15-min')`.
- Frontend changes: `src/utils/driverAssignmentUtils.ts`, `src/utils/collectionPhotos.ts` (leg-based fallback plus column fallback); the inspections card passes the order through unchanged apart from supplying the flat ids.
- Backfill runs as SQL over `orders` where the tracking block's ids are null or disagree with the pickup/delivery leg events; no Shipday API calls needed.
