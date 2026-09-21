# Day summary and costings on Generate Routes

After generating, add a summary strip at the top of the day's routes, plus an
admin-only costings panel matching the one in Get Timeslots.

## Day summary (everyone who can generate routes)

Shown above the route cards for the selected day:

- Total stops that day, and total jobs (orders touched)
- Routes / vans used
- Average stops per van (total stops ÷ vans used)
- Total driving+stop hours across all routes, and average hours per van
- Total miles, and average miles per van
- Spaces used vs spaces available across the vans
- Guaranteed stops that day, and how many routes are thin (under 13 stops)

## Costings for the day (admins only)

Same numbers and method as the Get Timeslots profitability panel, but summed for
the whole day:

- Revenue (from the same per-order pricing used today)
- Mileage cost at £0.45/mile
- Driver pay at £11/hour of route time
- Total cost, profit, and margin %
- £/stop, cost/stop and profit/stop

Each route card also gets a compact one-line cost readout for admins (miles cost,
driver pay, profit) so it's clear which van is carrying the weak day.

## Technical detail

- New `src/components/scheduling/generate/DaySummary.tsx` renders both the
  summary strip and, when `hasRole(userProfile, 'admin')`, the costings block.
- Summary figures come straight from the plan data already returned by
  `route-optimize` (`stop_count`, `duration_s`, `miles`, `max_load`,
  `van_capacity`, `guaranteed_count`) — no new backend work.
- Costings reuse `getRevenueForRouteStops` from `profitabilityService`, mapping
  plan stops to `{ orderId, type: leg_type === 'collection' ? 'pickup' : 'delivery' }`,
  with the same `COST_PER_MILE = 0.45` and `DRIVER_HOURLY_RATE = 11` constants
  (moved into a small shared module so RouteBuilder and this panel stay in step).
- Revenue is fetched per day in a cancellable effect keyed on the active day and
  its routes, with a loading state; failure shows "Costs unavailable" rather than
  blocking the plan.
- `GenerateRoutesDialog.tsx` renders `DaySummary` between the van/lock row and the
  route cards. No changes to generation, locking, or Get Timeslots handoff.
