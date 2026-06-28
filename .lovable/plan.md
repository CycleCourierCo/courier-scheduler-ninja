## Goal
Allow admins (admin / timeslip_admin) to manually create a timeslip from the Driver Timeslips page, filling in all fields rather than only generating from Shipday.

## UI changes
- `src/pages/DriverTimeslips.tsx`: add a third button in the admin action row, "Create Timeslip" (Plus icon). Opens a new dialog.
- New component `src/components/timeslips/CreateTimeslipDialog.tsx`, modelled on `TimeslipEditDialog`, with these fields:
  - Driver (Select, loaded from active drivers — same source the existing filters/bulk assign dialog use)
  - Date (date picker, defaults to today)
  - Driving hours, Number of stops (stop hours auto = stops × 10 / 60), Lunch hours
  - Hourly rate (default 11), Van allowance (default 0), Mileage (auto-fill 160 when van allowance > 0, same rule as edit dialog)
  - Vehicle (Select, optional — same list as edit dialog via `listVehicles`)
  - Status (draft / approved / rejected, default draft)
  - Custom add-ons (title + hours, add/remove rows — same UI as edit dialog)
  - Admin notes (textarea)
  - Live summary card showing total hours and total pay
- Validation: driver and date required; numeric fields ≥ 0.

## Service / data
- Add `createTimeslip(input)` to `src/services/timeslipService.ts` that inserts into `timeslips` with: `driver_id`, `date`, `status`, `driving_hours`, `total_stops`, `stop_hours`, `lunch_hours`, `hourly_rate`, `van_allowance`, `mileage`, `vehicle_id`, `custom_addons`, `custom_addon_hours`, `admin_notes`, plus empty `route_links: []` and `job_locations: []`. `total_hours` and `total_pay` are computed columns in the DB, so we don't set them. Returns the inserted row mapped the same way as the other service methods.
- No DB schema changes; existing RLS on `timeslips` already permits timeslip admins to insert.

## Wire-up
- In `DriverTimeslips.tsx` add a `createMutation` using the new service method, invalidate the `timeslips` query on success, toast success/error, and close the dialog.

## Out of scope
- No changes to generation flow, edit dialog, QuickBooks bill creation, or driver-side views.
