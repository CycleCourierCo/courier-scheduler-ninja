# Show expired jobs on the Get Timeslots map

## What you asked
The nearby-jobs pins on the Get Timeslots map only show jobs the customer is available for on the route's date. Jobs whose dates have all expired never appear, so you can't spot an overdue job sitting right next to a route and add it.

## What changes

**New "expired" pin category on the nearby-jobs map**
- A job counts as expired when it still needs doing, isn't booked onto another date, and every customer date for that leg has passed (London time) — the same definition the Expiring Dates page uses.
- Expired jobs show as red pins (circle = collection, square = delivery), listed under a red "Expired" label in the pin so they stand out from normal nearby jobs.
- Deliveries still only appear if the bike is collected (or its collection is booked for a real future date before the route date, or it's collected earlier on this same route) and any inspection is finished — the fix for uncollected deliveries stays in place.
- Northern Ireland jobs stay excluded, as they are everywhere else in planning.
- Clicking an expired pin shows the customer, address, tracking number, distance and an "Add to route" button, same as other pins — adding it works exactly like adding any other job (goes to the bottom of the list, times recalculate, you can drag or Re-optimise).

## Technical details
- `heatJobPoints.ts`: add `isLegExpired(order, type)` — leg needs doing, no scheduled date, all pickup/delivery dates < today (Europe/London), plus the same collected/inspection gating for deliveries as `isLegViableOnDate`.
- `TimeslotRouteMap.tsx`: candidates include legs where `isLegViableOnDate` OR `isLegExpired`; expired candidates get a red icon variant and an "Expired" badge in the popup; legend updated to mention red = expired.

## Checks after building
- Build passes.
- You verify in the preview: open Get Timeslots on a route, confirm an expired job near the route shows as a red pin and can be added.
