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
