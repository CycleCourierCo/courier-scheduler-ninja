# Driver Analytics

Add a **Drivers** tab to the Analytics page with a per-driver profile view: tenure, pay-rate history, weekly (Mon–Sun) pay slips, bikes collected/delivered, on-time performance against the timeslots we promised, and a location heat map.

## Layout

```text
Analytics ▸ Drivers
┌──────────────────────────────────────────────┐
│ Driver picker  ·  date range (defaults 12w)  │
├──────────────────────────────────────────────┤
│ Stat cards: Tenure · Days worked · Total pay │
│ Bikes collected · Bikes delivered · On-time% │
│ Total miles · Avg stops/day · Avg £/day      │
├──────────────────────────────────────────────┤
│ Pay rate over time (step line)               │
│ Weekly pay slips table (Mon–Sun rows)        │
│ Weekly bikes collected vs delivered (bars)   │
│ On-time / late / no-data breakdown           │
│ Heat map of stop locations (Google Maps)      │
├──────────────────────────────────────────────┤
│ All-driver leaderboard (sortable)            │
└──────────────────────────────────────────────┘
```

## What each metric uses

- **Tenure**: earliest approved timeslip date (falls back to profile creation) → "1 yr 3 mo".
- **Pay rate over time**: `hourly_rate` and `van_allowance` recorded on each timeslip, drawn as a step chart so rises are visible with the date they changed.
- **Weekly pay slips (Mon–Sun)**: timeslips grouped into ISO weeks (Europe/London) showing hours, stops, bikes, miles, van allowance and total pay, with a grand total row. Expandable to the day rows behind each week.
- **Bikes collected / delivered**: counted from orders where the driver is named on the collection or delivery leg, using each order's bike quantity, bucketed by week.
- **On-time rate**: for each completed leg we compare the actual Shipday completion time with the 3-hour window we promised (`pickup_timeslot` / `delivery_timeslot`). Legs with no promised window or no Shipday completion time are reported separately as "no data" rather than counted as late, so the percentage stays honest.
- **Heat map**: stop coordinates already stored on each timeslip (`job_locations`), rendered as a Google Maps heat map with pickup/delivery toggles.
- **Also worth tracking** (included): stops per hour, miles per stop, bikes per day, average day length, longest/shortest day, days with missing mileage or no vehicle assigned, and vehicle usage split.
- **Leaderboard**: one row per driver — hours, stops, bikes, miles, pay, £/bike, on-time % — sortable, for comparison at a glance.

## Technical notes

- New `src/services/driverAnalyticsService.ts`: paginated fetch of approved timeslips (`.range()` loop, past the 1000-row cap) plus orders filtered by driver name, and the aggregation helpers (weekly grouping, rate history, tenure, heat points, leaderboard). Driver name matching reuses the existing shipday-name/full-name variant helper so it lines up with the timeslip generator.
- New edge function `driver-ontime-stats`: for the selected range, pulls completed Shipday orders (same pattern as `query-shipday-completed-orders`), returns actual completion time + carrier per order id; the frontend joins these to promised timeslot windows. Results cached per range in React Query.
- New components under `src/components/analytics/`: `DriverAnalyticsSection.tsx` (picker + range + layout), `DriverPayRateChart.tsx`, `DriverWeeklyPayslipsTable.tsx`, `DriverBikesChart.tsx`, `DriverOnTimeCard.tsx`, `DriverHeatMap.tsx`, `DriverLeaderboardCard.tsx`.
- `src/pages/AnalyticsPage.tsx`: add a `drivers` tab trigger + content (grid column counts bumped to fit 9 tabs).
- Heat map uses the existing `useGoogleMaps` hook with the `visualization` library added.
- Mobile-first: cards stack, tables scroll horizontally, existing semantic tokens and `StatsCard` reused. No schema changes.
