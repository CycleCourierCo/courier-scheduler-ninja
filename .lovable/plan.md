

## Fix: Fuel Finder returning 0 results due to Supabase 1000-row limit

### Root Cause
The frontend queries `fuel_station_cache` with `.select("*").not("diesel_price", "is", null)` — Supabase returns a maximum of 1,000 rows by default. The cache has ~7,600 stations, so most are silently dropped. The 1,000 returned may not include stations near the depot, causing the distance filter to yield 0 results.

### Fix
In `src/pages/FuelFinderPage.tsx`, change the query at line ~143-146 to fetch in pages or use a larger limit. Since the table is unlikely to exceed 10,000 rows, the simplest fix is to set an explicit range:

```typescript
const { data: cached, error } = await supabase
  .from("fuel_station_cache" as any)
  .select("*")
  .not("diesel_price", "is", null)
  .range(0, 9999);
```

Alternatively, if the dataset grows beyond 10K, paginate with multiple requests.

### Files
- `src/pages/FuelFinderPage.tsx` — add `.range(0, 9999)` to the cache query

