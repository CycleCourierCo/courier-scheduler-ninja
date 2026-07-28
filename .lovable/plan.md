# Northern Ireland deliveries + foam markers on Job Scheduling

Two confirmed problems:

1. **Scheduling still shows the NI customer address.** In `src/components/scheduling/RouteBuilder.tsx` (~line 1082) the delivery job is built straight from `order.receiver.address` — there is no NI check, so the drawer, map, distances and optimisation all use the Northern Ireland address (hence the 661 mi / 24h 50m route in the screenshot). Shipday was fixed earlier, but the planner UI was not.
2. **Foam badges never render.** `SchedulingCard.tsx` reads `firstOrder.isNorthernIreland` / `firstOrder.foamStatus` (camelCase). The Job Scheduling page query in `src/pages/JobScheduling.tsx` returns raw database rows (`is_northern_ireland`, `foam_status`), so those properties are always `undefined`. RouteBuilder job cards and the timeslot drawer have no foam badge at all.

## What will change

### 1. Central NI delivery override
Add City Air Express coordinates (M17 1GB) to `src/constants/depot.ts` and a small shared helper that, given an order, returns the effective delivery destination:
- If `is_northern_ireland` (or the receiver postcode is a BT postcode via the existing `isNorthernIrelandAddress`), return the City Air Express name, address, phone and coordinates.
- Otherwise return the receiver's own details.

Apply it in the delivery job builder in `RouteBuilder.tsx` so `address`, `contactName`, `phoneNumber`, `lat`, `lon` all point at Manchester. Everything downstream — the timeslot drawer, route optimisation, flip route, distance/ETA summary and the SendZen/bulk message address text — then uses the correct stop automatically. The same override is applied in `JobMap.tsx` and `ClusterMap` so the map pin sits in Manchester.

The NI customer's real address and name stay visible as secondary context on the job card (labelled "Final destination: …") so the planner knows where the bike ultimately goes.

### 2. Foam markers
- Add a small reusable badge component: green **"Bike foamed"** for `foamed_ready` / `delivered_to_ferry` / `delivered_ni`, red **"Pending foaming"** otherwise — shown only when the order is NI and the leg is a delivery.
- Render it on: the Job Scheduling job list card, the RouteBuilder stop card (both grouped and single-stop layouts), and the Route Timeslots drawer stop rows.
- Fix the data mismatch: the badge logic reads the raw snake_case fields (`is_northern_ireland`, `foam_status`) that the scheduling query actually returns, and `SchedulingCard.tsx` is corrected to use the same source rather than the missing camelCase props.

## Technical notes
- City Air Express coords: approx. `53.4718, -2.2960` (Unit 1 Ordinal Street, Trafford Park, M17 1GB) — these will be geocoded once and hardcoded in the constant so route optimisation is deterministic.
- No database migration and no edge function changes; this is presentation/route-building only.
- Existing NI orders (e.g. `CCC754877137960COLBT4`) will immediately show the Manchester stop and a foam badge without any data repair.
