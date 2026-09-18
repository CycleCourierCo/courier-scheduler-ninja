# Why collected / Box My Bike jobs still appear in "Choose Jobs To Load"

## What's happening

The CSV matcher compares each route row's name and postcode against **every** active order and offers both a collection and a delivery option for each one. It never checks whether that leg is actually still outstanding. So:

- A bike that has already been collected still offers its collection as a candidate.
- A Box My Bike order still offers a delivery, even though those never have a customer delivery leg (the third party collects from the depot).
- Legs that already have a booked date still appear as fresh options.

This is why you see duplicate-looking pairs such as a 100% collection alongside a 60% address match on a job that's done.

## The fix

Filter candidates to legs that still need driving before they are offered:

- Drop collection candidates when the bike is already collected (or the order has moved past collection).
- Drop delivery candidates for Box My Bike orders and for anything already delivered or cancelled.
- Keep already-scheduled legs visible but clearly marked, rather than presented as the best match, so a genuinely re-run route can still be matched.

Result: the counts at the top ("Selected / Stops / Unmatched") reflect real outstanding work, and completed jobs stop competing with the live ones.

## Notes

- Nothing changes in the database or in how routes are saved — this is purely which options the matching screen offers.
- Northern Ireland ferry legs keep their existing handling.

## Technical details

- `src/utils/csvRouteParser.ts`: in `matchRowToOrder`, gate the sender/receiver candidate push on outstanding-leg predicates; reuse `needsCollectionLeg` / `needsDeliveryLeg` from `src/components/scheduling/heatJobPoints.ts` so one definition drives the heat maps and the CSV matcher.
- Add an `alreadyScheduled` flag on `MatchCandidate` (set when `scheduled_pickup_date` / `scheduled_delivery_date` exists) and sort those candidates last; surface a small "already booked" marker in `CSVMatchReviewDialog.tsx`.
- `getMatchStats` and `analyzeRouteViability` then operate on the reduced candidate set with no signature changes.
