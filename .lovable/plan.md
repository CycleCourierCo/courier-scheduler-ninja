# Route planning context + Verso (Vroom Premium) cost estimate

## 1. How routes are planned today

All planning happens in one screen, Job Scheduling > Route Builder (`src/components/scheduling/RouteBuilder.tsx`, ~4,100 lines), run by a human planner. There is no automatic optimiser.

Flow:

1. **Depot.** Every route starts and ends at Lawden Road, Birmingham B10 0AD (52.4690197, -1.8757663) — `src/constants/depot.ts`.
2. **Planner picks a route date and a start time** (default 09:00).
3. **Planner picks jobs** from the pending pool. Each transport order produces up to two independent "legs"/stops: a collection at the sender and a delivery at the receiver. They can be on the same route or weeks apart.
4. **Helpers on screen** to guide the choice:
   - map with three modes: geographic clusters (k-means, `src/services/clusteringService.ts`), job-age heat map, and "viable on this date" heat map
   - a guaranteed-delivery panel pinned at the top (jobs with a promised date)
   - badges per job: job age, availability dates remaining, collection state (Collecting on Route / Collected earlier / Collection after delivery! / Not Collected), inspection state, ferry state for Northern Ireland
   - van-space running total vs capacity (default 10 spaces, per-bike-type weighting in `src/lib/bikeSpaces.ts`; a tandem/e-cargo can be 1.5–2 spaces)
   - optional CSV import of an externally-optimised sequence (OptimoRoute-style) which is then matched back to our jobs
5. **Planner orders the stops manually** — drag-and-drop or up/down buttons. Breaks can be inserted as pseudo-stops with a duration.
6. **"Get Timeslots"** computes the timing chain (`calculateTimeslots`): depot → stop 1 → … → depot, adding real travel time per leg (Geoapify routing from the browser; `supabase/functions/route-path` uses Google Routes for the polyline/distance), **15 minutes service time per job**, arrival times rounded up to the next 5 minutes, stops at the same address grouped so travel time is only counted once. Output: per-stop ETA, route end time, total miles, total duration. A second pass re-times the route if a stop resolves to a work address inside its work-hours window.
7. Planner can hand-edit any stop time; later stops re-time from there.
8. **Send**: timeslots go to customers by WhatsApp/email, jobs are written to Shipday, the route is saved to `saved_routes`.

Key point: the sequence is entirely human judgement. The software prices and times whatever order the planner gives it, it does not search for a better order.

## 2. Data we hold per job (usable as VRP input)

- **Locations**: full address + lat/lon for sender and receiver, geocoded at order creation; depot fixed; Northern Ireland jobs route via a fixed ferry hand-off at City Air Express, Trafford Park M17 1GB (53.4713, -2.3049) instead of the customer address.
- **Time windows**: customer-confirmed availability as a set of whole dates (`YYYY-MM-DD` strings), not hours — sender and receiver choose separately. Business (B2B) accounts additionally have weekday opening hours. Inbound-NI senders pick a single Mon–Fri date. So constraints are mostly *day-level*, with opening hours and occasional work-address windows as intra-day windows.
- **Pairing**: collection must precede delivery, but they are usually on different routes and days, with the bike stored in a numbered bay at the depot in between. So it is rarely a classic same-route pickup-and-delivery shipment.
- **Capacity**: van space per bike type (weighted, fractional), van capacity setting, plus "already loaded" state at route start.
- **Priority signals**: job age (days since booking), availability dates remaining, guaranteed delivery date, inspection/repair completion state, NI ferry state.
- **Service time**: flat 15 min per job today.
- **Fleet**: named drivers/vans, one route per driver per day; driver hours and mileage tracked afterwards.
- **History**: ~172 saved routes since July 2026 with full job sequences — usable as a benchmark set for comparing an optimiser against human planning.

## 3. Volume (measured from the live database)

- Orders booked: **~200–235 per week** over the last 12 weeks (last full weeks: 236, 221, 179).
- Scheduled stops per weekday (collections + deliveries), last 4 weeks: typically **35–50 collections and 30–50 deliveries per day**, i.e. **~75–90 stops per working day**. Saturdays are light, Sundays zero.
- That is roughly **380–430 stops per week**, **~1,700–1,900 stops per month**.
- Routes built: **13–26 saved routes per week** (multiple vans per day).

## 4. Verso / Vroom Premium cost estimate

Verso charges per *optimised task*, from €0.005 per task, with a €20/month minimum covering up to 500 tasks, and re-running variations of the same problem is not charged again — a location is counted once per problem-solving sequence [1](https://verso-optim.com/pricing/).

Applied to our volume:

| Scenario | Tasks/month | Indicative cost |
| --- | --- | --- |
| Every stop optimised (~1,800/month) | ~1,800 | Low tens of € — at the €0.005 floor this is ~€9, so the €20 minimum likely governs; expect **€20–40/month** |
| Only deliveries optimised | ~900 | **€20/month** (minimum) |
| 50% growth | ~2,700 | Still modest, **€20–60/month** |

Because iterating on the same day's problem is free, the planner can try several scenarios (different vans, priorities, windows) per route at no extra charge — which suits how Route Builder is used.

Self-hosted open-source Vroom + OSRM would be £0 in licence but ~£10/month VPS plus maintenance. Verso removes the server and gives better road data and support for a similar monthly figure at our volume.

## 5. What an optimiser would change

- Replace manual stop ordering with a `solve` call: vehicles = vans (capacity in bike spaces, depot start/end, shift window), tasks = selected legs as `jobs` (single location) rather than `shipments`, since collection and delivery are normally on different days.
- Keep our 15-minute service time, van-space weighting, guaranteed dates as priorities/time windows, and NI ferry hand-off as a fixed location.
- Best first step: run it alongside the current flow on the 172 historical saved routes and compare miles and duration against what the planner chose.

## Next step

Tell me if you want this turned into an implementation plan (edge function `route-optimize` + an "Optimise order" button in Route Builder, Verso trial key), or whether this context pack is all you need for now.
