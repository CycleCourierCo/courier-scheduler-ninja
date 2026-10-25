# Live map: planned routes on real roads + today's missing routes

## 1. Draw planned routes along the roads
The app already uses **Google Maps (Routes API)** for road routes — it's what the scheduling route map uses through the `route-path` function. The live map will use the same thing.

- For each van on the chosen date, send its stops (in order) to `route-path` and draw the returned road line instead of straight lines.
- Long days (over 25 stops) are split into chunks and joined, like the Route Builder does.
- Results are cached per route for the day so changing the van filter or refreshing doesn't call Google again.
- If Google fails, fall back to the straight dashed line with a small "road route unavailable" note.
- Off-route checks then measure against the road line, so motorway stretches no longer look like deviations. Planned miles become real road miles.

## 2. Why today's 2 routes don't show
The map only reads **saved route sheets (timeslips)** for the date. The newest saved ones are for **22 Oct** — there are none for 23, 24 or 25 Oct. So today's two routes haven't been saved as timeslips yet (they may only exist in the Route Builder / scheduling screen or Shipday).

Fix:
- Show a clear message when a date has no saved routes: "No saved routes for this date — save them in Timeslips to see them here."
- Once today's routes are saved as timeslips (with a van chosen), they appear straight away.

If today's routes are kept somewhere other than timeslips, tell me where and I'll read them from there instead.

## Technical details
- `RouteOverlay.tsx`: new `useRoadPaths(routes)` hook calling `supabase.functions.invoke("route-path", { origin, stops, destination })` per timeslip, decoding the encoded polyline (reuse the decoder in `TimeslotRouteMap.tsx`), React Query cache keyed by timeslip id + stop hash, `staleTime` 1 day.
- `route-path` already requires sign-in; chunk ≤25 intermediates per request.
- `routeDeviation.ts`: `distanceToRoute` / `pathMiles` take the decoded road polyline when present; existing tests kept, one new test that a point on the road line is not off-route.
- Empty-state message in `LiveMap.tsx` when `fleet_route_day` returns no rows.
