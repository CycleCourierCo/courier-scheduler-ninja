

## Problem: Label Printing Only Shows 11 of 23 Pickups

### Root Cause
The `handlePrintLabels` function in `LoadingUnloadingPage.tsx` calls `getOrders()` which fetches ALL orders from the database, then filters client-side by date. However:

- Total orders in database: **2,979**
- `getOrders()` has `.limit(10000)` but Supabase PostgREST enforces a **server-side max of 1,000 rows**
- Only 1,000 orders are returned, and only 11 of those happen to have `scheduled_pickup_date` on March 10th
- The actual count for March 10th is **23 orders**

### Fix

Replace the client-side filtering approach with a **server-side filtered query**. Instead of fetching all orders and filtering in JavaScript, query only the orders needed for the selected date directly from Supabase.

**Changes to `src/services/orderService.ts`:**
- Add a new function `getOrdersByScheduledDate(date: string)` that queries orders where `scheduled_pickup_date` or `scheduled_delivery_date` falls on the given date
- This avoids the 1,000-row limit issue entirely since only relevant orders are fetched

**Changes to `src/pages/LoadingUnloadingPage.tsx`:**
- Update `handlePrintLabels` to use the new date-filtered query instead of `getOrders()`
- Pass the selected date to the query so filtering happens server-side

### New Query (in orderService.ts)
```typescript
export const getOrdersByScheduledPickupDate = async (date: string): Promise<Order[]> => {
  const startOfDay = `${date}T00:00:00.000Z`;
  const endOfDay = `${date}T23:59:59.999Z`;
  
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .gte("scheduled_pickup_date", startOfDay)
    .lte("scheduled_pickup_date", endOfDay);
  // ...
};
```

Similarly for delivery orders filtered by `scheduled_delivery_date`.

### Updated handlePrintLabels
- Import and call the new filtered functions instead of `getOrders()`
- Remove client-side date filtering since it's now done server-side

