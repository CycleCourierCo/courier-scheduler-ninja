# Mechanic timeslip filters, totals, and multi-role driver lists

## 1. Filters on the Mechanic Timeslips tab

Add to the filter row (next to the existing Status dropdown):

- **Mechanic** dropdown — "All mechanics" plus every user holding the mechanic role, sorted by name.
- **Date from / Date to** — two date inputs, plus quick presets: This week, Last week, This month, All time.
- **Clear filters** button.

The service function `listAllMechanicTimeslips` already accepts `driverId`, `dateFrom`, and `dateTo`, so no backend change is needed — the tab just needs to pass them and include them in the query key.

## 2. Totals for the filtered period

Replace the single "Total pay shown" card with a summary strip showing, for the filtered rows only:

- Total pay (£)
- Total hours worked
- Total lunch hours
- Number of shifts
- Average hours per shift
- Average effective rate (total pay / total hours)
- Breakdown of pay by mechanic (name + hours + pay), shown when "All mechanics" is selected

Approved vs pending pay is also split out, so it is clear how much of the total is still awaiting approval.

## 3. Driver lists missing multi-role drivers

Currently every driver dropdown/list filters `profiles.role = 'driver'`, which is the single legacy role column. A user who is a loader (or mechanic, or admin) and *also* has the driver role in `user_roles` never appears.

Fix by adding one shared helper that returns staff for a role by unioning:
- `profiles.role = <role>` (legacy), and
- `user_roles.role = <role>` (the real multi-role source)

deduplicated by id and sorted by name. Then use it in the places that list drivers for timeslips:

- Driver Management dialog
- Timeslip filters (driver dropdown)
- Create Timeslip dialog
- Bulk Assign Vehicle dialog

The same helper supplies the new mechanic dropdown, so mechanics with extra roles are included too.

## Technical notes

- New helper in `src/services/mechanicTimeslipService.ts` (or a small shared `staffService`) e.g. `listStaffByRole('driver' | 'mechanic')` doing two queries and merging client-side; keeps existing RLS paths untouched.
- `MechanicTimeslipsTab.tsx`: local state for `mechanicId`, `dateFrom`, `dateTo`; query key becomes `['mechanic-timeslips-admin', status, mechanicId, dateFrom, dateTo]`.
- Totals computed with a single `useMemo` reduce over the returned rows — no extra queries.
- Dates are stored as `YYYY-MM-DD` on `mechanic_timeslips.date`; presets are computed in Europe/London to match existing timeslip date handling.
- No database migration required.
