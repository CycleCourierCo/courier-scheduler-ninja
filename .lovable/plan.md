# Let the day-by-day planner run for a single day

Two things are getting in the way on Generate routes:

1. Picking one day is refused with "Pick at least 3 days to plan" — the screen currently insists on three days before it will do anything.
2. The Balanced / Day-by-day switch only appears after a plan has been built, so there is no visible "daily planner" before you press Generate.

## What changes

- One day is enough to generate. Choosing a single day runs the day-by-day plan for that day; the balanced-across-days plan needs at least two days, so with one day picked only the day-by-day result is produced (no error toast, no failed second attempt).
- Move the Balanced / Day-by-day choice above the Generate button so it is visible from the start. Whichever one is selected is shown first after generating; both are still built when more than one day is picked, so they can be compared.
- When only one day is picked, the Balanced option is shown as unavailable with a short hint ("needs 2 or more days") instead of an error.
- Wording on the day-by-day option stays "Day by day" so it matches what is already there, with a one-line description: fills each day as full as it can, in order.

## Technical notes

- `src/components/scheduling/generate/GenerateRoutesDialog.tsx`: lower `MIN_DAYS` to 1; in `handleGenerate` skip the joint request when `dates.length < 2` and default `mode` to `greedy` in that case; relax the same guard in `handleRetryMode`; lift the mode selector block out of the `result &&` section so it renders with the setup controls, disabling `joint` when fewer than two days are picked.
- No change to `route-optimize`, the plan tables, locking, or the Get Timeslots handoff.
