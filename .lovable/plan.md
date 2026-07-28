## Problem

On narrow screens the order detail page has several header rows that force text and buttons onto the same line, so buttons overlap the title or run off the right edge:

1. **Item card header** (`src/pages/OrderDetail.tsx`, the `CardTitle` around lines 1250–1282) — the bike name, Return, Print Label and email resend buttons sit in one non-wrapping flex row, so the buttons overlap the wrapped title text.
2. **Sender/Receiver Information header** (`src/components/order-detail/AdminContactEditor.tsx` line 168, `ContactDetails.tsx` line 51) — "Sender Information" plus Send Review and Edit Contact buttons overflow past the card edge.
3. **Item Details header** (`src/components/order-detail/ItemDetails.tsx` line 99) — same pattern with the Edit Bikes button.
4. **Order header** (`src/components/order-detail/OrderHeader.tsx`) — the fixed-width `w-[220px]` status select plus Cancel Order button can exceed a 360px viewport.

## Fix (presentation only, no logic changes)

For each header row:
- Change `flex items-center justify-between` to a wrapping layout: `flex flex-wrap items-start justify-between gap-2`, and let the title block take `min-w-0 flex-1` so long bike names wrap instead of being overlapped.
- Put the action buttons in their own `flex flex-wrap gap-2` container so they drop to the next line on mobile rather than overflowing.

Specifics:
- **OrderDetail.tsx item card**: make the `CardTitle` a wrapping column on mobile (`flex-col sm:flex-row`), title with `min-w-0 break-words`, button group `flex flex-wrap gap-2 w-full sm:w-auto`.
- **AdminContactEditor.tsx / ContactDetails.tsx**: wrap header, buttons group `flex flex-wrap gap-2`; keep button sizes as-is.
- **ItemDetails.tsx**: wrap header row.
- **OrderHeader.tsx**: status select becomes `w-full sm:w-[220px]`, and the select + Cancel Order row becomes `flex-wrap w-full` so Cancel Order wraps below the select on small screens. Also let the "Booked by" line wrap (`flex-wrap` + `break-all` on the email) instead of stretching the row.

No changes to data fetching, handlers, or backend behaviour.

## Verification

Load the order detail page in a 360px-wide viewport with Playwright and screenshot the item card, order header, and sender/receiver sections to confirm nothing overlaps or clips.
