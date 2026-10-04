# Route generation: three fixes

## 1. Expired deliveries planned before the bike is collected

The planner only lets a delivery go once the bike counts as collected. It counts a bike as collected if it's in the depot, its collection is planned earlier in the same run, or its collection is **booked** for an earlier date. The problem is the last one: if a collection was booked for a date that has already passed but the driver never actually collected it, the planner still thinks the bike is in the depot. Expired jobs hit this most because they tend to be old bookings that fell through.

Fix:
- A booked collection only counts if its date is today or later. A booked date that has passed without the bike being collected no longer counts, so the delivery waits.
- The same rule applies to collections on locked routes.
- An expired delivery that's held back for this reason is listed in At-risk as "Not collected yet — collection booked for {date} didn't happen", so you can see it.
- First step: check the latest run against live data to confirm this is what let the bad deliveries in. If something else did it, fix that as well before finishing.

## 2. Guaranteed deliveries don't plan the collection in time

Right now a guaranteed delivery is fixed to its guaranteed date, but the collection for that same order is treated like any other job. It can end up planned for after the guaranteed date, or not planned at all, so the delivery can't happen.

Fix:
- The collection for a guaranteed order can only be planned on a customer date at least one day before the guaranteed date.
- It's must-go (top priority) on the last date that still works. Before that it gets a strong boost.
- If no collection date can make the guarantee, both jobs show in At-risk: "Collection can't happen before the guaranteed date {date}".

## 3. Routes that cross back over the depot

The optimiser only looks at cost and time, so sometimes a van runs south of Birmingham and then back north past the depot. For each day:
- Jobs are grouped into compass sectors around the depot (N, NE, E, SE, S, SW, W, NW, plus a close-to-depot ring that any van can take).
- Each van is given one sector, or two sectors next to each other, depending on how much work is in each. A van can no longer cover opposite sides of the depot in one route.
- The London corridor van and the long-day difficult-area van keep the rules they have now.
- Safety net: if a finished route still has stops on both sides of the depot, the planner moves the odd stops to a van in the right sector or, failing that, to the leftover list. Never to another route that crosses.
- Each route card shows its sector, e.g. "North-west".

## Technical detail

`supabase/functions/route-optimize/index.ts`
- ~637-639 `bookedCollection`: use `scheduled_pickup_date` / `lockedCollectionDate` only when `>= today`. Otherwise null. New at-risk reason for an expired or ready delivery held back by a past-due booking.
- `considerLeg('collection', …)`: pass the order's guaranteed delivery date. Collection `futureDates` filtered to `< guaranteed`. `mustGo` true when `date === last valid date`. Priority boost (e.g. 90) before that. Mark both legs `urgentInPlan`.
- New `sectorFor(leg)`: bearing from `DEPOT` put into 8 sectors; legs within ~15 mi count as a "core" ring with no sector skill. Per day, give vans one sector or two adjacent ones based on job counts, using VROOM skills (`SECTOR_BASE + i`). This sits alongside the existing `GENERAL_SKILL` / `DIFFICULT_SKILL` / London corridor skills, which stay as they are.
- Post-solve check: a route whose non-core stop bearings span more than 120 degrees gets flagged, and the stops in the minority sector are moved to the unassigned list for a re-solve.
- Return `sector` per route. `src/services/routeGenerationService.ts` adds `sector?: string` to `PlanRoute`, and `GenerateRoutesDialog.tsx` shows it on the route card.
- Redeploy `route-optimize` and check with read-only SQL against the next run. No schema changes.
