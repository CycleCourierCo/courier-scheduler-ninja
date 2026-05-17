## Goal
Show which customer (the `user_id` profile, typically a B2B portal user) booked each order — both on the admin Order Detail page and as a column on the Dashboard table.

## Changes

### 1. Dashboard table — add visible "Customer" column
`src/components/OrderTable.tsx`
- An identical column already exists (`creator` / "Created By") but it's hidden by default. Rather than introduce a duplicate column, rename it for clarity:
  - In `ALL_COLUMNS`, change `{ id: "creator", label: "Created By" }` → `{ id: "creator", label: "Customer" }`.
  - Add `"creator"` to `DEFAULT_VISIBLE_COLUMNS` (placed first) so it shows by default for admins/route_planners.
  - Restrict default visibility to admin/route_planner roles (B2B customers already know themselves, so we skip adding it for them by filtering in the existing role-handling effect; if it was saved in their preferences we leave it alone).
  - Keep the existing fetch logic (`creatorNames` from `profiles.name || email`) untouched.

### 2. Order Detail — show the booking customer
`src/components/order-detail/OrderHeader.tsx` + `src/pages/OrderDetail.tsx`
- Extend `OrderHeaderProps` with an optional `customerName?: string` and `customerEmail?: string`.
- Render a small line under the title (admin context only): `Booked by: <name> <muted email>` using semantic tokens. Hidden when no value supplied.
- `OrderDetail.tsx`:
  - Add a small `useQuery` (or inline `useEffect`) that fetches `profiles.name, email` for `order.user_id` once the order is loaded.
  - Pass `customerName` / `customerEmail` props to `<OrderHeader>`.

### 3. No backend / RLS changes
- `profiles` already readable by admins/sales (existing `Consolidated profiles SELECT policy`), so this works for the admin Order Detail page.
- No new tables, columns, or migrations.

## Technical details
- Files touched:
  - `src/components/OrderTable.tsx` (rename label, default-visible array)
  - `src/components/order-detail/OrderHeader.tsx` (new optional props + render)
  - `src/pages/OrderDetail.tsx` (fetch profile, pass props)
- The `creator` column already calls `profiles.select('id, name, email')` keyed by `order.user_id`, so reusing it gives us exactly the requested "B2B customer who booked it".
- Customer-facing order page (`CustomerOrderDetail`) is intentionally unchanged — they already know it's their own.

## Out of scope
- No new global "booked by" field on the customer-facing tracking page.
- No filter logic changes (the existing admin-only Customer filter dropdown stays).
