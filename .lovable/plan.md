# Electric bike checks on inspections

Add battery, motor and key checks to the inspection checklist, shown only when the bike is electric.

## Behaviour

- The inspection dialog already asks for a bike category first (e.g. "Electric MTB Hardtail", "Electric Cargo Bike").
- When the chosen category is an electric one, three extra checklist items appear below the standard four:
  - Battery — condition, charge holds, mounting/latch secure
  - Motor — runs through assist levels, no noise or errors
  - Key present — battery/lock key handed over with the bike
- Each new item works exactly like the existing ones: tick to complete, optional notes, and "Add issue" to raise a priced repair against it (issues are prefixed with the item label as today).
- The Confirm button stays disabled until all visible items are ticked, so on electric bikes all seven must be completed; on non-electric bikes nothing changes.
- If the category is switched from electric to non-electric mid-inspection, the electric items' ticks, notes and issues are cleared so nothing stale is saved.
- Completion notes saved on the inspection include the electric lines only when they applied.
- A missing key is recorded by ticking the item and either adding a note ("no key supplied") or raising an issue — it does not block completion.

## Technical notes

All changes are in `src/pages/BicycleInspections.tsx`:

- Split `INSPECTION_ITEMS` into the existing base list plus `ELECTRIC_INSPECTION_ITEMS` (`ebike_battery`, `ebike_motor`, `ebike_key`).
- Derive `isElectric` from `checklistBikeType` (case-insensitive match on "electric"; also treat "e-bike"/"ebike" as electric for safety), and build an `activeItems` array used by the render loop, `allItemsChecked`, `allChecklistIssues` label lookup, and the no-issue notes builder.
- Add an effect that, when `isElectric` becomes false, removes electric item keys from `inspectionChecklist`, `inspectionComments` and `checklistIssues`.

No database or service changes: items are captured as inspection notes and issues, which already support arbitrary labels.
