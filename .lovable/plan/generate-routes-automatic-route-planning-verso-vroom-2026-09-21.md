# Generate Routes — automatic route planning (Verso/VROOM)

Adds a "Generate Routes" flow to Job Scheduling that builds multi-van day plans automatically, then hands the chosen route to the existing Get Timeslots logic, which stays the source of truth for customer times.

Built in the phases the spec sets out. This plan covers Phase 1 and Phase 2; the admin polygon editor and same-route collect-then-deliver stay for later.

## Phase 1 — one day, one plan per van

1. Data foundations
   - Enable PostGIS; create `difficult_areas` seeded with the five supplied polygons (Cornwall & Devon, Margate/East Kent, Carlisle & Lakes, Northumberland, Pembrokeshire).
   - Create `route_plans`, `route_plan_routes`, `route_plan_stops` with staff-only access following the existing scheduling policy pattern.
   - Mark each candidate stop as being in a difficult area by point-in-polygon at generation time.

2. Optimiser edge function `route-optimize`
   - Only caller of Verso; reads the URL and key from secrets, posts standard VROOM JSON with `options.g` so routes come back with road-following lines.
   - Builds the candidate pool: collections still to collect, deliveries already collected (inspection complete where required), customer availability inside the chosen range, Northern Ireland and ferry jobs excluded.
   - One time window per available date; businesses only get windows inside opening hours. Guaranteed dates are locked to their date at top priority; urgency scoring is `60/remaining dates + 40/days left`.
   - Vans come from the real fleet with weighted bike-space capacity; 12h target, 13h normal cap, 15h only for vans carrying a difficult-area stop. 15 min per stop and a 5% pessimism buffer so plans survive re-timing.
   - Returns routes, per-stop ETAs, peak load, and anything it could not place; never part-writes a plan on failure.

3. Popup UI on Job Scheduling
   - "Generate Routes" button beside Route Builder; step 1 asks for the date, shift start (09:00 default) and which vans are available.
   - Results show a card per van: stops, hours, miles, peak load vs capacity, and badges for Expedition 15h, Thin route (under 13 stops) and guaranteed jobs.
   - Map panel with depot, numbered stops, route lines, and faint difficult-area shading. Expandable stop list per card.
   - "At-risk jobs" panel listing everything unplaced, worst first, with guaranteed-date failures in red at the top.
   - "Use this route" locks the route's jobs and opens Get Timeslots in a new tab pre-loaded with that date, start time, van and stop order; a warning shows if re-timing pushes past the cap.
   - Parity check: re-timed duration within 5% of the solver's.

## Phase 2 — full week

- Solve each date in order across a range (default next 7 days), carrying assigned jobs forward and unlocking deliveries whose collection was planned earlier (off by default where inspection is required).
- Day columns with van requirement headers ("Needs 2 of 4 vans — Van A, Van C").
- Primary / More jobs / Shortest day alternatives per day with plain-language trade-off notes, duplicates collapsed, later days re-solved when an alternative is chosen.

## Technical notes

- Migrations: PostGIS, `difficult_areas` (GiST index), the three plan tables, GRANTs plus RLS on each.
- New edge function `supabase/functions/route-optimize/index.ts`; `VERSO_API_URL` and `VERSO_API_KEY` stored as secrets and read server-side only. I'll open the secure form to collect them before wiring the calls.
- Fleet read from `vehicles`; capacity weighting from `bike_type_spaces` / `workshop_settings.van_spaces_capacity` via `getOrderSpaces`.
- Stop coordinates from the order sender/receiver address lat/lon already used by Route Builder; depot from `src/constants/depot.ts`.
- New UI under `src/components/scheduling/generate/`; reuses the existing map stack. `calculateTimeslots` in `RouteBuilder.tsx` is not changed — only hydrated from `route_plan_stops`.
