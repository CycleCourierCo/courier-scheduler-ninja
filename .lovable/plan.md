
## Fix the remaining Fuel Finder issue

### What’s actually happening
- The OAuth/auth fix appears to be in place.
- The edge logs now show `404 at batch 17: Requested batch 17 is not available`, which looks like the API’s normal “no more pages” signal.
- The UI then shows “No diesel stations found”, which suggests the function is returning an empty result set rather than crashing.
- Most likely cause: the `/pfs` and `/pfs/fuel-prices` success payloads are still being parsed incorrectly. The API appears to wrap responses in `data`, but the function currently only checks `data[key] || data`, so it can miss the real arrays.

### Plan
1. **Fix batch response parsing in `supabase/functions/fuel-finder/index.ts`**
   - Update `fetchAllBatches()` to unwrap all likely payload shapes:
     - `data[key]`
     - `data.data?.[key]`
     - `data.data`
     - direct array responses
   - Only append actual station/price rows, never wrapper objects.

2. **Treat end-of-pagination 404 as expected**
   - If a later batch returns “Requested batch X is not available”, stop fetching cleanly.
   - Do not log that case as an error.

3. **Add stricter payload validation**
   - If the API returns an unexpected shape, fail clearly instead of silently producing zero stations.
   - Validate that parsed station rows have coordinates and parsed price rows contain diesel values.

4. **Improve the frontend error state in `src/pages/FuelFinderPage.tsx`**
   - Use `isError` / `error` from the query to show a proper message when the edge function genuinely fails.
   - Keep “No diesel stations found” only for successful empty searches.

5. **Add light observability**
   - Wrap unexpected edge-function failures with the shared Sentry helper so future API shape changes are easier to diagnose.

### Technical details
```text
Likely current flow:
API success response -> { success: true, data: { petrol_filling_stations: [...] } }
current parser       -> data[key] || data
result               -> wrapper object instead of the array
effect               -> station/price extraction fails silently -> empty results
```

### Files to update
- `supabase/functions/fuel-finder/index.ts`
- `src/pages/FuelFinderPage.tsx`

### Expected result
- Depot search should return real stations again.
- Normal pagination 404s will stop appearing as errors in logs.
- Users will see a clear failure message only when the API truly fails.
