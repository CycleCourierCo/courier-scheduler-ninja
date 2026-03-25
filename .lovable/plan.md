

## Phase 1: Warehouse Stock Intake System

### What it does
Creates a `warehouse_stock` table to track customer inventory stored at the depot, and an admin-only page to log incoming stock with bike details and storage location.

### Database Migration

**New table: `warehouse_stock`**

```sql
CREATE TYPE public.warehouse_stock_status AS ENUM ('stored', 'reserved', 'dispatched', 'returned');

CREATE TABLE public.warehouse_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,  -- customer who owns the stock
  deposited_by uuid,      -- admin/staff who logged it
  
  -- Item details (mirrors order bike fields)
  bike_brand text,
  bike_model text,
  bike_type text,
  bike_value numeric,
  item_notes text,
  
  -- Storage location
  bay text NOT NULL,           -- A-D
  position integer NOT NULL,   -- 1-20
  
  -- Status tracking
  status warehouse_stock_status NOT NULL DEFAULT 'stored',
  linked_order_id uuid,        -- null until booked for delivery
  
  -- Timestamps
  deposited_at timestamptz NOT NULL DEFAULT now(),
  dispatched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Prevent duplicate bay/position for active stock
  CONSTRAINT unique_active_location UNIQUE (bay, position)
    -- We'll handle conflict checking in app logic since dispatched items free up slots
);

-- RLS
ALTER TABLE public.warehouse_stock ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "warehouse_stock_admin_select" ON public.warehouse_stock
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid, 'admin')));

CREATE POLICY "warehouse_stock_admin_insert" ON public.warehouse_stock
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid, 'admin')));

CREATE POLICY "warehouse_stock_admin_update" ON public.warehouse_stock
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid, 'admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid, 'admin')));

CREATE POLICY "warehouse_stock_admin_delete" ON public.warehouse_stock
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid, 'admin')));

-- Loader access (select + update only)
CREATE POLICY "warehouse_stock_loader_select" ON public.warehouse_stock
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid, 'loader')));

CREATE POLICY "warehouse_stock_loader_update" ON public.warehouse_stock
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid, 'loader')))
  WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid, 'loader')));

-- Customer can see their own stock
CREATE POLICY "warehouse_stock_owner_select" ON public.warehouse_stock
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Updated_at trigger
CREATE TRIGGER update_warehouse_stock_updated_at
  BEFORE UPDATE ON public.warehouse_stock
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Code Changes

**1. `src/types/warehouseStock.ts`** -- New type file
- Export `WarehouseStock` type matching the table schema
- Export `WarehouseStockFormData` for the intake form

**2. `src/services/warehouseStockService.ts`** -- New service
- `getWarehouseStock()` -- fetch all stock (admin) or user's stock
- `addWarehouseStock(data)` -- insert new stock item
- `updateWarehouseStock(id, data)` -- update item
- `removeWarehouseStock(id)` -- delete item
- `getCustomerList()` -- fetch profiles for customer selector dropdown

**3. `src/pages/WarehouseStockPage.tsx`** -- New admin page
- Table view of all warehouse stock with columns: Customer, Item (brand/model/type), Location (bay+position), Status, Deposited date
- "Add Stock" button opens a dialog with:
  - Customer selector dropdown (fetches from profiles)
  - Bike details fields: brand, model, type, value (same pattern as create-order)
  - Storage location: bay (A-D) + position (1-20) -- same pattern as StorageLocation component
  - Notes field
- Edit and remove actions per row
- Filter by status and customer

**4. `src/App.tsx`** -- Add route
- `/warehouse-stock` route, wrapped in `ProtectedRoute adminOnly={true}`

**5. `src/components/Layout.tsx`** -- Add nav link
- Add "Warehouse Stock" link with `Warehouse` icon in admin menu section

### No unique constraint on bay+position
Instead of a DB constraint (which would block reuse after dispatch), the service layer will check for conflicts among `status IN ('stored', 'reserved')` items before inserting.

