# Fix the crash on the Drivers analytics tab

## What's happening

The Drivers tab renders a stop heat map built on Google Maps' `HeatmapLayer`. Google removed that feature in Maps JavaScript API v3.65, so constructing it throws:

> The Heatmap Layer functionality in the Maps JavaScript API is no longer available as of version 3.65.

The throw happens inside a render effect, so the whole Drivers tab is caught by the error boundary and shows "Something went wrong" instead of the analytics.

## The fix

Rebuild the heat map without `HeatmapLayer`, using density circles drawn on a normal Google map:

- Bucket the driver's stop coordinates into a small geographic grid (roughly ~2 km cells) and count stops per cell.
- Draw one translucent circle per cell, with radius and colour intensity scaled by the count (cool for one or two stops, hot for the busiest cells) — visually equivalent to a heat map, using `google.maps.Circle` which is fully supported.
- Keep the existing All / Collections / Deliveries toggle, the auto-fit to bounds, the empty state and the stop count in the card description.
- Add a small legend showing the low-to-high intensity scale.
- Drop the now-unneeded `visualization` library from the Maps script request for this card, and guard the drawing code so any future Maps failure shows the card's "Map unavailable" message instead of taking down the tab.

## Technical notes

- Only `src/components/analytics/DriverHeatMap.tsx` changes; the loader hook, service layer and other driver cards stay as they are.
- Circles are stored in a ref array and cleared on each redraw to avoid leaks when the filter or driver changes.
- Colours come from fixed intensity stops rather than hardcoded Tailwind utilities, since Maps overlays need literal colour strings.
