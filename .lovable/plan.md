# Fix mobile order card status badge overlapping tracking number

## Problem
On the mobile order card list, the status badge is rendered in the same horizontal row as the tracking number. Long status labels such as "Scheduled Dates Pending" take up too much width and force the tracking number to truncate aggressively, making it hard to read.

## What changes
Update `src/components/OrderCardList.tsx` so the status badge no longer competes for horizontal space with the tracking number:

- Stack the card header vertically on mobile: tracking number on top, creator line below it, and the status badge on its own line underneath (left-aligned or inline with the creator line).
- Keep the tracking number on a single line with truncation only when genuinely necessary.
- Preserve the existing tap-to-open behaviour and action button row.
- No changes to desktop; this only affects the `OrderCardList` mobile view.

## Verify
At 360px width, the full tracking number is visible on typical cards, the status badge sits cleanly below or beside non-competing content, and the card remains tappable without layout overflow.
