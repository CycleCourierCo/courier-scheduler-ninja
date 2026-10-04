# Show jobs that will be expired by the route date

## What's wrong
CCC754721327141PASPE8 (delivery to PE8, bike collected, no inspection needed) has its last customer date on **today, 4 Oct**. The map currently only calls a job "expired" if every date is before *today*, so it doesn't count. But the route you're planning is for a later day (e.g. Monday 5 Oct). By then every date has passed, so it should show as a red pin.

## Fix
- Work out "expired" against the **route's date** instead of today: a job shows red if all its customer dates are before the route date.
- Everything else stays the same: still needs doing, not booked onto another date, bike collected and inspection done for deliveries, NI jobs left out.
- A job with a date on the route day itself keeps showing as a normal (non-red) pin.

## Technical details
- `isLegExpired` in `heatJobPoints.ts` gets an optional reference date (`asOf`); compare `d < asOf` instead of `d < today`. Collection-booked check for deliveries stays based on today.
- `TimeslotRouteMap.tsx` passes `routeDate` as `asOf`. Other callers keep today's behaviour.
