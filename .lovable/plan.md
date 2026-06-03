### Problem
The "Box My Bike" link in the sidebar (`src/components/ui/sidebar.tsx`) is currently visible only to `admin` users. The user wants it shown for **admin**, **mechanic**, and **customer** roles (both B2B and B2C).

Additionally, the `Layout.tsx` mobile/desktop navigation menus do not include a "Box My Bike" link at all, so mobile and dropdown users have no way to reach the page.

### Changes

#### 1. Update `src/components/ui/sidebar.tsx`
- Replace the legacy `isAdmin = userProfile?.role === 'admin'` check with the `hasRole` helper from `@/lib/roles`.
- Move the "Box My Bike" link out of the admin-only block and into a shared block visible to `admin`, `mechanic`, `b2b_customer`, and `b2c_customer`.
- Keep existing admin-only links (Analytics, Bicycle Inspections) unchanged.

#### 2. Update `src/components/Layout.tsx`
- Add a "Box My Bike" link to the **mobile sheet menu** for admin, mechanic, B2B, and B2C users.
- Add a "Box My Bike" link to the **desktop user dropdown menu** for the same roles.
- Place the link in a logical position near Dashboard / Profile.

### Technical Details
- Use existing `hasRole` utility for consistency with the rest of the app.
- Use existing `Package2` icon from `lucide-react` (already used in sidebar.tsx).
- No database or backend changes required.
