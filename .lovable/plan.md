# Label updates: remove FROM details and add service/box/NI indicators

## Goal
Change the printed 4x6 collection/delivery labels so they no longer show the sender (FROM) details, and add small visual indicators for:
- Inspect & service jobs: cog + spanner icons
- Box My Bike jobs: box icon
- Northern Ireland jobs: "NI" badge

## Decisions from clarification
- Inspect/service indicator: shown when `order.needsInspection === true`.
- "NI" badge: shown when `order.isNorthernIreland === true`.
- Icons will be image files embedded in the PDF (not drawn with PDF primitives).

## Plan

### 1. Create icon assets
Generate or source three small black-line PNG icons suitable for a 4x6 label printer and place them in `public/`:
- `label-icon-cog.png`
- `label-icon-spanner.png` (wrench)
- `label-icon-box.png`

Keep them small (e.g. 48x48 px), monochrome, with transparent or white backgrounds so they render cleanly on white labels.

### 2. Refactor `src/utils/labelUtils.ts`
Both `generateSingleOrderLabel` and `generateBulkCollectionLabels` use `renderLabelPage`, so changes in one place cover both paths.

#### 2a. Remove the FROM / sender block
Delete the sender name, address and phone rendering from `renderLabelPage`. The receiver (TO) block stays.

#### 2b. Add an indicator header
After the tracking number and bike item lines, add a new row that shows the relevant icons/badges for the order:
- If `order.needsInspection === true`: draw the cog icon followed by the spanner icon, with a small "SERVICE" label.
- If `order.isBoxMyBike === true`: draw the box icon, with a small "BOX" label.
- If `order.isNorthernIreland === true`: draw a boxed "NI" text badge.

Multiple indicators can appear on the same label if they apply (e.g. a Northern Ireland box-my-bike order).

#### 2c. Layout adjustment
Because the FROM block is removed, pull the TO block and the contact/logo footer up so label space is used sensibly and nothing overflows the 4x6 page.

#### 2d. Safe image loading
Wrap each `pdf.addImage` icon call in a try/catch so a missing icon file does not break PDF generation. If an icon fails to load, fall back to the text label only (e.g. just "SERVICE" or "BOX").

### 3. Verify
- Run a TypeScript check to ensure no type errors after the refactor.
- Generate a sample single label and a sample bulk label from the UI (or via a small browser script) and visually confirm:
  - FROM details are gone.
  - Cog + spanner appear on inspection orders.
  - Box icon appears on Box My Bike orders.
  - "NI" badge appears on Northern Ireland orders.
  - Multi-bike labels still paginate correctly.

## Technical notes
- `labelUtils.ts` uses `jsPDF` in the browser; icon images will be loaded from the public path (`/label-icon-*.png`).
- The existing logo block already uses `pdf.addImage('/cycle-courier-logo.png', ...)`, so the same pattern applies for the new icons.
- No database or backend changes are required; this is a pure PDF-rendering change.
