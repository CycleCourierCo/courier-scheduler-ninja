# Generate Routes: honest van counts, 2-day plans, fuller routes

## 1. Van count on the day summary

The summary counts routes, not vans. A van that gets both a normal day and a long
("expedition") day shows up twice, so "Vans used" can read higher than the number of vans
ticked for that day.

- Count distinct vans, not routes.
- Show it as "3 of 8" (used of available on that day), so it can never look like more vans
  than exist.
- "Avg stops per van", hours and miles averages use the same distinct-van figure.
- The whole-plan summary shows van-days used of van-days available.

## 2. Planning for 2 days

The minimum is currently 3 days. Lower it to 2 (single days already run through the
day-by-day tab). Both the balanced and day-by-day plans run for a 2-day pick.

## 3. Why routes look light on jobs

Checked the last runs: 218 jobs offered, every one placed, 0 left unassigned, spread over
19-20 routes — about 11 stops each. So routes are not being cut short by the 12-hour day or
by the 10-bike van capacity; the planner simply has that many eligible jobs and is happy to
open another van because opening one is priced cheaply. Three changes:

- **Price a van at what it actually costs us.** Today opening a van is priced at about one
  hour of driving, so the planner treats a whole extra van as cheaper than a slightly longer
  detour — which is backwards for profit. A van that goes out costs a driver for the day plus
  the running miles, so opening one is priced at a full shift of driver pay, and detour time
  and miles are priced at our real per-hour and per-mile rates. The planner then only opens
  another van when the work genuinely will not fit, giving fewer, fuller routes and better
  margin per stop.
- **Deliver then collect on the same run.** Bikes collected on a day cannot currently be
  delivered until the next chosen day, so a van can never unload and refill along a route.
  Where a collection and its delivery both fall on the same chosen day and no inspection is
  needed, the pair is sent as one linked job so the bike is always collected first and
  delivered later in the same route.
- **Bikes already booked in for collection.** A delivery whose collection is already
  scheduled (for example tomorrow's booked-in work) is currently invisible to the planner.
  Treat that scheduled collection day as known, so its delivery can be planned from the
  chosen days that follow it.

## 4. Jobs that are already planned

Already-scheduled jobs stay out of planning, as now — they are never re-planned or
double-booked. The change is only the one above: their deliveries become plannable.

## Technical notes

- `DaySummary.tsx`: derive vans from `new Set(route.van_id)`, add a `vansAvailable` prop fed
  from `PlanDay.vans_available` (and summed for whole-plan totals).
- `GenerateRoutesDialog.tsx`: `MIN_DAYS` 3 → 2.
- `route-optimize/index.ts`:
  - Cost model in money terms rather than nominal seconds: `costs.fixed` set from a full
    shift at `DRIVER_HOURLY_RATE` (long-day twin scaled to its 15h shift), and `costs.per_hour`
    set from the same rate so detour time and an extra van are compared on the same scale;
    fall back to the current plain payload if Verso rejects `per_hour`. Greedy mode keeps
    `noFixed` so a single day still uses whatever vans it needs.
  - Same-day pairs: for legs whose collection and delivery share a chosen day and
    `needsInspection` is false, send a VROOM `shipments` entry (pickup then delivery, same
    vehicle) instead of two independent jobs; fall back to the current two-job form if the
    API rejects shipments. Pass B keeps handling cross-day deliveries.
  - Delivery eligibility: allow a delivery leg when `scheduled_pickup_date` is set and the
    bike is not yet collected, seeding `collectionDay` from that date so pass B and the grace
    pass can place it on later chosen days.
  - Keep the 90-second budget guards and the `shortfall_only` path untouched.
- Re-run a plan after the change and compare stops per route and vans used against the
  current 11-stop / 19-route figures.
