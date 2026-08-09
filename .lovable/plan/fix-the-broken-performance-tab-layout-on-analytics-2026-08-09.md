# Fix the broken Performance tab layout on Analytics

## What's happening

On mobile the Performance tab renders squeezed into roughly half the screen width, with the header and cards clipped and a horizontal scrollbar across the whole page (see screenshots).

The cause is the "Slowest Customers" leaderboard: its table is wrapped in a shadcn `ScrollArea` with a `min-w-[860px]` inner div (`src/components/analytics/PerformanceLeaderboard.tsx:93-94`). The Radix scroll viewport lays its content out as a table box, so that 860px minimum leaks outward instead of being contained — it stretches the page's scroll width and squashes every sibling card, including the sticky header area.

The Bike Value tab has the same construction (`BikeValueLeaderboard.tsx:117-118`, `min-w-[720px]`), so it is fixed the same way.

## The fix

- Replace the `ScrollArea` wrapper in the leaderboards with a plain scroll container: fixed max height with vertical scroll plus `overflow-x-auto`, matching the pattern already used by the driver, vehicle and mechanic tables in this folder (`overflow-x-auto` around the table).
- Keep the wide `min-w-[...]` table inside that container so wide columns still scroll sideways within the card rather than widening the page.
- Keep everything else as-is: sticky table header, sort controls, search box, highlighted rows, row click behaviour and the fixed table height.
- Also add `min-w-0` to the Performance tab's stat/chart grid wrappers where needed so no other wide child can push the page wider.

## Result

Performance tab (and Bike Value tab) fill the screen properly on mobile, the leaderboard scrolls horizontally inside its own card, and the page no longer scrolls sideways.

## Technical notes

- Files touched: `src/components/analytics/PerformanceLeaderboard.tsx`, `src/components/analytics/BikeValueLeaderboard.tsx`, and a small wrapper tweak in the performance section of `src/pages/AnalyticsPage.tsx`. No data or service changes.
- Sticky `thead` continues to work inside a plain `overflow-auto` container.
- Verify afterwards at 360px width that `document.documentElement.scrollWidth` equals the viewport width on both tabs.
