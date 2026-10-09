# Pagination and customer filter for invoice lists

## Cancelled but invoiced list
- Add a **Customer** dropdown above the list. Its options are built from the customers that actually appear in the cancelled-but-invoiced results (sorted A–Z, with job counts), plus "All customers".
- It works together with the existing search, date and "show resolved" filters.
- Add pagination: 25 jobs per page with Previous / Next and "Page X of Y". Changing any filter jumps back to page 1.
- Totals, "Check QuickBooks payment" and the spreadsheet download still cover **all** filtered jobs, not just the current page.

## Invoice History
- Currently only the latest 200 invoices load. Replace with proper pages: 25 per page, Previous / Next and "Page X of Y", loading each page from the server so older invoices are reachable.
- Existing filters stay; changing them returns to page 1.

## Technical details
- `CancelledInvoicedPanel.tsx`: `customer` + `page` state, customer options via `useMemo` over rows, slice `filtered` for the table only.
- `InvoicesPage.tsx`: invoice history query uses `.range()` with `count: 'exact'` instead of `.limit(200)`; page state reset on filter change.

## Failed collection marker (cancelled list)
- Each cancelled-but-invoiced job shows a **"Failed collection"** badge (with the date of the last failed attempt) if Shipday ever reported a failed collection on it.
- Add a **"Failed collection only"** toggle to filter to those jobs, and a count in the summary line. Included in the spreadsheet download as a column.
- Detection: the order's Shipday tracking history contains an ORDER_FAILED event on the collection (pickup) job. Added to the `cancelled_invoiced_orders()` database function as `had_failed_collection` + `last_failed_collection_at`.
