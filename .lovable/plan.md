# Keep multi-stop addresses together when re-optimising

## What I found in the "nw" route saved today
- **City Air Express (Ferry hand-off, Trafford Park)** has two jobs at the exact same spot, a collection and a drop-off. Re-optimise put them at stops 4 and 9, so the van would go back there twice.
- **Tom Lambe** has three jobs at the same address (two collections, one delivery). They are stops 10–12 in a row, but they're only together by luck, because nothing keeps them together.
- **William Taylor (Bowgreave, Lancashire)** is saved with map coordinates in Kent. This pulls the optimiser's route far south (the line running off the bottom of your map), and the route times are wrong because of it.

The cause: Re-optimise sends every job as its own stop, so jobs at the same address can be split up.

## The fix
- Before optimising, jobs at the same address are merged into one visit, with every bike collected and dropped off there counted together. Afterwards they're put back as separate jobs, always side by side, in the order you had them. This is the normal multi-stop grouping.
- Before optimising, any stop whose postcode doesn't match its coordinates (for example, a Lancashire postcode pinned in Kent) is flagged. The route stays as it is, and you're asked to fix that stop's location first.
- No change to the saved "nw" route itself. Once William Taylor's location is fixed, you can press Re-optimise again on it.

## Technical details
- `route-optimize` reorder mode: group stops by rounded coordinates (5 decimal places) into one VROOM job, with `pickup` = the sum of collection spaces and `delivery` = the sum of delivery spaces. If a group holds both legs of one order, keep that order's legs in the group (it's the same place, so it's handled in one visit), and use a VROOM shipment only when the two legs are at different places. Service time is 15 min plus 5 min for each extra job. Map each group id back to its keys in their original order.
- Frontend `handleReoptimise`: before calling, geocode-check each stop by comparing the postcode's area to its coordinates using the existing postcode lookup. Stop with a named error if a stop is more than 50 km from its postcode.
- Redeploy `route-optimize`.
