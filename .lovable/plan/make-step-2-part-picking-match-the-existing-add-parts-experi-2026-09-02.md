# Make step 2 part picking match the existing "add parts" experience

Right now step 2 of the New build dialog is a flat searchable list of every part in that customer's stock. Make it work like the detail dialog's add-parts flow: pick an area on the bike first, then see the parts for that area with search.

## Flow

```text
Step 2 of 2 - pick parts
[ bike diagram with hotspots, ticked counts per area ]
Selected area: Drivetrain            [All parts]
search box
[ ] SRAM  Bottom bracket - SRAM BB DUB PF30
[ ] BB86  Bottom bracket - BB86 (41mm)
3 parts - £240.00 parts total
[Back]  [Create build]
```

- The same `BikeDiagram` used in the build detail dialog appears at the top of step 2, with per-area counts of what you have already ticked.
- Tapping an area filters the list to that area's categories; the existing "All parts" toggle still shows everything.
- Search stays per-area (same behaviour as the current picker toolbar).
- Ticked parts persist while you switch areas, and the footer keeps the running "n parts - £x parts total".
- Slot for each ticked part is still derived from its category on create, so nothing changes about how parts land on the diagram.
- Until an area is chosen the list shows all parts (as today), so nothing is hidden.

## Technical notes

- `src/pages/BuildMyBikePage.tsx`: in the `step === "parts"` block, render `BikeDiagram` above `StockPickerList`, add a `createHotspot` state set by `onSelectSlot`, pass it as the `hotspot` prop, and compute a `countsBySlot` map from `pickedParts` using `slotForCategory`.
- No changes to `StockPickerList` (it already supports `hotspot` filtering plus the "All parts" toggle) or to any service/database code.
- Keep the mobile width guards already on the dialog (`max-w-[calc(100vw-2rem)]`, `min-w-0`).
