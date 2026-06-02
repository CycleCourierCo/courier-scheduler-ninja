Add a "Collection today" filter toggle to the Job Scheduling page alongside the existing "Collected (ready to deliver)" toggle.

Problem: The page currently has a filter to show only bikes already collected. Schedulers also need to find bikes that are due to be collected today (or on the selected date) so they can plan tomorrow's deliveries.

Changes:

1. `src/pages/JobScheduling.tsx`
   - Add new lifted state: `showCollectionToday` (boolean, default false).
   - Pass `showCollectionToday` and `onShowCollectionTodayChange` down to `RouteBuilder`.
   - Update `filteredOrdersForMap` (the ClusterMap filter) so that when the toggle is on, an order is kept only if its `pickup_date` includes today (or the selected `filterDate`) AND `order_collected !== true`.

2. `src/components/scheduling/RouteBuilder.tsx`
   - Extend `RouteBuilderProps` with `showCollectionToday?: boolean` and `onShowCollectionTodayChange?: (value: boolean) => void`.
   - Add internal state fallback (`internalShowCollectionToday`) and wire the handler pattern exactly like `handleShowCollectedOnlyChange`.
   - Update `getJobsFromOrders`:
     - Introduce a helper `isCollectionToday(order)` that checks whether the order's `pickup_date` array contains the target date (`filterDate` if set, otherwise today's date) and the order is not yet collected.
     - When `showCollectionToday` is true, only keep pickup jobs and delivery jobs that satisfy `isCollectionToday(order)`.
   - Add a new `<Switch>` in the Filter Section UI, placed right after the existing "Collected (ready to deliver)" toggle, labeled "Collection today".
   - Update `hasActiveFilters` to include `showCollectionToday` so the results badge behaves correctly.

Filter behaviour:
- Off (default): no extra restriction; behaves exactly as before.
- On: restricts visible jobs to orders whose `pickup_date` includes the chosen calendar date (or today's date when no calendar date is picked) and which are not yet marked as collected (`order_collected !== true`).
- This applies to both pickup jobs (so drivers can see today's collections) and delivery jobs (so schedulers can spot bikes that will be collected today and could be delivered tomorrow).