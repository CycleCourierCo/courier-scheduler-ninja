# Hide already-scheduled legs on the Job Scheduling map

## Cause (confirmed)
CCC754954594195CLISN1 has its collection booked for today (status "collection scheduled"), but its delivery isn't booked yet. The page keeps the order because the delivery still needs scheduling, then the map draws a pin for every leg it thinks is outstanding — and it still treats a "collection scheduled" order as needing a collection pin. So the green collection pin shows even though it's already booked.

## Change
When the map decides which pins to draw for an order:
- No collection pin if the collection already has a booked date (or the bike is collected).
- No delivery pin if the delivery already has a booked date, or it's a Box My Bike order.

The delivery pin for this order still shows (it still needs booking), so nothing else on the page changes.

## Technical details
- `src/components/scheduling/ClusterMap.tsx` `getJobsForOrder`: drop `collection` when `order.scheduled_pickup_date` is set; drop `delivery` when `order.scheduled_delivery_date` is set or `order.is_box_my_bike`.
- Cluster counts, lasso and add/remove buttons use these same points, so they follow automatically.
