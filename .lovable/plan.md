## Problem

In `CSVMatchReviewDialog`, the job list sits in a `ScrollArea` with `flex-1 min-h-[240px] max-h-[45vh]`. On a small phone viewport the header, stats grid, select-all buttons and footer already consume most of the 90vh dialog, so the list area is capped at ~45vh but forced to at least 240px — it overflows the dialog instead of scrolling, and only the first row and a half are reachable.

## Fix

In `src/components/scheduling/CSVMatchReviewDialog.tsx`:

1. Make the dialog a proper flex column that fills the screen height on mobile: `max-h-[92dvh] h-[92dvh] sm:h-auto flex flex-col overflow-hidden`.
2. Change the list container to `flex-1 min-h-0` (drop `min-h-[240px]` and `max-h-[45vh]`) so it shrinks to the leftover space and scrolls internally.
3. Keep header, stats and the select-all button row as non-shrinking (`shrink-0`), and give the footer `shrink-0` so the "Load N Jobs" / "Cancel" buttons stay visible while the list scrolls.
4. Compact the stats block on small screens (smaller number text, tighter padding) so more of the list is visible on a 360px-wide phone.

## Verification

Load the dialog at a 360x616 viewport with the sample 27-row CSV and confirm the full list scrolls from row #1 to the last row with the footer buttons pinned.
