# Make the number markers exactly match

## Confirmed mismatch

The screenshot shows the Get Timeslots number marker as a small pale/outlined circle. The generated-route marker is intended to be a clearly filled route-colour circle with a white number and crisp white border.

## Change

- Give the shared marker an explicit filled route colour, white number, white border, fixed 22px size, and matching shadow so Leaflet or inherited page styles cannot wash it out.
- Use the exact same marker helper in Generate Routes and Get Timeslots; neither screen will have its own marker override.
- Keep stop numbering, route data, map line, popups, and route behaviour unchanged.

## Verification

- Compare both maps at mobile and desktop sizes.
- Confirm the marker remains solid and legible over pale, dark, and detailed map tiles.
- Run the focused lint and TypeScript checks.
