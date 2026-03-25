

## Fix Multi-Bike Order Grouping Display

### Problem
When multiple rows share an Order Number but have different bikes (e.g., 2x Medium Mountain Bike + 3x Small Road Bike), the system stores all bikes in the `bikes` array correctly, but:
1. The **preview table** only shows a count badge and truncated type list — no brand/model details per bike
2. The **order creation** sets `bike_brand`, `bike_model`, `bike_type` to only the first bike's values and `bike_quantity` to the total count, making it look like 5 of the same bike in the dashboard

### Changes

**1. `src/services/bulkOrderService.ts`**
- Update `groupedOrderToFormData` to set `bike_quantity` to the actual `bikes.length` (this part is already correct)
- Ensure the `bikes` array preserves all unique entries — no deduplication issues
- The legacy `bikeBrand`/`bikeModel`/`bikeType` fields are only for backward compat display; leave as first bike but this is fine since the `bikes` array has full detail

**2. `src/pages/BulkOrderUpload.tsx`**
- Expand the preview table's "Bikes" column to show a detailed breakdown: list each unique bike with brand, model, and quantity (e.g., "2× Canyon