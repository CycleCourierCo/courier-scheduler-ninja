# Clocked hours vs. earned hours (mechanic analytics)

Today the Mechanic Hours section shows hours clocked next to a raw count of inspections and repairs. There is no notion of how long that work *should* have taken, so you cannot tell whether 10 jobs equals the 7 hours clocked.

This adds an "earned hours" (standard time) figure alongside clocked hours, per day and per mechanic, with a variance and efficiency measure.

## What you'll see

**New stat cards**
- Hours Clocked (existing)
- Standard Hours Earned — the labour time the completed jobs are worth
- Variance — earned minus clocked, in hours, coloured green when at/above clocked time, red when below
- Efficiency % — earned ÷ clocked

**Chart**
Grouped bars per day: Hours clocked vs. Standard hours earned, with the existing jobs-completed lines kept on the right axis. At a glance, matching bars mean the day adds up.

**Per-mechanic table** gains: Standard hours, Variance (h), Efficiency %, plus the existing hours/jobs columns. Sortable by efficiency so outliers stand out.

**Per-day breakdown** for a selected mechanic (click a table row): each day shows clocked hours, earned hours, variance, and the list of jobs that made up the earned time, so a mismatch can be traced to specific jobs.

## How earned hours are calculated

For each repair (resolved inspection issue) completed in the period, standard minutes come from the first available source:
1. The `labour_times` catalogue entry matched on the issue's `repair_id` (`labour_minutes`). Currently 81 of 289 resolved issues have a catalogue link.
2. Otherwise, derived from the issue's stored `labour_cost` ÷ workshop hourly rate.
3. Otherwise, a configurable default minutes-per-repair fallback.

Each completed inspection adds a configurable standard inspection time (default 30 minutes).

Because coverage of catalogue-linked repairs is currently partial, the UI shows a small coverage note ("x% of repairs priced from the labour catalogue") so the numbers are read with the right confidence, and the estimated portion is visually distinguishable in the tooltip.

## Technical notes

- New settings columns on `workshop_settings`: `inspection_standard_minutes` (default 30) and `default_repair_minutes` (default 30), editable from the existing settings card on the Labour Times admin page. Migration includes grants matching the existing table's policies.
- `src/services/mechanicHoursService.ts`: extend the issues query to join `labour_times` via `repair_id`, load `workshop_settings`, and compute `standardMinutes` per issue/inspection. Add `standardHours`, `varianceHours`, `efficiencyPct`, and `catalogueCoveragePct` to the daily rows, per-mechanic rows and totals. Add a per-mechanic-per-day breakdown structure with job-level rows (job label, type, minutes, source).
- `src/components/analytics/MechanicHoursSection.tsx`: new stat cards, second bar series, extra table columns, and an expandable per-mechanic day breakdown.
- Attribution keeps the existing rules: repairs by `resolved_by_id`/`resolved_at`, inspections by `inspected_by_id`/`inspected_at`, clocked hours from `closed`/`approved` `mechanic_timeslips` by `date` (Europe/London).
- No changes to pricing, invoicing, or timeslip logic.
