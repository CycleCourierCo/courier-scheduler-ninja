## Goal

When a CSV contains several rows for the same stop (e.g. `#9`/`#10` David Perryman, `#23–26` PAUL MARTIN), show **one stop card** listing the unique candidate jobs once, instead of repeating the same candidate list under every duplicate row.

## Changes — `src/components/scheduling/CSVMatchReviewDialog.tsx`

1. **Group rows into stops.** Build a memoised `stops` list from `matchResults`, keyed by normalised customer name + normalised address (lowercased, punctuation/whitespace stripped, so `Louth Cycle Centre` rows with slightly different address text still merge). Each stop keeps:
   - the list of source row sequences (`#9, #10`),
   - `sequence` = lowest sequence in the group (used for route position and collection-status ordering),
   - `candidates` = union of all rows' candidates, de-duplicated by `orderId|jobType`, sorted by confidence descending.

2. **Re-key selection.** Selection keys become `orderId|jobType` (no row index), so a candidate can only be picked once regardless of how many CSV rows referenced it. `selectedJobs` emits one entry per selected key with the stop's `sequence`.

3. **Default pre-tick.** For each stop, pre-tick the top N distinct candidates where N = number of CSV rows in that group (capped at the number of candidates). So a stop appearing twice with a collection and a delivery pre-ticks both; a stop appearing once pre-ticks only its best match. "Best match only" pre-ticks a single candidate per stop.

4. **Card UI.** Header shows all merged sequence badges (`#9 #10`) plus name and address. When a stop has more candidates than rows, keep the "N possible jobs for this stop — tick the ones to add" hint; add a line like "2 CSV rows merged into this stop" when duplicates were collapsed.

5. **Stats.** "Total Rows" stays as the raw CSV row count; add/relabel a counter for **Stops** (grouped count) so the numbers make sense after merging. Unmatched counts stops with zero candidates.

6. Collection-status badges continue to work: `pickupSequenceByOrderId` is rebuilt from the selected keys using each stop's sequence.

No changes needed in `RouteBuilder.handleCsvConfirm` — it already consumes `{orderId, jobType, sequence}[]`.

## Verification

Load the sample 27-row CSV at a 360px viewport and confirm David Perryman appears once with two tickable jobs, PAUL MARTIN appears once with its full candidate set, and the loaded job count matches the ticks.
