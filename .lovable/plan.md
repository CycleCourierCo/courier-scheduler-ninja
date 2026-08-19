# Fix flagged fuel issues inline

Right now the Flags tab on the Fuel Finder admin section only lets you dismiss a flag. Registration fixes are only possible in the Overview tab, and there is no way to correct an individual fill. This adds a "Fix" action to each flag.

## What you'll be able to do

For each flag, next to Dismiss:

- **Unknown registration** — match it to a fleet vehicle (with the suggested closest match pre-offered) or mark it as "not ours / ignore", straight from the flag. Same effect as the Overview matcher: all fills with that registration get re-linked and the flag disappears.
- **Large fill / duplicate fill / fuel with no timeslip / MPG flags** — a "Fix" dialog for the specific fill(s) behind the flag, where you can:
  - reassign the fill to a different vehicle (for when fuel was put in the wrong van's card record),
  - correct the litres and net amount if the invoice was mis-read,
  - correct the date/time,
  - add a short note explaining the fix.
- After any fix the numbers (MPG, cost per mile, per-vehicle table, flags) recompute automatically.
- Dismiss stays as-is for "checked, nothing wrong".

Every fix is admin-only, matching the existing fuel section.

## Technical notes

- `FuelAnomaly` gains optional `transactionIds: string[]`, `normalisedReg`, and `vehicleId` so the UI can act on the underlying rows instead of parsing the anomaly key. `analyseFuel` in `src/services/fuelInvoiceService.ts` populates these where known.
- New service functions in `fuelInvoiceService.ts`:
  - `updateFuelTransaction(id, updates)` — patches `vehicle_id`, `quantity_litres`, `net_amount`, `gross_amount`, `trx_date`, `trx_time`, plus a `correction_note`.
  - reuse existing `saveRegAlias` for the registration path (it already re-links matching transactions).
- Migration: add nullable `correction_note text` and `corrected_at timestamptz` / `corrected_by uuid` to `fuel_transactions` so corrections are auditable. No new tables, existing RLS/grants on `fuel_transactions` apply.
- UI: new `src/components/fuel/FixFlagDialog.tsx`; `FuelInvoiceAnalysisSection.tsx` renders per-flag actions and invalidates the `fuel-transactions` query on success.
- Recomputation is client-side (analysis already derives from the fetched transactions), so no extra reload logic is needed beyond query invalidation.
