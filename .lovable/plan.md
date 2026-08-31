# Fix CSV route matching: match on address, not names

## What's going wrong

The CSV only carries `sequence, name, address`. Today matching is name-first: an exact/substring name hit, or any Levenshtein similarity over 0.7, creates a candidate — postcode only nudges the confidence. So in Route_1_4.csv "Andrew Johnson" (#9) and "Andrew robinson" (#48) each become plausible candidates for the other's job.

The review dialog then tracks selection by a global `orderId|jobType` key and dedupes by that key while walking stops in sequence order, keeping the first occurrence. Ticking Andrew Robinson at #48 also marks the weak duplicate listed at #9, and the job is emitted with sequence 9.

## The fix — match on the unique bits of the address

1. **Postcode + premise becomes the identity.** Build a match key from the normalised full postcode plus the premise/house number (or unit) from the address line, and match CSV rows to order legs on that key. This is what actually identifies a drop, and it is present in every CSV row.
2. **Name drops to a tie-breaker only.** With multiple order legs at the same postcode + premise (the five Paul Martin rows at DE65 5SN, Webuycycle at the same unit), name similarity only orders the candidates within that stop — it can never introduce a candidate from a different address.
3. **No candidate without address agreement.** Remove name-similarity-only matching. If the postcode doesn't match, the leg isn't a candidate. Postcode-matches-but-premise-differs stays a candidate at lower confidence (covers "10" vs "10a", "Unit 15b" formatting), and rows whose postcode matches nothing are shown as unmatched for manual handling — same as today's "Not Found" state.
4. **Selection keyed per stop.** Checkbox state becomes `stopKey + orderId + jobType`, so ticking a job under one stop can't tick the same job listed elsewhere, and the confirmed sequence is the stop the job was actually ticked under. On confirm, if the same leg is ticked twice, keep the higher-confidence occurrence.

Note on email: the CSV has no email column, so email can't be the join key for this file. If you can export routes with an email/reference column, that becomes the primary key and address the fallback — say the word and I'll add it as the preferred path with the address logic as backup.

## Technical detail

- `src/utils/csvRouteParser.ts`
  - Add `addressKey(address)` → `{ postcode, premise }` with normalisation (strip spaces/case, handle "Unit 15b", "Apt 52 2", "Ls225fs", trailing letter suffixes).
  - Rewrite `matchRowToOrder`: iterate order legs, compute the leg's postcode/premise from `sender`/`receiver` address fields, and only emit a candidate when postcodes match. Confidence: 1.0 postcode + premise + name agreement, ~0.9 postcode + premise, ~0.75 postcode + name, ~0.6 postcode only. `matchType` reported as `exact` / `address` / `fuzzy` accordingly.
  - Delete the similarity-only branches (`stringSimilarity` over names) from candidate generation; keep the helper for the name tie-break score.
- `src/components/scheduling/CSVMatchReviewDialog.tsx`
  - Replace `candidateKey` with `selectionKey(stop, candidate)` for `selectedKeys`, `toggle`, select-all / deselect / best-match buttons, checkbox ids, and `pickupSequenceByOrderId`.
  - In `selectedJobs`, dedupe by `orderId|jobType` keeping the highest-confidence occurrence, then sort by sequence.
  - `stopKey` keeps its current postcode+premise grouping (now consistent with the matcher).
- No database, edge function, RouteBuilder or timeslot-maths changes.

## Verification

Re-upload Route_1_4.csv: Andrew Robinson appears only under stop #48 and lands at that position in Get Timeslots; the five DE65 5SN rows still group into one stop with five tickable jobs; unmatched rows are limited to addresses with no order at that postcode.
