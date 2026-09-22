# Make both route maps identical and show every job

## Confirmed issue

- The generated-route map and Get Timeslots map currently use separate marker styles, line styles, sizing, and route-loading paths.
- `CCC754274417932KEIB97` and `CCC754333199441KEIB97` are both present in the generated route, consecutively, but share the exact same collection coordinates (`53.0943832, -2.5374421`). Their markers are stacked directly on top of each other, so one appears missing.
- Get Timeslots rebuilds its map from live order records and requests a new road line, while the generator displays the geometry returned by the optimiser. This can make the same selected route look different after handoff.

## What will change

- Build one shared route-map presentation used by both **Generate Routes** and **Get Timeslots**.
- Match the generated-route appearance everywhere: same map tiles, route line weight and colour, numbered dots, depot marker, borders, popups, auto-zoom, and sizing treatment.
- Preserve the selected route's optimiser geometry and stop coordinates when opening Get Timeslots, so the initial map is the exact route the dispatcher selected.
- Continue recalculating the road line when the dispatcher changes the stop order, flips the route, removes a stop, or changes a stop location.
- Handle multiple jobs at one address as a shared stop marker that visibly contains every stop number. Opening it will list every job at that location, including both reported tracking numbers.
- Keep collection/delivery identity visible in the marker and popup without changing route order or timeslot behaviour.
- Validate coordinates before rendering and show a clear count if any stop cannot be mapped, rather than silently hiding it or breaking the map.

## Technical details

- Extract the common Leaflet map, route-line, depot, marker, popup, collision handling, and bounds logic into shared scheduling map utilities/components.
- Extend the Generate Routes handoff with the selected route identifier, then load its stored geometry and ordered stop coordinates in Get Timeslots.
- Keep the existing ID/type URL list as the order-loading fallback so old links continue to work.
- Use semantic design tokens for route and marker colours, including dark mode.
- Add deterministic grouping for identical and near-identical coordinates instead of random marker offsets.
- Add Sentry reporting and a local fallback for geometry/loading failures without exposing customer details.

## Verification

- Confirm both reported jobs appear in the generated map and Get Timeslots map at their shared location.
- Confirm both screens show the same initial road line, numbered stops, depot, zoom, and visual treatment.
- Confirm reordering in Get Timeslots updates the numbering and road line while preserving every job.
- Check desktop and mobile layouts, light and dark themes, map popups, fallback state, and TypeScript/lint checks.
