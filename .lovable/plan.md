

## Add purchase date + daily DVLA refresh cron

### 1. Schema change

Add to `vehicles` table:
- `purchase_date date NULL` — when the van was bought (user input on add).

Migration only adds the column; existing rows stay `NULL`.

### 2. Add Vehicle dialog

`src/components/vehicles/AddVehicleDialog.tsx`:
- New "Purchase date" field (date input via shadcn `Input type="date"` for simplicity / mobile-friendly), shown alongside Status.
- Default to today.
- Pass `purchase_date` into `createVehicle()`.

### 3. Edit Vehicle dialog

`src/components/vehicles/EditVehicleDialog.tsx`:
- Add editable Purchase date field so existing vehicles can be back-filled.

### 4. Vehicle Management page

`src/pages/VehicleManagement.tsx`:
- Add "Purchased" column in the table (formatted `dd MMM yyyy`, "—" if null).
- Show on the mobile card too.

### 5. Daily refresh cron

New edge function `supabase/functions/refresh-vehicles/index.ts`:
- Auth: requires `X-Cron-Secret` header matching the existing `cron_secret` vault entry (same pattern as `invoke_generate_timeslips`).
- Loads all vehicles, calls DVLA VES for each registration sequentially with a small delay (DVLA rate limits), updates DVLA-sourced fields + `last_refreshed_at` + `ves_raw`.
- Logs counts (success / failed) without printing PII (just registrations + status code per the sanitization rules).
- Failures on individual regs do not abort the run.

DB cron job (via insert tool, not migration — contains anon key per `schedule-jobs-supabase-edge-functions` rule):
- Wrapper SQL function `public.invoke_refresh_vehicles()` (SECURITY DEFINER) that fetches `cron_secret` from vault and `net.http_post`s the function — same pattern as `invoke_generate_timeslips`.
- `cron.schedule('refresh-vehicles-daily', '0 3 * * *', $$ select public.invoke_refresh_vehicles(); $$)` — runs 03:00 UTC daily (off-peak).

### 6. Files

**New**
- migration: `ALTER TABLE vehicles ADD COLUMN purchase_date date`.
- `supabase/functions/refresh-vehicles/index.ts`.
- DB function `invoke_refresh_vehicles` + cron job entry (via insert tool).

**Modified**
- `src/components/vehicles/AddVehicleDialog.tsx` — purchase date field.
- `src/components/vehicles/EditVehicleDialog.tsx` — purchase date field.
- `src/pages/VehicleManagement.tsx` — Purchased column / card line.
- `src/services/vehicleService.ts` — type already inherits from generated `VehicleInsert/Update` so no manual change needed once migration runs.

### Verification

- Add a new van → pick purchase date → row shows the date in the table.
- Edit an existing van → set purchase date → persists.
- Manually invoke `refresh-vehicles` (with `X-Cron-Secret`) → all vehicles' `last_refreshed_at` updates; tax/MOT changes (if any) reflected.
- Cron job listed in `cron.job` with schedule `0 3 * * *`.

