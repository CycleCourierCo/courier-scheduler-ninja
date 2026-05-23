## Why reoptimise isn't working

In `routesForDate` (line 318-321), the `dispatch_route_stops` select omits the row `id`:

```
.select("route_id, order_id, stop_type, sequence, address, lat, lon")
```

So every stop arrives with `s.id === undefined`. In `handleReoptimiseRoute` (line 233) we build the optimise payload as `{ id: s.id, lat, lon }`, the edge function echoes back `stop_id: undefined`, and the subsequent `dispatch_route_stops.update().eq("id", undefined)` updates nothing. The user sees no error and no change.

## Fix

1. **`src/pages/DispatchRoutesPage.tsx` — line 319**: add `id` to the select:
   ```
   .select("id, route_id, order_id, stop_type, sequence, address, lat, lon")
   ```
   That alone makes reoptimise work end-to-end (payload has real stop ids → updates hit the right rows → query invalidation re-renders with the new sequence and totals).

2. **Show return-to-depot time** in the stop list. The `route-path` edge function already returns one extra leg (depot → last stop is `legs[stopCount-1]`, last stop → depot is `legs[stopCount]`). In the render block around line 1025:
   - After the loop, compute `depotEta` from the running `cur` time: add `legs[stopCount]` seconds (no service time, no rounding needed beyond the same 5-min rounding for consistency).
   - Render it on the existing "Depot · B10 0AD" footer line, e.g. `{stopCount + 1}. Depot · B10 0AD · {depotEta}`.
   - To make `depotEta` available outside the loop, lift the ETA computation to also return a `depotEta` string alongside `etaBySeq`, or just compute it inline in the same block.

## Out of scope

- No edge function changes (`route-path` already returns the final leg).
- No DB schema or RLS changes.
- No other UI changes.
