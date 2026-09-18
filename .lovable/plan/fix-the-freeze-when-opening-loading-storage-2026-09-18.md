# Fix the freeze when opening Loading & Storage

## What's happening

Opening Loading & Storage downloads up to 5,000 full order records in one go — including every tracking event and photo history attached to each one — and then, for every single order, writes three separate diagnostic lines into the browser's log. Those log lines are also forwarded one-by-one to the error-reporting service.

With a few thousand orders that's over ten thousand log events fired in a tight loop on the same thread that draws the page, so the spinner keeps spinning and the menu stops responding. This matches the screenshot: page stuck loading with the menu open.

Confirmed in the code:
- `getOrdersForLoading` in `src/services/orderService.ts` selects all columns with a 5,000-row limit.
- `fetchData` in `src/pages/LoadingUnloadingPage.tsx` logs per order (three calls each) plus two whole-array dumps.
- Error reporting is configured to forward `log`-level console output, so each of those becomes a reported event.

## The fix

1. Stop the per-order logging on the Loading & Storage page. Keep one short summary line instead of thousands.
2. Request only the fields this page actually uses instead of everything, so the download is a fraction of the current size and arrives much faster.
3. Stop forwarding ordinary informational log lines to error reporting; keep warnings and errors.
4. Compute the "for delivery today" / "loaded" groupings once per change instead of re-filtering the whole list on every re-render, so the page stays responsive after it loads.
5. Clean up the stray attribute that makes React warn on every sidebar render (the repeated warning already visible in the console).

## Technical detail

- `src/services/orderService.ts` — replace `select("*, bicycle_inspections(status)")` in `getOrdersForLoading` with an explicit column list covering the fields consumed by the loading page, storage views and label generation (ids, tracking number, status, sender/receiver, bikes, scheduled dates, storage/loading/driver-holder fields, inspection status, NI/boxing flags, collection photo source). Keep the existing status exclusions and ordering; keep the row cap.
- `src/pages/LoadingUnloadingPage.tsx` — delete the per-order and per-allocation `console.log` calls in `fetchData`; wrap the storage-allocation build plus `getBikesForDelivery` / `getBikesLoadedOnDate` results in `useMemo` keyed on `orders` and `selectedLoadingDate`.
- `src/main.tsx` — narrow `Sentry.consoleLoggingIntegration` levels to `["warn", "error"]`.
- `src/components/Layout.tsx` — fix the nav `map` that spreads a `data-lov-id` onto a `React.Fragment`; use a keyed fragment with no extra props.

No database, permission or business-logic changes; the same orders and storage rows appear as today.
