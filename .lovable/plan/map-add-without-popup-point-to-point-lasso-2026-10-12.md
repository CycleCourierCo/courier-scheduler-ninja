# Map: add without popup + point-to-point lasso

## What changes
1. **Add / Remove from route on the map no longer opens the timeslots popup.** The job is just added to (or removed from) the route list and its pin turns blue. When you press **Get Timeslots**, the added jobs are included as normal.
2. **Lasso becomes point-to-point.** With Lasso on, each click on the map drops a corner point and joins it to the last one with a line. Finish the shape by clicking the first point again, double-clicking, or pressing **Finish shape**. **Undo point** removes the last corner, and **Cancel** throws the shape away. Once it's finished, the same "N jobs selected — Add / Remove / Clear" bar appears. The map can still be dragged and panned while you draw.

## Technical details
- `RouteBuilder.tsx`: in the `mapJobCommand` effect, remove both `calculateTimeslots(next)` calls. Only `setSelectedJobs(next)` runs, plus the toast.
- `LassoLayer.tsx`: replace the pointer-drag drawing with `useMapEvents` click and dblclick handling. Each click appends a vertex. A dashed `Polyline` shows the points so far, with a preview segment following the mouse, and small circle markers mark the vertices. A click within about 12px of the first vertex, a double-click, or calling `finish()` closes the polygon (at least 3 points) and runs `onComplete`. Dragging stays enabled and double-click zoom is turned off while the lasso is active. Expose `finish`, `undo` and `cancel` via a ref or callbacks, used by the buttons in `ClusterMap.tsx`.
- `ClusterMap.tsx`: show **Finish shape / Undo point / Cancel** while drawing, and update the Lasso button hint to "click to add points".
