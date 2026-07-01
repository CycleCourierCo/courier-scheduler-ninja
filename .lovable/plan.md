## Goal
On the scheduling page's "Get Timeslot" dialog (after route optimization), show the driver's return-to-depot time and a route summary underneath the stops.

## Changes

### 1. `src/services/routeOptimizationService.ts`
Extend `optimizeRouteWithGeoapify` return value with route-level metadata pulled from the Geoapify response:
- `endArrivalTime` — parsed from the `end` step's `arrival_time` (formatted `HH:mm`).
- `totalDurationMinutes` — from `route.properties.time` (seconds → minutes).
- `distanceMiles` — already present, keep as-is.
- (Also mirror the same additions on `optimizeMultiDriverRoute` for consistency, since it uses the same shape.)

### 2. `src/components/scheduling/MultiJobTimeslotDialog.tsx`
- Store the new fields alongside `optimizedJobs` (add `routeMeta` state: `{ endArrivalTime, totalDurationMinutes, distanceMiles }`).
- After the Deliveries list, render:
  - **End of route card**: "Return to Depot — Lawden Road, B10 0AD" with the `endArrivalTime` badge (styled like the stop cards but neutral/muted).
  - **Route Summary card** with four stats:
    - Stops: `displayJobs.length`
    - Orders: unique `orderId` count across `displayJobs`
    - Total Distance: `distanceMiles.toFixed(1)` mi
    - Route Length: hours + minutes from `totalDurationMinutes`
- No change to send/save logic.

### Notes
- Depot address pulled from existing `@/constants/depot` (`DEPOT_LOCATION.address`).
- Purely presentational; no DB or edge-function changes.
