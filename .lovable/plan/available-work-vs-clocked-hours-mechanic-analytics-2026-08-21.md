# Available work vs. clocked hours (mechanic analytics)

Right now the Mechanic Hours section shows what each mechanic clocked and what they earned. It doesn't show how much work was actually sitting in the workshop that day, so a low day can't be told apart from a quiet day.

This adds, per day, the number of jobs available (bikes awaiting inspection or awaiting repair) and the hours those jobs were worth — then splits that evenly across the mechanics who clocked hours that day.

## What you'll see

**New stat cards**
- Jobs Available (total across the period)
- Hours Possible — standard time those available jobs were worth

**Chart**
A third series per day: "Hours possible" alongside hours clocked and standard hours earned, so the gap between capacity and available work is visible at a glance.

**Per-mechanic table / mobile cards** gain two columns:
- Jobs available (share) — the day's queue divided by mechanics clocked in that day, summed over the period
- Hours possible (share) — same split applied to the hours
- Utilisation % — standard hours earned ÷ hours possible (share)

**Per-day breakdown** for a mechanic shows, for each day: hours clocked, hours earned, plus "queue that day: X jobs / Y h (your share: A jobs / B h)". A day where earned hours are low but the queue share was also low reads clearly as no work available.

## How "available" is defined

For each day in the range, a job counts as available if it was open and actionable at any point that day:

- **Awaiting inspection** — an inspection record created on or before that day and not yet inspected by the end of that day. Worth the standard inspection time.
- **Awaiting repair** — an approved inspection issue whose parts were ready (marked parts arrived or parts in stock) on or before that day, and not resolved by the end of that day. Worth its standard minutes, using the same source chain as earned hours (labour catalogue → labour cost ÷ hourly rate → default repair minutes).

Issues still waiting on parts are excluded, so the figure reflects work that could genuinely have been picked up.

The share per mechanic is the day's total divided by the number of mechanics with clocked hours that day. Days where nobody clocked in contribute to the workshop-wide figure but not to any mechanic's share.

## Technical notes

- `src/services/mechanicHoursService.ts`:
  - Widen the two existing queries so open work is visible: fetch `bicycle_inspections` with `created_at`, `inspected_at`, `bike_type` where `created_at <= toISO` and (`inspected_at` is null or `inspected_at >= fromISO`); fetch `inspection_issues` with `parts_arrived_at`, `parts_in_stock_at`, `customer_responded_at`, `resolved_at`, `status`, labour join, filtered the same way on the readiness/resolution window. Paginate with `.range()` loops to stay clear of the 1,000-row cap.
  - Build the day list from the requested range (not only days with activity) in `Europe/London`, then for each day count items whose availability window covers it, accumulating `availableJobs` and `availableMinutes`.
  - Add `availableJobs`, `hoursPossible` to `MechanicHoursDaily`; `availableJobsShare`, `hoursPossibleShare`, `utilisationPct` to `MechanicHoursPerMechanic` and to `MechanicDayBreakdown` (with the day's unsplit totals too); `availableJobs`, `hoursPossible` to `totals`.
  - Split per day by the count of mechanics with `hours > 0` in that day's `dayMap`.
- `src/components/analytics/MechanicHoursSection.tsx`: two new stat cards, a third `Bar`/`Line` series for hours possible, two extra table columns plus utilisation, matching rows in the mobile card layout, and the queue line inside the day breakdown component.
- No changes to timeslips, pricing, or invoicing logic.
