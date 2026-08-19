# Fix duplicated jobs when loading a Shipday route file

## What's happening

The Route_24 file has 3 Marcus Connolly rows, but two of them read "10 Blandfield Road" and one reads "10a blandfield road". The review dialog splits those into two separate stops (premise "10" vs "10a"), and then attaches *every* Marcus Connolly job candidate to *both* stops.

Because of that:
- Each stop independently pre-ticks its top N candidates, so the same job gets picked up under two stops.
- The confirm step walks stop by stop and emits one route job per ticked candidate per stop — so the same delivery is added to the route twice.

That's why the timeslot popup shows two "Multiple stops" cards with overlapping bike numbers (33/32/31/30 then 31/30/29/28), and why manually removing his jobs and re-adding them gives the correct 3.

## The fix

1. **One candidate belongs to one stop.** When grouping CSV rows into stops, assign each order/leg candidate to a single stop only — the earliest-sequence stop that matches it — instead of duplicating it across every stop with a similar name. Remaining stops keep only candidates not already claimed, so a stop with no unique candidate left shows as having none rather than repeating another stop's job.
2. **Cap the pre-tick to the real number of CSV rows for that customer.** Default selection stays "top N by confidence" but is applied once per candidate, so 3 CSV rows can never pre-tick more than 3 jobs.
3. **Dedupe on confirm.** The confirm handler collapses any duplicate `orderId + jobType` pairs (keeping the earliest sequence) before building route stops, as a safety net for saved routes and the URL-parameter load path.
4. **Collapse near-identical premises.** Treat "10" and "10a" at the same postcode and same customer name as one stop so the three rows merge into a single stop group with three tickable jobs.

No changes to matching confidence, viability analysis, or the timeslot calculation itself.

## Technical detail

- `src/components/scheduling/CSVMatchReviewDialog.tsx`: make `stops` build claim candidates globally (a `claimed` set keyed `orderId|jobType` while iterating stops in sequence order); soften `stopKey`'s premise normalisation so a trailing letter suffix doesn't split a stop; keep `selectedJobs` emitting one entry per unique candidate key.
- `src/components/scheduling/RouteBuilder.tsx`: in `handleCsvConfirm`, dedupe the incoming selection by `orderId + jobType` before mapping to `SelectedJob[]`; apply the same dedupe in the `initialJobs` URL-parameter effect.

## Verification

Re-upload Route_24 with the same order set and confirm the review dialog shows one Marcus Connolly stop with 3 tickable deliveries, and the timeslot popup shows a single stop with 3 bikes.
