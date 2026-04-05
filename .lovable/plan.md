
## Fix the false “cache is empty” state in Fuel Finder

### What’s actually wrong
The cache card is reading the wrong source.

In `src/pages/FuelFinderPage.tsx`:
- `cachedAt` comes from `stationData?.cached_at`
- `stationData` only exists after the search query runs
- that search query is gated by `enabled: !!searchParams`

So before the user presses “Find Diesel Stations”, `stationData` is `undefined`, which makes the admin card render:

- “Cache is empty — refresh required”

even when `fuel_station_cache` already contains thousands of rows.

This matches the screenshot exactly. The issue is not the table being empty; it’s the UI wiring.

### Implementation plan

1. Add a separate cache-status query in `src/pages/FuelFinderPage.tsx`
- Run this independently of station search
- Read from `fuel_station_cache`
- Return:
  - latest `cached_at`
  - total cached station count
  - optionally count of stations with non-null `diesel_price`

2. Stop using `stationData` to drive the cache-status card
- Replace:
  - `const cachedAt = stationData?.cached_at`
  - `const needsRefresh = stationData?.needs_refresh`
- With values derived from the new cache-status query

3. Show proper cache states in the card
- Loading: “Checking cache…”
- Success with data: “7,5xx stations cached” + “Last refreshed …”
- Empty only when the status query truly returns zero usable cached rows
- Error state if the query fails

4. Keep search results logic separate
- Leave the actual station search query tied to `searchParams`
- Continue filtering cached stations client-side after the user searches
- Only the status display changes

5. Gate the new status query on existing auth readiness
- Reuse `useAuth()`’s existing `user` / `isLoading` state
- Do not create a new auth hook unless needed
- This avoids firing the cache-status query before authentication is ready

### File to update
- `src/pages/FuelFinderPage.tsx`

### Technical details
Recommended shape for the new query:

```text
cacheStatusQuery:
  select cached_at
  filter diesel_price IS NOT NULL
  order by cached_at desc
  limit 1
  include exact count
```

Then derive:

```text
hasCache = count > 0
latestCachedAt = firstRow?.cached_at ?? null
```

UI logic becomes:

```text
if cacheStatusLoading -> "Checking cache..."
else if cacheStatusError -> "Unable to load cache status"
else if hasCache -> show count + last refreshed
else -> "Cache is empty — refresh required"
```

And keep the existing search query for actual results:

```text
search query enabled only after searchParams exists
```

### Expected result
- The “Station Price Cache” card will correctly show that the cache is populated before any search is run.
- Users will no longer see a misleading “empty” warning when the table already has data.
- Search behavior stays unchanged, but the status display becomes accurate and trustworthy.
