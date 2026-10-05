# Fix the 1,000-row limit on timeslips

## Problem
Supabase returns at most 1,000 rows per query. Two timeslip loaders fetch with no pagination, so once you pass 1,000 timeslips the lists silently truncate:

- `timeslipService.getAllTimeslips` — used by the admin Timeslips page (`DriverTimeslips.tsx`) and the driver hours/mileage panel (`DriverHoursMileagePanel.tsx`)
- `timeslipService.getDriverTimeslips` — used for a driver's own approved timeslips

All other timeslip queries (profitability, vehicle analytics, fuel, maintenance, driver analytics) already paginate with `.range()` loops, so they are unaffected.

## Fix
In `src/services/timeslipService.ts`:

1. Add a shared paginated-fetch helper that loops `.range(from, from + 999)` until a page returns fewer than 1,000 rows, accumulating all results.
2. Use it in `getAllTimeslips` — filters (status, driver, date range, no-mileage, no-vehicle) stay applied server-side exactly as now; only the fetch becomes paged.
3. Use it in `getDriverTimeslips` the same way.

No UI changes, no database changes, no behaviour change other than returning all rows instead of the first 1,000.

## Verification
- Typecheck/build passes.
- Confirm the Timeslips page shows all historical timeslips (count should exceed 1,000 if that many exist).
