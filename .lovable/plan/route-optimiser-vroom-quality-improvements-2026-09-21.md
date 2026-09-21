# Route Optimiser — VROOM Quality Improvements

The current integration is structurally correct (capacity model, priorities, time windows, day chaining). This plan closes the remaining quality gaps so the solver produces the best routes it reasonably can.

## Changes — all inside `supabase/functions/route-optimize/index.ts`

1. **Raise solver exploration level**
   - Send `options: { g: true, x: 5 }` (max exploration) if the Verso endpoint supports it; verify against the Verso docs and fall back gracefully if the parameter is rejected.
   - Expected cost: a few extra seconds per solve; benefit: shorter total mileage and better stop ordering on busy days.

2. **Log solution quality**
   - Capture `solution.summary` (cost, routes used, unassigned count) plus solve time in the function log per day.
   - Include `unassigned_today` per day in the API response (field already exists in the frontend type — currently unpopulated).

3. **Workload balancing between vans**
   - Add `max_travel_time` per vehicle (derived from the 12h/15h caps minus service time) so no van can be silently over-loaded relative to others.
   - Keep expedition vehicles' higher fixed cost so they're only used for difficult-area days.

4. **Per-day context in logs**
   - Log date, pool size, vehicles offered, routes returned, unassigned keys — no PII, per existing edge-function logging rules.

## What stays unchanged

- Sequential day-by-day solving with carry-forward (correct for a multi-day horizon; VROOM is single-day by design).
- Collection-before-delivery day separation (matches the depot-based business model; inspection jobs need the overnight gap anyway).
- Guaranteed-date hard pinning, difficult-area expedition skills, business-hours time windows, locked-route exclusion.
- Frontend (`GenerateRoutesDialog`) — no changes needed; it already reads `unassigned_today` if present.

## Verification

- Redeploy `route-optimize` and confirm unauthenticated requests still return 401.
- Run one real generation from Job Scheduling on a normal weekday; check the function log shows summary stats and the dialog renders routes/at-risk jobs as before.
- Confirm mileage/route count is equal or better than a previous comparable day.
