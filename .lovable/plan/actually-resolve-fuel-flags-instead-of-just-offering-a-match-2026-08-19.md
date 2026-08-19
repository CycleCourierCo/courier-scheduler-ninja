# Actually resolve fuel flags instead of just offering a match

Right now, picking a vehicle for an unknown registration only saves a mapping. The wrong registration stays attached to the fill rows, and the same fill often re-appears immediately as a different flag, so nothing feels resolved. This change makes a fix genuinely close the issue and remove it from the list.

## What changes

**Matching an unknown registration**
- Picking a vehicle rewrites the affected fuel rows: they get the vehicle, and their working registration becomes the fleet vehicle's registration, so the mis-typed reg no longer shows anywhere in the analysis (the original invoice text is still kept on the row for audit).
- The rows are stamped as corrected, with who did it and when.
- The unknown-registration flag is closed out permanently, so it cannot bounce back on the next refresh.
- "Not ours" behaves the same way: the reg is marked ignored, the flag is closed, and those fills stop being counted as unmatched spend.

**Fix dialog for individual fills**
- On save, the corrected rows are stamped, and the flag that was being fixed is closed out so it disappears from the list rather than re-computing.

**Immediate feedback**
- A resolved flag vanishes from the list the moment the fix succeeds, without waiting for the data to reload, and the flag counter updates with it.
- If resolving a fill surfaces a genuinely new issue (e.g. that vehicle has fuel but no timeslip mileage), that new flag appears as its own item — it will not silently reuse the old one.

**Resolved vs dismissed**
- Flags closed by a fix are recorded as resolved with a short note ("matched to <reg>", "fill corrected"), distinct from a plain manual dismiss, so the "Restore dismissed flags" button no longer resurrects issues that were actually fixed.

## Technical notes

- `src/services/fuelInvoiceService.ts`: extend `saveRegAlias` to also set `normalised_reg`, `correction_note`, `corrected_at`, `corrected_by` on matched rows; add a `resolveAnomaly(key, note)` helper writing to `fuel_anomaly_dismissals` with a `resolved` marker in the note; keep `analyseFuel` filtering on the same dismissal set.
- `src/components/fuel/FuelInvoiceAnalysisSection.tsx`: local `resolvedKeys` state merged into the dismissal set used by `analyseFuel` for instant hiding; alias mutation takes the anomaly key so it can resolve it; separate the resolved keys out of the "restore dismissed" action.
- `src/components/fuel/FixFlagDialog.tsx`: call `resolveAnomaly` with the anomaly key after a successful save and report the resolved key back to the parent.
- No schema change needed — `correction_note`, `corrected_at`, `corrected_by` already exist on `fuel_transactions`.
