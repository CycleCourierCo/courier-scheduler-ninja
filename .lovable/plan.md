# Treat "Ship as-is" as inspected in Job Scheduling and Route Builder

## What

A bike whose repairs were declined by both the seller and receiver ends in the **Ship as-is** state. That state already clears it for delivery everywhere else (delivery gate, boxing/foaming, availability), but the two scheduling screens only count "inspected" and "repaired" as done. With the "inspected only" filter on, a ship-as-is bike's delivery leg disappears from Job Scheduling and Route Builder as if it still needed workshop time.

## Changes

1. **Job Scheduling** — include ship-as-is in the inspection-complete check, so the "inspected only" filter no longer hides its delivery leg.
2. **Route Builder** — same fix in the three places it decides whether an inspection is complete (the delivery gate check and the two filter/badge paths), so a ship-as-is bike can be placed on a route like any other finished inspection.

No database changes. No changes to what "inspected" means for bikes still in the workshop — pending, issues found, in repair, and awaiting approvals still block delivery exactly as they do today.

## Technical details

- `src/pages/JobScheduling.tsx` line ~174: `isInspectionComplete = inspection_status === 'inspected' || 'repaired'` → add `|| 'ship_as_is'`. Also widen the local `inspection_status` type (line ~43) to include `'ship_as_is'`.
- `src/components/scheduling/RouteBuilder.tsx`: same addition at line ~374 (inspection-complete helper), ~1397 (filter predicate), and ~3329 (per-job badge/complete check).
- `src/utils/servicingGate.ts` already returns true for `ship_as_is` (`canDeliver`), so the delivery-side gate needs no change — this aligns scheduling with it.

## Verify

- Typecheck passes.
- An order at `ship_as_is` with a delivery date now appears in Job Scheduling's delivery list with "inspected only" enabled, and can be added to a route in Route Builder.
- Orders at `issues_found` / `in_repair` still do not appear under the same filter.
