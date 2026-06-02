## 1. Vehicle mileage on Vehicles page

- Extend `vehicleService.ts` with `getVehicleMileageTotals()` that sums `timeslips.mileage` grouped by `vehicle_id` (paginated, status `approved`) and returns a `Record<vehicleId, number>`.
- In `VehicleManagement.tsx`:
  - Load mileage totals alongside `listVehicles()`.
  - Add a **"Miles driven"** column to the desktop table and a row on the mobile card. Format with `toLocaleString('en-GB')` + " mi".
  - For `sold` vehicles, also show their `sold_mileage` underneath (if present) for reference.

## 2. Per-vehicle mileage analytics

Extend `src/services/vehicleAnalyticsService.ts`:
- `TimeslipRow` gains `vehicle_id: string | null`.
- `fetchTimeslipsForAnalytics` already paginates — just select `vehicle_id` too.
- New `getWeeklyMileageByVehicle(rows, vehicleIds)` returning `{ week, label, [reg1]: miles, [reg2]: miles, ... }[]` for Recharts multi-series.
- New `getVehicleLeaderboard(rows, vehicles)` returning `{ registration, miles, routes, activeDays }[]`.

New component `src/components/analytics/VehicleMileageChart.tsx`:
- Multi-select vehicle picker (shadcn popover + checkbox list of in-use + sold vehicles, with "Select all / clear").
- Renders a `LineChart` with one `<Line>` per selected vehicle, distinct HSL colors derived from index `hsl(${(i*47)%360} 70% 50%)`.
- Empty-state when none selected.

In `AnalyticsPage.tsx` → Vehicles tab:
- Keep existing date range controls (already there) — they drive the same query.
- Add the new chart below `WeeklyVehicleStatsChart`.
- Add a small **Vehicle leaderboard** card (table: reg, miles, routes, active days) sorted by miles desc.
- Add 2 extra KPI `StatsCard`s for the tab:
  - **Miles / route** (avg)
  - **Most-used vehicle** (top reg + miles)

## 3. Out of scope

- No DB changes (mileage already on `timeslips`).
- No changes to timeslip entry / vehicle assignment flows.
- No cost-per-mile calculations (separate ask if wanted later).

## Technical notes

- All queries already respect RLS via the authenticated session.
- Vehicle list for picker reuses `listVehicles()` filtered to non-archived statuses; cached via `useQuery(['vehiclesList'])`.
- Default selection = top 5 vehicles by miles in the current range, so the chart is useful on first render.
