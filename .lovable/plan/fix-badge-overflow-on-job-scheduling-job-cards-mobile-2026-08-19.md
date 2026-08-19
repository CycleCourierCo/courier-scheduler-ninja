# Fix badge overflow on Job Scheduling job cards (mobile)

On narrow screens the status badges on each available-job card (Delivery / Collected / Inspection Done, plus the "N days waiting" badge next to the tracking number) run past the card edge instead of wrapping.

## What to change

In the available-jobs card grid in the Route Builder:

1. Badge row (Collection/Delivery, collection status, inspection status, Shipday icon)
  - Allow the row to wrap onto multiple lines and stop it from forcing the card wider than its container.
2. Tracking-number line
  - Let the "N days waiting" badge wrap below the tracking number when there isn't room, keep the tracking number itself from being pushed off-screen, and allow long tracking numbers to break.
3. Address and "Final destination" text
  - Ensure long addresses wrap rather than pushing the card out.

No logic, data, or filter behaviour changes — presentation only.

## Technical detail

File: `src/components/scheduling/RouteBuilder.tsx` (available jobs `Card` render, around the `availableJobs.map` block).

- Header row: `flex justify-between items-start` → add `gap-2` and `flex-wrap`; inner badge container gets `flex-wrap` and `min-w-0`.
- Tracking-number `<p>`: change to `flex flex-wrap items-center gap-1` with `min-w-0` and `break-all` on the number span; the waiting badge keeps `ml-auto` but gains `shrink-0`.
- Address / final-destination paragraphs: add `break-words min-w-0`.