

## Phase 2: Customer Inventory Portal

### What it does
Gives B2B/B2C customers a "My Stock" page where they can see their stored inventory and request a delivery from it. When they request delivery, a new order is created pre-filled with the stock item details, and the warehouse stock status changes to "reserved".

### Changes

**1. `src/services/warehouseStockService.ts`** -- Add customer-scoped query
- Add `getMyWarehouseStock(userId: string)` -- fetches only items where `user_id = userId` and `status IN ('stored', 'reserved')`
- Add `requestDeliveryFromStock(stockId: string, deliveryAddress: object, userId: string)` -- updates stock status to `reserved`, creates a new order via `createOrder` with bike details pre-filled, and sets `linked_order_id` on the stock item

**2. `src/pages/MyStockPage.tsx`** -- New customer-facing page
- Shows a card-based list of the customer's stored items (brand, model, type, value, storage duration)
- Summary stats: total items stored, items reserved for delivery
- Each stored item has a "Request Delivery" button that opens a dialog
- The dialog collects receiver details (name, phone, email, address) -- reusing the same address/contact pattern from CreateOrder
- On submit: creates order + marks stock as reserved
- Shows reserved items with a badge linking to the order

**3. `src/App.tsx`** -- Add route
- `/my-stock` route wrapped in `ProtectedRoute` (no adminOnly, accessible to all authenticated users)

**4. `src/components/Layout.tsx`** -- Add nav link for customers
- Add "My Stock" link with `Package` icon in the authenticated user nav section (visible to B2B and B2C customers, not admin-only)

**5. `src/components/ProtectedRoute.tsx`** -- No changes needed
- B2B/B2C customers already pass through the standard auth check; no role restriction needed

### Technical Details

- The existing RLS policy `warehouse_stock_owner_select` already allows customers to SELECT their own stock (`user_id = auth.uid()`)
- Customers cannot UPDATE warehouse_stock directly (no RLS policy for customer updates), so the `requestDeliveryFromStock` function will need to work through an approach that the customer can execute. Two options:
  - **Option A**: Add a customer UPDATE RLS policy scoped to their own items and only allowing status changes to 'reserved'
  - **Option B**: Use an RPC function (security definer) that validates ownership and performs the update
- **Recommended: Option A** -- Add a narrow customer UPDATE policy. The service function will handle creating the order and updating the stock status in sequence.

### Database Migration
```sql
-- Allow customers to update their own stock (status to reserved + linked_order_id)
CREATE POLICY "warehouse_stock_owner_update" ON public.warehouse_stock
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
```

### Flow
```text
Customer opens "My Stock"
  → Sees list of their stored items (fetched via RLS owner_select)
  → Clicks "Request Delivery" on an item
  → Dialog: enters receiver name, phone, email, address
  → Submit:
      1. Creates order with bike details from stock item
      2. Updates stock status to 'reserved' + sets linked_order_id
  → Item shows as "Reserved" with link to order
```

