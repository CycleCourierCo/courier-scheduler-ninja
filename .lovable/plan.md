

## Show Total Mileage Per Driver Slot

The `PredictedRouteCard` already has an `estimatedMiles` prop and renders it — it's just never passed data. The fix is to extract distance from the Geoapify response and thread it through.

### Changes

**1. `src/services/routeOptimizationService.ts`**
- Change `optimizeMultiDriverRoute` return type from `Map<number, OptimizedJob[]>` to `Map<number, { jobs: OptimizedJob[], distanceMiles: number }>`
- Extract `route.properties.distance` (meters) from each Geoapify feature, convert to miles (`/ 1609.34`), and include in the return value
- Same change for `optimizeRouteWithGeoapify` (single driver) — return `{ jobs: OptimizedJob[], distanceMiles: number }`

**2. `src/pages/AIRouting.tsx`**
- In `handleOptimizeRoute`, destructure the new return shape `{ jobs, distanceMiles }`
- Store mileage per route key in a new state: `routeMileage: Map<string, number>`
- Pass `estimatedMiles={routeMileage.get(key)}` to each `PredictedRouteCard`
- In `DayOverview`, sum mileage for all optimized routes on that day

**3. No changes needed to `PredictedRouteCard.tsx`** — it already renders `estimatedMiles` when provided.

