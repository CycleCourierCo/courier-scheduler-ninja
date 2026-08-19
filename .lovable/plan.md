# Compact driver hours & mileage panel

Tighten the "Driver hours & mileage" card on Job Scheduling so it consumes far less vertical space and presents each driver as a single compact line.

## What changes

- **Header:** keep the title and date range on one line; shrink the From/To date inputs to minimal width and place them inline with the title on desktop, collapsing only on very narrow screens.
- **Padding:** reduce `CardHeader`/`CardContent` padding to the smallest comfortable values (`pb-2`, `p-3` or less) and remove any extra vertical gaps.
- **Desktop table:** render one row per driver with no nested rows or expansion. Columns become:
  - Driver name
  - Total hours (with driving/stops hours shown inline as small muted text, e.g. `8.50h · 6.20 / 2.30`)
  - Mileage
  - Days
  - Stops
- **Mobile:** replace the current stacked cards with a compact single-line list item per driver (name left, total hours + mileage right, tiny supporting text below if needed). Keep the grand total as a single sticky footer line.
- **Typography:** use smaller text (`text-xs` / `text-sm`) throughout and remove icons inside rows; keep the header icon only.
- **Empty/loading states:** shrink skeleton lines to match the compact row height.
- **Missing-mileage note:** show as a tiny `*` or superscript indicator beside the mileage instead of a full badge, with a tooltip explaining the count of missing days.

## Technical notes

- File: `src/components/scheduling/DriverHoursMileagePanel.tsx` only.
- No data or service changes; purely presentation and layout.
- Keep the existing `useQuery` fetch and aggregation logic untouched.
- Preserve the date-range default (Sunday–Thursday) and reset behaviour.
