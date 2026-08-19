# Improve the Dashboard orders UI on mobile

On a phone the orders list is the same wide, resizable data table used on desktop. Only two columns fit on screen, names wrap onto two lines inside grey pills, rows are tall and mostly empty, and everything else (status, dates, actions) is hidden behind horizontal scrolling. The "Columns" settings and column-resize grips are useless at that width.

## What changes

Below the `md` breakpoint, show the same orders as a stacked card list instead of a table. Desktop stays exactly as it is today.

Each order card shows, in a compact layout:

- Tracking number as the card title (tap anywhere on the card to open the order, same routing rule as the table rows: admin/route planner to the admin view, everyone else to the customer view).
- Status badge top-right.
- Customer (creator) as a small muted line, single line with truncation — no wrapping pills.
- Bike: brand, model and quantity when present.
- Sender to Receiver on one row with a small arrow between, each truncated.
- Scheduled collection and delivery as two small labelled lines with their timeslot windows; "Not scheduled" when empty.
- Created date as a muted footnote.

Actions (Admin / Customer / Label / Resend, whichever the role allows) move into a compact row of icon buttons at the bottom of the card, with touch-friendly hit areas.

Other mobile tweaks:

- Hide the "Columns" bar and resize grips on mobile (they only apply to the table).
- Add a mobile-friendly count line and keep the existing pagination controls, which already stack.
- Filters: keep as-is functionally, no logic changes.

## Technical notes

- New component `src/components/OrderCardList.tsx` rendering the card layout from the same `Order[]` and `userRole` props.
- `src/components/OrderListContainer.tsx` renders `OrderCardList` inside `md:hidden` and `OrderTable` inside `hidden md:block`, so both use identical data and no fetch logic changes.
- Reuse `StatusBadge`, `formatTimeslotWindow`, `generateSingleOrderLabel` and `resendSenderAvailabilityEmail` so behaviour matches the table exactly.
- In `OrderTable.tsx`, wrap the column-settings bar so it does not render on mobile.
- Styling uses existing semantic tokens (`bg-card`, `text-muted-foreground`, `border-border`) — the current table uses hardcoded greys, the new cards will not.

## Verify

At 360px width: no horizontal page scroll, each order readable without swiping, names truncate on one line, tapping a card opens the right order detail page, action buttons work.
