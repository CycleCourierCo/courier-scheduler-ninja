## Route Profitability panel (admin only)

Add a new section inside the Route Summary block in `src/components/scheduling/RouteBuilder.tsx`, rendered in both the compact and full summary variants, visible only to admins.

### Where it goes
Directly beneath the existing "Route Summary" card at lines ~3429–3439 and ~3575–3585. Same muted card style, with a "Route Profitability (Admin)" heading.

### What it shows
Four blocks:

1. **Revenue**
   - Total route revenue
   - Per-stop breakdown count and average per stop
2. **Costs**
   - Mileage cost: `routeStats.distanceMiles × £0.45`
   - Driver pay: `(routeStats.durationMinutes / 60) × £11`
   - Total cost
3. **Profit** = revenue − total cost, with margin %
4. **Unit economics**
   - Revenue / stop
   - Cost / stop
   - Profit / stop
   - Profit / order

### Revenue calculation

For every unique `orderId` in `selectedJobs` (excluding `type === 'break'`):

1. Look up `special_rate_price` for the order's `user_id` (from `profiles`).
2. If a special rate exists → revenue for that order = `special_rate_price` (full order price). Each of the two stops (collection + delivery) is worth `special_rate_price / 2`.
3. Otherwise → use `getRevenuePerStopForBikeType(bike_type)` from `src/constants/bikePricing.ts`. That helper already returns the per-stop value (full price / 2). Sum across the bikes JSONB array with quantities, matching the existing `getRevenueForTimeslip` logic.
4. For each order, only count the stops that actually appear in this route (collection, delivery, or both). Per-stop value × number of that order's stops present = order's contribution.

Example: Non-electric road bike, both stops in route → 2 × £36 = £72 revenue. Matthew Coulthard special rate £65, only delivery in route → 1 × £32.50.

### Reuse and refactor

- Extract a small `getRevenueForRouteStops(selectedJobs)` helper. Prefer placing it in `src/services/profitabilityService.ts` next to the existing `getSpecialRatePrice` / `getRevenuePerStopForBikeType` logic so the two revenue paths stay in sync. Export it and call it from RouteBuilder.
- Use the existing `specialRatePriceCache` and `clearSpecialRatePriceCache` from that service.
- Bike data source: prefer `job.orderData.bikes` (JSONB) already loaded on selected jobs; fall back to `orderData.bike_type` then `getRevenuePerStopForBikeType` default (£30/stop) for unknowns.

### Admin gating

Use the existing auth context + `hasRole(profile, 'admin')` from `src/lib/roles.ts` (pattern already used elsewhere in the app). Only render the profitability card when true. No route/policy changes required — data used is already in memory or read via existing profiles RLS.

### State + wiring in RouteBuilder

- Add `const [profitability, setProfitability] = useState<{ revenue: number; mileageCost: number; driverPay: number; totalCost: number; profit: number; stopCount: number; orderCount: number } | null>(null);`
- Add a `useEffect` that recomputes whenever `selectedJobs` or `routeStats` change: builds the unique orders list, awaits `getRevenueForRouteStops`, then combines with `routeStats.distanceMiles` and `routeStats.durationMinutes` for costs. Skip when `routeStats` is null or there are no non-break stops.
- Constants defined locally at the top of the file: `const COST_PER_MILE = 0.45;` `const DRIVER_HOURLY_RATE = 11;`.

### UI details

- Same `p-2/p-3 border rounded-lg bg-muted/40` container styling as the existing summary.
- Small heading: "Route Profitability" with an admin-only badge.
- 2-column grid on the compact variant, 4-column on the full variant, mirroring the neighbour card.
- Format currency as `£X.XX` via `toLocaleString('en-GB', { style: 'currency', currency: 'GBP' })`.
- Colour profit green when positive, red when negative (semantic tokens, no hard-coded hex).

### Out of scope

- No changes to timeslip-based profitability page, database schema, or edge functions.
- No persistence of the calculated numbers — display only.
