
# Fix: Route Planners Can't See Admin Button or Open Orders

## Root Cause

There are **three places** in `OrderTable.tsx` that filter out the "actions" column for non-admin users. The previous fix only updated the button visibility condition (line 441), but the actions column itself is being **removed entirely** before it ever renders:

1. **Line 78**: A `useEffect` strips the "actions" column from `visibleColumns` for any non-admin role
2. **Line 165**: The `handleColumnChange` function filters out "actions" for non-admin roles
3. **Line 260 area / TableColumnSettings**: The column settings dropdown hides "actions" for non-admin roles

Additionally, when a route planner clicks a table row, the click handler just `return`s without navigating anywhere -- so clicking an order row does nothing.

## Solution

Update all three filtering locations to treat `route_planner` the same as `admin`:

### File: `src/components/OrderTable.tsx`

**1. useEffect (line 77-81)** -- Include route_planner in the check:
```typescript
useEffect(() => {
  if (userRole !== "admin" && userRole !== "route_planner" && visibleColumns.includes("actions")) {
    setVisibleColumns(prevColumns => prevColumns.filter(col => col !== "actions"));
  }
}, [userRole, visibleColumns]);
```

**2. handleColumnChange (line 163-169)** -- Include route_planner:
```typescript
const handleColumnChange = (columns: string[]) => {
  const filteredColumns = userRole !== "admin" && userRole !== "route_planner"
    ? columns.filter(col => col !== "actions") 
    : columns;
  setVisibleColumns(filteredColumns);
};
```

**3. TableColumnSettings prop (around line 301)** -- Show actions column for route_planner:
```typescript
<TableColumnSettings 
  columns={(userRole === "admin" || userRole === "route_planner") 
    ? ALL_COLUMNS 
    : ALL_COLUMNS.filter(col => col.id !== "actions")} 
  visibleColumns={visibleColumns} 
  onChange={handleColumnChange} 
/>
```

**4. Row click handler (line 187-190)** -- Navigate route planners to the admin page on row click:
```typescript
const handleRowClick = (orderId: string) => {
  if (userRole === "admin") return;
  if (userRole === "route_planner") {
    navigate(`/orders/${orderId}`);
    return;
  }
  navigate(`/customer-orders/${orderId}`);
};
```

## Summary

Four small edits in `OrderTable.tsx` to ensure route planners see the actions column (with the Admin button) and can click rows to navigate to the admin order detail page.
