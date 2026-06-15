## Goal

Two filter bugs on `/scheduling`:

1. **Expired availability dates** still collapses the list to 0 instead of being additive (e.g. 108 jobs on 16th + 4 expired = 112).
2. **Inspected only** + a selected date drops the list to 0. It should keep showing every pickup, and every delivery that doesn't require inspection. Only deliveries whose order `needs_inspection === true` AND whose `inspection_status` is not yet `inspected` / `repaired` should be hidden.

## Changes

### `src/components/scheduling/RouteBuilder.tsx` — `getJobsFromOrders`

- Remove the early `return` for `showInspectedOnly` at the top of the `orderList.forEach`. Pickups must never be affected by this toggle.
- Compute once per order:
  - `needsInspection = order.needs_inspection === true`
  - `isInspectionComplete = order.inspection_status === 'inspected' || order.inspection_status === 'repaired'`
  - `passesInspected = !applyFilters || !showInspectedOnly || !needsInspection || isInspectionComplete`
- AND `passesInspected` into the delivery branch alongside `passesCollectedOnly`, `passesCollectingBefore`, and the date/expired visibility.
- Replace the nested ternary expired logic with explicit named booleans so the additive rule is unambiguous:

```text
pickupBaseVisible    = !applyFilters || pickupMatchesDate
pickupExpiredVisible = applyFilters && showExpiredDatesOnly && pickupIsExpired
pickupVisible        = pickupBaseVisible || pickupExpiredVisible

deliveryBaseVisible    = !applyFilters || deliveryMatchesDate
deliveryExpiredVisible = applyFilters && showExpiredDatesOnly && deliveryIsExpired
deliveryDateVisible    = deliveryBaseVisible || deliveryExpiredVisible
deliveryVisible        = deliveryDateVisible
                         && passesCollectedOnly
                         && passesCollectingBefore
                         && passesInspected
```

- Add a one-shot `console.debug` (gated by `import.meta.env.DEV`) after `availableJobs` is built, logging `{ filterDate, showExpiredDatesOnly, showInspectedOnly, total: availableJobs.length }` so the next reproduction confirms the toggle is flipping the count.

### `src/pages/JobScheduling.tsx` — `filteredOrdersForMap`

Mirror the same rules so the map stays in sync with the list:

- Remove the blanket `if (showInspectedOnly && !isInspected) return false;` early exit.
- Compute `needsInspection` and `isInspectionComplete` from the order, then `passesInspected = !showInspectedOnly || !needsInspection || isInspectionComplete`.
- AND `passesInspected` into `hasValidDelivery` in both branches (the `showCollectionToday` branch and the default branch). Pickups remain unaffected.
- Replace the nested ternary `pickupVisibleByDate` / `deliveryVisibleByDate` with the same explicit `base || expired` form used in RouteBuilder, in both branches.

## Out of scope

- No DB, query, or RLS changes.
- No UI layout, copy, or new toggles.
- Selected route, Shipday verification, CSV import, and timeslip logic untouched.

## Expected behavior after fix

- Filter to 16th → 108 jobs. Toggle Expired on → 112 (108 + 4 expired). Off → 108.
- Filter to 16th → 108 jobs. Toggle Inspected only on → all 108 pickups still show; deliveries that don't require inspection still show; only deliveries whose order needs inspection and isn't yet complete are hidden.
