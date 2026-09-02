# Uragano Sports 2025 stock build + parts intake

Load the spec sheet as a reusable stored build, create every part as a zero-quantity warehouse item, and add a proper "Receive stock" flow so parts can be booked into a bay when they physically arrive.

Owner account for all of this: `shopify@cyclecourierco.com`.

## 1. Stored build template

Create a stored build "Uragano Sports 2025" (brand Uragano, model Sports, type Gravel) with 18 items, each carrying the exact spec text from the PDF in the item notes:

| Category | Spec |
| --- | --- |
| Frame | URAGANO SPORTS Carbon |
| Fork | URAGANO SPORTS, Suspension Fork |
| Shifters | LTWOO eGR 12 speed |
| Front derailleur | LTWOO eGR, 2x12 speed |
| Rear derailleur | LTWOO eGR 12 speed, Max 34T |
| Crankset | Senicx crank, 42T |
| Cassette | SUGEK, 12 speed, 11-46T |
| Chain | KMC 12X |
| Bottom bracket | Senicx BSA |
| Front brake | LTWOO ERG Hydraulic Disc Brake |
| Rear brake | LTWOO ERG Hydraulic Disc Brake |
| Brake rotors | ASMRT, 160mm (x2) |
| Front wheel | MVMT M-Bronze R50 Carbon, 50mm rim depth, 100x12mm thru axle |
| Rear wheel | MVMT M-Bronze R50 Carbon, 50mm rim depth, HDR freehub, 142x12mm thru axle |
| Tyres | WTB Riddler 700x45C (x2) |
| Handlebar | Pardus Alloy |
| Stem | MVMT M Dark |
| Dropper post | Dropper Seat Post |
| Saddle | X Base Boost |

Clicking "Start build" on this template keeps working as it does today: it allocates any matching in-stock parts automatically.

No standalone bike row is added to warehouse stock — template only, as requested.

## 2. Parts created at quantity 0

One warehouse component row per distinct part above, quantity 0, with the spec text stored on the row so it reads exactly as the PDF does. Rows sit in a holding bay label (`UNALLOCATED`) until they are received into a real bay.

Zero-quantity rows are shown in the stock list with an "Out of stock" badge so they read as a catalogue entry rather than physical stock.

## 3. Receive stock dialog

New action on each component row: **Receive**. It asks for
- quantity received (added to the existing quantity),
- bay and position (pre-filled from the row when it already has one),
- optional note.

On save the row's quantity increases, bay/position are set, and status becomes `stored`. This keeps a single row per part rather than creating duplicates, so the build allocator always sees one accurate count.

## Technical notes

- No migration needed for the template spec text: `bike_build_template_items.notes` already exists and holds the spec string. Component rows use the existing `warehouse_stock.spec` column.
- Template plus the 18 stock rows are inserted with a data script (run_sql), not a schema migration.
- `warehouse_stock` has no unique constraint on `(bay, position)`, so the `UNALLOCATED` holding bay is safe for the zero-quantity rows.
- UI work: a `ReceiveStockDialog` component, wired into the component rows in `src/pages/WarehouseStockPage.tsx`; quantity/bay update handled by a new function in `src/services/warehouseStockService.ts`.
- `BuildTemplateDialog` gains a per-item spec field so future templates can be entered with the same detail the PDF import uses.
