

## Fix: Bike-type pricing shows wrong revenue / missing jobs

### Root Cause

Two functions in `src/services/profitabilityService.ts` fetch orders **without any server-side filters**, relying on client-side filtering after the fact:

1. **`getRevenueForTimeslip`** (line 274): `supabase.from('orders').select(...)` with no `.eq()` or `.gte()` filters — returns only the first 1,000 rows (Supabase default limit). If the driver's orders for that date aren't in the first 1,000 rows, they're silently excluded, producing revenue for only 2 orders instead of the actual count.

2. **`calculateTotalJobsFromDriverDate`** (line 127): Same pattern — fetches all orders unfiltered, hits the 1,000-row cap, then filters client-side by date and driver name.

Both functions were written to work around OR-filter limitations (collection_driver OR delivery_driver), but the unfiltered fetch silently truncates results.

### Fix

**File: `src/services/profitabilityService.ts`**

1. **Add server-side date filtering** to both functions. The `scheduled_pickup_date` and `scheduled_delivery_date` columns are timestamps, so filter with `.gte()` / `.lt()` for the target date (e.g., `2025-04-05T00:00:00` to `2025-04-06T00:00:00`). This dramatically reduces the result set so it won't hit the 1,000-row limit.

2. **Add pagination as a safety net** — if either query might still exceed 1,000 rows (unlikely after date filtering), paginate in batches of 1,000.

3. **For `getRevenueForTimeslip`** (~line 274):
   ```
   // Instead of fetching ALL orders:
   // Fetch orders where pickup OR delivery date matches
   // Use two queries (one for pickup date, one for delivery date) and merge
   const startOfDay = `${date}T00:00:00`;
   const endOfDay = `${date}T23:59:59`;
   
   const [pickupRes, deliveryRes] = await Promise.all([
     supabase.from('orders')
       .select('id, bike_type, bike_quantity, bikes, user_id, collection_driver_name, delivery_driver_name, scheduled_pickup_date, scheduled_delivery_date')
       .gte('scheduled_pickup_date', startOfDay)
       .lte('scheduled_pickup_date', endOfDay),
     supabase.from('orders')
       .select('id, bike_type, bike_quantity, bikes, user_id, collection_driver_name, delivery_driver_name, scheduled_pickup_date, scheduled_delivery_date')
       .gte('scheduled_delivery_date', startOfDay)
       .lte('scheduled_delivery_date', endOfDay),
   ]);
   
   // Merge and deduplicate by order ID
   const allOrders = new Map();
   [...(pickupRes.data || []), ...(deliveryRes.data || [])].forEach(o => allOrders.set(o.id, o));
   const dateFilteredOrders = Array.from(allOrders.values());
   ```

4. **For `calculateTotalJobsFromDriverDate`** (~line 127): Apply the same two-query approach with date-scoped server filters.

5. **Count stops correctly**: Currently, each order contributes revenue once (halved per stop). But if a driver does both collection AND delivery for the same order on the same day, that's 2 stops worth of revenue. The current code deduplicates by order ID, counting it once. This may also undercount revenue. After the date fix, also check whether each order contributes 1 or 2 stops for the driver on that date (collection stop + delivery stop = 2x the per-stop revenue).

### Expected Result
- All orders for the date are found (not capped at 1,000)
- Revenue correctly reflects all jobs the driver completed that day
- The "Use bike type" toggle produces accurate totals matching the actual order count

