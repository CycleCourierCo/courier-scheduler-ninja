

## Add Map to Fuel Finder Results

### What
Add an interactive Leaflet map above the station list showing each station as a marker. Each marker popup displays the station name, brand, diesel price, and distance.

### How

**File: `src/pages/FuelFinderPage.tsx`**

1. Import `MapContainer`, `TileLayer`, `Marker`, `Popup` from `react-leaflet`, plus `L` from `leaflet` and the leaflet CSS.
2. Reuse the existing `fixLeafletIcon()` pattern from `JobMap.tsx` to fix default marker icons.
3. Create custom colored markers: green for cheapest station, default blue for others.
4. Add a map section between the "all stations more expensive" warning and the results list, rendered only when `sortedStations.length > 0`.
5. Map centers on the average lat/lng of all stations, with zoom ~12.
6. Each marker popup shows: brand, name, price (bold, green if cheapest), distance, and last updated time.

### Technical Details
- Stations already have lat/lng from the edge function (`location.latitude`/`location.longitude`) — these are returned but not currently exposed in the `FuelStation` interface. Will add `latitude` and `longitude` fields to the interface.
- If the edge function doesn't currently return coordinates, will update it to include them in the response.
- Map height: ~300px on mobile (360px viewport), responsive.
- Uses OpenStreetMap tiles (same as existing maps in the project).

### Files
- `src/pages/FuelFinderPage.tsx` — add map component, update FuelStation interface
- `supabase/functions/fuel-finder/index.ts` — ensure lat/lng are included in station response (if not already)

