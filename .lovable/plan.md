# CSV Upload: Planner Job Selection Stage

## Goal
When a route CSV is uploaded on Job Scheduling, the planner reviews and **chooses** which matched jobs get loaded into the Route Builder — instead of every match being loaded automatically. Where a CSV row could belong to more than one job for the same customer, all candidates are shown so the planner picks the right one(s). For deliveries, the card shows whether the bike is already collected, scheduled for collection, or being collected on this same route.

## Current behaviour (verified)
- `src/utils/csvRouteParser.ts` matches each CSV row to a **single** best order + job type, marks that order/leg as "used", and discards other equally-plausible candidates. Same-customer duplicates are therefore silently collapsed or mis-assigned.
- `src/components/scheduling/CSVMatchReviewDialog.tsx` is read-only; the footer button loads *all* matched rows.
- `RouteBuilder.handleCsvConfirm` maps every matched result into `selectedJobs`.

## Changes

### 1. Matcher returns candidates (`src/utils/csvRouteParser.ts`)
- Extend `MatchResult` with `candidates: Array<{ order, jobType, matchType, confidence }>` — every order/leg scoring above threshold for that row, sorted by confidence, not just the winner.
- Keep `matchedOrder` / `jobType` as the top candidate (default selection) so existing callers (multi-CSV comparison, route analysis) keep working unchanged.
- Relax the "used order" suppression so a same-customer duplicate still appears as a candidate; only the auto-selected default respects de-duplication.

### 2. Collection-status helper
Add a helper (in `csvRouteParser.ts`) that, for a delivery candidate, returns one of:
- `collected` — `order.order_collected === true`
- `on_route_before` / `on_route_after` — the order's pickup leg is also in this CSV, compared by CSV sequence vs the delivery row
- `scheduled` — `pickup_date` set (show the date)
- `not_collected` — none of the above

### 3. Selection UI (`CSVMatchReviewDialog.tsx`)
- Each row becomes a selectable card with a checkbox; defaults ticked for the top match, unticked for unmatched rows.
- When a row has more than one candidate, show them grouped under the row with a radio/segmented choice (or multiple checkboxes if the planner wants both legs), each labelled with tracking number, contact name, bike description, match type and confidence.
- Delivery candidates get a status badge from the helper: "Collected", "Collecting earlier on this route (#seq)", "Collection later on this route (#seq)", "Collection scheduled DD MMM", "Not collected".
- Header stats update live: "X of Y selected"; footer button reads "Load N Jobs" and is disabled at zero.
- Add "Select all / Deselect all" and a quick "Select only viable deliveries" shortcut.
- Keep the existing mobile-friendly scroll area layout.

### 4. Wire-up (`RouteBuilder.tsx`)
- `handleCsvConfirm` receives the planner's chosen list (order id + job type, in CSV sequence order) rather than deriving it from all matches, then builds `selectedJobs` as today.

## Notes
- No database or edge-function changes; this is presentation + matching logic only.
- Multi-CSV comparison flow (`RouteComparisonDialog`) is unaffected; it continues to use the existing viability analysis.
