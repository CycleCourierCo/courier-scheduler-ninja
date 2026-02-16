

# Give Route Planners Access to the Admin Order Page

## Problem

When a route planner clicks an order from the dashboard, they are taken to the **customer order detail** page (`/customer-orders/:id`), which has limited information. They need access to the **admin order detail** page (`/orders/:id`) to see full scheduling and logistics details.

## Solution

Update `src/components/OrderTable.tsx` in two places:

### 1. Row click navigation (line 187-190)
Currently, only admins skip the customer-orders redirect. Update the logic so route planners also navigate to the admin order page:

```typescript
const handleRowClick = (orderId: string) => {
  if (userRole === "admin" || userRole === "route_planner") {
    return; // Don't navigate on row click (they use the Admin button)
  }
  navigate(`/customer-orders/${orderId}`);
};
```

### 2. Show the "Admin" view button (line 441)
Currently, only admins see the "Admin" button. Update the condition to include route planners:

```typescript
{(userRole === "admin" || userRole === "route_planner") && (
  <Button variant="outline" size="sm" asChild>
    <Link to={`/orders/${order.id}`}>
      <Eye className="h-4 w-4 mr-1" />
      Admin
    </Link>
  </Button>
)}
```

No database or routing changes are needed -- the `ProtectedRoute` already allows `route_planner` access to `/orders/:id`.

