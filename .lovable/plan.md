## Goal

Replace the straight geodesic polylines on the dispatch map with **road-following** polylines for each saved route.

## Approach

Currently `DispatchRoutesPage.tsx` draws each saved route as a `google.maps.Polyline` between depot → stops → depot using raw lat/lng points and `geodesic: true` — that's why it shows as straight lines.

To make it follow roads we need the actual driving path geometry. Cleanest option: ask Google's **Routes API** for the route geometry (encoded polyline) once per saved route, decode it, and draw that.

### 1. New edge function `route-path`
- Input: `{ origin: {lat,lon}, stops: [{lat,lon}], destination: {lat,lon} }` (destination = depot for return-to-depot routes).
- Calls `routes/directions/v2:computeRoutes` through the existing Google Maps connector gateway with:
  - `travelMode: DRIVE`
  - `routingPreference: TRAFFIC_AWARE`
  - `intermediates` = ordered stops
  - field mask: `routes.polyline.encodedPolyline,routes.distanceMeters,routes.duration`
- Returns `{ encodedPolyline, distance_m, duration_s }`.
- Same auth pattern as `optimise-route` (uses `LOVABLE_API_KEY` + `GOOGLE_MAPS_API_KEY`). Since the user has now fixed the Routes API permission, this will work.

### 2. Update `DispatchRoutesPage.tsx`
- In the saved-routes `useEffect`, for each visible route:
  - Build the ordered point list: depot → stops (by `sequence`) → depot.
  - Call the new `route-path` edge function once per route (cache by `route_id` so we don't re-fetch on every toggle).
  - Decode the returned `encodedPolyline` using `google.maps.geometry.encoding.decodePath(...)` (the `geometry` library is already loaded by `useGoogleMaps`).
  - Render the `Polyline` using the decoded path, **remove** `geodesic: true`, keep the per-route `strokeColor` and z-index.
- Keep depot marker + stop markers as they are now.
- Fit bounds to include the decoded polyline path.

### 3. Fallback
- If the edge function fails (e.g. transient Routes API error), fall back to the current straight-line rendering so the map still shows something, and log the failure.

## Out of scope
- No changes to `optimise-route` or the optimisation flow itself — sequencing logic stays put.
- No DB schema changes. (We *could* persist `encoded_polyline` on `dispatch_routes` later to avoid refetching, but skipping for now to keep the change small.)

## Technical details
- Files touched:
  - **new** `supabase/functions/route-path/index.ts`
  - `src/pages/DispatchRoutesPage.tsx`
- Routes API endpoint (via gateway): `POST https://connector-gateway.lovable.dev/google_maps/routes/directions/v2:computeRoutes`
- Decoder: `google.maps.geometry.encoding.decodePath(encoded)` → `LatLng[]` fed straight into `new google.maps.Polyline({ path, ... })`.
