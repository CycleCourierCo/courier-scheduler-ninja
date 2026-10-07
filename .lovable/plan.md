# London routes, same-day collect & deliver, and guarantee types

## 1. London mixed with other areas
Your screenshot shows one van doing central London and then Essex/Southend and Kent (Margate area). London jobs are meant to go only to the London van, but the jobs *around* London (Essex, Kent, Surrey) aren't in the drawn London area, so an ordinary van can take some London-adjacent work and the London van can pick up "on the way" jobs. I haven't yet confirmed which rule let this route through, so the first step is to check that day's saved plan.

Fix:
- **Check first:** look at the saved plan behind the screenshot to see if the blue van was the London van, the long-day van, or a van taking a guaranteed job (guaranteed jobs currently skip the area rules).
- **Strict London van:** besides London work, the London van can only take jobs on the way between the depot and London (within 12 miles of the line), never past London (Essex, Kent, Sussex).
- **No London for others:** ordinary vans, the long-day van and guaranteed-job vans can't take London jobs. A guaranteed London job always goes on the London van.
- **Warning:** if a finished route still has London stops plus stops more than 12 miles off the corridor, its card shows "London + other area". It also gets one more planning attempt to fix it.

## 2. Same-day collect & deliver (e.g. CCC754179428418JOHSW1)
That job runs from Newport Pagnell (MK16) to London SW10, guaranteed for 8 Oct, and hasn't been collected. Newport Pagnell sits close to the depot-to-London line, so yes: the London van can collect it on the way down and deliver it the same day. Today the planner only plans a delivery once the bike is collected or the collection is on an *earlier* day, so this can't happen.

Fix:
- If both the collection and delivery customer dates include the same day, and no inspection is needed, the planner can put both on one van that day, with the collection first.
- This applies to London-van jobs collected on the corridor, and to any job where both ends are in the same area.
- Route cards show "Collect & deliver same day" on those stops.

## 3. Choose what's guaranteed: collection, delivery, or both
Today only a guaranteed **delivery** date exists. The collection is just forced early enough to make it.

Add a guarantee type on the order's guaranteed-date settings:
- **Delivery** (what you have now): delivered on date X.
- **Collection:** collected on date X. The delivery is planned normally afterwards.
- **Both:** collected on date X and delivered on date Y, where Y is the same day as X or later.

The planner treats each guaranteed leg as must-go on its date. The Guaranteed panel, order page and route badges show which leg is guaranteed. The existing charge/invoice stays the same.

## Technical detail
- `route-optimize/index.ts`: in `buildJob`, the guaranteed-job branch keeps the London skill for London legs. In `isCorridorLeg`, require a minimum distance from London as well (t≤1 already). Add a post-solve check for London plus off-corridor stops with one re-solve, and `london_mixed` in debug. Add same-day pairing as VROOM `shipments` when both legs are eligible on the date (a London leg uses the London skill on both). Forced placement reads the new guarantee fields.
- Migration: on `orders`, add `guaranteed_type text default 'delivery'` (delivery|collection|both) and `guaranteed_collection_date date`. Existing rows default to delivery.
- UI: add a type selector and collection date to the guaranteed-delivery controls on the order page. Update GuaranteedDatePanel and the GenerateRoutesDialog badges, plus `routeGenerationService` types.
- Deploy `route-optimize`, then use read-only checks on the next run.
