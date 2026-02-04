
# Add Bicycle Inspections to Sidebar and Fix Menu Scrolling

## Overview

Two changes are needed:
1. Add "Bicycle Inspections" to the sidebar menu for admin users
2. Fix scrolling issues on both desktop dropdown menu and mobile sheet so all menu items are accessible

---

## Current Issues

| Issue | Location | Problem |
|-------|----------|---------|
| Missing menu item | `sidebar.tsx` | Bicycle Inspections not in sidebar for admins |
| Can't scroll desktop menu | `Layout.tsx` | Dropdown menu overflows viewport |
| Can't scroll mobile menu | `Layout.tsx` | Sheet content doesn't scroll properly |

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/ui/sidebar.tsx` | Add Bicycle Inspections link for admins |
| `src/components/Layout.tsx` | Add scrolling to dropdown and sheet menus |

---

## Implementation Details

### 1. Add Bicycle Inspections to Sidebar (`src/components/ui/sidebar.tsx`)

Add the `Wrench` icon import and include Bicycle Inspections in the admin links section:

```typescript
import {
  LayoutDashboard,
  Plus,
  User,
  BarChart3,
  CalendarDays,
  Users,
  ClipboardCheck,
  Wrench,  // ADD THIS
} from "lucide-react";

// In getDefaultLinks(), after Analytics:
if (isAdmin) {
  links.push({
    href: "/analytics",
    icon: <BarChart3 className="h-5 w-5" />,
    label: "Analytics",
  });
  links.push({
    href: "/bicycle-inspections",
    icon: <Wrench className="h-5 w-5" />,
    label: "Bicycle Inspections",
  });
}
```

### 2. Fix Desktop Dropdown Scrolling (`src/components/Layout.tsx`)

Add max-height and overflow to the DropdownMenuContent:

```typescript
<DropdownMenuContent 
  align="end" 
  className="max-h-[calc(100vh-100px)] overflow-y-auto"
>
```

This limits the dropdown height to viewport minus header space and enables vertical scrolling.

### 3. Fix Mobile Sheet Scrolling (`src/components/Layout.tsx`)

Wrap the sheet content in a scrollable container:

```typescript
<SheetContent side="right" className="w-[250px]">
  <div className="flex flex-col space-y-4 py-4 h-full overflow-y-auto">
    {/* existing menu items */}
  </div>
</SheetContent>
```

---

## Visual Result

### Sidebar (Admin View)
```
┌──────────────────────┐
│ 🚴 Cycle Courier     │
├──────────────────────┤
│ 📊 Dashboard         │
│ ➕ New Order         │
│ ✅ Jobs              │
│ 📅 Scheduling        │
│ 📈 Analytics         │
│ 🔧 Bicycle Inspections│ ← NEW
│ 👥 Account Approvals │
│ 👤 Profile           │
└──────────────────────┘
```

### Desktop Dropdown (with scroll)
```
┌────────────────────┐
│ Dashboard          │↑
│ Analytics          │░
│ Your Profile       │░
│ ──────────────     │░ ← Scrollable
│ User Management    │░
│ Loading & Storage  │░
│ Job Scheduling     │░
│ Driver Timeslips   │░
│ ...                │↓
└────────────────────┘
```

### Mobile Sheet (with scroll)
```
┌─────────────────────────┐
│ Home                    │↑
│ Track Order             │░
│ Create Order            │░
│ ─────────────           │░
│ Dashboard               │░ ← Scrollable
│ Analytics               │░
│ Your Profile            │░
│ ...                     │░
│ Bicycle Inspections     │░
│ Logout                  │↓
└─────────────────────────┘
```

---

## Summary

| Task | Description |
|------|-------------|
| Add sidebar link | Add Bicycle Inspections to sidebar for admin users |
| Desktop scroll | Add `max-h-[calc(100vh-100px)] overflow-y-auto` to DropdownMenuContent |
| Mobile scroll | Add `overflow-y-auto` to Sheet content container |
