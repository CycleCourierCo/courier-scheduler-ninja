# Make the Route Timeslots dialog much bigger

## Goal
The Route Timeslots popup in Route Builder currently opens as a narrow panel (~672px wide, 80% of screen height). Make it fill most of the screen so many more stops are visible without scrolling.

## Changes — `src/components/scheduling/RouteBuilder.tsx`

1. **Enlarge the desktop dialog** (line 3879)
   - Change `DialogContent` classes from `max-w-2xl max-h-[80vh] overflow-y-auto` to a near-fullscreen size: `sm:max-w-5xl lg:max-w-6xl w-[95vw] max-h-[92vh]`.

2. **Use the extra width for the stop list**
   - Render the route stop cards (`selectedJobs.map(... JobItem)`) in a responsive grid: one column on small screens, two columns side-by-side on `lg` and up, so the wide dialog shows roughly twice as many stops per screen.
   - Start/End depot bars, capacity warning, Route Summary, and Route Profitability panels stay full width beneath the stop grid.

3. **Mobile unchanged**
   - The mobile bottom drawer already covers 90% of screen height; no change there.

## Verification
- `bun run build`.
- Playwright check on the Job Scheduling page at desktop viewport: open Route Builder → Get Timeslots, confirm the dialog spans most of the screen and stops render in two columns with no overflow or overlap.
