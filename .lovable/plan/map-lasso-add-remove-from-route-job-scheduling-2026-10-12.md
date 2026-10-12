# Map lasso + add/remove from route (Job Scheduling)

## What you'll get
1. **Click a pin → Add / Remove**: each job pin's popup gets an "Add to route" button, or "Remove from route" if it's already in the route below. The route re-times like adding from the nearby-jobs map.
2. **Lasso tool**: a "Lasso" button on the map. Turn it on, drag a freehand loop around pins, and a bar appears: "12 jobs selected — Add to route / Remove from route / Clear". Map panning is paused while lassoing; turning Lasso off restores it. Respects the current All / Collections / Deliveries filter.
3. **Pins already in the route look different** (thick dark outline), so you can see what's in the route at a glance.

Applies to the Clusters map view (both with and without K-means clusters). Job age and Viable on date are heat maps with no pins, so they stay as they are.

## Technical details
- `RouteBuilder.tsx`: new optional props `onSelectedJobsChange(jobs)` (reports `{orderId,type}` list up) and `mapJobCommand` (`{ id, action: 'add'|'remove', jobs: {orderId,type}[] }`). A `useEffect` keyed on command `id` applies it: adds via existing `getLegContact`/`formatAddress` logic (skipping duplicates and jobs without coordinates), removes matching jobs, then calls `calculateTimeslots(next)` once for a batch. Toast summary ("Added 8, 2 already in route").
- `JobScheduling.tsx`: holds `routeJobKeys` state and `mapJobCommand` state; passes keys + `onAddJobs`/`onRemoveJobs` to `ClusterMap`, command to `RouteBuilder`.
- `ClusterMap.tsx`: new props `routeJobKeys`, `onAddJobs`, `onRemoveJobs`. Popups get the buttons (`collection` → `pickup` mapping). New `LassoLayer` child using `useMapEvents`: on mousedown/touchstart records lat/lng path drawn as a Leaflet `Polyline`, on release closes it and selects points via ray-casting point-in-polygon; disables `map.dragging` while active. Floating selection bar uses existing `Button` components and design tokens. No new packages.
- In-route icon variant added in `createColoredIcon` (outline ring).
