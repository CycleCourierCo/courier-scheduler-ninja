# Stop showing uncollected deliveries on the Get Timeslots map

## Cause (confirmed)
CCC754292486343ROBPE1 is not collected and has no collection booked. But the customer's collection *availability* includes dates before the route date (29 Sep, 30 Sep, 1 Oct), and the map counts "customer was available to be collected earlier" as "collected". Being available is not the same as being picked up.

## Change
A delivery only shows as a nearby job when one of these is true:
- the bike is marked collected, or
- its collection is actually booked for a date before the route date, and that date is today or later (a booking in the past that never got marked done doesn't count), or
- its collection is already earlier on this same route.

Inspection and customer-date rules stay as they are.

## Technical details
- `src/components/scheduling/heatJobPoints.ts` `isLegViableOnDate`: replace `pickupDates.some(d < target)` with `order_collected === true || (scheduled_pickup_date && today <= scheduled_pickup_date < target)` (London dates).
- `TimeslotRouteMap.tsx`: also allow a delivery when its pickup leg is already earlier on the current route (from `stops`).
- The heat maps use the same check, so they'll stop counting these deliveries as workable too.
