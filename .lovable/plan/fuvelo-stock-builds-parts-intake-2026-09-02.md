# Fuvelo stock builds + parts intake

Load all 14 spec sheets as reusable stored builds, create every distinct part as a zero-quantity warehouse item, and add a "Receive stock" flow so parts can be booked into a bay when they physically arrive.

Owner account for all of this: `shopify@cyclecourierco.com`.

## 1. Stored build templates (14)

One stored build per spec sheet, each with its ~19 parts and the exact spec text from the PDF carried on the item:

| Stored build | Brand / model | Type | Drivetrain |
| --- | --- | --- | --- |
| Uragano Sports 2025 | Uragano / Sports | Gravel | LTWOO eGR 12sp |
| Uragano Evo 2025 | Uragano / Evo | Gravel | SRAM Rival XPLR AXS |
| LightCarbon LCG071 eGR | LightCarbon / LCG071 | Gravel | LTWOO eGR 12sp |
| LightCarbon LCG071 GRX | LightCarbon / LCG071 | Gravel | Shimano GRX Di2 12sp |
| Spark Evo 2025 | Pardus / Spark Evo | Road | Shimano 105 12sp |
| Spark Sport 2025 | Pardus / Spark Sport | Road | LTWOO eR9 12sp |
| Super Evo 2025 | Pardus / Super Evo | Road | SRAM Rival eTap AXS |
| Super Sports 2025 | Pardus / Super Sports | Road | LTWOO eR9 12sp |
| LightCarbon LCR017 eR9 | LightCarbon / LCR017 | Road | LTWOO eR9 12sp |
| LightCarbon LCR017 UDi2 | LightCarbon / LCR017 | Road | Shimano Ultegra Di2 |
| Tavelo Arow UDi2 | Tavelo / Arow Race | Road | Shimano Ultegra Di2 |
| Tavelo Arow SL UDi2 | Tavelo / Arow SL | Road | Shimano Ultegra Di2 |
| Tavelo Arow SL 105 Di2 | Tavelo / Arow SL | Road | Shimano 105 Di2 |
| Tavelo Arow SL eRX | Tavelo / Arow SL | Road | LTWOO eRX 12sp |

Each build lists the same slots the sheets use, mapped onto the existing component categories: Frame, Fork, Shifters, Front derailleur, Rear derailleur, Crankset, Cassette, Chain, Bottom bracket, Front brake, Rear brake, Brake rotors, Front wheel, Rear wheel, Tyres, Handlebar, Stem, Seatpost, Saddle. Rows the sheet shows as "—" or "-" (no front derailleur on 1x builds, no separate stem on integrated cockpits) are skipped rather than added as empty parts.

Clicking "Start build" on any template keeps working as it does today: it allocates matching in-stock parts automatically.

No standalone bike rows are added to warehouse stock — templates only, as requested.

## 2. Parts created at quantity 0

One warehouse component row per **distinct** part spec across all 14 sheets, quantity 0, with the exact spec text stored on the row. Parts shared between builds (e.g. Continental tyres, DYC 12X chain, LC SP01 seatpost, MVMT M-Bronze R50 wheels) become a single shared row so counts stay accurate, giving roughly 130 distinct catalogue rows rather than 14 x 19 duplicates.

Rows sit in a holding bay label (`UNALLOCATED`) until received, and show an "Out of stock" badge in the stock list so they read as catalogue entries rather than physical stock.

## 3. Receive stock dialog

New action on each component row: **Receive**. It asks for
- quantity received (added to the existing quantity),
- bay and position (pre-filled from the row when it already has one),
- optional note.

On save the row's quantity increases, bay/position are set, and status becomes `stored`. One row per part is kept rather than creating duplicates, so the build allocator always sees one accurate count.

## Technical notes

- No migration needed: `bike_build_template_items.notes` holds the per-part spec string, and component rows use the existing `warehouse_stock.spec` column.
- The 14 templates, their items, and the deduped stock rows are inserted with a data script (run_sql), not a schema migration.
- `warehouse_stock` has no unique constraint on `(bay, position)`, so the `UNALLOCATED` holding bay is safe for zero-quantity rows.
- UI work: a `ReceiveStockDialog` component wired into the component rows in `src/pages/WarehouseStockPage.tsx`; quantity/bay update handled by a new function in `src/services/warehouseStockService.ts`.
- `BuildTemplateDialog` gains a per-item spec field so future templates can be entered with the same detail as the PDF import.
