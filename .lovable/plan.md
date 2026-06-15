Plan:

1. Update the collection-status logic in `RouteBuilder.tsx` so a delivery whose order has `scheduled_pickup_date` equal to today and `order_collected !== true` returns a `Collecting Today` amber badge instead of falling through to `Not Collected`.

2. Remove the separate duplicate `Collecting Today` badge rendering and make it part of the main collection status badge, so the UI shows one clear status: `Collected`, `Collecting Today`, `Collecting on Route`, `Collection After Delivery`, or `Not Collected`.

3. Make the date comparison robust for Supabase timestamp strings by extracting/normalising the date portion rather than relying on potentially stale availability dates.

4. Fix the Recalculate flow in the Route Timeslots popup: it currently refreshes only sender/receiver coordinates, so selected jobs can keep stale `orderData`. I’ll expand that refresh to also pull `scheduled_pickup_date`, `order_collected`, `collection_confirmation_sent_at`, availability dates, and related scheduling fields, then merge them back into `selectedJobs` before recalculating.

5. Verify the example logic against `CCC754788119570SALB31`: `scheduled_pickup_date = 2026-06-15`, `order_collected = false`, so on June 15 it should display `Collecting Today` when planning delivery for June 16.