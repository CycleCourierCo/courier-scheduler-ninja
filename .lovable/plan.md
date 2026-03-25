
Goal: make order detail views show unique bikes correctly (including size), with per-item quantities, instead of showing only the first bike + total quantity.

1) Confirmed root cause (from current code/data)
- The uploaded bulk order is stored correctly in `orders.bikes` (e.g., Medium/Large/X-Large variants are present as separate entries).
- The page the user is viewing (`/customer-orders/:id` in `src/pages/CustomerOrderDetail.tsx`) still renders legacy fields (`bikeBrand`, `bikeModel`, `bikeQuantity`) only.
- That is why it shows “Rogue Frame … (Medium), Quantity: 5” instead of a breakdown by unique item/size.

2) Add a shared bike-summary helper (single source of truth)
- Create a small utility (e.g. `src/utils/bikeSummary.ts`) to:
  - Normalize each bike entry.
  - Build uniqueness key using: `brand + model + size + type` (size-aware uniqueness).
  - Return grouped output like:
    - `[{ label: "Velduro Rogue Frame - No Shock (Large)", quantity: 3, ... }, ...]`
  - Fallback safely for older orders without `bikes` array (legacy single-bike fields).

3) Update detail UIs to use grouped bikes (not legacy first-bike fields)
- `src/pages/CustomerOrderDetail.tsx`:
  - Replace current “Item Details” rendering with grouped breakdown from helper.
  - Show:
    - Total quantity.
    - Per-unique-item lines with quantities (e.g., `3× ... (Large)`, `1× ... (Medium)`).
  - Keep customer order number/type/value display where relevant.
- `src/components/order-detail/ItemDetails.tsx`:
  - Use same helper so admin/customer detail behavior is consistent.
  - Replace raw `order.bikes.map(...)` list with grouped quantity list.

4) Fix misleading title/header text on order pages
- `src/pages/CustomerOrderDetail.tsx` card title currently shows only `order.bikeBrand order.bikeModel`.
- `src/pages/OrderDetail.tsx` header currently computes `itemName` from legacy fields.
- Update both to show a neutral multi-item summary when multiple bikes exist (e.g., “5 bikes (3 unique items)”) and only show single-bike title when truly single.

5) Preserve size fidelity in new bulk-created orders
- `src/services/bulkOrderService.ts` already appends size into model for dealer rows; keep that behavior.
- Ensure bike objects passed into `createOrder` preserve size-aware identity consistently so grouping remains accurate across all views.
- If needed, extend types in `src/types/order.ts` with optional `size?: string` on bikes for clearer future-proofing (non-breaking).

Validation checklist after implementation
- Re-open `/customer-orders/d9144317-a9ab-4d30-ac6d-79bdcf82d565` and verify it shows separate lines for Medium/Large/X-Large with correct counts.
- Verify a single-item order still shows the old simple layout correctly.
- Verify admin `OrderDetail` and customer `CustomerOrderDetail` now match in bike breakdown behavior.
- Verify mobile layout (360px) wraps long bike names without clipping.
