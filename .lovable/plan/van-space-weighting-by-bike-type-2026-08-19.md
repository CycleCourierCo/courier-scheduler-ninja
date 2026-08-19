# Van space weighting by bike type

Right now the route builder counts every bike as "1 bike" when showing the load on board. A cargo trike and a boxed kids bike take up wildly different room in the van, so the count doesn't tell the planner whether the van is actually full. This adds configurable space values per bike type, plus a global van capacity, and shows the load in spaces.

## What gets built

1. **Bike type space settings (admin)**
  - New tab/section on the Labour Times admin page (`/admin/labour-times`) called "Van Spaces".
  - Table listing every bike type from the existing pricing list, each with an editable "spaces" value (decimals allowed, e.g. 0.5 for a wheelset, 2.5 for a trike).
  - A single "Spaces per van" capacity field at the top.
  - Defaults are seeded so nothing breaks before the admin edits anything (everything 1 space unless listed otherwise).
2. **Scheduling uses spaces instead of raw bike counts**
  - The load shown at each stop in the route builder (the 🚲 number today) becomes a spaces figure, e.g. `6.5 / 10`.
  - Multi-bike orders are summed per bike from the order's item list, falling back to the order's single bike type and quantity when the item list is absent.
  - The starting-load calculation (deliveries with no matching collection in the route) uses the same weighting.
  - The value carried into the timeslot dialog / saved routes stays consistent with the new figure.
3. **Over-capacity warning (warn only, never blocks)**
  - Any stop whose load exceeds the van capacity shows its badge in red.
  - A summary warning appears at the top of the route builder naming the peak load and how far over capacity it is.
  - Sending the route is still allowed.

## Technical notes

- New table `public.bike_type_spaces` (`bike_type` text primary key, `spaces` numeric, `updated_at`, `updated_by`) with grants for `authenticated` + `service_role`, RLS on: read for internal staff, write for admins only. Seeded with one row per entry in `src/constants/bikePricing.ts`.
- Van capacity added as a new column `van_spaces_capacity` on the existing singleton `workshop_settings` table (default 10), managed through the same settings hook pattern as `hourly_rate_gbp`.
- New `src/lib/bikeSpaces.ts`: React Query hook to load the space map + capacity, a mutation to save, and a pure `getOrderSpaces(order, spaceMap)` helper with normalised (case-insensitive, partial) bike type matching mirroring `getRevenuePerStopForBikeType`.
- `RouteBuilder.tsx`: replace the `bike_quantity || 1` arithmetic in `calculateOptimalStartingBikes`, `calculateBikeCountAtJob`, and `calculateFinalBikeCount` with `getOrderSpaces`; keep prop names but display spaces and capacity.
- `JobScheduling.tsx` `OrderData` type gains `bike_type` and `bikes` (the query already selects `*`, so no query change needed).
- `clusteringService.determineOptimalK` keeps its existing signature; its `maxBikesPerVan` argument is fed the configured capacity.