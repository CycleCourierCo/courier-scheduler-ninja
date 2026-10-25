# Live map list: stop the sideways overflow and redraw glitch

## What the screenshot shows
The map wasn't on screen, so the map isn't the cause. Two other things are visible:
- **The list is wider than the phone.** There's a sideways scrollbar at the bottom, and "0/9 stops" is cut off on the right. The route title, the "No timeslip linked" tag and the stops count all sit on one line, and on a 360px screen they don't fit.
- **The page judders while you scroll it sideways and up and down at once.** Chrome on Android then draws half-old, half-new copies of the cards, which is the ghosted text you're seeing.

## Changes
1. **Nothing can be wider than the screen.** The Live map page is clipped to the screen width, so it can't scroll sideways.
2. **Route cards stack on phones:**
   - Line 1: route name, with the stops count on the right
   - Line 2: the "No timeslip linked" tag, then the driver or route name
   - Line 3: planned miles and tracking status
   
   Long text shortens with "…" instead of pushing the card wider.
3. **Van cards** get the same treatment, so long addresses can't widen them either.
4. **Plain text font for route names.** Route names use the normal font instead of the wide typewriter-style one, which takes much more room.
5. **Fewer redraws.** The route list currently recalculates on every small update, such as the 60-second van refresh. It will only recalculate when the routes or tracked positions actually change.

## Technical details
- `LiveMap.tsx`:
  - outer container `overflow-x-hidden`
  - list column `min-w-0`
  - cards become `div role="button"` with `min-w-0 overflow-hidden`, because a `<button>` won't shrink its children
  - title row `flex min-w-0` with a `truncate` name and a `shrink-0` badge; the "No timeslip linked" badge moves to row 2
  - route names drop `font-mono`
- `RouteOverlay.tsx` `useRouteDay`: memo `analyses` on a stable key built from each road query's `dataUpdatedAt` and status, instead of the `roads` array, which is a new array on every render.
- Verify with Playwright at 360x616 using a stubbed list render: `document.documentElement.scrollWidth <= 360` and no clipped badges.
