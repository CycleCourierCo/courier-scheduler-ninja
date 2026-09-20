# Make the Route Timeslots dialog much bigger

## Goal
The Route Timeslots popup in Route Builder opens as a narrow panel (~672px wide, 80% of screen height), and stop addresses are clamped to a single line so they get cut off. Make the dialog fill most of the screen and show addresses in full.

## Changes — `src/components/scheduling/RouteBuilder.tsx`

1. **Enlarge the desktop dialog** (line 3879)
   - Change `DialogContent` classes from `max-w-2xl max-h-[80vh] overflow-y-auto` to a near-fullscreen size: `w-[95vw] sm:max-w-7xl max-h-[92vh]`. That gives roughly double the current width (~1280px on a typical desktop) so the whole dialog — controls, summary panels, and stop cards — gets more room.

2. **Show addresses in full on stop cards**
   - The address line in `JobItem` uses `line-clamp-1`, which cuts long addresses short even when there is space. Remove the one-line clamp so the full address wraps onto multiple lines.
   - Ensure the address container can shrink/wrap (`min-w-0`) so long text wraps inside the card instead of stretching it.

3. **Use the extra width for the stop list**
   - Render the stop cards in a responsive grid: one column on smaller screens, two columns side-by-side on `lg` and up, so roughly twice as many stops are visible per screen.
   - Start/End depot bars, capacity warning, Route Summary, and Route Profitability panels stay full width beneath the stop grid.

4. **Mobile unchanged**
   - The mobile bottom drawer already covers 90% of screen height; no change there.

## Verification
- `bun run build`.
- Playwright check on the Job Scheduling page at desktop viewport: open Route Builder → Get Timeslots, confirm the dialog spans most of the screen, stops render in two columns, and long addresses display in full without overflow.
