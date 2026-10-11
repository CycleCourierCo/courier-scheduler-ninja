# Rename "Driver Timeslips" to "Timeslips" and merge mechanic timeslips into the main lists

## What changes

### 1. Renames
- Page title: "Driver Timeslips" → "Timeslips" (admin view; drivers still see "My Timeslips").
- Menu label: "Driver Timeslips" → "Timeslips" in `src/components/Layout.tsx` (desktop dropdown + mobile sheet) and the route label in `src/config/routes.ts`.
- Subtitle "Manage driver timeslips and payments" → "Manage timeslips and payments".
- The web address stays `/driver-timeslips` so existing links and bookmarks keep working.

### 2. Mechanic timeslips join the Draft / Approved / All lists
Today mechanic timeslips live on their own "Mechanic Timeslips" tab. Instead:

- The separate "Mechanic Timeslips" tab is removed.
- Mechanic timeslips are fetched alongside driver timeslips and shown in the same lists, mapped by status:
  - **Draft** tab: mechanic slips with status `open` (still clocked in) or `closed` (clocked out, awaiting approval) — these are the ones needing action, same as driver drafts.
  - **Approved** tab: mechanic slips with status `approved`.
  - **All** tab: everything, including rejected.
- Each mechanic timeslip card gets a "Mechanic" badge (with the wrench icon) so it's obvious which is which, and keeps its existing mechanic-specific display: clock-in/out photos, GPS map links, hours, hourly rate, and the clock-out explanation + work-done summary added recently.
- The tab counts (Draft (n), Approved (n), All (n)) include mechanic slips.
- The existing filters still apply: the person dropdown gains the mechanics (it already loads users by role, so mechanics are added to that list), and date-range filtering applies to mechanic slips too. Driver-only filters (no mileage / no vehicle) simply don't exclude mechanic slips.
- Sorting works across both kinds (by date; mechanic slips have no total pay so they sort last in the pay sorts).

### 3. Implementation notes (technical)
- Extract the mechanic timeslip card markup from `src/components/timeslips/MechanicTimeslipsTab.tsx` into a reusable `MechanicTimeslipCard` component; the old tab component is deleted.
- In `src/pages/DriverTimeslips.tsx`: add a query using `listAllMechanicTimeslips({ status })` with the mapped status, merge results with driver timeslips into one list of `{ kind: 'driver' | 'mechanic', ... }` items, render `TimeslipCard` or `MechanicTimeslipCard` accordingly.
- Mechanic approve/reject/edit/delete actions keep working from the merged cards (same mutations as the old tab).
- No database changes; no changes to the Mechanic Clock page or to how timeslips are generated.

## Not changing
- The `/driver-timeslips` URL, permissions (admin + timeslip_admin), the Generate/Create/Bulk Assign buttons, and the driver's own "My Timeslips" view.
