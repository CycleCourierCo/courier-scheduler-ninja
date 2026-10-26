# Snap the driven line to roads

## Why it looks different now
The planned route is drawn along roads by Google. The driven line uses the van's tracker positions, which are saved every 2 minutes and joined with straight lines, so it cuts across fields and corners.

## What changes
- On the Live Map, the solid driven line follows the roads the van most likely used between its tracker points.
- Off-route and visited-stop checks still use the real tracker points, so what gets flagged as a deviation stays the same. Only the drawing changes.
- If road-snapping fails or isn't available, the map shows the current straight-line version so the line never goes missing.
- Snapped lines are saved, so viewing the same day again doesn't cost extra. Today's line only re-snaps the new points.

## Technical details
- New `snap-path` Edge Function (admin/fleet_manager JWT check): it reads `fleet_position_history` for a vehicle and date, calls the Google Roads API `snapToRoads` with `interpolate=true` in batches of 100 points with a one-point overlap, and returns the polyline. It reuses the existing Google Maps key.
- Results are cached in a new service-role-only table, `fleet_snapped_paths`, keyed by vehicle, date and last point time. Only the points recorded after the cache are snapped.
- In `RouteOverlay.tsx`, the solid line is drawn from the snapped polyline, falling back to the raw points. `pathMiles` and the deviation checks keep using the raw points.
- One test checks the batching and overlap rule.
- Prerequisite: the Roads API must be enabled on the Google Cloud key. If it's off, the map keeps the straight lines and shows a short note.

# Tracking in the stop pop-up

## What changes
- When you tap a stop marker, its pop-up shows the live ETA and miles, plus **Copy tracking link** and **Send** buttons. These open the existing Send ETA link window for that stop.
- Stops that are already collected or delivered show their tick and status instead, with no link buttons.
- If the van has no fresh position, the pop-up says "Van position unavailable" and the buttons are greyed out.

## Technical details
- The Leaflet `Popup` in `RouteOverlay.tsx` reads `etas` (already passed in), and a new `onSendStop(target)` callback from `LiveMap.tsx` opens `SendEtaLinkDialog` with the stop target. This reuses the "Stops & live ETAs" logic.
- Task added to roadmap.md during build.
