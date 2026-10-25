# Live map: find the real cause of the scrolling glitch, then fix it

## What we know
- It only happens on the Live map, and it happens on the live site too, so it's not the Lovable preview.
- It still happens in List view with no map on screen, so the map itself isn't the cause.
- In your recording, the top part of the page ("Live map", the date box, "All vans") is left behind in stacked copies as you scroll. That usually means the page is being redrawn non-stop while you scroll, either by something constantly re-rendering or by a layer Chrome can't keep up with.

My earlier fixes were guesses, and none of them worked. This time I'll reproduce it first and only then change things.

## Steps
1. **Reproduce it here.** Open the Live map in a phone-sized Chrome with test data that copies today's 8 vans and saved routes. Then measure:
   - how many times the page re-renders per second while it's sitting idle and while scrolling
   - which parts of the page are being redrawn
   - whether anything has a running animation, a refresh timer firing too often, or an extra scroll area
2. **Fix whatever the measurement shows.** The likely suspects, in order:
   - a re-render loop: the route list or the "updated X minutes ago" text re-rendering every frame
   - the extra scroll area my last change added (the sideways clip), which creates a second scrolling layer
   - the native date box and the van dropdown sitting in a layer that Chrome repaints
   - the map's styles still being active while the map is hidden
3. **Simplify the phone page if needed.** Keep the page as one plain scrolling list, with no nested scroll areas and no layer tricks. The date and van filter go in a single compact bar that doesn't move with the page.
4. **Check again.** Re-run the same measurement and record a short scroll in the phone-sized browser to show nothing is left behind.

## What you'll see
The same Live map and List switch, but scrolling should be smooth with no copies left behind. If step 1 can't reproduce it, I'll tell you and send a screen recording of what I tried rather than guessing again.

## Technical details
- **Playwright harness:**
  - Chromium with the Pixel 5 profile (`isMobile`, `hasTouch`, dpr 3)
  - `page.route` stubs for the Supabase auth session, profile and roles, plus `radius-positions`, `fleet_route_day`, `fleet_position_history`, `vehicles` and `vehicle_issues`
  - a session JSON saved in localStorage for the app origin only
- **Measurements:**
  - `PerformanceObserver` for long tasks
  - a `MutationObserver` mutation count over 10 seconds idle and while scrolling
  - React Profiler commit counts, logged through a temporary window hook, removed afterwards
  - CDP `Overlay.setShowPaintRects` screenshots
- **Candidate fixes:**
  - remove `overflow-x-hidden` from the container and stop overflow per card instead
  - memoise the route and van lists
  - make sure `formatDistanceToNow` only updates on data refresh
  - load the Leaflet CSS only when the map is mounted
