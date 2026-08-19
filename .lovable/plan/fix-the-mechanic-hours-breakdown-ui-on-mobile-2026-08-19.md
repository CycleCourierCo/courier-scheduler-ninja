# Fix the mechanic hours breakdown UI on mobile

The mechanic hours section renders an 8-column table (Mechanic, Clocked, Standard, Variance, Efficiency, Inspections, Repairs, Min/job) inside a horizontally scrolling container. On a phone that means:

- Headers and numbers sit far off-screen, so you scroll sideways to read one row.
- The expanded day-by-day breakdown is rendered inside a full-width table cell, so job names get clipped and the "30 min" values only appear after scrolling right — the job and its time are never visible together.

## What changes

Keep the table exactly as it is on desktop (md and up). On smaller screens, replace it with a stacked card list:

- One card per mechanic: name plus a chevron to expand.
- Metrics as a compact 2-column label/value grid inside the card (Clocked, Earned, Variance, Efficiency, Inspections, Repairs, Min/job), with the variance colour kept.
- Tapping the card expands the same day-by-day breakdown, but rendered inside the card at full viewport width instead of inside a wide table cell.

Inside the daily breakdown (both layouts):

- Day header stats wrap as they do now, but job rows put the job name on its own line with the source badge and the minutes on a second line, so nothing is truncated or pushed off-screen.
- Remove the horizontal-scroll dependency for the expanded content entirely.

The helper text under the table stays, moved outside the scroll container so it doesn't inherit the sideways scroll.

## Technical notes

- Single file: `src/components/analytics/MechanicHoursSection.tsx`.
- Extract the day-list rendering into a small local component so the table row and mobile card share it (no duplicated markup).
- Table wrapper becomes `hidden md:block overflow-x-auto`; card list is `md:hidden space-y-2`.
- Presentation only — no changes to `mechanicHoursService.ts` or any calculations.
