## Goal

Show how long each order has been waiting (since `created_at`) on every job card in the Route Builder list on the Job Scheduling page.

## Change

**File:** `src/components/scheduling/RouteBuilder.tsx` (job card, around lines 3013–3026)

Add a small line under the tracking number / contact showing days since the order was created:

- Compute `daysOnPlatform = differenceInDays(new Date(), new Date(job.order.created_at))`
- Render as a `Badge` (or inline text with a `Clock` icon) reading:
  - `Just added` if 0 days
  - `1 day waiting` if 1
  - `N days waiting` otherwise
- Color-code by age for quick scanning:
  - 0–2 days → neutral / muted
  - 3–6 days → amber
  - 7+ days → red (urgent)

Place it next to the tracking number row so it's visible at a glance without enlarging the card.

## Out of scope

- No changes to data fetching — `created_at` is already on `OrderData`.
- No changes to `SchedulingCard` (legacy component not used on the current scheduling page).
- No sorting/filtering changes — display only.
