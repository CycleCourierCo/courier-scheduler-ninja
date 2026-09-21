# Allow planning a single day

Generate Routes still refuses to run unless two or more days are ticked, even
though the planner now solves one day at a time. This removes that block and
makes the settings behave sensibly for a one-day run.

## What changes

- Ticking a single day (e.g. Wed 23 Sep) and pressing Generate works. The only
  remaining check is that at least one day is picked, with the message
  "Pick at least one day to plan".
- "Firm days" is clamped to the number of days picked, so a one-day run always
  gets the full fine-tuning rather than a rough pass.
- Everything else (vans grid, long day, jobs-per-route target, locking, Get
  Timeslots handoff) is unchanged.

## Technical detail

In `src/components/scheduling/generate/GenerateRoutesDialog.tsx`:

- `MIN_DAYS` 2 -> 1, and update the toast text in `handleGenerate`.
- Send `firm_days: Math.min(firmDays, dates.length)` in `planInput` so a single
  selected day is always treated as firm.
- Keep the existing "no vans ticked" guard.

No backend change: `route-optimize` already accepts a one-day
`selected_dates` array and plans each day independently.
