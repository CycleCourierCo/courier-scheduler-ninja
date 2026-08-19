# Driver hours & mileage totals on Job Scheduling

Add a totals panel directly below the cluster map on the Job Scheduling page, summarising each driver's hours and mileage from their timeslips over a date range that defaults to Sunday–Thursday and can be edited.

## What it does

- New card titled "Driver hours & mileage", placed between the cluster map and the Route Builder.
- Date range defaults to the current working week: Sunday through Thursday (based on today in Europe/London; if today is Friday or Saturday, it shows the week that just finished).
- Two date pickers (From / To) let the planner change the range; a "Reset to Sun–Thu" button restores the default.
- One row per driver with a timeslip in that range, showing:
  - Driver name
  - Total hours (driving + stops + custom addons, matching the timeslip's total)
  - Driving hours and stop hours as smaller supporting figures
  - Total mileage
  - Number of days worked and total stops
- A footer row totals hours, mileage, days and stops across all drivers.
- Sorted by total hours descending. Drivers with no timeslips in the range are omitted; an empty state shows when nothing matches.
- Mileage shown as "—" where a timeslip has no mileage recorded, and the row notes how many days are missing mileage so the planner knows the total is incomplete.
- Responsive: table on desktop, stacked cards on mobile.

## Technical notes

- Data comes from `timeslips` via the existing `timeslipService.getAllTimeslips({ dateFrom, dateTo })`, which already joins `profiles` for the driver name. No new queries or schema changes.
- Aggregation is done client-side in a new component `src/components/scheduling/DriverHoursMileagePanel.tsx`, grouping by `driver_id` and summing `total_hours`, `driving_hours`, `stop_hours`, `mileage`, and `total_stops`.
- Fetched with `useQuery` keyed on the date range so changing dates refetches.
- Default range computed with `date-fns` (`startOfWeek` with `weekStartsOn: 0` plus 4 days), dates handled as `YYYY-MM-DD` strings to stay consistent with how timeslips are stored.
- Rendered in `src/pages/JobScheduling.tsx` after the `ClusterMap` block; no changes to Route Builder or scheduling logic.
