# Fix horizontal overflow in the Build My Bike parts picker

On mobile, the bike diagram inside the build detail dialog pushes content wider than the screen, so the whole dialog scrolls sideways (visible in the screenshots: "Rear wheel" and "Front wheel" labels sit half off the panel and the dialog gains a horizontal scrollbar).

## Cause

The diagram's hotspot labels are absolutely positioned at percentage coordinates and centred with a -50% translate. Labels near the edges (`rear-wheel` at x=16, `front-wheel` at x=82, `accessories` at x=24) are wide relative to a 320px-wide container, so half the pill sits outside the diagram box. The dialog container is `overflow-y-auto` only, so the extra width leaks out as page-level horizontal scroll.

## Changes (presentation only)

1. `src/components/build-my-bike/BikeDiagram.tsx`
   - Keep hotspots inside the box: clamp edge labels by switching the horizontal transform per hotspot side (left-edge labels align to their left edge, right-edge labels to their right edge, middle ones stay centred) instead of always translating -50%.
   - Constrain label width on small screens (`max-w-[38%]`, tighter padding/text size below `sm`) so long labels like "Saddle & post" and "E-bike parts" wrap instead of stretching.
   - Add `overflow-hidden` to the diagram wrapper as a hard guarantee nothing escapes.

2. `src/components/build-my-bike/BuildDetailDialog.tsx`
   - Add `overflow-x-hidden` and a mobile-safe width (`w-[calc(100vw-2rem)] sm:w-auto`) to the `DialogContent` so the dialog can never scroll sideways.
   - Make sure the components list rows below the diagram use `min-w-0` truncation so long spec text (e.g. "Handlebar · HBR17 ~300g · slot: cockpit") wraps rather than widening the row.

3. `src/components/build-my-bike/PickComponentDialog.tsx`
   - Same mobile width guard on its `DialogContent`, and let the search input + "All parts" toggle wrap on narrow screens so that dialog stays within the viewport too.

No data, service, or stock-allocation logic changes.

## Verification

Load a build detail dialog at a 360px viewport in the preview and confirm no horizontal scrollbar and all ten hotspot labels fully visible inside the diagram.
