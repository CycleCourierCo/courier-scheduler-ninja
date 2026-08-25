# Shipday jobs: missing pickup references

## What I found

Both jobs you named **are in Shipday** — nothing was lost at Shipday's end. What's missing is the reference stored inside the order's tracking record.

| Order | Shipday pickup job | Shipday delivery job | Pickup ref in tracking record | Delivery ref in tracking record |
|---|---|---|---|---|
| CCC754296942656MUSCH6 | 52299217 | 52299218 | present | present |
| CCC754953717831CARDE6 | 52299220 | 52299221 | **missing** | present |

Across the last 45 days of live orders (239 total), 16 have a half-filled tracking record:

- **11 orders** have a Shipday pickup job but no pickup reference in the tracking record (CARDE6, MATCA1, RICRH1, TONB90, PAUL8, HAREX1, ANTL33, SHIPR6, MATDE6, RANNN1, BETTN6).
- **1 order** (EAMCB7) has the mirror problem: delivery job 52299212 exists, delivery reference missing.
- **4 orders** show no delivery reference legitimately — they are Box My Bike jobs, where the third-party courier handles delivery and no Shipday delivery leg is ever created.
- **1 order** (CCC754739140674MATL8, created 11 Aug, still awaiting scheduled dates) genuinely has **no Shipday jobs at all** — this is the only order actually missing from Shipday.

Every affected tracking record was last rewritten between 10:25 and 10:29 this morning, in one run.

## Root cause

The order's Shipday data is stored twice: in dedicated columns (`shipday_pickup_id` / `shipday_delivery_id`) and inside the `tracking_events` JSON blob. The Shipday creation function reads the whole JSON blob at the start of the run and writes the whole blob back at the end. When the pickup leg and the delivery leg are pushed as two separate runs that overlap, the second run writes back the copy it read before the first run finished — silently erasing the other leg's reference. The dedicated columns survive because they are written as separate fields.

The order detail timeline reads the pickup reference from the JSON blob, so the affected orders look like the pickup was never sent to Shipday even though it was.

## The fix

1. **Stop the overwrite.** Change the Shipday creation function so it never writes the whole JSON blob back. Instead it merges just the keys it owns (`pickup_id`, `delivery_id`, `created_at`) into the existing record inside the database, so two overlapping runs can no longer erase each other. Same treatment for the webhook and reconcile handlers that rewrite the blob.
2. **Repair the existing 12 orders.** Backfill the missing references in the tracking record from the dedicated columns, which hold the correct Shipday job IDs. No new Shipday jobs get created, so no duplicates and no customer notifications.
3. **Push the one genuinely missing order.** Create the Shipday jobs for CCC754739140674MATL8 (or confirm with me first if it should stay unsent while it waits on dates).
4. **Make the mismatch visible.** Add a check to the existing Shipday verification job that flags any order where a dedicated column and the tracking record disagree, so this can't drift again unnoticed.

## Technical notes

- `supabase/functions/create-shipday-order/index.ts` (lines ~447-479): replace the read-modify-write of `tracking_events` with a `jsonb_set`-based merge, via a new `SECURITY DEFINER` function (e.g. `public.merge_order_shipday_refs(p_order_id uuid, p_pickup_id text, p_delivery_id text)`) with `EXECUTE` revoked from `PUBLIC`, `anon` and `authenticated` so only the service role can call it.
- Apply the same merge in `shipday-webhook/index.ts` (lines 203-224, 331-451) and `reconcile-shipday-orders/index.ts` (lines 330-409), which have the identical read-modify-write shape.
- Backfill is a data update (run through the SQL tool, not a migration): set `tracking_events.shipday.pickup_id`/`delivery_id` from `shipday_pickup_id`/`shipday_delivery_id` wherever the column is set and the JSON key is null. Box My Bike orders keep a null delivery reference.
- Add the column-vs-JSON consistency check to `verify-shipday-orders/index.ts` output.
