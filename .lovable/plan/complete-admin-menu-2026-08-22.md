# Complete admin menu

Admins currently reach some pages only by typing the URL. The menu will list every admin-accessible page, grouped so the long list stays usable, and identical in both the desktop dropdown and the mobile sheet.

## Pages missing from the admin menu today

- Inbox — in the desktop dropdown, missing from the mobile sheet
- Mechanic Clock — only shown to mechanics, not admins
- Dispatch Orders and Dispatch Routes — not linked anywhere
- Shopify Integration — not linked anywhere
- Bulk Availability, Pricing, My Stock — only shown to B2B accounts
- API Documentation — only reachable from the footer
- Create Order and Bulk Upload — top nav only; will also appear in the menu

Already present and staying: Dashboard, Analytics, Profile, Tasks, Knowledge, Box My Bike, Users, Vehicles, Claims, Loading & Storage, Warehouse Stock, Storage Bays, Trunk Runs, Job Scheduling, AI Routing, Driver Timeslips, Route Profitability, Account Approvals, API Keys, Webhooks, Invoices, Bicycle Inspections, Labour Times, Holidays, Notice Bars, Announcement Emails, Fuel Finder, Tracking, plus the two Sentry test actions.

## Grouping

Section headers inside the menu, in this order:

```text
Orders        Dashboard · Create Order · Bulk Upload · Tracking · Invoices · Pricing
Operations    Job Scheduling · AI Routing · Dispatch Orders · Dispatch Routes ·
              Loading & Storage · Warehouse Stock · Storage Bays · Trunk Runs ·
              Bulk Availability · My Stock
Workshop      Bicycle Inspections · Labour Times · Mechanic Clock · Box My Bike
Fleet         Vehicles · Driver Timeslips · Fuel Finder · Claims
Insight       Analytics · Route Profitability
Comms         Inbox · Tasks · Notice Bars · Announcement Emails · Knowledge
Admin         Users · Account Approvals · Holidays · API Keys · Webhooks ·
              Shopify Integration · API Documentation
Developer     Test Sentry Error · Test Sentry Log
```

Non-admin roles keep exactly the menu they see now — nothing is added or removed for B2B, driver, loader, mechanic, sales, route planner or timeslip admin.

## Technical notes

- All changes live in `src/components/Layout.tsx`.
- Define one `ADMIN_MENU_SECTIONS` array in that file (label, icon, path per item) and render it in both the desktop `DropdownMenu` and the mobile `Sheet`, so the two can no longer drift apart. The Sentry test items stay as inline actions, not links.
- Desktop uses `DropdownMenuLabel` plus `DropdownMenuSeparator` for the section headers; mobile uses small muted headings above each block. The dropdown gets a max height with scroll so the long list works on laptop screens.
- Icons reuse the existing lucide imports; add only what the new entries need (e.g. `Inbox`, `Store`, `BookOpen`, `Route`).
- Routes are unchanged — this is menu wiring only.
