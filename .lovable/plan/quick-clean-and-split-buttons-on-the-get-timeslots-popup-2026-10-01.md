# Quick-clean and Split buttons on the Get Timeslots popup

Four new buttons in a row above the stop list (both the wide and the smaller popup). Each one shows how many stops it would affect, e.g. "Remove not collected (6)". A button is greyed out when its count is 0. After removing stops, the timeslots are worked out again, and **Undo** on the message puts them back.

## 1. Remove not collected
- Removes **deliveries** where the bike hasn't been collected yet.
- Collections are never removed by this button.

## 2. Remove not inspected
- Removes **deliveries** of bikes that need an inspection that isn't finished yet (the same "inspected or repaired" check the popup already uses for its badge).
- **Collections are never removed**, even if the bike will need an inspection.

## 3. Remove not customer dates
- Removes stops that show the yellow **Not Customer Date** badge for the route date.
- Stops marked **Dates Expired** stay, and so do stops marked **No Dates Provided**.

## 4. Split route
- Click **Split route**, enter how many routes you want (2 or more, no more than the number of stops) and press Split.
- The route optimiser shares the stops out between that many vans. It aims for the lowest total cost and time (miles plus driver hours, using the same costs as Get Timeslots). Each route starts and ends at the depot.
- It keeps the rules Re-optimise already uses: a collection comes before its delivery, and stops at the same address stay together on one route.
- The result opens in a preview with one card per route: stop count, time, miles and cost, plus the total saved compared with one route.
- For each card you can **Load into builder** (replaces the current route, then works out the timeslots) or **Save route** (saves it under a name such as "nw – 1 of 3").
- If some stops can't be placed, they're listed by name and nothing changes.

## Technical details
- `RouteBuilder.tsx`: memoise `notCollectedDeliveries` (type delivery and `!order_collected`), `uninspectedDeliveries` (delivery, `needs_inspection`, status not inspected/repaired), and `notCustomerDate` (reuse the availability badge helper, keeping only `text === 'Not Customer Date'`). Breaks are never counted. Each remove action filters `selectedJobs`, stores the previous array for Undo, then calls `calculateTimeslots`. Add `SplitRouteDialog` for the number input and the result cards.
- `route-optimize`: new `mode: "split"` with input `{ date, shift_start, routes: N, stops[] }`. It builds N identical vehicles (no capacity or hour limits, matching reorder), shipments for pickup+delivery pairs and same-location clustering, and `options.g`. Vehicle cost uses `COST_PER_MILE` / `DRIVER_HOURLY_RATE` equivalents, so VROOM weighs distance against time. The fixed vehicle cost is set to 0 so all N vans get used. It returns `{ routes: [{ order, duration_s, distance_m }], unassigned, baseline }`. Input validated with Zod; no personal details logged.
- Saving uses the existing `saved_routes` insert. No database changes.
