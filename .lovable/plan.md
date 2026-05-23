## Goal
Make `/dispatch/routes` show all eligible jobs for the chosen date, let planners filter by sender/receiver availability, and allow selected jobs to either create a new route or be added to an existing route.

## Plan
1. **Rebuild the page around a unified job dataset**
   - Derive map pins and sidebar rows from a single `jobs` list instead of only from `scheduled_pickup_date` / `scheduled_delivery_date`.
   - Treat each pickup and delivery as its own selectable job.
   - Include jobs when the chosen date matches:
     - `scheduled_pickup_date` / `scheduled_delivery_date`, or
     - `pickup_date` / `delivery_date` availability arrays.
   - Exclude completed legs (`order_collected` for pickup, `order_delivered` for delivery) and legs already assigned to a route for that day.

2. **Make the list and map show the same jobs**
   - Render the sidebar from the same filtered job collection used for markers.
   - Show a proper jobs count, selected count, and clear empty states:
     - no matching availability
     - already routed
     - missing coordinates
   - Keep selection in sync between row clicks, pin clicks, and box/lasso selection.

3. **Fix lasso/box selection to operate on jobs reliably**
   - Keep the current drag-selection approach, but wire it against the unified jobs/markers model so selected jobs are always reflected in the sidebar.
   - Preserve replace vs add-to-selection behavior.
   - Make “lasso into a route” mean: select jobs on the map, then send that exact selected set into the route action.

4. **Add route destination actions**
   - Keep **Create new route** using the current save flow.
   - Add **Add to existing route** with a route picker for the chosen date.
   - When adding to an existing route, append new jobs after the current last sequence and avoid duplicate stop insertion.

5. **Validate against live data patterns already in the app**
   - Align date matching with the logic already used in the scheduling/RouteBuilder flow.
   - Verify today’s database shape is handled correctly: most eligible jobs are coming from `pickup_date` / `delivery_date` availability arrays, not only scheduled timestamps.
   - Confirm no database migration is needed.

## Technical details
- **Primary file:** `src/pages/DispatchRoutesPage.tsx`
- **Data model change:** create a derived `DispatchJob[]` structure with fields like `key`, `orderId`, `type`, `dateMatchedBy`, `lat`, `lon`, `label`, `address`, `isAssigned`, `isComplete`.
- **Date matching rules:**
  - pickup job matches selected date if `scheduled_pickup_date` is that date, or if unscheduled and `pickup_date` contains that date.
  - delivery job matches selected date if `scheduled_delivery_date` is that date, or if unscheduled and `delivery_date` contains that date.
- **Assignment actions:**
  - new route → insert into `dispatch_routes`, then insert ordered rows into `dispatch_route_stops`
  - existing route → fetch current max sequence, append only non-duplicate `(order_id, stop_type)` rows
- **No schema changes planned.**