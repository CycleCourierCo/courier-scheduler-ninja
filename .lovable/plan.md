

## Restructure Bulk Upload Preview Table

### What changes

The preview table currently has a single "Types" column showing combined brand+model text. Instead:

1. **Replace columns**: Remove the combined "Types" column. Add three separate columns: **Brand**, **Model** (with size included), and **Type** (the pricing category like "Electric Bike - Under 25kg").

2. **Make fields editable**: Each bike row's Brand, Model, and Type will be editable inline. Type will use a dropdown select populated from `BIKE_TYPE_BY_ID` values. Brand and Model will be text inputs.

3. **Expand rows for multi-bike orders**: Orders with multiple bikes will show one sub-row per bike so each can be edited independently.

### Technical details

**File: `src/pages/BulkOrderUpload.tsx`**

- Update table headers: `☐ | Order # | Receiver | Postcode | Qty | Brand | Model | Type | Status`
- For each order, render one row per bike (or a parent row with sub-rows). Each bike shows:
  - **Brand**: editable `<Input>` defaulting to `bike.brand`
  - **Model**: editable `<Input>` defaulting to `bike.model` (already contains size from the parser, e.g. "Rogue Frame (Large)")
  - **Type**: editable `<Select>` with all values from `BIKE_TYPE_BY_ID`, defaulting to `bike.type`
- Add an `updateBike` handler that updates the specific bike in `groupedOrders` state by order key + bike index
- The checkbox, order #, receiver, postcode, and status cells span all bike rows for that order using `rowSpan`

**File: `src/services/bulkOrderService.ts`**

- No changes needed — the model field already includes size (e.g. `"Rogue Frame (Large)"`) from the dealer parser's `groupRowsByOrderNumber` function

