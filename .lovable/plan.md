## Problem

On Job Scheduling, the "Expired availability dates" toggle is AND-combined with the date picker. Selecting a specific date and turning expired on requires a job to both match the chosen date AND have every availability date in the past — almost no job satisfies both, so the 4 expired jobs that show without a date filter disappear.

## Fix

Treat "Expired availability dates" as an additive surface: a job qualifies if it passes the date filter OR all of its availability dates are expired. Apply the same OR logic in both places that filter scheduling jobs.

### `src/components/scheduling/RouteBuilder.tsx` (job list, ~lines 963–1015)

- Pickup branch: replace the current `pickupAvailable && pickupExpiredOk` gate with:
  - `passesDate = !applyFilters || !filterDate || pickupDates matches filterDate`
  - `isExpired = hasAllDatesExpired(pickupDates)`
  - Include the pickup when `(!showExpiredDatesOnly && passesDate) || (showExpiredDatesOnly && (passesDate || isExpired))`.
- Delivery branch: same restructure for `deliveryDates`, kept behind the existing `showCollectedOnly` / `passesCollectingBefore` checks so those still gate deliveries.

### `src/pages/JobScheduling.tsx` (`filteredOrdersForMap`, ~lines 145–205)

Apply the same OR rule so the cluster map matches the job list:
- `hasValidPickup = hasUnscheduledPickup && ((!showExpiredDatesOnly && pickupPassesDateFilter) || (showExpiredDatesOnly && (pickupPassesDateFilter || allDatesExpired(pickupDates))))`
- `hasValidDelivery` mirrors that, keeping the existing collected / collecting-before checks.
- Apply inside both the `showCollectionToday` branch and the default branch.

## Out of scope

- No change to other filters (collected only, inspected only, collection-today, job type).
- No change to `hasAllDatesExpired` definition or to when the expired toggle is shown.
- No data, edge function, or styling changes.
