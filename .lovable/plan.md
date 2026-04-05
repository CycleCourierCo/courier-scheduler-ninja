

## Fix: Fuel Finder only returning 11 of 81 stations within 5 miles

### Root Cause
The database confirms **81 stations** within 5 miles of the depot have valid diesel prices. The frontend query uses `.range(0, 9999)` to override Supabase's default 1000-row limit, but the `as any` type cast on the table name is unnecessary (the `fuel_station_cache` table IS in the generated types) and may interfere with the query builder chain. Additionally, `.range(0, 9999)` can silently fail if the PostgREST server has a hard `max-rows` setting lower than 10,000.

The safer fix is twofold:
1. Remove the `as any` cast (types already exist for this table)
2. Add pagination to guarantee all rows are fetched regardless of server limits

### Changes — `src/pages/FuelFinderPage.tsx`

1. **Remove `as any` casts** on all `fuel_station_cache` queries — the table is already in the generated Supabase types, so the cast is unnecessary and may suppress query builder errors.

2. **Add a radius selector dropdown** to the search form for depot mode with options: 2, 5, 10, 15, 25 miles. Default to 10 miles.

3. **Paginate the cache query** — instead of a single `.range(0, 9999)`, fetch in batches of 1000 and concatenate, guaranteeing all rows are returned regardless of server config:
   ```
   let all = [], from = 0, batchSize = 1000;
   while (true) {
     const { data } = await supabase
       .from("fuel_station_cache")
       .select("*")
       .not("diesel_price", "is", null)
       .range(from, from + batchSize - 1);
     if (!data || data.length === 0) break;
     all.push(...data);
     if (data.length < batchSize) break;
     from += batchSize;
   }
   ```

4. **Use the radius state** in the filtering logic (line 178) instead of hardcoded `5`:
   ```
   const radiusKm = radiusMiles * MILES_TO_KM;
   ```

5. **Add the radius `<Select>` dropdown** next to the search button (depot mode only) with options: 2 mi, 5 mi, 10 mi, 15 mi, 25 mi.

### File
- `src/pages/FuelFinderPage.tsx`

