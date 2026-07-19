## Fix mobile overflow on Driver Timeslips

The page overflows horizontally on mobile (~360px). Root causes visible in the screenshot:

1. **TabsList** (`Draft/Approved/All/Mechanic Timeslips`) uses default shadcn grid which forces all 4 tabs into one row wider than the viewport, pushing the whole page horizontally.
2. **TimeslipCard action row** — three `flex-1` buttons (Edit/Approve/Reject) plus a delete button on one row exceed narrow card width, causing the green "Approve" bar to clip past the card edge as seen in the screenshot.
3. **Pay Details block** uses `flex justify-between` inside a card that's being stretched by the outer overflow; values render off-screen. Once outer overflow is fixed they'll sit correctly, but adding `min-w-0` and letting long values wrap keeps them safe.
4. **Route link buttons row** already wraps; fine.
5. **Total Pay summary card** (`flex justify-between`) is fine but its parent container should not overflow.

### Changes

**`src/pages/DriverTimeslips.tsx`**
- Wrap `TabsList` in an `overflow-x-auto` container and set `TabsList` to `w-max` / `inline-flex` so tabs scroll horizontally instead of stretching the page.
- Add `min-w-0` to the outer container / cards so children can shrink.
- On the summary Card (Showing / Total Pay), keep flex row but allow wrap on narrow widths.

**`src/components/timeslips/TimeslipCard.tsx`**
- Header row: allow the right-side pay column to shrink; add `min-w-0` and `flex-wrap` so the driver name and pay stack cleanly.
- Hours breakdown: change `grid-cols-3` to `grid-cols-2 sm:grid-cols-3` (or allow wrap) so items don't overflow on 360px width.
- Admin action buttons: replace `flex + flex-1` with a responsive `grid grid-cols-2 sm:flex sm:flex-wrap` so buttons stack 2-up on mobile instead of clipping.
- Add `min-w-0` on inner text containers to prevent overflow.

**`src/components/timeslips/TimeslipFilters.tsx`**
- The `min-w-[250px]` on the date range and `min-w-[220px]` quick filters push the filter card wider than a 360px viewport. Lower/remove the `min-w-*` values (e.g. `min-w-0 sm:min-w-[200px]`) and keep `flex-wrap`, so each filter takes full width on mobile and wraps naturally.

No business-logic or data changes — presentation only.

### Verification
- Load `/driver-timeslips` at 360px width, confirm no horizontal scroll, tabs scroll independently, and action buttons stay inside the card.
