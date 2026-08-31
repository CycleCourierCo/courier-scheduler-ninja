# Fix jobs loading at the wrong route position after CSV upload

## What's going wrong

In Route_1_4.csv, "Andrew Johnson" is stop #9 and "Andrew robinson" is stop #48. The name matcher (Levenshtein similarity over 0.7) treats those two as plausible matches for each other, so Andrew Robinson's job is offered as a weak candidate under stop #9 as well as an exact candidate under stop #48.

Two mechanics in the review dialog then combine to misplace it:

1. Selection is tracked by a global `orderId|jobType` key, not per stop. Ticking Andrew Robinson under stop #48 also marks the same weak candidate listed under stop #9 as ticked.
2. When building the final job list, the dialog walks stops in sequence order and dedupes by that same key, keeping the **first** occurrence. So the job is emitted with sequence 9 instead of 48.

The same applies to any pair of similarly named customers (e.g. Paul Martin / Julian Martin), which is why only "certain" jobs jump position.

## The fix

1. **Track selection per stop.** Key checkboxes by `stopKey + orderId + jobType` so ticking a job under one stop no longer ticks the same job listed under a different stop. The confirm step then uses the sequence of the stop the job was actually ticked under.
2. **Keep one job per stop on confirm.** If the same order/leg somehow ends up ticked under two stops, keep the occurrence at the stop with the higher match confidence (tie-break on lower sequence) rather than blindly taking the first sequence.
3. **Stop weak cross-stop candidates from appearing at all.** For each order/leg, compute its best confidence across all stops; only list it under stops where its confidence is at or near that best (small tolerance). A 0.64-confidence "Andrew Johnson" guess disappears from stop #9 once stop #48 matches the same job at ~1.0.
4. **Raise the fuzzy floor slightly** so different surnames at different postcodes stop generating candidates: require postcode agreement for similarity-based (non-substring) matches below ~0.85, in `matchRowToOrder`.

Default pre-tick behaviour, stop grouping, viability analysis and timeslot maths are unchanged.

## Technical detail

- `src/components/scheduling/CSVMatchReviewDialog.tsx`
  - Replace `candidateKey(c)` with `selectionKey(stop, c)` for `selectedKeys`, `toggle`, select-all / best-match buttons, checkbox ids, and `pickupSequenceByOrderId`.
  - In the `stops` memo, after grouping, drop candidates whose confidence is materially below that order/leg's best confidence across all stops; keep the existing single-owner `claimed` pass for the equal-confidence case.
  - In `selectedJobs`, dedupe by `orderId|jobType` choosing the entry with the highest candidate confidence, then sort by sequence.
- `src/utils/csvRouteParser.ts`: in `matchRowToOrder`, skip similarity-only candidates (no substring/exact name hit) when the CSV postcode is present and does not match the leg's postcode.
- No database, edge function or RouteBuilder changes needed; `handleCsvConfirm` already keeps the sequence order it is given.

## Verification

Re-upload Route_1_4.csv and confirm Andrew Robinson appears only under stop #48, and that the Get Timeslots list shows him at position 48-ish rather than 9. Spot-check the five Paul Martin rows still group as one stop with five tickable jobs.
