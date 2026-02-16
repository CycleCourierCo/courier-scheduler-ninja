

# Fix: Allow Route Planners to Open Orders from Dashboard

## Root Cause

In `src/components/OrderTable.tsx`, when a non-admin user clicks an order row, they are navigated to `/customer-orders/{id}`. However, the `ProtectedRoute` component only permits `route_planner` access to `/scheduling`, `/dashboard`, and paths starting with `/orders/`. The `/customer-orders/` path is not in the allowlist, so the route planner is immediately redirected back to `/dashboard`.

## Solution

Update `src/components/ProtectedRoute.tsx` to also allow `route_planner` access to the `/customer-orders/` path.

### File: `src/components/ProtectedRoute.tsx`

Add a check for the customer order detail page alongside the existing order detail page check:

```typescript
const isOrderDetailPage = location.pathname.startsWith('/orders/');
const isCustomerOrderDetailPage = location.pathname.startsWith('/customer-orders/');
if (userProfile?.role === 'route_planner') {
  if (!isSchedulingPage && !isDashboardPage && !isOrderDetailPage && !isCustomerOrderDetailPage) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}
```

This is a single-line change that adds the customer order detail route to the route planner's permitted pages.

