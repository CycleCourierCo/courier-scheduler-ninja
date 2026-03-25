

## Add Bike Value Column to Bulk Upload Table

### What changes

Two things are missing:
1. The `value` field is not captured when parsing bikes from the uploaded file
2. The `value` column is not shown in the table, and it's not passed through to order creation

### Technical details

**File: `src/services/bulkOrderService.ts`**

1. In `groupRowsByOrderNumber` (line 253-258), add `value: r.bike_value || ""` to the bike object
2. In `groupedOrderToFormData` (line 353), change `value: undefined` to `value: b.value || undefined` so it passes through to order creation
3. In the `GroupedOrder` interface, the bikes array type already has `size?: string` -- no change needed since `value` will be a loose string property

**File: `src/pages/BulkOrderUpload.tsx`**

1. Add "Value (£)" table header after "Type"
2. Expand the `updateBike` field union type from `"brand" | "model" | "type"` to include `"value"`
3. Add a `<Input type="number">` cell for each bike row, bound to `bike.value` via `updateBike(key, bikeIdx, "value", ...)`

Three files touched, minimal changes -- just wiring the value field through parsing, display, and submission.

