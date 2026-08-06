# Mechanic hours section on Analytics

Add a "Mechanic Hours" section to the Inspections tab that puts clocked hours side by side with what was actually produced on each day.

## What it shows

For each day in the chosen date range:

- Hours clocked by mechanics (from mechanic timeslips, closed/approved).
- Inspections completed that day.
- Repairs completed that day (issues marked resolved/repaired).
- Output per hour (inspections + repairs divided by hours clocked).

Presented as:

- Summary tiles: total hours, inspections completed, repairs completed, jobs per hour, and average minutes per job.
- Combo chart: bars for hours clocked, lines for inspections and repairs completed per day.
- Per-mechanic breakdown table: hours, inspections, repairs, jobs per hour, and average minutes per job — so you can see who is getting more done per clocked hour.

Date range controls default to the last 4 weeks, with quick 4w / 8w / 12w buttons and custom from/to inputs.

## Technical notes

- New `src/services/mechanicHoursService.ts`:
  - Query `mechanic_timeslips` (status in closed/approved) between dates, joined to `profiles` for the mechanic name; sum `total_hours` per `date` and per `driver_id`.
  - Query `bicycle_inspections` for `inspected_at` in range, grouped by London-local day and `inspected_by_id`.
  - Query `inspection_issues` where status in ('resolved','repaired') and `resolved_at` in range, grouped by day and `resolved_by_id`.
  - Return `{ daily: { date, label, hours, inspections, repairs, jobsPerHour }[], perMechanic: { mechanicId, name, hours, inspections, repairs, jobsPerHour, minutesPerJob }[], totals }`.
  - Bucket dates in `Europe/London` to match how timeslip dates are stored (`YYYY-MM-DD` strings).
- New `src/components/analytics/MechanicHoursSection.tsx`: date range controls, `StatsCard` tiles, recharts `ComposedChart` (Bar for hours + two Lines), and a table for the per-mechanic breakdown. Uses existing semantic colour tokens like the other analytics charts.
- `src/pages/AnalyticsPage.tsx`: render the section in the Inspections tab under a "Mechanic Hours" heading, below the existing charts.
