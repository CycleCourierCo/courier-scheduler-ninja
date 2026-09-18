# Make every page load fast and stop the browser hanging

Full audit is done: all 60 pages were checked. Most are fine. The hangs come from a small number of pages that download the whole database table and then do heavy maths in the browser while it is trying to draw the screen.

## What the data actually looks like right now

- 7,481 orders in total (about 15 MB if every column is loaded)
- 335 active jobs, 325 inspections, 622 repair issues, 16 Box My Bike jobs
- 8,091 fuel stations, 948 timeslips, 301 tasks, 174 stock items
- Claims, knowledge base, conversations, builds: tiny

## The pages causing the freezes

1. **Inspections** — the list is re-filtered around 12 times for every single keystroke or click, every card is redrawn each time, and the page repairs/reconciles statuses in the database *before* it will show you anything.
2. **Loading & Storage** — loads every column of up to 5,000 orders (including full tracking history) and used to write thousands of log lines while drawing.
3. **Job Scheduling** — loads the whole active backlog and then checks courier jobs for every order, not just the day you are looking at.
4. **Analytics** — downloads all 7,481 orders and all inspections in eight sequential batches, with no caching, then recalculates roughly 15 charts on every click because the results are not remembered.
5. **Fuel Finder** — downloads all 8,091 fuel stations and measures the distance to each one in the browser, every time you search.
6. **Invoices** — loads the whole invoice history table with no limit, and loads every column of orders during a bulk run.
7. **User Management** — loads every user with every column (including document links) into one unpaginated table.
8. **Bulk Availability and Project Management** — update records one at a time in a loop, so the page sits frozen until the last one finishes.
9. **Dashboard label printing** — builds large PDFs in one go on the main thread, which is what triggers "page took too long to respond".
10. **Tracking page (public)** — logs the full order object on every redraw.

## Good news — these are already fine

Repair approval pages (both the inspection approval and the receiver repair offer) are clean: one call, small payload, results remembered correctly. Also fine: customer order detail, tracking (apart from the logging), customer service inbox, vehicles, equipment, my stock, storage bays, driver timeslips, trunk runs, tasks, reviews, knowledge base, claims, and all the small admin/settings pages.

## What I will change

**Stop over-fetching**
- Analytics: only load the date range being viewed, keep results for 5 minutes, and remember every calculation instead of redoing it.
- Fuel Finder: ask the database for stations near the search point instead of all of them.
- Loading & Storage: request only the columns the page shows.
- Invoices: newest 200 invoices, and only needed order columns.
- User Management: paginate and load display columns only.
- Job Scheduling: only verify courier jobs for the selected day.

**Stop redundant work while drawing**
- Inspections: sort into status groups in a single pass, split cards into their own memoised component, and only draw what is on screen for long lists.
- Inspections: move the status reconciliation into the background so the list appears immediately.
- Analytics: memoise the status counts and the ~8 chart calculations currently recomputed on every render.
- Remove logging from inside loops and from the public tracking page.

**Stop the main thread locking up**
- Label/PDF generation runs in chunks so the browser stays responsive.
- Bulk availability and project-management updates run in small parallel batches instead of one-by-one.

**Global safety net**
- Sensible default freshness so heavy lists don't re-download every time a window regains focus.

## Technical notes

- `AnalyticsPage.tsx:109-126, 128-134, 172-190` — add `staleTime`, date-bounded queries, `useMemo`.
- `analyticsService.ts:9-45`, `inspectionAnalyticsService.ts:35-65` — accept a date range; drop unbounded pagination.
- `FuelFinderPage.tsx:206-233` — bounding-box filter server side.
- `BicycleInspections.tsx:1581-1611` — single-pass bucketing; extract memoised card; virtualize.
- `inspectionService.ts:198-300, 574-680` — background reconcile, parallel queries, Map lookups.
- `orderService.ts:99-127` — explicit column list.
- `JobScheduling.tsx:112-166` — scope Shipday verification.
- `schedulingService.ts:36-190` — remove per-job logs.
- `InvoicesPage.tsx:115-120, 334-345`; `UserManagement.tsx:64`; `TrackingPage.tsx:103-105`; `BulkAvailabilityPage.tsx:100-166`; `ProjectManagement.tsx:69`; `labelUtils.ts` chunking; `App.tsx` QueryClient defaults.
- No database schema or business-logic changes; behaviour stays identical.
