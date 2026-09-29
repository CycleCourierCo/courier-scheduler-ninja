# Cycle Courier Co. redesign

- [x] Establish tokens, typography, semantic status colours and shared controls.
- [x] Rebuild shared navigation, access states and notices.
- [x] Build strip map and doorstep pages.
- [x] Redesign public and account-entry pages.
- [x] Redesign customer portal pages.
- [x] Redesign warehouse and workshop pages.
- [x] Redesign office operations pages.
- [ ] Redesign administration and integration pages.
- [x] Complete map, print and decorative-effect sweep.
- [x] Validate the production build and responsive shared layouts.
- [x] Restore Shipday tick/cross indicators on all visible Job Scheduling cards.
## Generate Routes (Verso/VROOM)
- [x] Phase 1: plan tables + difficult areas, `route-optimize` edge function, Generate Routes popup with cards, map, at-risk panel, Get Timeslots handoff
- [x] Show the ordered road route and every job on a map in Get Timeslots
- [x] Match the Get Timeslots map styling, markers, lines and sizing to Generate Routes
- [ ] Phase 2: Alt 1 / Alt 2 variants per day with trade-off notes and re-solve on selection
- [ ] Phase 3: admin polygon editor, driver availability, same-route collect-then-deliver
## Driver rota & absence
- [x] Database: availability, overrides, absence requests, rota settings, triggers
- [x] My Holidays page, Drivers Rota page, User Management availability + approvals
- [x] Absence emails (admins + driver)
- [x] Active-users helper applied to all pickers/filters

## Inspection options
- [x] Add Inspection only and Inspection and service booking choices
- [x] Show inspection type to workshop staff and customers
- [x] Add service acceptance to the customer approval page
- [x] Prevent declined or undecided services from being invoiced
- [ ] Verify signed-in workshop and customer flows end to end

## Warehouse storage invoicing
- [x] Add £40 VAT-inclusive monthly bike charge to weekly and manual QuickBooks invoices, including storage-only customers.
- [x] Record invoiced bike-months and surface ambiguous failures for review.
- [x] Verify anniversary and VAT arithmetic with automated tests.
- [ ] Verify a signed-in invoice preview and a real QuickBooks invoice after the required service product is configured (blocked by external sign-in and QuickBooks setup).
- Expiring Dates page: four-column layout (today / tomorrow / 2-3 days / expired), no-date jobs excluded
