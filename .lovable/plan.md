

# Allow Route Planner to See All Orders

## Problem
The `route_planner` role cannot see any orders on the dashboard because the RLS (Row Level Security) policy on the `orders` table only grants SELECT access to `admin` users or the order owner (`user_id = auth.uid()`). The client-side code already skips the user_id filter for route planners, but the database blocks the query at the RLS level.

Additionally, route planners cannot navigate to individual order detail pages (`/orders/:id`).

## Solution

Two changes are needed:

### 1. Database: Update RLS SELECT policy (orders table)

Modify the existing `orders_authenticated_select_policy` to also allow `route_planner` role to read all orders:

**Current policy logic:**
```
admin OR user_id = auth.uid()
```

**Updated policy logic:**
```
admin OR route_planner OR user_id = auth.uid()
```

The SQL will use the existing `has_role()` security definer function and the cached CTE pattern already established in the project.

### 2. Frontend: Allow route planner to access order detail pages

**File: `src/components/ProtectedRoute.tsx`** (around line 79)

Add `/orders/` path to the allowed routes for route_planner, so they can click into individual orders from the dashboard or scheduling page.

```
Allowed paths: /dashboard, /scheduling, /orders/:id
```

## What stays the same
- The client-side filtering in `getOrdersWithFilters` already handles `route_planner` correctly (line 140) -- no changes needed there.
- No other roles are affected.

