# Fix: loading page "Print Collection Labels" uses old label design

## Cause (verified)
`src/pages/LoadingUnloadingPage.tsx` has its own duplicated jsPDF label code (`generateLabels`, lines ~499-712) that still renders the old design (FROM/sender block, no service/box/NI indicator icons). The new design lives only in `src/utils/labelUtils.ts` (`renderLabelPage`), used by the order detail and dashboard label buttons.

## Changes

### `src/utils/labelUtils.ts`
- Export `renderLabelPage` (and keep `LABEL_WIDTH` / `LABEL_HEIGHT` exported) so other pages can reuse the single source of truth.

### `src/pages/LoadingUnloadingPage.tsx`
- Delete the duplicated per-label rendering inside `generateLabels` and the now-unused local `splitText` helper.
- Keep the existing behaviour that is unique to this page: grouping by collection driver, sorting drivers (Unassigned last), sorting each driver's orders by pickup timeslot, and the driver separator page (name, "N Pickups - N Bikes", date).
- For each order/bike, call `pdf.addPage()` then `renderLabelPage(pdf, order, i, quantity, LABEL_WIDTH)`.
- Keep the same output filename `collection-labels-<date>.pdf`.

## Result
The loading page labels become byte-for-byte the same design as the order labels: no FROM block, and the service / box-my-bike / NI indicator icons appear.

## Verify
- Type check.
- Generate labels from the loading page for a date that includes an inspect-and-service, a box-my-bike and an NI order; confirm indicators show and no sender block appears, and driver separator pages still sit before each driver's labels.
