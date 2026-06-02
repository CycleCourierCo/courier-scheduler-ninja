Rework the new toggle so it surfaces orders that will be collected before the selected delivery date (i.e. will be available to deliver on the selected date), and fix the label.

Current behaviour (wrong): toggle filters for orders whose `pickup_date` equals the selected date, and the label switches to "Collection on selected date".

New behaviour:
- Rename the toggle to **"Collecting before delivery date"** (static label, no swap).
- When the toggle is ON and `filterDate` is set:
  - Show **delivery jobs only** for orders that are either already collected (`order_collected === true`) OR whose `pickup_date` contains at least one date strictly before `filterDate`.
  - Hide pickup jobs entirely (they aren't relevant for "what can I deliver that day").
- When the toggle is ON but no `filterDate` is set: treat target as today's date — show deliveries whose collection is already done or scheduled before today.
- When OFF: existing behaviour, no change.

Changes:

1. `src/components/scheduling/RouteBuilder.tsx`
   - In `getJobsFromOrders`, replace the `isCollectionToday` helper with `isCollectedBeforeTarget(order)`:
     - returns true if `order_collected === true`, OR if any entry in `order.pickup_date` parses to a date strictly less than the target date (filterDate ?? today).
   - When `showCollectionToday` is true:
     - Skip pickup jobs (don't push).
     - For delivery jobs, only include when `isCollectedBeforeTarget(order)` is true (and existing date/collected filters still apply).
   - Update the Switch label to `Collecting before delivery date` (drop the conditional text).

2. `src/pages/JobScheduling.tsx`
   - Apply the same logic to `filteredOrdersForMap`: when `showCollectionToday` is true, keep an order only if it has an unscheduled delivery AND (`order_collected === true` OR `pickup_date` has a date strictly before the target). Pickup-only inclusion is dropped under this filter.

Naming: the existing state variable `showCollectionToday` is kept as-is to minimise churn; only the user-facing label changes.