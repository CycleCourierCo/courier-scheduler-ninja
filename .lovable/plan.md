## Problem

On desktop the job-selection dialog's list doesn't scroll independently — the fix only worked on mobile.

Cause (verified in `src/components/ui/dialog.tsx` line 39): the base `DialogContent` already applies `grid ... max-h-[90vh] overflow-y-auto`. `CSVMatchReviewDialog` adds `flex flex-col`, but Tailwind emits `.flex` before `.grid`, so `grid` wins and `flex-col` is inert. On mobile it still worked because `h-[92dvh]` plus the parent's own `overflow-y-auto` scrolled the whole dialog; on desktop `sm:h-auto` leaves the grid box unconstrained, so `flex-1 min-h-0` on the `ScrollArea` resolves to nothing and the inner list never gets its own scroll area.

## Fix

In `src/components/scheduling/CSVMatchReviewDialog.tsx` only (presentation change):

1. On the `DialogContent`, override the base display so flex column actually applies (`!flex`), and give the dialog a bounded height on all breakpoints — e.g. `h-[92dvh] sm:h-[85vh] sm:max-h-[85vh]` — plus `overflow-hidden` so the outer box never scrolls.
2. Keep header, stats bar, quick-action buttons and footer as `shrink-0`; keep the `ScrollArea` as `flex-1 min-h-0` so it takes the remaining height and scrolls internally.

## Verification

Open the CSV upload review dialog at desktop width and confirm the header/stats/footer stay pinned while the stop list scrolls, then re-check at mobile width that nothing regressed.
