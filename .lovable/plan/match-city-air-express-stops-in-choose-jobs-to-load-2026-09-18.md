# Match City Air Express stops in "Choose Jobs To Load"

## What's wrong

When a route file contains the ferry hand-off stop (City Air Express, Unit 1 Ordinal Street, Manchester M17 1GB), the job selector shows it as "Not Found" — even when several Northern Ireland jobs on the route belong there.

Confirmed cause: the matcher only ever compares a route row to the customer's own name and postcode (sender for collections, receiver for deliveries). For Northern Ireland jobs the driver's actual stop is the ferry hand-off point, not the customer, so nothing matches and no jobs are offered for that row.

## Change

Teach the matcher about the ferry hand-off stop:

- For inbound Northern Ireland orders (bike comes from NI), the **collection** leg can match a City Air Express row.
- For outbound Northern Ireland orders (bike goes to NI), the **delivery** leg can match a City Air Express row.
- Matching on that row uses the hand-off name ("City Air Express" / "Ferry hand-off") and its M17 1GB postcode, instead of the customer's details.
- Normal (non-NI) jobs are unaffected; a City Air row will never pull in an ordinary customer job, and an ordinary customer row will never pull in a ferry job.

Because one City Air stop can legitimately cover many bikes, the stop lists every eligible Northern Ireland job with a tick box, showing the customer name and tracking number on each so the planner can see which bike is which. Only as many as the route file has rows for that stop are pre-ticked; the rest are listed unticked.

The existing filters still apply: already-collected collections, cancelled/completed legs and Box My Bike deliveries are not offered, and legs that already have a booked date sort last with the "Already booked" badge.

## Technical notes

- `src/utils/csvRouteParser.ts`: in `matchRowToOrder`, resolve the leg's real stop via `getLegContact(order, type)` (or `isFerryLeg` + `CITY_AIR_EXPRESS`) from `@/utils/niDelivery`, and score name/postcode against that resolved contact rather than raw `order.sender` / `order.receiver`. Keep the existing `needsCollectionLeg` / `needsDeliveryLeg` gating and `alreadyScheduled` flags.
- `src/components/scheduling/CSVMatchReviewDialog.tsx`: display the leg contact via the same NI-aware helper so ferry candidates read as "City Air Express — <customer> <tracking>"; keep grouping, per-stop claim cap and default selection logic as they are.
- No database, query or edge function changes.
- Verify with `bun run build`.
