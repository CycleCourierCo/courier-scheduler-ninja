# Route report email: handle several bikes at one stop

## What's wrong now
The report only reads the old single-bike fields (one brand/model) and doesn't show how many bikes are picked up or dropped at a stop. A stop with 3 bikes looks like a stop with 1, and the other bikes are missing. Separate jobs at the same address also show as unrelated rows.

## What you'll see
- Each stop shows a bike count chip, e.g. "+3 bikes" for a collection or "-2 bikes" for a delivery, next to the van's running total.
- The stop lists every bike on that job, grouped where they're the same: "2x Trek Domane — 56cm", "1x Giant TCR — M". Long lists cut off at 5 with "+N more".
- Several jobs back-to-back at the same address are grouped together under one address heading (one shared time), with each job's customer, tracking number and bikes listed underneath, so the van's running total only changes once for that address.
- Summary at the top gets "Bikes collected" and "Bikes delivered" totals.

## Technical details
- `RouteBuilder.tsx` report payload: add `bikes: [{label, quantity}]` from `getGroupedBikes(orderData)` (bikes JSONB is the source of truth, legacy fallback built in), and set `bikeQuantity` to the sum of those quantities.
- `send-route-report/index.ts`: new optional `bikes` field; render the grouped list (escape HTML); show the +/- chip; merge consecutive non-break stops with the same normalised address into one row group; add the two bike totals to the summary. Older payloads without `bikes` still work.
- Redeploy `send-route-report`.
