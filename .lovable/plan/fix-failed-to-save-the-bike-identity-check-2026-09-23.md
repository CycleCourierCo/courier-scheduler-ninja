# Fix "Failed to save the bike identity check"

## What's going wrong

When a mechanic taps Submit on a bike check, the app first looks up that bike's inspection record. That lookup expects exactly one record per job. If a job has ended up with **two** inspection records, the lookup errors out and the whole submission fails with "Failed to save the bike identity check" — every retry fails the same way, so the mechanic is permanently stuck on that bike.

Confirmed in the live data: one job (tracking CCC754927671284LOUCO9) has two inspection records, both created within the same second today at 15:45. Nothing stops duplicates being created, so a double tap or a slow connection creates a second record and locks that bike out from then on.

The exact bike in Sami's screenshot can't be pinned down from the data (the Wake Green Road job shown is cancelled and has no inspection record), so the plan also makes the error message show the real reason instead of a generic failure, so the next occurrence is identifiable immediately.

## Fix

1. **Clean up the duplicate** — keep the older of the two records for that job (with any issues/notes attached) and remove the stray one, so Sami can submit that bike.
2. **Stop duplicates happening** — add a database rule allowing only one inspection record per job.
3. **Make the lookup tolerant** — take the earliest inspection record for a job rather than erroring when more than one exists, and if two submissions race, re-read the existing record instead of failing.
4. **Better error message** — the toast shows the underlying reason (e.g. permission or connection) rather than a generic "Failed to save the bike identity check".

No change to what's recorded on a check, to issue reporting, or to who can inspect.

## Technical notes

- Migration: delete the newer duplicate row in `bicycle_inspections` for order `fdee3213-b30e-4a15-a94d-98f47ec36fe3` (re-pointing any `inspection_issues` rows to the kept row first), then `CREATE UNIQUE INDEX ... ON public.bicycle_inspections (order_id) WHERE order_id IS NOT NULL`.
- `src/services/inspectionService.ts` → `getOrCreateInspection`: replace `.maybeSingle()` on the `order_id` lookup with `.order('created_at').limit(1)`; on insert failure with a unique-violation (`23505`) re-fetch the existing row and return it.
- `src/pages/BicycleInspections.tsx` → `handleConfirmInspection`: include the error message in the toast.
