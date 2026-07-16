## Goal

Import the uploaded `supabase_import.sql` (bicycle labour time reference data) into the connected Supabase database as two new tables in `public`.

## What gets created

1. **`public.labour_times`** — 36 rows of standard workshop repair times (repair_id PK, bike_type, category, repair_name, labour_minutes, min_charge_gbp, difficulty, skill_level, tools, parts, flags for safety/warranty/test-ride/torque/calibration/suspension/brake-bed-in, notes). Indexes on `bike_type`, `category`, `repair_name`.
2. **`public.labour_time_multipliers`** — modifier PK, adjustment_type (percent/minutes), value, applies_to, notes. ~18 rows covering things like internal routing, carbon, ebike, seized components, etc.

Both use `create table if not exists` + `on conflict do nothing`, so re-running is safe.

## Additions required on top of the uploaded SQL

The file as-is doesn't include the grants/RLS that this project requires. The migration will run the uploaded SQL verbatim, then append:

- `GRANT SELECT ON public.labour_times, public.labour_time_multipliers TO authenticated;`
- `GRANT ALL ON public.labour_times, public.labour_time_multipliers TO service_role;`
- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` on both
- Read policy: any authenticated user can `SELECT` (reference data, no writes from client)

No `anon` grant — reference data is only shown to signed-in staff.

## Not doing

- No UI wiring yet. Just the import. Once loaded you can tell me where you want to surface these (e.g. as a lookup in the inspection pricing flow to auto-suggest labour minutes/cost).
