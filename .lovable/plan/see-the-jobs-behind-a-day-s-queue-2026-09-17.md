# See the jobs behind a day's queue

On Mechanic Profitability, the day-by-day breakdown shows a line like "Queue that day: 12 jobs / 6.5h". Right now it's just numbers — you can't see which bikes made it up.

## What changes

- The "Queue that day" line becomes clickable (and the chart's day is reachable the same way through the breakdown).
- Clicking it opens a panel listing every job that was available that day, split into two groups:
  - **Awaiting inspection** — bike / reference, the day it came in, how many days it had been waiting by that date, and the standard inspection time.
  - **Awaiting repair (parts ready)** — the repair name, the bike it's on, the day its parts became available, days waiting, its standard minutes, and where that time came from (book time, from price, fallback).
- Each row says plainly why it counted, e.g. "In since 12 Sep, not inspected until 15 Sep" or "Parts ready 11 Sep, still open".
- A short footer repeats the rule: jobs still waiting on parts are excluded because they couldn't have been picked up, and the day's total is split evenly between the mechanics clocked in that day.
- Totals in the panel match the "N jobs / X h" figures on the line, so the drill-down always reconciles.

## Technical notes

- `src/services/mechanicHoursService.ts`
  - Widen the two "open work" queries to carry identifying detail: inspections add `order_id`, `bike_brand`, `bike_model`, `reference`, `bike_type`; issues add `issue_description`, `inspection_id` plus the inspection's bike labels (join or a second lookup keyed on `inspection_id`), keeping the existing `.range()` paging.
  - In `addAvailability`, also push a `QueueItem` onto a new per-day list: `{ id, kind: 'inspect' | 'repair', label, since, minutes, source, closedOn }`. Store as `queueItemsByDay: Map<string, QueueItem[]>` in the day aggregate.
  - Expose `queueItems` on `MechanicHoursDaily` and on `MechanicDayBreakdown` (the workshop-wide list for that date, not the share). Cap each day's list defensively (e.g. 300 items) to keep the payload sane.
- `src/components/analytics/MechanicHoursSection.tsx`
  - Make the queue line in `DayBreakdown` a button that opens a `Dialog` (mobile-safe: scrollable body, no sideways scroll) rendering the day's `queueItems` grouped by kind with the reason text and minute badges.
  - Reuse the existing `sourceLabel` map for repair time sources.
- No database, RLS or edge-function changes; no change to how earned hours, utilisation or invoicing are calculated.
