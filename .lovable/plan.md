
# Add Mechanic User Role for Bicycle Inspections

## Overview

Create a new "mechanic" user role that has exclusive access to the Bicycle Inspections page, similar to how "loader" only has access to the Loading page. Mechanics will be able to perform all inspection tasks on the page.

---

## Current Role System

| Role | Current Access |
|------|----------------|
| admin | Full access to all features |
| driver | Timeslips, Check-in, Profile |
| loader | Loading page only |
| route_planner | Dashboard, Scheduling |
| sales | Dashboard, Approvals, Invoices |
| b2b_customer | Dashboard, Orders, Inspections (own) |
| b2c_customer | Dashboard, Orders |

---

## New Mechanic Role

| Attribute | Value |
|-----------|-------|
| Role Name | mechanic |
| Access | Bicycle Inspections page only |
| Capabilities | All inspection tasks (mark inspected, report issues, mark repaired, etc.) |
| Default Redirect | /bicycle-inspections |

---

## Files to Modify

| File | Changes |
|------|---------|
| Database Migration | Add 'mechanic' to `user_role` enum |
| `src/types/user.ts` | Add 'mechanic' to UserRole type |
| `src/components/ProtectedRoute.tsx` | Add mechanic role restrictions |
| `src/components/Layout.tsx` | Add navigation for mechanic role |
| `src/pages/UserManagement.tsx` | Add mechanic option in role dropdowns |
| `src/components/user-management/EditUserDialog.tsx` | No changes needed (uses role from select) |
| `src/pages/BicycleInspections.tsx` | Update admin check to include mechanic |

---

## Implementation Details

### 1. Database Migration

```sql
-- Add 'mechanic' to user_role enum
ALTER TYPE user_role ADD VALUE 'mechanic';
```

### 2. Update TypeScript UserRole Type (`src/types/user.ts`)

```typescript
export type UserRole = 'admin' | 'b2b_customer' | 'b2c_customer' | 'driver' | 'loader' | 'mechanic' | 'route_planner' | 'sales';
```

### 3. Update ProtectedRoute (`src/components/ProtectedRoute.tsx`)

Add mechanic role restrictions after the loader check:

```typescript
// After loader check (around line 70)
// Mechanic role restrictions - only allow access to bicycle inspections
const isBicycleInspectionsPage = location.pathname === '/bicycle-inspections';
if (userProfile?.role === 'mechanic') {
  if (!isBicycleInspectionsPage) {
    return <Navigate to="/bicycle-inspections" replace />;
  }
  return <>{children}</>;
}
```

### 4. Update Layout Navigation (`src/components/Layout.tsx`)

Add mechanic-specific navigation:

```typescript
// Add role check
const isMechanic = userProfile?.role === 'mechanic';

// Add mechanic nav links (similar to driver)
const mechanicNavLinks = isMechanic ? <>
  <Link to="/bicycle-inspections" onClick={closeSheet} className="text-foreground hover:text-courier-500 transition-colors">
    Bicycle Inspections
  </Link>
</> : null;
```

Also update the mobile and desktop menus to show mechanic-specific options.

### 5. Update UserManagement Page (`src/pages/UserManagement.tsx`)

Add mechanic option to role select dropdowns:

```typescript
<SelectItem value="mechanic">Mechanic</SelectItem>
```

### 6. Update BicycleInspections Page (`src/pages/BicycleInspections.tsx`)

Update the admin check to include mechanic for full management access:

```typescript
const isAdmin = userProfile?.role === "admin";
const isMechanic = userProfile?.role === "mechanic";
const canManageInspections = isAdmin || isMechanic;

// Replace isAdmin checks with canManageInspections where appropriate
```

---

## Access Control Summary

```text
┌─────────────────────────────────────────────────────────┐
│              Mechanic Role Access                       │
├─────────────────────────────────────────────────────────┤
│ ✅ Bicycle Inspections Page                             │
│    - View all pending inspections                       │
│    - Mark inspected (no issues) with checklist          │
│    - Report issues with costs                           │
│    - Mark issues as repaired                            │
│    - Complete repairs workflow                          │
│    - Reset inspections                                  │
├─────────────────────────────────────────────────────────┤
│ ❌ All other pages redirect to /bicycle-inspections     │
└─────────────────────────────────────────────────────────┘
```

---

## Navigation for Mechanic (Mobile & Desktop)

```text
┌────────────────────────┐
│ [User Profile Icon] ▼  │
├────────────────────────┤
│ mechanic@example.com   │
│ ─────────────────────  │
│ 🔧 Bicycle Inspections │
│ 👤 Your Profile        │
│ ─────────────────────  │
│ 🚪 Logout              │
└────────────────────────┘
```

---

## Summary

| Task | Description |
|------|-------------|
| Add database enum value | Add 'mechanic' to user_role enum |
| Update TypeScript type | Add 'mechanic' to UserRole union |
| Add route protection | Restrict mechanic to bicycle-inspections only |
| Add navigation | Show inspection link in header menu |
| Add to user management | Allow admins to assign mechanic role |
| Grant inspection access | Allow mechanics to perform all inspection tasks |
