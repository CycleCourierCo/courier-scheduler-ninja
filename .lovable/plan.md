## Problem

On a 360px viewport the Invoices page (`src/pages/InvoicesPage.tsx`) scrolls sideways because several rows are locked to a single non-wrapping line:

1. **Invoice history rows** (lines 931–983) — `flex items-center justify-between` with a status pill plus "View in QuickBooks" and "Delete" buttons pushes content past the card edge (matches the screenshot).
2. **Page header** (line 631) — title + QuickBooks connect/status on one row.
3. **Create Invoice action row** (line 789) — two `min-w-[200px]` `size="lg"` buttons side by side exceed 360px.
4. **Orders to Invoice rows** (line 753) — long tracking/bike text and date on one non-shrinking row.

## Fix (presentation only)

- **History rows**: `flex flex-col sm:flex-row sm:items-center justify-between gap-3`; text block gets `min-w-0 flex-1` with `break-words` / `break-all` on the email line; action group becomes `flex flex-wrap items-center gap-2` so the buttons wrap under the details on mobile.
- **Page header**: `flex flex-wrap items-center justify-between gap-3`, heading `text-2xl sm:text-3xl`.
- **Action buttons row**: `flex flex-col sm:flex-row sm:justify-end gap-3`, buttons `w-full sm:w-auto sm:min-w-[200px]`.
- **Orders to Invoice rows**: `flex flex-wrap justify-between items-start gap-2` with `min-w-0` on the text block and `break-words` on the tracking line.

No changes to data fetching, invoice creation, or QuickBooks logic.

## Verification

Load `/invoices` in a 360px-wide Playwright viewport, screenshot the header, action buttons and invoice history sections, and confirm `document.documentElement.scrollWidth <= 360`.
