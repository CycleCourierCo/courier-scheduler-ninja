One adjustment to the Job Scheduling filters: stop hiding pickup jobs when the "Collecting before delivery date" toggle is ON.

## Change

When this toggle is ON, pickup jobs are currently removed from both the map and Route Builder. Change it so pickup jobs continue to show as long as they pass the normal date filter (a pickup that is possible on the selected date stays visible). The delivery-side rule is unchanged: deliveries only appear if the order is already collected OR has a `pickup_date` strictly before the target date.

## Files

- `src/pages/JobScheduling.tsx`
  - In the `showCollectionToday` branch of `filteredOrdersForMap`, drop the "hide pickups" behaviour. Evaluate pickup eligibility using the same rules as the default branch and return true if either the pickup OR the (existing rule) delivery qualifies.

- `src/components/scheduling/RouteBuilder.tsx`
  - In `getJobsFromOrders`, remove the branch that skips pickup jobs when `showCollectionToday` is true. Pickups go through normal date/collected filtering. Delivery filtering via `isCollectedBeforeTarget` is unchanged.

No DB, edge function, email, label, or new-toggle changes.
