## Vehicles page enhancements

### 1. New vehicle fields
Add to `vehicles` table via migration:
- `purchase_mileage` (integer, nullable) — captured when adding a vehicle
- `sold_date` (date, nullable) — required when status set to `sold`
- `sold_mileage` (integer, nullable) — required when status set to `sold`
- Toll/zone toggles (boolean, default false):
  - `clean_air_zones` (Gov Clean Air Zones)
  - `tyne_tunnel`
  - `mersey_tunnel`
  - `humber_bridge`
  - `tamar_bridge`

(Existing `london_auto_pay` and `dartford_crossing` remain.)

### 2. Add Vehicle dialog (`AddVehicleDialog.tsx`)
- New "Mileage at purchase" number input next to purchase date.
- New "Tolls & Zones" section with toggles for: London Auto Pay, Dartford, Clean Air Zones, Tyne Tunnel, Mersey Tunnel, Humber Bridge, Tamar Bridge.

### 3. Edit Vehicle dialog (`EditVehicleDialog.tsx`)
- Show purchase mileage field (editable).
- When status is changed to `sold`, reveal required "Sold date" (default today) and "Mileage at sale" inputs; block save until both filled.
- Same expanded Tolls & Zones toggles list as Add dialog.

### 4. Quick status change buttons
On the vehicles list page (`VehicleManagement.tsx`) row/card:
- Add a compact status action menu (dropdown of all `VEHICLE_STATUS_OPTIONS`) so the user can change status in one click without opening Edit.
- If the chosen status is `sold`, open a small modal prompting for sold date + sold mileage before persisting; otherwise call `updateVehicle` directly and toast.

### 5. Service layer (`vehicleService.ts`)
- Extend `VehicleInsert`/`VehicleUpdate` usage for the new fields (types come from regenerated Supabase types after migration).
- No new functions needed — `updateVehicle` already handles partial patches.

### Out of scope
- No changes to DVLA lookup, RLS, or list filtering.
- No reporting/analytics on sold vehicles in this pass.

### Technical notes
- All new columns nullable so existing rows are unaffected.
- Sold-date/mileage requirement enforced client-side (consistent with existing validation pattern); no DB CHECK constraint to keep flexibility.
