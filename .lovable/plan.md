## Add Vehicles tab to Analytics page

Source data: `timeslips` table (already used by `timeslipService.getAllTimeslips`). Each approved timeslip = 1 route, with `mileage`, `driver_id`, `date`.

### 1. New service: `src/services/vehicleAnalyticsService.ts`
- `fetchTimeslipsForAnalytics()` — paginated fetch of all approved timeslips (bypassing 1000-row limit), selecting `id, date, mileage, driver_id`.
- `getWeeklyVehicleStats(timeslips)` — groups by ISO week (Mon–Sun), returns `{ week, label, miles, routes, drivers }[]` where:
  - `miles` = sum of `mileage` for the week
  - `routes` = count of timeslips
  - `drivers` = unique `driver_id` count
- `getVehicleTotals(timeslips)` — totals + averages per week for stat cards.

### 2. New chart: `src/components/analytics/WeeklyVehicleStatsChart.tsx`
Recharts `ComposedChart` (or dual-axis `LineChart`) styled like `OrderTimeChart`:
- Bars: miles per week (left Y axis)
- Lines: routes per week and unique drivers per week (right Y axis)
- ResponsiveContainer + CartesianGrid + legend + tooltip using design tokens.

### 3. `src/pages/AnalyticsPage.tsx`
- Import new service + chart, add `Truck`/`Route`/`Users` (already partly imported) icons.
- Add `useQuery({ queryKey: ["vehiclesAnalytics"], queryFn: fetchTimeslipsForAnalytics })`.
- Update `TabsList` from `grid-cols-6` → `grid-cols-7` (lg) and adjust the col-span on last tab; add new `TabsTrigger value="vehicles"` with `Truck` icon.
- New `TabsContent value="vehicles"`:
  - 3 StatsCards: Total Miles, Total Routes, Active Drivers (with weekly averages in description).
  - `WeeklyVehicleStatsChart` full width.

No DB, RLS, or edge function changes. Frontend-only.