# Make automatic Shipday creation reliable

## Confirmed diagnosis

- `CCC754296942656MUSCH6` and `CCC754953717831CARDE6` were manually synced on 25 August, so their current Shipday IDs do not prove the booking-time automation worked.
- Website bookings insert directly into `orders`, then start `createShipdayOrder(order.id)` without awaiting it. `CreateOrder.tsx` immediately navigates away after `createOrder()` returns, so the browser can cancel the in-flight Edge Function request. The error is caught and only written to the browser console, leaving no durable retry.
- One genuinely unsynced recent order remains: `CCC754739140674MATL8` (created 11 August), with neither pickup nor delivery Shipday ID.
- Separately, multiple orders have dedicated Shipday ID columns populated while the same reference is absent from `tracking_events`. The current read-modify-write of the full JSON object can lose data when webhook and reconciliation updates overlap.

## Changes

1. **Make initial creation deterministic**
   - Await the Shipday Edge Function call before the website booking flow navigates away.
   - Keep the customer order successfully created if Shipday is temporarily unavailable, but surface/log the sync failure rather than silently swallowing it.
   - Apply the same reliable handling to part-exchange return orders.

2. **Add a durable reconciliation safety net**
   - Extend the existing reconciliation function to find active, non-test orders missing the required Shipday pickup or delivery leg and create only the missing leg.
   - Preserve Box My Bike and collected-order rules so no inappropriate duplicate delivery/pickup job is created.
   - Schedule the reconciliation through the existing authenticated cron-wrapper pattern so a browser interruption or transient Shipday outage is repaired automatically.

3. **Prevent Shipday metadata loss**
   - Add a narrowly scoped database function that atomically merges Shipday IDs and event updates into `tracking_events` while retaining existing data.
   - Use it from creation, webhook, and reconciliation paths instead of replacing the full JSON blob.
   - Keep the dedicated `shipday_pickup_id` and `shipday_delivery_id` columns synchronized in the same operation.

4. **Repair and verify**
   - Run reconciliation for `CCC754739140674MATL8` and any other eligible missing legs.
   - Verify a new booking receives the expected Shipday IDs, existing webhook history remains intact, and rerunning reconciliation does not create duplicates.
   - Check Edge Function logs for successful automatic creation and cron execution.

## Technical notes

- Edge Functions retain in-code JWT/service-role validation and CORS on every response.
- The database helper will be `SECURITY DEFINER`, use a fixed `search_path`, revoke public execution, and grant execution only to `service_role`.
- Reconciliation queries will be server-filtered and paginated to avoid the Supabase 1,000-row limit.
