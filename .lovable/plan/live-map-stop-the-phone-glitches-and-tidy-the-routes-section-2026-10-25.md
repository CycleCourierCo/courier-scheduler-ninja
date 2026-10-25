# Live map: stop the phone glitches and tidy the routes section

## What that section is
The card that says "No timeslip yet · 0/9 stops · No recorded path for this day" is a **saved route for the chosen day** (from Load routes). It shows:
- the van that ran it. Here there isn't one yet, because no timeslip is linked, so it says "No timeslip yet"
- how many stops the van has reached (0 of 9)
- planned road miles, depot to depot
- the driven path once the van has been tracked

The big empty grey space under it isn't part of the card. That's the glitch: your phone hasn't redrawn the map properly while you scroll.

## Why it keeps glitching
On phones the map sits in the middle of a long page that scrolls. Chrome on Android often fails to redraw a moving map while the page around it scrolls, which leaves ghost copies and blank patches. Turning off animations didn't fix it, so the fix is a different phone layout where the map never scrolls with the page.

## Changes (phones only; laptop stays as it is)
1. **Map / List switch.** Two buttons at the top: **Map** and **List** (List shows a count, e.g. "List · 12").
   - Map: the map fills the screen under the header, with no page scrolling at all.
   - List: routes and vans in a normal scrolling list, with no map on screen.
2. **Tapping a van or route in List** switches to Map and zooms to it.
3. **Compact controls.** The date, van filter and Refresh sit on one tidy row. The "Fleet" button moves into the title row.
4. **Clearer route cards.**
   - The title shows the route name, e.g. "Route aebf16e0", with a "No timeslip linked" badge instead of the big "No timeslip yet" heading.
   - "No recorded path for this day" becomes "Not tracked yet" in smaller grey text.
   - A short heading explains the section: "Saved routes: planned stops vs where the van went".
5. **Headings** "Saved routes" and "Live vans" separate the two parts of the list.

## Technical details
- `src/pages/fleet/LiveMap.tsx`: use `useIsMobile()`. On mobile, render either the map container (height `calc(100dvh - header)`, measured with the same ref pattern the inbox uses) or the list, never both, so the Leaflet layer never moves with page scroll. Call `map.invalidateSize()` when switching back to Map.
- Desktop grid unchanged.
- Route card: when `registration` is missing, title = `name` (stripped of the date prefix), with an outline badge "No timeslip linked".
- Keep `preferCanvas` and animations off.
- Verify with Playwright at 360x616: switch tabs, scroll List, confirm no overflow and that the map fills the space.
