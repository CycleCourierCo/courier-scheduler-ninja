## Add Vehicle Selection to Driver Timeslips

### Database
- Add `vehicle_id uuid` column to `timeslips` (nullable, references `vehicles(id)`).
- Add index on `(vehicle_id, date)` for mileage-by-vehicle reporting.

### Backend / Types
- Regenerated Supabase types will include the new column.
- Update `src/types/timeslip.ts` to include `vehicle_id?: string | null`.
- `timeslipService.updateTimeslip` already passes through arbitrary updates — no change needed.

### UI — `src/components/timeslips/TimeslipEditDialog.tsx`
- Fetch active vehicles via `listVehicles()` from `vehicleService` (filter out `sold`/`written_off`).
- Add a "Vehicle" `Select` next to Mileage showing `registration — make` for each vehicle, plus an "Unassigned" option.
- Persist `vehicle_id` in `onSave`.

### UI — `src/components/timeslips/TimeslipCard.tsx` (display)
- Show the assigned vehicle registration next to the mileage line so admins/drivers can see which van was used.

### Out of scope (for now)
- No changes to analytics yet — once data accrues we can add per-vehicle mileage to the Vehicles analytics tab in a follow-up.
- No auto-assignment logic; admin picks the vehicle when editing/approving the timeslip.
