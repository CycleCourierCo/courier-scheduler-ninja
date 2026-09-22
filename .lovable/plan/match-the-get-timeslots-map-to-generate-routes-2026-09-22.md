# Match the Get Timeslots map to Generate Routes

## What will change

- Replace the separate Get Timeslots map presentation with the same map design used in **Generate Routes**.
- Use the same map tiles, route-line styling, numbered markers, depot marker, border, popups, auto-zoom, and overall proportions.
- Keep collection and delivery details available in each marker popup while matching the generated-route visual style.
- Apply the same presentation in both the desktop Route Timeslots window and its mobile layout.
- Preserve the existing Get Timeslots behaviour: the map will continue updating when jobs are reordered, moved, removed, flipped, or recalculated.
- Keep the current fallback that shows all available markers if the road line cannot load.

## Technical details

- Extract the shared Leaflet styling and marker helpers so Generate Routes and Get Timeslots cannot drift visually.
- Use the project’s semantic colour tokens for the route, markers, depot, borders, and map notices, including dark mode.
- Keep each screen’s existing route data source and business logic unchanged; this update is presentation-only.

## Verification

- Compare both maps side by side for matching line, dots, numbers, depot, popups, zoom, and framing.
- Confirm Get Timeslots still refreshes the map after every route-order change.
- Check desktop and mobile layouts, light and dark themes, fallback state, and TypeScript/lint checks.
