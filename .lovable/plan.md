## Bulk Assign Vehicle to Timeslips

Add an admin tool on the Driver Timeslips page that assigns one vehicle to all timeslips for a chosen driver within a chosen date range.

### UX
- New "Bulk Assign Vehicle" button (admin only) next to "Generate Timeslips".
- Opens a dialog with:
  - Driver picker (reuses existing driver list from `TimeslipFilters`).
  - Date range (start + end) using shadcn date pickers.
  - Vehicle picker (active vehicles only, same filter as `TimeslipEditDialog`).
  - Optional toggle: "Only fill timeslips with no vehicle" (default on) so existing assignments aren't overwritten.
  - Preview count: "X timeslips will be updated" before confirming.
- Confirm button runs the update, shows a toast with the count, and refreshes the list.

### Technical
- New `BulkAssignVehicleDialog.tsx` in `src/components/timeslips/`.
- New `timeslipService.bulkAssignVehicle({ driverId, dateFrom, dateTo, vehicleId, onlyEmpty })` that runs a single `supabase.from('timeslips').update({ vehicle_id }).eq('driver_id', ...).gte('date', ...).lte('date', ...)` (with `.is('vehicle_id', null)` when `onlyEmpty`). Returns affected count.
- Preview uses the same filters with `select('id', { count: 'exact', head: true })`.
- No DB schema changes — `vehicle_id` column already exists.
- Invalidate `['timeslips']` query on success.

### Out of scope
- Bulk editing other fields (rate, mileage, approval).
- Editing timeslips outside the admin role.